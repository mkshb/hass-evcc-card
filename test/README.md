# Tests

Headless browser tests for the card. No Home Assistant instance is needed at
runtime: the card runs against a mock `hass` object fed from JSON fixtures.

## What is covered

Groups in `run.py` (`--only <group>`, repeatable):

| Group | Checks |
|---|---|
| `unit` | Pure functions from `src/utils` in node, no browser: number/step formatting, the dual-format evcc timestamp parser, duration and countdown strings, the SoC gradients, HTML escaping, the `stats_period` normalisation, entity discovery, and that `package.json` still carries the version from `src/core/constants.js` |
| `render` | Every card mode in light and dark, screenshot per mode, fails on any console error; stats bar chart from sessions |
| `stats_fallback` | Stats mode on an ha-evcc without `evcc_intg/sessions`: the recorder is queried for sum buckets, the chart is rebuilt from the deltas, the solar split survives, the `30d` tab switches to day buckets |
| `stats_period` | Every `stats_period` value steers both stats paths the same way: the current vocabulary (`month`/`year`/`total`/`none`), the legacy one older dashboards carry (`30d`/`365d`/`thisYear`), and the unconfigured default, each with and without the sessions API; plus `none` hiding the footer under `site` |
| `renderkey` | A hass update only reaches the DOM when the render key changes. Changed select options and number bounds must trigger a render, an update that changes nothing must not, and `RENDER_ATTRS` must list every attribute the card reads: the group proxies the attribute objects during a render of every mode and fails on anything outside the list |
| `lifecycle` | Detach and re-attach the same card element, the way Lovelace re-mounts on a view switch: the `evcc-plan-reset` listener, the registry entry the inline site handlers resolve through and the countdown interval must all come back, the registry must not leak instances, a re-mount must cost no backend call, and a render pending at detach is cancelled and picked up again on re-mount |
| `interaction` | Direct-input panel on number sliders, select-backed sliders (min/max current), battery boost and the plan target; keyboard writes (none for a key that moved nothing); outside click (inside and outside the card) / tab switch closing the panel, a deferred hass update surviving a panel switch; `hide_settings`, `slider_steps` (matched against the feature key, not the tail of the entity id, and reported in the console when a select-backed slider cannot honour it); plan preview request |
| `editor` | The visual editor emits every field into the config (text, all selects, all checkbox groups), emits the complete config rather than a patch, and drops a key again when a field returns to its default; the mode switch re-renders the form; `stats_period` shows the default of the current mode instead of a preselected period and keeps a legacy value selected without rewriting it |
| `escaping` | Names that are free text in an evcc/HA configuration reach the DOM as text: card title, vehicle title, loadpoint title, PV device title, unit of measurement, the session names and the currency from the WebSocket API, the config dump and a vehicle id inside an attribute. Each payload has to appear verbatim and create no element |
| `contracts` | Every writing control calls the right HA service with the right payload: mode, phases, clear-limit buttons, boost chip, continuous charging, preconditioning, vehicle select, set/delete plan (a vehicle plan in percent; a guest vehicle gets an error instead of a call the integration would silently drop, and its delete addresses the loadpoint by its evcc index), slider release, battery discharge control, battery selects |
| `tariff` | Loadpoints without solar (`no_pv`): which mode buttons remain, and `pv` relabelled as the smart mode when a tariff is available; the same on a co2 signal, where the card must read `tariff_co2` instead of `tariff_grid`; plan preview in g/kWh with a price counter-check |
| `traffic` | Plan preview traffic rules promised to ha-evcc: one call per target change, none while idle, cache hit on repeat, one call per slider drag |
| `priority` | Regression for #170: drag and drop reorders the rows without jitter, apply writes the new priorities |
| `locales` | All 8 locale files share the same keys, `index.json` is complete, no untranslated key reaches the DOM in any language |
| `discovery` | Custom entity prefix, `disabled_loadpoints` hide/dim/show, heating loadpoint (temperature label, and no charge plan block, also with a plan running and in the plan mode, where no `plan_preview` may go out); disabled limit entities; two ha-evcc config entries, where the prefix and the entry id behind the WebSocket commands have to come from the same instance, also when the prefix is configured after the registry probe |
| `flow` | Sankey labels keep their distance on both sides, with the default fixture and with every value below a tenth of a kW, where the bands hit their minimum height and the node centres move closer together than the labels are tall |
| `cardapi` | The methods Home Assistant expects on a custom card: `getCardSize()` answers for every mode, never 0 or undefined, taller for a taller mode, scaled by the number of loadpoints where the card repeats a block per loadpoint, and already answerable on a card that has never seen hass; `getGridOptions()` reports rows that follow `getCardSize()`, a column count that is a multiple of three and fits the 12 column section, and minimums that stay inside those; the `window.customCards` entry carries a name, a description, a documentation link and `preview: true`, and the stub config renders on an instance with no evcc entity at all, which is what the picker preview does |
| `setconfig` | `setConfig()` accepts every documented value, including the legacy `site2` mode and the legacy `stats_period` values, and throws on an unknown `mode`, `size`, `disabled_loadpoints` or `stats_period` and on an empty or non-string `prefix`, `language` or `loadpoints`; the message names the option and a rejected config leaves the card on the previous one |
| `widths` | 300 px and 650 px cards: the input panel stays inside the card, no horizontal overflow |

Assertions are made on the service calls the card issues (`hass.callService`)
and the WebSocket commands it sends, which the mock records instead of executing.

## Unit tests

`test/unit/*.test.mjs` import the ES modules under `src/utils/` directly and run
in node's own test runner, with no browser and no card involved. They cover the
edge cases a render test can only reach indirectly: a missing entity, the two
timestamp formats evcc emits, a SoC of 0 in the gradient maths, escaping.

```bash
node --test test/unit/            # on their own, ~0.2 s
python3 test/run.py --only unit   # the same tests inside the suite report
```

The suite runs each file through node's junit reporter and feeds the individual
cases into the same `report.md` / `junit.xml` as the browser checks, so a broken
helper shows up in one place with everything else.

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
| Test suite (chromium, webkit) | Matrix over both engines: `npm run build` and a check that the committed `dist/evcc-card.js` equals the build (a stale bundle fails), syntax check, `test/run.py --browser <engine>` with Playwright's bundled browser (the unit tests run inside it, node is already set up for the build); `report.md` becomes the job summary, `test/out` is uploaded as an artifact per engine |
| README screenshots up to date | Renders all screenshots in a `debian:bookworm-slim` container with the same Chromium and font packages as the dev container, and compares them with `images/` via `test/compare_images.py` (tolerance 0.5 % differing pixels). Fails when a card change was committed without regenerating the images. Text rendering differs between distributions by a few pixels per line, so an Ubuntu runner cannot be used for this job |
| Entities exist in ha-evcc | `test/check_ha_evcc.py --clone` against the latest marq24/ha-evcc; the nightly run catches renamed entities in new integration releases |

## Requirements

The dev container image (`mkshb/homelab`, `hass-production/sidecar`) ships everything
below, so a rebuilt pod is ready without any setup: the toolchain survives the pod
recreation that every Home Assistant update triggers, which a manual install into
the container overlay does not.

`test/setup.sh` is the fallback for a plain container and the repair on an older
image. It checks every item first and installs only what is missing (idempotent,
needs sudo, a second when nothing is missing). `PLAYWRIGHT_BROWSERS_PATH` decides
where the browsers live; the image puts them in `/opt/ms-playwright`.

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
| `harness.html` | Loads `dist/evcc-card.js` (run `npm run build` after editing `src/`), builds the mock hass, mounts one card. Query params: `mode`, `config` (JSON), `dark`, `w` (width px), `lang`, plus the fixture variants below |
| `mock-hass.js` | Minimal `hass`: `states`, `language`, `localize`, `callWS` (entity registry, the `evcc_intg` commands and `recorder/statistics_during_period`), `callService` (recorded, simple writes mirrored into `states`) |
| `fixtures/states.json` | Entity states, keyed by entity id |
| `fixtures/entity_registry.json` | Registry entries of the `evcc_intg` platform (what `config/entity_registry/list` returns, slimmed) |
| `fixtures/ws/*.json` | Responses of the ha-evcc WebSocket data API: `capabilities`, `sessions`, `forecast_{grid,solar,planner}`, `plan_preview`. Timestamps are re-based to "now" by the mock |
| `screenshots.py` | All README screenshots from the harness: one light/dark pair per mode (`images/<mode>-{light,dark}.png`, the card element at 470 px) plus the `slider-input` crop. `--only <name>` for a single pair |
| `run.py` | Playwright runner: serves the repo root over HTTP, drives the harness, and runs the unit tests through node |
| `unit/*.test.mjs` | Unit tests for `src/utils/`, run by node's test runner (see above) |
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

### Fixture variants

One captured snapshot cannot hold every setup, so the harness derives variants
from it. Each is a query parameter, and `open_card()` in `run.py` takes the
matching keyword:

| Parameter | Keyword | Effect |
|---|---|---|
| `set=<id>:<state>,...` | `set={...}` | Override entity states |
| `attrs=<json>` | `attrs={...}` | Override entity attributes (JSON, because values may contain any character) |
| `disable=<id>,...` | `disable=[...]` | Mark registry entries `disabled_by` and drop their state, as HA does for entities disabled by default |
| `rename=<from>:<to>` | `rename=(from, to)` | Rename the entity prefix everywhere, for multi-instance setups |
| `ws=0` | `ws=False` | No ha-evcc WebSocket data API, so the entity and recorder fallbacks run |
| `tariff=co2` | `tariff="co2"` | The data API reports a co2 signal instead of prices: `smartCostType: "co2"`, no currency, and the rate values are replaced by a fixed daily emission curve (180..420 g/kWh, lowest around midday) |
| `wsname=<text>` | `wsname="…"` | Put this text into every name the data API reports: the `loadpoint` and `vehicle` of each session and the currency. Used by the `escaping` group |
| `second=<json>` | `second={...}` | Clone the fixture as a second ha-evcc config entry, `{prefix, entryId, first}`. ha-evcc builds the entity prefix from the entry title, so two instances always mean two prefixes and two entry ids; `first` puts the clone ahead of the original in the registry |

`recorder/statistics_during_period` is answered by the mock as well, generated
over the window the card asks for so the series always ends at "now", and
derived from the bucket index so two runs produce the same chart. That is what
the `stats_fallback` group renders its chart from.

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
