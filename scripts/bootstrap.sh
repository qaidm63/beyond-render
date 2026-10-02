#!/usr/bin/env bash
# Shadow Matrix — rebuild the local dev environment.
#
# The virtualenv, node_modules and .env files are intentionally NOT in git
# (dependencies are reproducible; .env holds secrets). Some sandboxes also
# discard them between sessions. This script restores everything that is
# derivable, and tells you clearly if a secret file is missing.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Python environment"
[ -d .venv ] || python3 -m venv .venv
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r backend/requirements.txt
echo "    ok"

echo "==> Node environment"
(cd frontend && npm install --silent)
echo "    ok"

echo "==> Secrets"
missing=0
for f in .env frontend/.env.local; do
  if [ -f "$f" ]; then
    echo "    found $f"
  else
    echo "    MISSING $f  (copy from .env.example and fill in)"
    missing=1
  fi
done

echo
if [ "$missing" -eq 1 ]; then
  echo "Create the missing env file(s), then start the servers:"
else
  echo "Ready. Start the servers:"
fi
cat <<'USAGE'
  .venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000
  cd frontend && npm run dev
USAGE
