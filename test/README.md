# Tests

Headless browser tests for the card. No Home Assistant instance is needed at
runtime: the card runs against a mock `hass` object fed from JSON fixtures.

## What is covered

- **Render smoke**: every card mode in light and dark, screenshot per mode,
  fails on any console error or uncaught exception.
- **Interaction**: the direct-input panel on number sliders, select-backed
  sliders (min/max current), battery boost and the plan target; keyboard
  writes; outside click / tab switch closing the panel.
- **Config**: `hide_settings`, `slider_steps`, and the editor checkboxes.

Assertions are made on the service calls the card issues (`hass.callService`),
which the mock records instead of executing.

## Run

```bash
python3 test/run.py                 # everything
python3 test/run.py --only render   # screenshots only
python3 test/run.py --headed        # watch it in a window
```

Screenshots land in `test/out/` (git-ignored). Exit code 1 on failure.

## Reports

Every run of `run.py` or `screenshots.py` writes to `test/out/`:

| File | Content |
|---|---|
| `report.md` | Human-readable summary: result, card version, run time, every check with its detail, failures first |
| `report.json` | The same as data |
| `junit.xml` | JUnit format for CI test summaries |
| `pre-commit.log` | Full output of the last pre-commit hook run |

The reports are overwritten by the next run; `screenshots.py` and `run.py`
share the files, so the report always describes the most recent of the two.

## Deterministic output

`run.py` freezes the browser clock at the capture time of the fixtures
(`FIXED_TIME`, 2026-09-18 13:00 Europe/Berlin, locale de-DE). Hour labels,
plan times and the "current month" therefore never drift, and two runs produce
byte-identical screenshots. A changed PNG means the rendering changed.

Known cosmetic difference to the HA frontend: headless Chromium formats the
native `datetime-local` input (charge plan "finish by") in US notation
regardless of locale flags. Fonts are Liberation/DejaVu unless Roboto is
installed (`apt install fonts-roboto`).

## Pre-commit hook

`.githooks/pre-commit` runs the syntax check and regenerates the README
screenshots whenever `dist/` is part of a commit, and adds changed images to
that commit. The screenshot run renders every mode light and dark and fails on
any console error, so it doubles as the render smoke (about 40 s; the full
suite with interaction tests stays in `run.py`). On failure the commit is
aborted, the reason goes to stderr and the details to `test/out/pre-commit.log`
and `test/out/report.md`. Activate the hook once per clone:

```bash
git config core.hooksPath .githooks
```

Skip it for one commit with `git commit --no-verify` or `EVCC_SKIP_HOOK=1`.

## Requirements

`test/setup.sh` installs everything below on Debian/Ubuntu (idempotent, needs sudo).

- Python 3 with `playwright` (`pip install playwright`)
- Chromium at `/usr/bin/chromium` (Debian: `apt install chromium fonts-dejavu-core`)
- Node.js for a plain syntax check:
  `cp dist/evcc-card.js /tmp/evcc-card.mjs && node --check /tmp/evcc-card.mjs`
  (the card uses `import.meta`, so it must be checked as an ES module)

## Files

| File | Purpose |
|---|---|
| `harness.html` | Loads `dist/evcc-card.js`, builds the mock hass, mounts one card. Query params: `mode`, `config` (JSON), `dark`, `w` (width px), `lang` |
| `mock-hass.js` | Minimal `hass`: `states`, `language`, `localize`, `callWS` (entity registry + capabilities), `callService` (recorded, simple writes mirrored into `states`) |
| `fixtures/states.json` | Entity states, keyed by entity id |
| `fixtures/entity_registry.json` | Registry entries of the `evcc_intg` platform (what `config/entity_registry/list` returns, slimmed) |
| `fixtures/ws/*.json` | Responses of the ha-evcc WebSocket data API: `capabilities`, `sessions`, `forecast_{grid,solar,planner}`, `plan_preview`. Timestamps are re-based to "now" by the mock |
| `screenshots.py` | All README screenshots from the harness: one light/dark pair per mode (`images/<mode>-{light,dark}.png`, the card element at 470 px) plus the `slider-input` crop. `--only <name>` for a single pair |
| `run.py` | Playwright runner: serves the repo root over HTTP, drives the harness |

## Fixtures

The fixtures are a snapshot of a real ha-evcc setup with two loadpoints
(`openwb`, a heating loadpoint `wp`), two vehicles, a home battery and a price
tariff. They contain device names only, no credentials.

To refresh them from a running instance, evaluate this template in
*Developer tools → Template* and save the result as `fixtures/states.json`
(then convert the list to an object keyed by `entity_id`):

```jinja
{% set ns = namespace(out=[]) %}
{% for s in states if s.domain in ['sensor','binary_sensor','button','number','select','switch']
                   and s.entity_id.split('.')[1].startswith('evcc_') %}
  {% set ns.out = ns.out + [{'entity_id': s.entity_id, 'state': s.state, 'attributes': s.attributes,
                             'last_changed': s.last_changed.isoformat(), 'last_updated': s.last_updated.isoformat()}] %}
{% endfor %}
{{ ns.out | to_json }}
```

The registry fixture comes from `.storage/core.entity_registry` filtered to
`platform == "evcc_intg"`, keeping `entity_id`, `platform`, `config_entry_id`,
`disabled_by`, `unique_id` and `original_name`.

### WebSocket data API fixtures

The `evcc_intg/*` commands are served from `fixtures/ws/`, so the stats mode
runs its sessions path and the plan preview works. `?ws=0` on the harness (or
`ws=False` in `open_card`) disables them and exercises the entity/recorder
fallbacks instead.

The fixtures are the raw evcc API responses, read-only, wrapped the way
ha-evcc's `evcc_card_websocket.py` returns them:

| Fixture | Source | Wrapping |
|---|---|---|
| `sessions.json` | `GET /api/sessions` | `{ "sessions": [...] }` |
| `forecast_<kind>.json` | `GET /api/tariff/<kind>` | `{ "kind", "rates": [...], "smartCostType": "price", "currency": "€" }` |
| `plan_preview.json` | `GET /api/loadpoints/1/plan/static/preview/soc/80/<rfc3339>` | response + `smartCostType`, `currency` |
| `capabilities.json` | hand-written | `{ "version", "commands": ["forecast", "sessions", "plan_preview"] }` |

Forecast rates are shifted at load time so the first slot starts at the
current hour. The plan preview is derived per request: the charging window
takes the fixture's `duration`, ends at the requested target time and its slots
are cut from the shifted grid forecast, the way evcc's static preview places a
plan. Sessions keep their real dates (the month scope of the stats mode
therefore shows data only while the capture month is the current month).
