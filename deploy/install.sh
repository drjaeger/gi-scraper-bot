#!/usr/bin/env bash
# Builds the bot and installs it as a systemd timer on this machine.
# Usage: ./deploy/install.sh [interval]   (default 10min; systemd syntax e.g. 5min, 1h)
# Safe to re-run — use it after `git pull` to rebuild and reload.
set -euo pipefail

INTERVAL="${1:-10min}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$(command -v node || true)"
USER_NAME="$(id -un)"

if [[ -z "$NODE" ]]; then
  echo "node not found in PATH — install Node.js 22+ first (see README)" >&2
  exit 1
fi
NODE_MAJOR="$("$NODE" -p 'process.versions.node.split(".")[0]')"
if (( NODE_MAJOR < 22 )); then
  echo "Node $NODE_MAJOR found, need 22+ (see README)" >&2
  exit 1
fi

cd "$DIR"
if [[ ! -f .env ]]; then
  echo "No .env found — copy .env.example to .env and fill in DISCORD_WEBHOOK_URL first" >&2
  exit 1
fi

echo "==> Installing dependencies and building"
npm ci --no-audit --no-fund
npm run build

echo "==> Installing systemd units (needs sudo)"
render() {
  sed -e "s|__USER__|$USER_NAME|g" -e "s|__DIR__|$DIR|g" \
      -e "s|__NODE__|$NODE|g" -e "s|__INTERVAL__|$INTERVAL|g" "$1"
}
render deploy/gi-monitor.service | sudo tee /etc/systemd/system/gi-monitor.service >/dev/null
render deploy/gi-monitor.timer   | sudo tee /etc/systemd/system/gi-monitor.timer   >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable --now gi-monitor.timer

echo "==> Running once now"
sudo systemctl start gi-monitor.service || true
journalctl -u gi-monitor.service -n 15 --no-pager || true

echo
echo "Done. Runs every $INTERVAL."
echo "  Logs:        journalctl -u gi-monitor -f"
echo "  Next run:    systemctl list-timers gi-monitor.timer"
echo "  Run now:     sudo systemctl start gi-monitor"
