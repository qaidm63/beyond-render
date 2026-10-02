# Phase 2 — Operations Guide

Everything built in Phase 2 and how to run it.

## 1. Apply the database schema

The pgvector schema is **not** auto-applied; run it once against Supabase:

```bash
psql "$DATABASE_URL" -f backend/db/schema.sql
```

or paste `backend/db/schema.sql` into the Supabase SQL editor. It is
idempotent — safe to re-run.

Creates: `projects`, `project_embeddings` (vector(768)), `jobs`,
`agent_config` (seeded singleton), `pitches`, `telemetry_events`, the
`match_portfolio()` RPC, and RLS on every table.

> **Embedding width is load-bearing.** `vector(768)` matches Gemini
> `text-embedding-004`. Changing the model means changing the column width in
> `schema.sql`, `EMBEDDING_DIMENSIONS` in `core/config.py`, and re-embedding
> everything. The provider raises rather than silently truncating.

## 2. Ingest the portfolio

```bash
.venv/bin/python -m backend.ingest --dry-run   # show the plan
.venv/bin/python -m backend.ingest             # embed changed projects
.venv/bin/python -m backend.ingest --force     # re-embed everything
```

Idempotent: a project whose `sha256(document + model)` is unchanged is skipped,
so re-runs cost no API quota.

**Safety guard:** ingestion refuses to write offline hashing vectors to the
database. Those carry no semantic meaning and would silently corrupt every
future Fit Score. Override only for scratch environments with
`--offline --allow-offline-writes`.

## 3. Run a sweep

```bash
.venv/bin/python -m backend.pipeline --dry-run  # no persistence
.venv/bin/python -m backend.pipeline            # full cycle
.venv/bin/python -m backend.pipeline --no-dom   # skip Layer 2
```

Or via the API: `POST /api/scout/run`.

## 4. The three layers

| Layer | Module | Coverage | Notes |
|---|---|---|---|
| 1. XHR/GraphQL | `agents/scout/xhr_engine.py` | ~80% | `python-jobspy` against open gateways. Per-term failures are isolated. |
| 2. Vision & DOM | `agents/scout/dom_engine.py` | ~20% | Playwright + operator `cookies.json`. Skipped gracefully when absent. |
| 3. Semantic Gatekeeper | `agents/analyst.py` | 100% of output | pgvector similarity; below-threshold jobs never reach the Radar. |

`agents/scout/router.py` orchestrates all three, de-duplicates by fingerprint,
and applies a cheap structural pre-filter **before** any embedding call — that
pre-filter is a cost control, and it is deliberately permissive: a missing
signal never rejects a job.

## 5. Supplying the browser session (Layer 2)

Layer 2 needs `backend/cookies.json`, exported **manually** by you from a
browser already signed in to LinkedIn. Accepted formats: a plain JSON array of
cookie objects, or a Playwright `storage_state` object.

```bash
playwright install chromium   # one-time, needs network
```

The system never logs in, never touches 2FA, and never fabricates credentials.
When the session expires the sweep reports
`OPERATOR ACTION REQUIRED` and defers to you.

## 6. Tests

```bash
.venv/bin/python -m pytest
```

81 tests, fully offline — no network, no database. They cover normalisation,
de-duplication, vector maths, the gatekeeper threshold boundary, sweep
resilience when a layer dies, and the credential policy (including a test
asserting the DOM engine exposes no login helper).

## 7. API surface

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | liveness + database status |
| GET | `/api/health/dependencies` | secret/session audit (presence only, never values) |
| GET | `/api/config` | live SearchConfiguration |
| POST | `/api/ingest` | embed the portfolio |
| POST | `/api/scout/run` | run one sweep |
| GET | `/api/jobs` | read the pipeline |
| GET | `/api/admin/session` | 401 until Phase 3 |

## 8. Single source of truth

`shared/portfolio_evidence.json` is read by **both** `frontend/src/constants.ts`
and `backend/core/portfolio.py`. Edit the JSON — never the TS file — so the
embeddings can never drift from what the site displays. After editing, re-run
ingestion.
