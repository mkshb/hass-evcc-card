# Tests

Headless browser tests for the card. No Home Assistant instance is needed at
runtime: the card runs against a mock `hass` object fed from JSON fixtures.

## What is covered

Groups in `run.py` (`--only <group>`, repeatable):

| Group | Checks |
|---|---|
| `render` | Every card mode in light and dark, screenshot per mode, fails on any console error; stats bar chart from sessions; entity fallback without the WebSocket API |
| `interaction` | Direct-input panel on number sliders, select-backed sliders (min/max current), battery boost and the plan target; keyboard writes; outside click / tab switch closing the panel; `hide_settings`, `slider_steps`; editor checkboxes; plan preview request |
| `contracts` | Every writing control calls the right HA service with the right payload: mode, phases, clear-limit buttons, boost chip, continuous charging, preconditioning, vehicle select, set/delete plan, battery discharge control, battery selects |
| `traffic` | Plan preview traffic rules promised to ha-evcc: one call per target change, none while idle, cache hit on repeat, one call per slider drag |
| `priority` | Regression for #170: drag and drop reorders the rows without jitter, apply writes the new priorities |
| `locales` | All 8 locale files share the same keys, `index.json` is complete, no untranslated key reaches the DOM in any language |
| `discovery` | Custom entity prefix, `disabled_loadpoints` hide/dim/show, heating loadpoint (temperature label, no plan), disabled limit entities |
| `widths` | 300 px and 650 px cards: the input panel stays inside the card, no horizontal overflow |

Assertions are made on the service calls the card issues (`hass.callService`)
and the WebSocket commands it sends, which the mock records instead of executing.

## ha-evcc contract check

`test/check_ha_evcc.py` verifies that every entity in the card's `FEATURES`
array can be produced by ha-evcc (`evcc_intg`): it parses the tag definitions
and entity description lists of the integration and compares the resulting
`<domain>.<prefix>[<loadpoint>_]<suffix>` ids with the card. Exit code 1 on a
missing counterpart; a second column reports whether the entity was seen in
the registry fixture.

```bash
python3 test/check_ha_evcc.py                          # ../ha-evcc checkout next to this repo
python3 test/check_ha_evcc.py --ha-evcc /path/to/config # any tree containing custom_components/evcc_intg
python3 test/check_ha_evcc.py --clone                  # latest upstream, for CI
```

Check against the ha-evcc version you release for; an outdated checkout reports
entities added later (e.g. `disabled_in_config`, the energy counters) as missing.

## Run

```bash
python3 test/run.py                   # everything, Chromium
python3 test/run.py --browser webkit  # the same checks in WebKit (reports in test/out/webkit/)
python3 test/run.py --only render     # screenshots only
python3 test/run.py --headed          # watch it in a window
```

Screenshots land in `test/out/` (git-ignored). Exit code 1 on failure.

### Browsers

Chromium stands for desktop Chrome/Edge and the Android companion app (an
Android System WebView, Chromium-based). WebKit is Playwright's build of
Safari's engine and stands for Safari and the iOS companion app, which renders
the frontend in a WKWebView and therefore uses exactly this engine. Both runs
execute the same groups; only the README screenshot comparison is Chromium-only,
because text rendering differs between engines. What neither run covers: the
apps' native layer (authentication, haptics, notifications) and iOS-specific
input controls such as the native date picker. `EVCC_BROWSER=webkit` selects
the engine without the flag (used by the CI matrix).

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
plan times and the "current month" therefore never drift. CSS animations are not
covered by the frozen clock, so `screenshots.py` captures with Playwright's
`animations="disabled"`: the charging pulse of the SoC bar is rewound to its
first frame instead of landing on a random opacity. Two runs therefore produce
byte-identical screenshots. A changed PNG means the rendering changed.
`FIXED_TIME` carries an explicit UTC offset on purpose: a naive time is read in
the host's timezone, which shifted the plan chart by two hours on a UTC runner.

Known cosmetic difference to the HA frontend: headless Chromium formats the
native `datetime-local` input (charge plan "finish by") in US notation
regardless of locale flags. Fonts are Liberation/DejaVu unless Roboto is
installed (`apt install fonts-roboto`).

## Pre-commit hook

`.githooks/pre-commit` rebuilds `dist/evcc-card.js` from `src/` (`npm run build`),
runs the syntax check and regenerates the README screenshots whenever `src/` or
`dist/` is part of a commit, and adds the rebuilt bundle and changed images to
that commit. The screenshot run renders every mode light and dark and fails on
any console error, so it doubles as the render smoke (about 40 s; the full
suite with interaction tests stays in `run.py`). On failure the commit is
aborted, the reason goes to stderr and the details to `test/out/pre-commit.log`
and `test/out/report.md`. Activate the hook once per clone:

```bash
git config core.hooksPath .githooks
```

Skip it for one commit with `git commit --no-verify` or `EVCC_SKIP_HOOK=1`.

## Continuous integration

`.github/workflows/tests.yaml` runs on every pull request, on pushes to `main`,
nightly and on demand, in three jobs:

| Job | What it does |
|---|---|
| Test suite (chromium, webkit) | Matrix over both engines: `npm run build` and a check that the committed `dist/evcc-card.js` equals the build (a stale bundle fails), syntax check, `test/run.py --browser <engine>` with Playwright's bundled browser; `report.md` becomes the job summary, `test/out` is uploaded as an artifact per engine |
| README screenshots up to date | Renders all screenshots in a `debian:bookworm-slim` container with the same Chromium and font packages as the dev container, and compares them with `images/` via `test/compare_images.py` (tolerance 0.5 % differing pixels). Fails when a card change was committed without regenerating the images. Text rendering differs between distributions by a few pixels per line, so an Ubuntu runner cannot be used for this job |
| Entities exist in ha-evcc | `test/check_ha_evcc.py --clone` against the latest marq24/ha-evcc; the nightly run catches renamed entities in new integration releases |

## Requirements

`test/setup.sh` installs everything below on Debian/Ubuntu (idempotent, needs sudo).

- Python 3 with `playwright` and `pillow` (`pip install playwright pillow`)
- Chromium: `/usr/bin/chromium` (Debian: `apt install chromium fonts-dejavu-core fonts-roboto fonts-noto-color-emoji`)
  or Playwright's own (`python3 -m playwright install chromium`). `EVCC_CHROMIUM=<path>` picks
  a binary, `EVCC_CHROMIUM=bundled` forces the Playwright one (what CI uses).
  `fonts-noto-color-emoji` matters for the screenshots: the plan button carries an emoji,
  without an emoji font it renders as a placeholder box
- WebKit: `python3 -m playwright install --with-deps webkit` (about 180 system packages on
  Debian; `test/setup.sh` runs it). Debian 12/13 and Ubuntu 22.04/24.04 are supported
- Node.js 18+ with npm: `npm ci` installs Rollup, `npm run build` bundles `src/` into
  `dist/evcc-card.js` (what the harness loads), `node --check dist/evcc-card.js` is the
  syntax check (`package.json` declares `"type": "module"`, so the file is parsed as ESM)

## Files

| File | Purpose |
|---|---|
| `harness.html` | Loads `dist/evcc-card.js` (run `npm run build` after editing `src/`), builds the mock hass, mounts one card. Query params: `mode`, `config` (JSON), `dark`, `w` (width px), `lang` |
| `mock-hass.js` | Minimal `hass`: `states`, `language`, `localize`, `callWS` (entity registry + capabilities), `callService` (recorded, simple writes mirrored into `states`) |
| `fixtures/states.json` | Entity states, keyed by entity id |
| `fixtures/entity_registry.json` | Registry entries of the `evcc_intg` platform (what `config/entity_registry/list` returns, slimmed) |
| `fixtures/ws/*.json` | Responses of the ha-evcc WebSocket data API: `capabilities`, `sessions`, `forecast_{grid,solar,planner}`, `plan_preview`. Timestamps are re-based to "now" by the mock |
| `screenshots.py` | All README screenshots from the harness: one light/dark pair per mode (`images/<mode>-{light,dark}.png`, the card element at 470 px) plus the `slider-input` crop. `--only <name>` for a single pair |
| `run.py` | Playwright runner: serves the repo root over HTTP, drives the harness |
| `compare_images.py` | Compares a fresh render with the committed `images/` (used by CI) |
| `check_ha_evcc.py` | Entity contract check against ha-evcc (see below) |

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
