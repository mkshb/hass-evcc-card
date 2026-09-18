# evcc Card v0.7.9

A usability release for the sliders. Every value in the card can now be typed in directly, the step size is configurable, and settings you never use can be hidden. Built for touch: the input panel is thumb-sized, not a tiny text box.

## New

- **Direct input for every slider.** Tap the value next to a slider and a row opens below it with **−** / **+** buttons, a number field with the unit and apply / cancel. The buttons walk the slider step, the field takes an exact value (comma or dot both work) and is clamped to the slider range. Enter or ✓ writes, Escape or ✕ discards. Works for target SoC, min SoC, min / max current, battery boost, priority, smart charging limit, feed-in priority limit and the target SoC of the charge plan. For the current sliders, − / + step through the actual options ha-evcc offers, including the fractional amps.
- **Configurable step size.** New `slider_steps` option (YAML) to override the step of a number slider per setting, for example `smart_cost_limit: 0.01` instead of the 0.005 the entity reports. The − / + buttons use the same step.
- **Hide individual settings.** New `hide_settings` option, also available as checkboxes in the visual editor. Remove target SoC, min SoC, phases, min / max current, battery boost, priority, smart charging limit or feed-in priority limit from the `loadpoint` and `compact` card. If nothing is left in the charge settings section, the section and its gear button disappear.
- **Available in all 8 languages.**

## Fixes

- **Gear button with `charge_current_settings: expanded`.** The first click on the gear did nothing when the charge settings started expanded; it now collapses the section as expected.
- **Keyboard changes are written now.** Changing a slider with the arrow keys, Home / End or PageUp / PageDown only updated the label before; the value never reached Home Assistant. The same applied to the plan target, where keyboard changes did not refresh the plan preview.

## Thanks

Thank you to **@flrnwrzl** for the well-structured feature request in [#172](https://github.com/mkshb/hass-evcc-card/issues/172). Three of the four points are in this release. The fourth, resetting a slider to a default, is covered by the existing **clear** button for the smart charging and feed-in priority limits; the other sliders have no default value in evcc to fall back to.

## Good to know

- The step of a slider always comes from the ha-evcc entity unless you override it with `slider_steps`. Values are written with three decimals for the price / CO₂ limits, as ha-evcc expects.
- This release pairs with **ha-evcc 2026.7.0** or newer. The card targets the **ha-evcc** integration (`evcc_intg`) by @marq24 exclusively. Install and update through HACS as usual.

---

# evcc Card v0.7.8

A bug-fix release for the priority mode. Reordering loadpoints by drag & drop was close to unusable, and while fixing it a few more weak spots in the same area were found and reworked.

## Fixes

- **Drag & drop in priority mode works again.** The dragged row no longer jitters, and the drop indicator follows the pointer directly instead of lagging one position behind. Two causes were at play: the dragged row still occupied its slot in the list, which created a feedback loop between the row position and the placeholder, and the insertion logic stopped at the first row it checked. The row is now taken out of the flow, the list geometry is measured once when the drag starts, and the target position is derived from the row's own centre. This also fixes the row floating above the cursor when the card is embedded in a popup.
- **The dragged row is kept inside the list.** Dragging beyond the top or bottom edge no longer clips the row.
- **The dragged row keeps its width.** Previously it grew wider than the list and was cut off on the right.
- **No more frozen card after a drag.** If a data update or a background fetch re-rendered the card during a drag, the drag was orphaned and the card stopped updating until the page was reloaded. Re-rendering is now deferred until the drag has finished, and losing the pointer capture ends the drag cleanly.
- **Only the primary pointer starts a drag.** A right-click or a second finger no longer triggers a reorder.

## Thanks

A big thank you to **@el-Presi** for the excellent bug report in [#170](https://github.com/mkshb/hass-evcc-card/issues/170): a precise root-cause analysis, a video and a working patch. That analysis was the basis for this release. While going through it, more issues in the drag handling turned up, so the whole area was reworked rather than patched.

## Good to know

- This release pairs with **ha-evcc 2026.7.0** or newer. The card targets the **ha-evcc** integration (`evcc_intg`) by @marq24 exclusively. Install and update through HACS as usual.

---

# evcc Card v0.7.7

A maintenance release that keeps the card in step with the latest ha-evcc versions: smoother current sliders and a new lifetime energy overview.

## New in the card

- **Energy totals in site mode.** The expandable table below the flow bar gains a third section showing the lifetime meter readings your setup provides: solar generation, grid import, grid export, battery charge and battery discharge. Each row appears only when the matching sensor exists, and clicking a row opens the usual more-info dialog. Available in all 8 languages.
- **Current sliders handle the new fractional amps.** ha-evcc 2026.8.9 extends the minimum-current options with 0.125 / 0.25 / 0.5 A. The card's sliders now step through the actual option list instead of a fixed grid, so they stay precise and only ever show values that really exist, on old and new integration versions alike.

## Fixes & compatibility

- **Corrected sensor references.** The card looked for a few site energy sensors under names the integration never used (`grid_energy_export`, `battery_energy_charge`, `battery_energy_discharge`, `home_energy`, `tariff_feedin`). These now point to the real entities: `grid_return_energy`, `battery_energy`, `battery_return_energy` and `tariff_feed_in`.

## Good to know

- The grid and battery energy counters need **ha-evcc 2026.9.0/2026.9.1** or newer and an evcc version that reports them. They are disabled by default in Home Assistant, so enable the sensors in the entity settings of the evcc integration if you want the new section.
- This release pairs with **ha-evcc 2026.7.0** or newer. The card targets the **ha-evcc** integration (`evcc_intg`) by @marq24 exclusively. Install and update through HACS as usual.

---

# evcc Card v0.7.5

A preparation release. evcc is redesigning its charge modes, and this version makes sure the card follows along the moment that change reaches you, without altering anything for setups running today.

## What is changing in evcc

evcc is reworking how charge modes are named and structured: `PV` and `Min+PV` are replaced by a single `Smart` mode, and the behaviour that `Min+PV` used to provide moves into a separate `Always charge` setting with three states (off, on, once). The ha-evcc integration added support for this in **2026.8.3**.

Two things are worth knowing about the timing. The evcc pull request behind it is still a draft, so it has not landed in an evcc release yet and its details can still change. And the switch does not happen when you update the integration, it happens when evcc itself starts reporting the new mode set. Until then nothing about your card changes.

## New in the card

- **Smart mode is supported.** When your loadpoint offers the new mode set, the card shows `Off / Smart / Fast` instead of the old four buttons.
- **New Always charge row.** Right below the mode buttons the card shows a compact `Off / On / Once` selector whenever the loadpoint provides it. `On` keeps charging at least at the minimum current without interruption, `Once` does the same but only for the running session and resets when the vehicle is disconnected. Hovering the label shows the minimum current that applies.
- **The row appears only when it is relevant.** The integration reports the setting as unavailable while the loadpoint is not in Smart mode, and the card hides the row accordingly, so it never clutters the view.
- **Available in all 8 languages.**

## Nothing changes for current setups

The card decides purely from what your mode entity actually offers, never from a version number. Classic loadpoints keep `Off / PV / Min+PV / Fast`, switch devices keep their reduced set, and the existing "Smart" labelling for charge points without solar keeps working exactly as before. If the mode list has not loaded yet, the card falls back to the classic set, so no unusable button can ever appear.

## Good to know

- This release pairs with **ha-evcc 2026.7.0** or newer. The new mode handling needs **2026.8.3** or newer plus an evcc version that ships the redesign.
- The card targets the **ha-evcc** integration (`evcc_intg`) by @marq24 exclusively. Install and update through HACS as usual.

---

# evcc Card v0.7.4

A small maintenance release that future-proofs the card against an upcoming change in how evcc reports timestamps, so your statistics and charge-plan preview keep working without interruption.

## Fixes & compatibility

- **Ready for evcc's new timestamp format.** A future evcc version may report timestamps as numeric unix values instead of the current text format. The matching ha-evcc integration (2026.7.0) already handles both formats, and the card now does too. This affects the places where the card reads raw evcc timing data: the session based statistics (charged energy, solar share and average price per month, year and total) and the charge-plan preview chart. Without this change, those views would have shown wrong dates once evcc switched formats.
- **No change for current setups.** As long as evcc keeps using its present timestamp format, the card behaves exactly as before. The new handling is a safety net that activates automatically only if and when evcc changes the format, so there is nothing you need to do.

## Good to know

- This release pairs with **ha-evcc 2026.7.0** or newer. Updating the integration and the card together is recommended.
- The card targets the **ha-evcc** integration (`evcc_intg`) by @marq24 exclusively. Install and update through HACS as usual.
