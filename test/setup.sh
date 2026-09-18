#!/usr/bin/env bash
# Installs what test/run.py needs on a fresh Debian/Ubuntu container.
# Idempotent; safe to re-run after a pod restart.
set -euo pipefail
sudo apt-get update -qq 2>/dev/null || true   # a stale third-party keyring may warn; Debian repos still work
sudo apt-get install -y -qq nodejs chromium fonts-dejavu-core fonts-liberation fonts-roboto
python3 -m pip install -q --user "playwright==1.63.0"
node --version && chromium --version && python3 -c "import playwright; print('playwright ok')"
