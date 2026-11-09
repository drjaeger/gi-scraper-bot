# Games Island MtG Stock Monitor

Watches the [Games Island](https://games-island.eu) Magic: The Gathering catalogue and posts to Discord when a product **appears in stock for the first time** or **comes back in stock**.

Each run scrapes the crawler-friendly listing (`crawlme.games-island.eu/c/Magic-The-Gathering`), compares it with the previous run's state, sends any changes to a Discord webhook, and saves the new state. The first run only builds a baseline and sends nothing.

If runs start failing (site down, layout changed, etc.) you get **one** ⚠️ message in Discord, then one ✅ message when it recovers.

## Running on a Raspberry Pi

Needs a Pi 3, 4 or 5 on **64-bit** Raspberry Pi OS (Node.js no longer supports 32-bit ARM / Pi Zero / Pi 1).

```bash
# 1. Node.js 24 + git
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs git

# 2. Get the code
git clone https://github.com/drjaeger/gi-scraper-bot.git   # or SSH, if the Pi has a key/deploy key
cd gi-scraper-bot

# 3. Configure
cp .env.example .env
nano .env        # set DISCORD_WEBHOOK_URL

# 4. Build + install as a systemd timer (default every 10 min)
./deploy/install.sh            # or e.g. ./deploy/install.sh 5min
```

The install script builds the project, installs `gi-monitor.service` + `gi-monitor.timer`, starts the timer and does one run immediately (which builds the baseline).

**Day to day**

| | |
|---|---|
| Follow logs | `journalctl -u gi-monitor -f` |
| When is the next run | `systemctl list-timers gi-monitor.timer` |
| Run now | `sudo systemctl start gi-monitor` |
| Update | `git pull && ./deploy/install.sh` |
| Stop | `sudo systemctl disable --now gi-monitor.timer` |

State lives in `./data/` (`state.json` = last seen catalogue, `health.json` = failing/OK flag). Deleting `state.json` just triggers a silent re-baseline.

## Configuration (`.env`)

| Variable | Required | Purpose |
|---|---|---|
| `DISCORD_WEBHOOK_URL` | yes | Channel webhook to post to. Without it, runs still work but only log. |
| `DATA_DIR` | no | Where `state.json` / `health.json` go. Default `./data`. |
| `GIST_ID` + `GIST_TOKEN` | no | Store product state in a GitHub Gist instead of a local file (token needs `gist` scope). |

## Development

```bash
npm install
npm run dev      # runs src/ directly with tsx, reads .env if present
npm run build && npm start
```

Code is in `src/`: `scraper.ts` (fetch + parse), `store.ts` (state), `notifier.ts` (Discord), `index.ts` (diff + health tracking).

## GitHub Actions

`.github/workflows/monitor.yaml` is **manual-only** (Actions tab → Run workflow) now that the Pi does the scheduling. Note it uses the Gist secrets for state, not the Pi's local file — so a manual run compares against whatever is in the Gist. To move back to Actions, re-add a `schedule:` trigger there.
