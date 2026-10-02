# Shadow Matrix & Smart Portfolio

A hybrid system: a dynamic architectural portfolio fronting an autonomous
recruitment agent that discovers roles, scores them semantically, and generates
tailored pitch pages per company.

Built to `Shadow_Matrix_Final_Blueprint` — see
[`docs/SHADOW_MATRIX_EXECUTION_PLAN.md`](docs/SHADOW_MATRIX_EXECUTION_PLAN.md).

**Status: Phase 4 complete** (foundation · swarm & pgvector · Command Center · agents, alerts & scheduling).

## Architecture

```
frontend/   React 19 + TypeScript + Vite + Tailwind 4
backend/    Python 3.11 + FastAPI  (agent swarm)
            Supabase (PostgreSQL + pgvector)
```

### Routes
| Path | Audience | Status |
|---|---|---|
| `/` | Public visitors | Live |
| `/vip/:companyId` | Recruiters (dynamic pitch) | Live — approved pitches only |
| `/matrix-admin` | Operator (Command Center) | Live — Supabase Auth + allowlist |

### The Swarm (Blueprint § 4)
1. **XHR / GraphQL Engine** (~80%) — direct JSON interception on open gateways.
2. **Vision & DOM Engine** (~20%) — Playwright fallback for anti-bot platforms,
   using an operator-supplied `backend/cookies.json`.
3. **Semantic Gatekeeper** — pgvector similarity against portfolio embeddings;
   anything under `matchingThreshold` is discarded before it reaches the UI.

## Running locally

**Prerequisites:** Node.js 20+, Python 3.11+

```bash
# 1. Secrets (once)
cp .env.example .env               # fill in real values
#    frontend/.env.local needs the two public VITE_* values

# 2. Install everything
./scripts/bootstrap.sh

# 3. Run (two terminals)
.venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
cd frontend && npm run dev         # http://localhost:5173, proxies /api -> :8000
```

`scripts/bootstrap.sh` rebuilds the virtualenv and `node_modules` and reports
any missing env file. None of those are tracked in git — dependencies are
reproducible, and env files hold secrets.

API docs: `http://localhost:8000/api/docs`

## Documentation

- [`docs/SHADOW_MATRIX_EXECUTION_PLAN.md`](docs/SHADOW_MATRIX_EXECUTION_PLAN.md) — phased plan
- [`docs/PHASE_2_OPERATIONS.md`](docs/PHASE_2_OPERATIONS.md) — schema, ingestion, sweeps
- [`docs/PHASE_3_OPERATIONS.md`](docs/PHASE_3_OPERATIONS.md) — auth model, Command Center
- [`docs/PHASE_4_OPERATIONS.md`](docs/PHASE_4_OPERATIONS.md) — Tailor & Analyst agents,
  Telegram gateway, periodic scheduler, and their guard rails

## Security

- `.env` and `backend/cookies.json` are git-ignored and must never be committed.
- The Supabase **secret/service key is server-side only** and never reaches the browser.
- The browser calls relative `/api/*` paths; Vite (dev) or the reverse proxy
  (prod) forwards them to FastAPI.
- No automated login, no 2FA bypass, no fabricated credentials. Browser sessions
  are exported manually by the system operator.
- Operator JWTs are verified server-side on every protected request;
  `ProtectedRoute` only controls rendering. Authorisation requires an explicit
  `ADMIN_EMAILS` allowlist — a valid Supabase user is not automatically an
  operator.
- `frontend/.env.local` holds public `VITE_*` values only; Vite inlines them
  into the bundle.
