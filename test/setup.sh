#!/usr/bin/env bash
# Installs what test/run.py needs on a fresh Debian/Ubuntu container.
# Idempotent; safe to re-run after a pod restart.
set -euo pipefail
sudo apt-get update -qq 2>/dev/null || true   # a stale third-party keyring may warn; Debian repos still work
sudo apt-get install -y -qq nodejs npm chromium fonts-dejavu-core fonts-liberation fonts-roboto fonts-noto-color-emoji
python3 -m pip install -q --user "playwright==1.63.0" pillow
# WebKit (Safari's engine) for `test/run.py --browser webkit`; Chromium comes from apt above.
# install-deps needs root but must see the user's playwright module, hence the env.
sudo env PATH="$PATH" HOME="$HOME" PYTHONUSERBASE="$HOME/.local" python3 -m playwright install-deps webkit
python3 -m playwright install webkit
node --version && chromium --version && python3 -c "import playwright; print('playwright ok')"
