# Phase 3 — Command Center & VIP Route

## Auth decision: Supabase Auth

The blueprint specified a "Protected Route" without naming a mechanism. The
supplied `SUPABASE_JWKS_URL` and anon key only make sense for Supabase Auth, so
that is what was built.

**The model:**

1. The operator signs in with email/password via `supabase-js` in the browser.
2. Every API call carries that JWT as a Bearer token.
3. The backend verifies the signature, expiry and audience **server-side** on
   every protected request.
4. Authorisation is a separate, explicit allowlist: `ADMIN_EMAILS`.

> A valid Supabase user is **not** an operator. Anyone can sign up to a Supabase
> project, so authentication alone must never grant Command Center access. The
> allowlist is the authorisation boundary; without it, auth is reported as *not
> configured* and the route stays sealed.

`ProtectedRoute` in React controls only what is **rendered**. Bypassing it in
devtools yields nothing but 401s, because the gate is in FastAPI.

### Setup

1. Create the operator user in Supabase → Authentication → Users.
2. Set in `.env`:
   ```
   SUPABASE_JWKS_URL="https://<project>.supabase.co/auth/v1/.well-known/jwks.json"
   ADMIN_EMAILS="you@example.com"
   ```
   Legacy HS256 projects may instead set `SUPABASE_JWT_SECRET`.
3. Set in `frontend/.env.local` (public values only):
   ```
   VITE_SUPABASE_URL="https://<project>.supabase.co"
   VITE_SUPABASE_ANON_KEY="<anon key>"
   ```

### Token algorithm routing

The token's own `alg` header selects the verifier family (RS256/ES256 → JWKS,
HS256 → shared secret). This is deliberate: a naive "try asymmetric, then fall
back to symmetric" chain reports an **invalid** token as *auth not configured*
(503) instead of *rejected* (401) whenever no HS256 secret is set — masking an
authentication failure as an outage.

The header is untrusted input, so it only ever **chooses** a verifier, never
weakens one. `jwt.decode` is always pinned to an explicit algorithm allowlist,
which is what makes an `alg: none` forgery fail.

| Situation | Response |
|---|---|
| No token | 401 |
| Expired / tampered / wrong audience | 401 |
| Valid token, email not allowlisted | 401 *(same detail string — no oracle)* |
| `alg: none` forgery | 401 |
| Valid operator | 200 |
| Verifier material unavailable | 503 |

## Command Center modules (`/matrix-admin`)

| Module | Blueprint | What it does |
|---|---|---|
| **Radar** | § 5.1 | Kanban over the four pipeline stages; optimistic card moves that roll back on failure |
| **Swarm Configurator** | § 5.2 | Live `SearchConfiguration` toggles, threshold slider, "Run sweep now" |
| **Pitch Studio** | § 5.3 | Approve/unpublish pitches, copy the VIP link, preview |
| **Telemetry** | § 5.4 | Conversion counters, recruiter views, manual re-ingestion |

## VIP route (`/vip/:companyId`)

Public and unauthenticated — the link *is* the product. It serves only
**approved** pitches; a draft returns 404 so an unfinished cover letter can
never leak. Each load records a `pitch_view` telemetry event, which is what
feeds "recruiter views".

Project bodies come from `shared/portfolio_evidence.json` rather than the
database, so page content cannot drift from the live portfolio.

## Bundle split

The admin console and the Supabase client are lazy-loaded. A visitor reading
the portfolio downloads 590 kB; the 229 kB auth/API chunk loads only on
`/matrix-admin` and `/vip/*`.

## Tests

```bash
.venv/bin/python -m pytest      # 105 tests, fully offline
```

`backend/tests/test_auth.py` pins the security boundary: expiry, tampering,
wrong audience, missing `exp`, `alg: none` forgery, allowlist enforcement, the
cookie fallback, and that failure details are indistinguishable between
expired / forged / not-allowlisted (no enumeration oracle).
