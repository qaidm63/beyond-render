"""
Scout Layer 2 — Vision & DOM Engine.
Blueprint § 4.2: the emergency path, ~20% of coverage.

Strategy: drive Playwright to emulate genuine browsing against anti-bot
protected platforms (LinkedIn). The script loads `cookies.json`, which the
system operator exports MANUALLY from an already-authenticated session, in
order to pass login walls.

EXPLICIT PROHIBITION (Blueprint closing note)
---------------------------------------------
This engine NEVER attempts to log in, NEVER handles 2FA, and NEVER fabricates
credentials. If the session file is absent or expired it fails loudly and
defers to the operator. There is no automated recovery path by design.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote_plus

from backend.agents.scout.normalise import (
    clean_text,
    detect_remote,
    fingerprint,
    slugify,
)
from backend.core.config import SearchConfiguration
from backend.core.schemas import JobOpportunity, ScoutEngine
from backend.core.secrets import cookies_available, load_browser_cookies

logger = logging.getLogger("shadow-matrix.scout.dom")

SUPPORTED_SOURCES: tuple[str, ...] = ("linkedin",)

LINKEDIN_SEARCH = "https://www.linkedin.com/jobs/search/?keywords={terms}&location={location}"

# Conservative pacing. We are a guest on these platforms: slow, bounded,
# single-session browsing only.
NAVIGATION_TIMEOUT_MS = 45_000
SETTLE_MS = 2_500
MAX_CARDS_PER_TERM = 25

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)


class DomEngineError(RuntimeError):
    """Raised when the browser layer cannot run at all."""


class SessionExpiredError(DomEngineError):
    """
    The operator-supplied session is no longer valid.

    Recovery is a MANUAL action: re-export cookies.json from a browser where
    the operator is signed in. We never attempt to re-authenticate.
    """


def session_ready() -> bool:
    """True when an operator-provided browser session file is present."""
    return cookies_available()


def _normalise_cookies(raw: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Coerce exported cookies into Playwright's expected shape.

    Browser extensions export `sameSite` values Playwright rejects, and
    session cookies carry `expirationDate` floats instead of `expires`.
    """
    cleaned: list[dict[str, Any]] = []
    for cookie in raw:
        name, value = cookie.get("name"), cookie.get("value")
        if not name or value is None:
            continue

        entry: dict[str, Any] = {
            "name": name,
            "value": value,
            "domain": cookie.get("domain", ".linkedin.com"),
            "path": cookie.get("path", "/"),
            "httpOnly": bool(cookie.get("httpOnly", False)),
            "secure": bool(cookie.get("secure", True)),
        }

        same_site = str(cookie.get("sameSite", "Lax")).lower()
        entry["sameSite"] = {
            "lax": "Lax",
            "strict": "Strict",
            "none": "None",
            "no_restriction": "None",
            "unspecified": "Lax",
        }.get(same_site, "Lax")

        expires = cookie.get("expires", cookie.get("expirationDate"))
        if isinstance(expires, (int, float)) and expires > 0:
            entry["expires"] = float(expires)

        cleaned.append(entry)
    return cleaned


async def _harvest(
    page: Any,
    term: str,
    location: str,
) -> list[JobOpportunity]:
    """Extract job cards from one LinkedIn search results page."""
    url = LINKEDIN_SEARCH.format(terms=quote_plus(term), location=quote_plus(location))
    await page.goto(url, timeout=NAVIGATION_TIMEOUT_MS, wait_until="domcontentloaded")
    await page.wait_for_timeout(SETTLE_MS)

    if "/authwall" in page.url or "/login" in page.url:
        raise SessionExpiredError(
            "LinkedIn redirected to the login wall. The supplied cookies.json "
            "has expired. Re-export it manually from an authenticated browser "
            "session — automated login is out of scope."
        )

    cards = await page.evaluate(
        """
        () => {
          const nodes = document.querySelectorAll(
            '.jobs-search__results-list li, .scaffold-layout__list-item, [data-job-id]'
          );
          return Array.from(nodes).slice(0, 25).map((node) => {
            const pick = (sels) => {
              for (const s of sels) {
                const el = node.querySelector(s);
                if (el && el.textContent.trim()) return el.textContent.trim();
              }
              return null;
            };
            const link = node.querySelector('a[href*="/jobs/view/"]');
            return {
              title: pick(['.base-search-card__title', '.job-card-list__title', 'h3']),
              company: pick(['.base-search-card__subtitle', '.job-card-container__company-name', 'h4']),
              location: pick(['.job-search-card__location', '.job-card-container__metadata-item']),
              url: link ? link.href.split('?')[0] : null,
            };
          });
        }
        """
    )

    harvested: list[JobOpportunity] = []
    for card in cards[:MAX_CARDS_PER_TERM]:
        title = clean_text(card.get("title"), 300)
        company = clean_text(card.get("company"), 300)
        job_url = clean_text(card.get("url"), 1000)
        if not title or not company or not job_url:
            continue

        card_location = clean_text(card.get("location"), 300)
        harvested.append(
            JobOpportunity(
                fingerprint=fingerprint("linkedin", job_url, title, company),
                title=title,
                company=company,
                companyId=slugify(company),
                location=card_location,
                url=job_url,
                source="linkedin",
                engine=ScoutEngine.DOM,
                # Search cards carry no body text; the Analyst scores on the
                # title/company/location signal unless a detail pass is run.
                description=None,
                isRemote=detect_remote(card_location, None),
                discoveredAt=datetime.now(timezone.utc),
            )
        )
    return harvested


async def fetch(
    config: SearchConfiguration,
    search_terms: list[str],
    *,
    headless: bool = True,
) -> list[JobOpportunity]:
    """
    Scrape protected platforms behind an operator-supplied session.

    Raises SessionExpiredError when the session is dead — a human must act.
    """
    cookies = _normalise_cookies(load_browser_cookies())
    if not cookies:
        raise DomEngineError("cookies.json contained no usable cookies.")

    try:
        from playwright.async_api import async_playwright
    except ImportError as exc:  # pragma: no cover
        raise DomEngineError(
            "Playwright is not installed. Run: "
            "pip install -r backend/requirements.txt && playwright install chromium"
        ) from exc

    location = next(
        (loc for loc in config.targetLocations if loc.lower() != "remote"),
        "Worldwide",
    )
    collected: list[JobOpportunity] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=headless)
        try:
            context = await browser.new_context(user_agent=USER_AGENT)
            await context.add_cookies(cookies)
            page = await context.new_page()

            for term in search_terms:
                try:
                    found = await _harvest(page, term, location)
                    logger.info("DOM '%s' -> %d cards", term, len(found))
                    collected.extend(found)
                except SessionExpiredError:
                    raise  # operator must intervene; abort the sweep
                except Exception as exc:  # noqa: BLE001 - isolate per-term
                    logger.warning("DOM sweep failed for '%s': %s", term, exc)
                # Deliberate pacing between searches.
                await asyncio.sleep(2.0)
        finally:
            await browser.close()

    return collected
