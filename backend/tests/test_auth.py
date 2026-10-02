"""
Operator authentication — the security boundary of the Command Center.

These tests use locally generated HS256 tokens; no network, no Supabase.
"""

from __future__ import annotations

import time

import jwt
import pytest
from fastapi import HTTPException
from starlette.datastructures import Headers
from starlette.requests import Request

from backend.core import auth

SECRET = "test-jwt-secret"
OPERATOR_EMAIL = "operator@example.com"


def make_token(
    *,
    email: str = OPERATOR_EMAIL,
    sub: str = "user-123",
    exp_delta: int = 3600,
    audience: str | None = "authenticated",
    secret: str = SECRET,
    algorithm: str = "HS256",
    omit_exp: bool = False,
) -> str:
    claims: dict = {"sub": sub, "email": email, "role": "authenticated"}
    if audience is not None:
        claims["aud"] = audience
    if not omit_exp:
        claims["exp"] = int(time.time()) + exp_delta
    return jwt.encode(claims, secret, algorithm=algorithm)


def make_request(token: str | None = None, cookie: str | None = None) -> Request:
    headers = []
    if token:
        headers.append((b"authorization", f"Bearer {token}".encode()))
    if cookie:
        headers.append((b"cookie", f"sm_access_token={cookie}".encode()))
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/admin/session",
        "headers": headers,
        "query_string": b"",
    }
    return Request(scope)


@pytest.fixture
def configured(monkeypatch):
    """Symmetric-only configuration: no JWKS, explicit allowlist."""
    values = {
        "SUPABASE_JWT_SECRET": SECRET,
        "ADMIN_EMAILS": f"{OPERATOR_EMAIL}, Second@Example.com ",
        "SUPABASE_JWKS_URL": None,
    }
    monkeypatch.setattr(
        auth, "get_secret", lambda name, default=None: values.get(name, default)
    )
    monkeypatch.setattr(auth, "_get_jwks_client", lambda: None)
    return values


class TestAllowlist:
    def test_parses_and_normalises(self, configured):
        assert auth.admin_emails() == {OPERATOR_EMAIL, "second@example.com"}

    def test_empty_allowlist_means_not_configured(self, monkeypatch):
        monkeypatch.setattr(
            auth,
            "get_secret",
            lambda name, default=None: {"SUPABASE_JWT_SECRET": SECRET}.get(
                name, default
            ),
        )
        # A verifier without an allowlist is NOT configured: otherwise anyone
        # who can sign up to the Supabase project becomes an operator.
        assert auth.auth_configured() is False

    def test_verifier_plus_allowlist_is_configured(self, configured):
        assert auth.auth_configured() is True


class TestDecodeToken:
    def test_accepts_valid_token(self, configured):
        claims = auth.decode_token(make_token())
        assert claims["email"] == OPERATOR_EMAIL
        assert claims["sub"] == "user-123"

    def test_rejects_expired(self, configured):
        with pytest.raises(ValueError):
            auth.decode_token(make_token(exp_delta=-10))

    def test_rejects_wrong_signature(self, configured):
        with pytest.raises(ValueError):
            auth.decode_token(make_token(secret="attacker-secret"))

    def test_rejects_missing_expiry(self, configured):
        # A token without exp would never expire — must not be accepted.
        with pytest.raises(ValueError):
            auth.decode_token(make_token(omit_exp=True))

    def test_rejects_wrong_audience(self, configured):
        with pytest.raises(ValueError):
            auth.decode_token(make_token(audience="some-other-service"))

    def test_rejects_alg_none_forgery(self, configured):
        """The classic JWT attack: unsigned token claiming alg=none."""
        forged = jwt.encode(
            {"sub": "x", "email": OPERATOR_EMAIL, "aud": "authenticated",
             "exp": int(time.time()) + 600},
            key="",
            algorithm="none",
        )
        with pytest.raises(ValueError):
            auth.decode_token(forged)

    def test_raises_when_no_verifier_configured(self, monkeypatch):
        monkeypatch.setattr(auth, "get_secret", lambda name, default=None: default)
        monkeypatch.setattr(auth, "_get_jwks_client", lambda: None)
        with pytest.raises(auth.AuthNotConfiguredError):
            auth.decode_token(make_token())


@pytest.mark.asyncio
class TestCurrentOperator:
    async def test_authorises_allowlisted_operator(self, configured):
        operator = await auth.current_operator(make_request(make_token()))
        assert operator.email == OPERATOR_EMAIL
        assert operator.user_id == "user-123"

    async def test_accepts_cookie_fallback(self, configured):
        operator = await auth.current_operator(make_request(cookie=make_token()))
        assert operator.email == OPERATOR_EMAIL

    async def test_email_match_is_case_insensitive(self, configured):
        token = make_token(email="SECOND@EXAMPLE.COM")
        assert (await auth.current_operator(make_request(token))).email == (
            "second@example.com"
        )

    async def test_rejects_missing_credentials(self, configured):
        with pytest.raises(HTTPException) as exc:
            await auth.current_operator(make_request())
        assert exc.value.status_code == 401

    async def test_rejects_valid_token_not_on_allowlist(self, configured):
        """
        THE critical case: a genuine Supabase user who is not the operator.
        Anyone can sign up; authentication must not imply authorisation.
        """
        token = make_token(email="stranger@example.com")
        with pytest.raises(HTTPException) as exc:
            await auth.current_operator(make_request(token))
        assert exc.value.status_code == 401

    async def test_rejects_token_without_email(self, configured):
        token = jwt.encode(
            {"sub": "x", "aud": "authenticated", "exp": int(time.time()) + 600},
            SECRET,
            algorithm="HS256",
        )
        with pytest.raises(HTTPException) as exc:
            await auth.current_operator(make_request(token))
        assert exc.value.status_code == 401

    async def test_error_detail_does_not_leak_reason(self, configured):
        """Expired vs forged vs not-allowlisted must be indistinguishable."""
        expired = make_request(make_token(exp_delta=-10))
        forged = make_request(make_token(secret="bad"))
        stranger = make_request(make_token(email="stranger@example.com"))

        details = []
        for request in (expired, forged, stranger):
            with pytest.raises(HTTPException) as exc:
                await auth.current_operator(request)
            details.append(exc.value.detail)
        assert len(set(details)) == 1

    async def test_503_when_auth_not_configured(self, monkeypatch):
        monkeypatch.setattr(auth, "auth_configured", lambda: False)
        with pytest.raises(HTTPException) as exc:
            await auth.current_operator(make_request(make_token()))
        assert exc.value.status_code == 503


class TestAlgorithmRouting:
    """
    The token's `alg` header selects the verifier family. Getting this wrong
    turns an authentication failure into a misleading 503.
    """

    def test_invalid_symmetric_token_is_rejected_not_misreported(self, configured):
        with pytest.raises(ValueError):
            auth.decode_token(make_token(secret="wrong"))

    def test_asymmetric_token_without_jwks_reports_misconfiguration(
        self, monkeypatch
    ):
        monkeypatch.setattr(
            auth,
            "get_secret",
            lambda name, default=None: {
                "ADMIN_EMAILS": OPERATOR_EMAIL,
                "SUPABASE_JWKS_URL": "https://example.test/jwks.json",
            }.get(name, default),
        )
        monkeypatch.setattr(auth, "_get_jwks_client", lambda: None)

        # A well-formed RS256 header with a junk signature, assembled by hand
        # so no private key is needed.
        import base64
        import json as _json

        def b64(raw: bytes) -> str:
            return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()

        rs_token = ".".join(
            [
                b64(_json.dumps({"alg": "RS256", "typ": "JWT"}).encode()),
                b64(_json.dumps({"sub": "x"}).encode()),
                b64(b"not-a-real-signature"),
            ]
        )
        with pytest.raises(auth.AuthNotConfiguredError):
            auth.decode_token(rs_token)

    def test_unsupported_algorithm_is_a_rejection(self, configured):
        token = jwt.encode({"sub": "x"}, key="", algorithm="none")
        with pytest.raises(ValueError, match="Unsupported token algorithm"):
            auth.decode_token(token)

    def test_garbage_is_a_rejection_not_a_crash(self, configured):
        with pytest.raises(ValueError, match="Malformed token"):
            auth.decode_token("not-a-jwt-at-all")


@pytest.mark.asyncio
class TestFailureCodes:
    async def test_bad_symmetric_token_yields_401(self, configured):
        with pytest.raises(HTTPException) as exc:
            await auth.current_operator(make_request(make_token(secret="wrong")))
        assert exc.value.status_code == 401

    async def test_garbage_token_yields_401(self, configured):
        with pytest.raises(HTTPException) as exc:
            await auth.current_operator(make_request("garbage"))
        assert exc.value.status_code == 401
