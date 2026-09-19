#!/usr/bin/env bash
# Installs what test/run.py needs on a Debian/Ubuntu container.
#
# The dev container image (mkshb/homelab, hass-production/sidecar) ships Node,
# Chromium, the fonts and Playwright with both browsers, so on that image every
# step below is a no-op and the script finishes in a second. It stays as the
# fallback for a plain container, and as the repair after a pod restart on an
# image that predates the toolchain.
set -euo pipefail

PLAYWRIGHT_VERSION="${PLAYWRIGHT_VERSION:-1.63.0}"   # same pin as .github/workflows/tests.yaml
BROWSERS_DIR="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"

have() { command -v "$1" >/dev/null 2>&1; }
note() { echo "[setup] $*"; }

# `apt-get update` fails as a whole when a third-party repo carries a rotated
# signing key, and Playwright's install-deps treats that failure as fatal. The
# GitHub CLI repo is part of the dev image, so refresh its keyring when it is
# the one complaining.
apt_update() {
  local out
  out="$(sudo apt-get update -qq 2>&1 || true)"
  if grep -q "NO_PUBKEY\|is not signed" <<<"$out" && grep -rqs "cli.github.com" /etc/apt/sources.list.d/; then
    note "refreshing the GitHub CLI keyring (rotated signing key)"
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg status=none
    sudo chmod 644 /usr/share/keyrings/githubcli-archive-keyring.gpg
    out="$(sudo apt-get update -qq 2>&1 || true)"
  fi
  grep -q "NO_PUBKEY\|is not signed" <<<"$out" && note "warning: an apt repo stays unsigned:" && echo "$out" >&2
  return 0
}

# --- apt packages -----------------------------------------------------------
pkgs=()
have node && have npm || pkgs+=(nodejs npm)
have chromium || pkgs+=(chromium)
for f in fonts-dejavu-core fonts-liberation fonts-roboto fonts-noto-color-emoji; do
  dpkg -s "$f" >/dev/null 2>&1 || pkgs+=("$f")
done

if [ ${#pkgs[@]} -gt 0 ]; then
  note "installing: ${pkgs[*]}"
  apt_update
  sudo apt-get install -y -qq "${pkgs[@]}"
else
  note "node, chromium and the fonts are present"
fi

# --- python packages --------------------------------------------------------
if python3 -c "import playwright, PIL" 2>/dev/null; then
  note "playwright $(python3 -m playwright --version | awk '{print $2}') and pillow are present"
else
  note "installing playwright==${PLAYWRIGHT_VERSION} and pillow"
  python3 -m pip install -q --user "playwright==${PLAYWRIGHT_VERSION}" pillow
fi

# --- browsers ---------------------------------------------------------------
# Chromium for the screenshots comes from apt above; WebKit (Safari's engine,
# what the iOS companion app renders in) only exists as Playwright's build.
if compgen -G "$BROWSERS_DIR/webkit-*" >/dev/null; then
  note "webkit is installed in $BROWSERS_DIR"
elif [ -e "$BROWSERS_DIR" ] && [ ! -w "$BROWSERS_DIR" ]; then
  note "warning: $BROWSERS_DIR is not writable and carries no webkit."
  note "It belongs to the image: rebuild the sidecar image instead, or set"
  note "PLAYWRIGHT_BROWSERS_PATH to a writable directory and re-run."
else
  note "installing the webkit browser and its system packages"
  apt_update
  # install-deps needs root but must see the user's playwright module.
  sudo env PATH="$PATH" HOME="$HOME" PYTHONUSERBASE="$HOME/.local" \
       PLAYWRIGHT_BROWSERS_PATH="$BROWSERS_DIR" python3 -m playwright install-deps webkit
  python3 -m playwright install webkit
fi

node --version && chromium --version && python3 -m playwright --version
