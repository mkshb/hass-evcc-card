// Card stylesheet. The CSS itself is one constant string with nothing per
// instance in it, so every card on the page shares one parsed sheet.
const CSS = `
      :host {
        display: block;
        --evcc-green:  var(--success-color,  #22c55e);
        --evcc-red:    var(--error-color,    #ef4444);
        --evcc-amber:  var(--warning-color,  #f59e0b);
        --evcc-blue:   #3b82f6;
        --evcc-orange: #f97316;
        --evcc-yellow: #eab308;
        --evcc-gray:   var(--disabled-color, #6b7280);
        --evcc-bolt:   #facc15;
      }
      .evcc-scale-wrap { container-type: inline-size; }
      @container (min-width: 450px) { .evcc-scale-wrap:not([data-size]) { zoom: 1.15; } }
      @container (min-width: 650px) { .evcc-scale-wrap:not([data-size]) { zoom: 1.3;  } }
      .evcc-scale-wrap[data-size="small"]  { zoom: 1.0;  }
      .evcc-scale-wrap[data-size="medium"] { zoom: 1.15; }
      .evcc-scale-wrap[data-size="large"]  { zoom: 1.30; }
      ha-card {
        color: var(--primary-text-color);
        font-family: var(--paper-font-body1_-_font-family, sans-serif);
      }
      .card-content { padding: 12px 16px 16px; }

      .loadpoint {
        padding: 12px 0;
        border-bottom: 1px solid var(--divider-color, #e5e7eb);
        margin-bottom: 0;
      }
      .loadpoint:first-child { padding-top: 0; }
      .loadpoint:last-child { border-bottom: none; padding-bottom: 0; }
      /* The header values of a loadpoint open more-info; the site rows and the
         grid chips carry their own hover, this one covers the inline values. */
      .loadpoint [data-more-info] { cursor: pointer; }
      .loadpoint [data-more-info]:hover { opacity: .75; }
      .lp-header {
        display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;
      }
      .lp-name { font-size: 1rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 8px; }
      .lp-badge {
        font-size: .75rem; font-weight: 600; padding: 2px 10px;
        border-radius: 999px; border: 1px solid currentColor;
      }
      .lp-badge.charging  { color: var(--evcc-green);  background: color-mix(in srgb, var(--evcc-green)  15%, transparent); }
      .lp-badge.connected { color: var(--evcc-blue);   background: color-mix(in srgb, var(--evcc-blue)   15%, transparent); }
      .lp-badge.ready     { color: var(--evcc-gray);   background: color-mix(in srgb, var(--evcc-gray)   15%, transparent); }
      .lp-badge.disabled  { color: var(--evcc-gray);   background: color-mix(in srgb, var(--evcc-gray)   15%, transparent); }
      .loadpoint.lp-disabled { opacity: 0.55; }
      .lp-action-row { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 8px; }
      .lp-action-chip {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 3px 8px; border-radius: 999px;
        font-size: .72rem; font-weight: 600;
        border: 1px solid var(--divider-color, #4b5563);
        color: var(--primary-text-color);
      }
      .lp-action-chip svg { width: 14px; height: 14px; flex: 0 0 14px; }
      .lp-action-chip.phase { color: var(--evcc-bolt, #ffae00); border-color: color-mix(in srgb, var(--evcc-bolt, #ffae00) 50%, transparent); background: color-mix(in srgb, var(--evcc-bolt, #ffae00) 10%, transparent); }
      .lp-action-chip.pv    { color: var(--evcc-green, #0a0);  border-color: color-mix(in srgb, var(--evcc-green, #0a0)  50%, transparent); background: color-mix(in srgb, var(--evcc-green, #0a0)  10%, transparent); }
      .lp-action-chip.vehicle { color: var(--info-color, #2196f3); border-color: color-mix(in srgb, var(--info-color, #2196f3) 50%, transparent); background: color-mix(in srgb, var(--info-color, #2196f3) 10%, transparent); }
      .lp-remaining {
        font-size: .85em; color: var(--secondary-text-color);
        margin-right: 8px; white-space: nowrap;
      }

      .mode-row { display: flex; gap: 6px; margin-bottom: 12px; }
      .mode-row.has-sub { margin-bottom: 6px; }
      .alwayscharge-row { margin-bottom: 12px; }
      .mode-btn {
        flex: 1; display: flex; flex-direction: column; align-items: center;
        gap: 2px; padding: 8px 2px; min-width: 0;
        border: 1px solid var(--divider-color, #e5e7eb); border-radius: 8px;
        background: transparent; color: var(--secondary-text-color);
        cursor: pointer; font-size: .7rem; transition: all .15s; overflow: hidden;
      }
      .mode-btn:hover { border-color: var(--primary-color); }
      .mode-btn.active { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }
      .mode-icon { display: flex; align-items: center; justify-content: center; line-height: 1; min-height: 20px; }
      .mode-label { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      .soc-section { margin-bottom: 12px; }
      .soc-label-row {
        display: flex; justify-content: space-between;
        font-size: .85rem; margin-bottom: 6px; color: var(--secondary-text-color);
      }
      .vehicle-name { font-weight: 500; color: var(--primary-text-color); }
      .smart-cost-row { display: flex; justify-content: flex-end; margin-top: 4px; }
      .boost-activate-row { display: flex; justify-content: flex-start; margin-top: 6px; margin-bottom: 2px; }
      .boost-activate-btn {
        display: inline-flex; align-items: center; gap: 4px;
        background: none; border: 1px solid var(--divider-color, #555);
        border-radius: 4px; cursor: pointer;
        font-size: .75rem; color: var(--secondary-text-color);
        padding: 3px 8px; font-family: inherit;
        transition: border-color .15s, color .15s, background .15s;
      }
      .boost-activate-btn:hover { border-color: var(--evcc-bolt, #ffae00); color: var(--evcc-bolt, #ffae00); }
      .boost-activate-btn.on { color: var(--evcc-bolt, #ffae00); border-color: var(--evcc-bolt, #ffae00); background: rgba(255,174,0,0.08); }
      .soc-track {
        position: relative; height: 8px;
        background: var(--divider-color, #e5e7eb); border-radius: 4px; overflow: visible;
      }
      @keyframes soc-pulse {
        0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; }
      }
      .soc-fill { height: 100%; border-radius: 4px; transition: width .4s ease; }
      .soc-fill.charging { animation: soc-pulse 1.4s ease-in-out infinite; }
      .soc-limit-marker {
        position: absolute; top: -3px; width: 3px; height: 14px;
        background: #22c55e; border-radius: 2px; transform: translateX(-50%);
      }
      .soc-min-marker {
        position: absolute; top: -3px; width: 3px; height: 14px;
        background: #f59e0b; border-radius: 2px; transform: translateX(-50%);
      }

      .power-row { display: flex; align-items: flex-end; gap: 8px; margin-bottom: 12px; color: var(--secondary-text-color); flex-wrap: wrap; }
      .power-row.charging { color: #22c55e; }
      .power-value { font-size: 1.6rem; font-weight: 700; }
      .power-sep { font-size: .8rem; color: var(--secondary-text-color); align-self: flex-end; padding-bottom: .2rem; }
      .power-current { font-size: .82rem; align-self: flex-end; padding-bottom: .2rem; }
      .power-phases  { font-size: .82rem; align-self: flex-end; padding-bottom: .2rem; }
      .power-currents-hint { font-size: .72rem; color: var(--secondary-text-color, #757575); margin-top: 2px; opacity: .8; }

      .sliders { margin-bottom: 10px; }
      .slider-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: .83rem; flex-wrap: wrap; }
      .slider-row label { flex: 0 0 auto; min-width: 70px; white-space: nowrap; color: var(--secondary-text-color); }
      .slider-control { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 120px; }
      .slider-control input { flex: 1; min-width: 0; accent-color: var(--primary-color); }
      .slider-val { flex-shrink: 0; min-width: 52px; text-align: right; font-size: .8rem; }
      /* The value is a tap target: same look as before, but a thumb-sized hit
         area (padding + negative margin keeps the row height unchanged). */
      button.slider-val {
        background: none; border: none; font-family: inherit; color: inherit; cursor: pointer;
        padding: 8px 6px; margin: -8px -6px; border-radius: 6px; line-height: 1.2;
        text-decoration: underline dotted; text-decoration-color: var(--secondary-text-color, #888);
        text-underline-offset: 3px; touch-action: manipulation;
      }
      button.slider-val:hover, button.slider-val.editing { color: var(--primary-color); text-decoration-color: currentColor; }
      button.slider-val:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 1px; }
      /* Direct-input panel: full-width row under the slider, every control ≥44px. */
      .slider-edit { flex: 0 0 100%; display: flex; align-items: center; gap: 8px; margin: 6px 0 2px; }
      .slider-edit-btn {
        flex: 0 0 auto; min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center;
        border: 1px solid var(--divider-color, #555); border-radius: 8px; cursor: pointer; font-family: inherit;
        background: var(--secondary-background-color, rgba(127,127,127,0.12)); color: var(--primary-text-color);
        font-size: 1.3rem; line-height: 1; padding: 0; touch-action: manipulation; user-select: none;
      }
      .slider-edit-btn:active { filter: brightness(0.9); }
      .slider-edit-ok     { color: var(--evcc-green); font-weight: 700; }
      .slider-edit-cancel { color: var(--secondary-text-color); }
      .slider-edit-field {
        flex: 1 1 80px; min-width: 64px; min-height: 44px; display: flex; align-items: center; box-sizing: border-box;
        border: 1px solid var(--divider-color, #555); border-radius: 8px; padding: 0 10px;
        background: var(--card-background-color, #fff);
      }
      .slider-edit-field:focus-within { border-color: var(--primary-color); }
      .slider-edit-input {
        flex: 1; min-width: 0; width: 100%; border: none; background: none; outline: none;
        font-family: inherit; font-size: 1.15rem; color: var(--primary-text-color); text-align: right; padding: 0;
      }
      .slider-edit-unit { flex: 0 0 auto; margin-left: 6px; font-size: .9rem; color: var(--secondary-text-color); white-space: nowrap; }
      /* Narrow cards (≈300 px): 4 × 40 px buttons + 4 gaps + a 64 px field still fit the content box. */
      @container (max-width: 340px) {
        .slider-edit { gap: 6px; }
        .slider-edit-btn { min-width: 40px; }
        .slider-edit-field { flex-basis: 64px; min-width: 64px; padding: 0 8px; }
      }
      .smart-active-hint { font-size: .75rem; color: var(--evcc-green); margin-top: -4px; margin-bottom: 8px; }
      .smart-cost-clear-row { display: flex; justify-content: flex-end; margin-top: 6px; margin-bottom: 2px; }
      .smart-cost-clear-btn { background: none; border: 1px solid var(--divider-color, #555); border-radius: 4px; cursor: pointer; font-size: .75rem; color: var(--secondary-text-color); padding: 3px 8px; font-family: inherit; transition: border-color .15s, color .15s; }
      .smart-cost-clear-btn:hover { border-color: var(--evcc-red); color: var(--evcc-red); }
      .smart-cost-chip { display: inline-flex; align-items: center; gap: 3px; font-size: .72rem; color: var(--secondary-text-color); white-space: nowrap; background: none; border: none; padding: 0; cursor: pointer; font-family: inherit; }
      .smart-cost-chip:hover { color: var(--primary-color); }
      .smart-cost-chip.active { color: var(--evcc-green); }
      .smart-cost-chip.active:hover { color: var(--evcc-green); filter: brightness(1.2); }
      .settings-divider { border: none; border-top: 1px solid var(--divider-color, #e5e7eb); margin: 8px 0; }
      @keyframes smart-cost-pulse { 0%,100% { background: transparent; } 40% { background: color-mix(in srgb, var(--primary-color) 15%, transparent); } }
      .smart-cost-highlight { border-radius: 6px; animation: smart-cost-pulse 1.5s ease; }

      .toggles { margin-bottom: 10px; }
      .toggle-row { display: flex; justify-content: space-between; align-items: center; font-size: .83rem; margin-bottom: 6px; flex-wrap: wrap; gap: 4px; }
      button.toggle {
        padding: 3px 14px; border-radius: 999px; border: 1px solid var(--divider-color);
        background: transparent; color: var(--secondary-text-color);
        cursor: pointer; font-size: .75rem; font-weight: 600; transition: all .15s;
      }
      button.toggle.on { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }

      .current-block {
        border-top: 1px solid var(--divider-color, #333);
        margin-top: 10px; padding-top: 10px; margin-bottom: 10px;
      }
      .block-title-row {
        display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;
      }
      .block-title {
        font-size: .7rem; font-weight: 600; text-transform: uppercase;
        letter-spacing: .08em; color: var(--secondary-text-color);
      }
      .current-toggle-btn {
        background: transparent; border: none; border-radius: 50%;
        color: var(--secondary-text-color); cursor: pointer;
        padding: 3px; display: flex; align-items: center; justify-content: center;
        transition: color .15s, background .15s; margin: -3px;
      }
      .current-toggle-btn:hover {
        color: var(--primary-color);
        background: var(--secondary-background-color, rgba(0,0,0,.06));
      }
      .current-toggle-btn.active { color: var(--primary-color); }
      .current-block-body[hidden] { display: none; }

      .selects { margin-bottom: 10px; }
      .select-row { display: flex; justify-content: space-between; align-items: center; font-size: .83rem; margin-bottom: 6px; flex-wrap: wrap; gap: 4px; }
      .phase-btn-group { display: flex; gap: 4px; }
      button.phase-btn {
        padding: 3px 10px; border-radius: 999px; border: 1px solid var(--divider-color);
        background: transparent; color: var(--secondary-text-color);
        cursor: pointer; font-size: .75rem; font-weight: 600; transition: all .15s; white-space: nowrap;
      }
      button.phase-btn.active { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }

      .site-block { padding: 0; }
      .site-table-hidden { display: none; }
      .flow-wrap-clickable {
        cursor: pointer;
        border-radius: 6px;
        transition: opacity .15s;
      }
      .flow-wrap-clickable:hover { opacity: 0.85; }

      .flow-wrap {
        margin-bottom: 18px;
        padding: 0;
      }
      .flow-wrap svg {
        overflow: visible;
      }
      .flow-overlay {
        color: var(--primary-text-color, #212121);
      }
      .site-table { display: flex; flex-direction: column; }
      .site-section-gap { border-top: 1px solid var(--divider-color, #333); margin: 10px 0 12px; }
      .site-section-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid var(--divider-color, #333); }
      .site-section-title { font-size: .8rem; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--secondary-text-color); }
      .site-section-total { font-size: 1rem; font-weight: 700; }
      .site-row { display: grid; grid-template-columns: 1.4rem 1fr auto; gap: 0 6px; align-items: center; padding: 5px 0; font-size: .78rem; }
      .site-row-clickable { cursor: pointer; border-radius: 4px; }
      .site-row-clickable:hover { background: var(--secondary-background-color, rgba(255,255,255,0.05)); }
      .site-row-icon  { display: flex; align-items: center; justify-content: center; }
      .site-row-label { display: flex; flex-direction: column; gap: 1px; }
      .site-row-name  { font-size: .8rem; }
      .site-row-sub   { font-size: .68rem; color: var(--secondary-text-color); }
      .site-row-pw    { font-weight: 700; font-size: .82rem; min-width: 48px; text-align: right; }
      .site-row-indent { padding-left: 1.2rem; position: relative; }
      .site-row-indent::before {
        content: "└";
        position: absolute;
        left: 0.15rem;
        top: 50%;
        transform: translateY(-50%);
        font-size: .75rem;
        color: var(--secondary-text-color);
        opacity: 0.6;
      }
      .site-row-indent .site-row-icon { opacity: 0.7; }
      .site-row-indent .site-row-name { font-size: .75rem; color: var(--secondary-text-color); }
      .site-row-indent .site-row-pw   { font-size: .78rem; }
      .site-pw-green  { color: #22c55e; }
      .site-pw-blue   { color: #3b82f6; }
      .site-pw-yellow { color: #facc15; }

      .sankey-wrap { padding: 12px 0 8px; }
      .sankey-wrap svg { overflow: visible; }
      .sankey-node { opacity: 1; transition: opacity .15s; }
      .sankey-node:hover { opacity: 0.7; }
      .sankey-center-chevron { transition: opacity .15s; }
      .sankey-wrap:hover .sankey-center-chevron { opacity: 0.7 !important; }

      .s2-net {
        text-align: center; padding: 14px 0 16px;
        border-bottom: 1px solid var(--divider-color, #333); margin-bottom: 14px;
      }
      .s2-net-label {
        font-size: .6rem; font-weight: 700; letter-spacing: .1em;
        text-transform: uppercase; color: var(--secondary-text-color); margin-bottom: 4px;
      }
      .s2-net-value { font-size: 2.2rem; font-weight: 800; line-height: 1; letter-spacing: -.02em; }
      .s2-net-status { font-size: .75rem; font-weight: 600; margin-top: 4px; }
      .s2-pv-badge {
        display: inline-flex; align-items: center; gap: 4px;
        margin-top: 8px; background: rgba(34,197,94,0.12); color: #22c55e;
        border-radius: 20px; padding: 3px 10px; font-size: .68rem; font-weight: 700;
      }
      .s2-section { margin-bottom: 12px; }
      .s2-section-label {
        font-size: .58rem; font-weight: 700; letter-spacing: .12em;
        text-transform: uppercase; color: var(--secondary-text-color); opacity: .55; margin-bottom: 6px;
      }
      .s2-chips { display: flex; gap: 6px; flex-wrap: wrap; }
      .s2-chip {
        display: inline-flex; align-items: center; gap: 5px;
        background: var(--secondary-background-color, rgba(255,255,255,0.05));
        border-radius: 20px; padding: 5px 11px; font-size: .72rem; font-weight: 600;
        border: 1px solid var(--divider-color, #333);
      }
      .s2-chip-clickable { cursor: pointer; }
      .s2-chip-clickable:hover { opacity: 0.75; }
      .s2-chip-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
      .s2-chip-sub { font-size: .62rem; color: var(--secondary-text-color); font-weight: 400; }

      .stats-period-tabs { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 10px; }
      .stats-period-tab {
        padding: 2px 10px; border-radius: 999px;
        border: 1px solid var(--divider-color, #e5e7eb);
        background: transparent; color: var(--secondary-text-color);
        cursor: pointer; font-size: .72rem; font-weight: 600; transition: all .15s;
      }
      .stats-period-tab.active { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }
      .stats-period-tabs--small .stats-period-tab { font-size: .65rem; padding: 1px 8px; }

      .stats-footer-wrap {
        border-top: 1px solid var(--divider-color, #333);
        margin-top: 12px; padding-top: 8px;
      }
      .stats-footer-wrap .stats-footer { border-top: none; margin-top: 6px; padding-top: 0; }

      .stats-footer {
        border-top: 1px solid var(--divider-color, #333);
        margin-top: 12px; padding-top: 10px;
      }
      .sf-period {
        font-size: .6rem; text-transform: uppercase; letter-spacing: .08em; font-weight: 700;
        color: var(--secondary-text-color); text-align: center; margin-bottom: 6px; opacity: 0.7;
      }
      .sf-items { display: flex; align-items: center; }
      .sf-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; }
      .sf-val  { font-size: .82rem; font-weight: 700; }
      .sf-lbl  { font-size: .58rem; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: .06em; font-weight: 600; }
      .sf-sep  { width: 1px; height: 28px; background: var(--divider-color, #333); flex-shrink: 0; }

      .stats-no-data {
        font-size: .76rem; color: var(--warning-color, #f4b942);
        background: rgba(244,185,66,.08);
        border: 1px solid var(--warning-color, #f4b942);
        border-radius: 6px; padding: 10px 12px; margin-bottom: 10px; line-height: 1.6;
      }
      .stats-no-data-link {
        display: inline-block; margin-top: 4px; color: var(--primary-color);
        text-decoration: none; font-weight: 600;
      }
      .stats-no-data-link:hover { text-decoration: underline; }

      .stats-kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
      .stats-kpi {
        background: var(--secondary-background-color, rgba(255,255,255,.05));
        border-radius: 8px; padding: 10px 8px; text-align: center;
        display: flex; flex-direction: column; gap: 3px;
      }
      .stats-kpi-val { font-size: 1.1rem; font-weight: 800; line-height: 1; }
      .stats-kpi-lbl { font-size: .58rem; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: .06em; font-weight: 600; }
      .stats-chart-section { margin-top: 4px; }
      .stats-stepper { display: flex; align-items: center; justify-content: center; }
      .stats-step-btn {
        border: 1px solid var(--divider-color, rgba(127,127,127,0.3)); background: transparent;
        color: var(--primary-text-color); border-radius: 8px; width: 26px; height: 24px; line-height: 1;
        font-size: 1rem; cursor: pointer; padding: 0;
      }
      .stats-step-btn:hover:not([disabled]) { background: var(--secondary-background-color, rgba(127,127,127,0.12)); }
      .stats-step-btn[disabled] { opacity: 0.35; cursor: default; }
      .stats-stepper { gap: 4px; }
      .stats-step-label { text-align: center; font-weight: 600; font-size: 0.85rem; white-space: nowrap; overflow: hidden; }
      .stats-step-label--month { width: 74px; }
      .stats-step-label--year { width: 42px; }
      .stats-controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
      .stats-controls .stats-period-tabs { margin-bottom: 0; }
      .stats-steppers { flex: 0 0 100%; display: flex; align-items: center; justify-content: flex-end; gap: 10px; min-height: 26px; }
      .stats-legend { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 12px; margin-top: 8px; font-size: 0.74rem; color: var(--secondary-text-color); }
      .sl-item { display: inline-flex; align-items: center; gap: 5px; }
      .sl-dot { width: 9px; height: 9px; border-radius: 2px; display: inline-block; }
      .evcc-chart-wrap { position: relative; margin-left: -16px; margin-right: 0; }
      .evcc-chart-tooltip {
        position: absolute; top: 0; transform: translateX(-50%);
        background: var(--ha-card-background, var(--card-background-color, #1f2937));
        border-radius: 8px; padding: 8px 12px;
        font-size: 12px; line-height: 1.6; white-space: nowrap;
        pointer-events: none; z-index: 10;
        box-shadow: 0 4px 16px rgba(0,0,0,.35);
      }
      .ectt-header { font-weight: 700; margin-bottom: 4px; }
      .ectt-row { display: flex; align-items: center; gap: 6px; }
      .ectt-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
      .ectt-name { flex: 1; color: var(--primary-text-color); }
      .ectt-val { font-weight: 600; margin-left: 12px; }
      .ectt-summary { margin-top: 6px; padding-top: 5px; border-top: 1px solid var(--divider-color, #374151); font-weight: 700; }
      .stats-chart-title {
        font-size: .58rem; font-weight: 700; letter-spacing: .12em;
        text-transform: uppercase; color: var(--secondary-text-color); opacity: .55; margin-bottom: 8px;
      }
      .stats-chart-loading {
        height: 75px; display: flex; align-items: center; justify-content: center;
        color: var(--secondary-text-color); font-size: .75rem; opacity: .5;
      }
      .stats-solar-hint {
        font-size: .72rem; color: var(--secondary-text-color);
        margin-top: 10px; padding: 6px 10px;
        background: color-mix(in srgb, var(--evcc-green) 8%, transparent);
        border: 1px solid color-mix(in srgb, var(--evcc-green) 25%, transparent);
        border-radius: 6px; line-height: 1.4;
      }

      .battery-block { padding: 0; }
      .batt-main-row { display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
      .batt-text-col { flex: 1; min-width: 0; overflow-wrap: anywhere; display: flex; flex-direction: column; gap: 12px; }
      .batt-text-item { display: flex; gap: 8px; align-items: flex-start; }
      .batt-text-icon { display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px; }
      .batt-text-title { font-size: .82rem; font-weight: 600; margin-bottom: 2px; }
      .batt-text-desc  { font-size: .76rem; color: var(--secondary-text-color); line-height: 1.4; }
      .batt-inline-select { color: var(--primary-color, #00b4d8); font-weight: 600; font-size: .76rem; font-family: inherit; background: transparent; border: none; border-bottom: 1px dotted var(--primary-color, #00b4d8); cursor: pointer; padding: 0 2px; outline: none; appearance: none; -webkit-appearance: none; }
      .batt-visual-col { display: flex; flex-direction: column; align-items: center; gap: 8px; flex-shrink: 0; align-self: flex-start; }
      .batt-marker-top { display: none; }
      .batt-visual { display: flex; flex-direction: column; align-items: center; width: 56px; }
      .batt-cap-tip { width: 22px; height: 5px; background: var(--divider-color, #555); border-radius: 3px 3px 0 0; margin-bottom: 1px; }
      .batt-body { width: 56px; height: 130px; border: 2px solid var(--divider-color, #555); border-radius: 5px; overflow: hidden; display: flex; flex-direction: column; position: relative; }
      .batt-zone { display: flex; align-items: center; justify-content: center; position: relative; z-index: 1; min-height: 20px; }
      .batt-zone-car  { background: #22c55e18; }
      .batt-zone-haus { background: #3b82f618; }
      .batt-zone-icon { font-size: 1.2rem; }
      .batt-divider-line { height: 2px; background: var(--divider-color, #555); flex-shrink: 0; z-index: 2; }
      .batt-soc-overlay { position: absolute; bottom: 0; left: 0; right: 0; z-index: 0; border-radius: 0 0 3px 3px; transition: height .4s; opacity: 0.55; }
      .batt-info-col { display: flex; flex-direction: column; gap: 2px; align-items: center; text-align: center; }
      .batt-info-label { font-size: .7rem; color: var(--secondary-text-color); line-height: 1.2; }
      .batt-info-pct   { font-size: 1.1rem; font-weight: 700; line-height: 1.1; }
      .batt-info-kwh, .batt-info-power { font-size: .7rem; color: var(--secondary-text-color); line-height: 1.2; white-space: nowrap; }
      .batt-discharge-row { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--divider-color, #333); font-size: .84rem; }
      .batt-discharge-toggle { width: 42px; height: 24px; border-radius: 12px; border: none; background: var(--divider-color, #444); position: relative; cursor: pointer; flex-shrink: 0; transition: background .2s; }
      .batt-discharge-toggle.on { background: var(--primary-color, #00b4d8); }
      .batt-toggle-knob { position: absolute; width: 18px; height: 18px; border-radius: 50%; background: white; top: 3px; left: 3px; transition: left .2s; }
      .batt-discharge-toggle.on .batt-toggle-knob { left: 21px; }
      @container (max-width: 420px) {
        .batt-main-row { flex-direction: column; gap: 14px; }
        .batt-visual-col { align-self: stretch; justify-content: flex-start; }
      }

      .session-block { border-top: 1px solid var(--divider-color, #e5e7eb); margin-top: 10px; padding-top: 10px; }
      .session-title { font-size: .7rem; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: var(--secondary-text-color); margin-bottom: 8px; }
      .session-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(70px, 1fr)); gap: 6px; }
      .session-item { display: flex; flex-direction: column; gap: 2px; }
      .si-label { font-size: .7rem; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: .05em; }
      .si-value { font-size: .95rem; font-weight: 600; color: var(--primary-text-color); }

      .plan-block { border-top: 1px solid var(--divider-color, #e5e7eb); margin-top: 10px; padding-top: 10px; }
      .plan-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
      .plan-badge { font-size: .7rem; font-weight: 600; padding: 2px 9px; border-radius: 999px; border: 1px solid var(--divider-color); color: var(--secondary-text-color); }
      .plan-badge.planned { background: rgba(0, 120, 180, 0.3); color: #60aaff; }
      .plan-badge.active  { background: color-mix(in srgb, var(--evcc-green) 15%, transparent); color: var(--evcc-green); border-color: var(--evcc-green); }
      .plan-projection { display: flex; flex-direction: column; gap: 3px; font-size: .78rem; color: var(--secondary-text-color); margin-bottom: 10px; padding: 7px 10px; background: var(--secondary-background-color, rgba(0,0,0,.08)); border-radius: 6px; }
      .plan-projection strong { color: var(--primary-text-color); }
      .plan-inputs { display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; }
      .plan-row { display: flex; align-items: center; gap: 8px; font-size: .83rem; flex-wrap: wrap; }
      .plan-row label { flex: 0 0 auto; min-width: 60px; white-space: nowrap; color: var(--secondary-text-color); }
      .plan-soc-control { display: flex; align-items: center; gap: 8px; flex: 1; }
      .plan-soc-range { flex: 1; accent-color: var(--primary-color); }
      .plan-soc-val { min-width: 42px; text-align: right; font-size: .8rem; }
      input.plan-time-input { flex: 1; padding: 4px 8px; border: 1px solid var(--divider-color, #4b5563); border-radius: 6px; background: var(--card-background-color); color: var(--primary-text-color); font-size: .82rem; color-scheme: dark light; }
      .plan-actions { display: flex; gap: 8px; }
      .plan-btn { flex: 1; padding: 7px 10px; border-radius: 7px; border: 1px solid var(--divider-color); font-size: .8rem; font-weight: 600; cursor: pointer; transition: all .15s; background: transparent; color: var(--primary-text-color); }
      .plan-btn.save { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }
      .plan-btn.save:hover { filter: brightness(1.1); }
      .plan-btn.delete { color: #ef4444; border-color: #ef444466; }
      .plan-btn.delete:hover { background: #ef444422; }
      select.plan-vehicle-select,
      select.plan-precondition-select { flex: 1; padding: 4px 8px; border: 1px solid var(--divider-color, #4b5563); border-radius: 6px; background: var(--card-background-color); color: var(--primary-text-color); font-size: .82rem; }
      .plan-row .toggle { margin-left: auto; }
      .plan-error { margin-top: 8px; padding: 6px 10px; border-radius: 6px; background: #ef444422; color: #ef4444; font-size: .78rem; word-break: break-all; }
      .plan-preview { margin: 10px 0 4px; }
      .plan-preview-loading { text-align: center; padding: 12px; font-size: .78rem; color: var(--secondary-text-color); }
      .plan-preview-error, .plan-preview-info { padding: 8px 10px; border-radius: 6px; background: var(--secondary-background-color, rgba(0,0,0,.08)); color: var(--secondary-text-color); font-size: .78rem; }
      .plan-preview-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
      .plan-preview-left, .plan-preview-right { display: flex; flex-direction: column; }
      .plan-preview-right { text-align: right; }
      .plan-preview-label { font-size: .65rem; text-transform: uppercase; letter-spacing: .03em; color: var(--secondary-text-color); }
      .plan-preview-value { font-size: .88rem; font-weight: 600; color: var(--evcc-green,#22c55e); }
      .rplan-block .plan-header { justify-content: flex-start; gap: 6px; }
      .rplan-hint { display: inline-flex; align-items: center; color: var(--secondary-text-color); cursor: help; }
      .rplan-list { display: flex; flex-direction: column; gap: 8px; }
      .rplan-row { display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; border: 1px solid var(--divider-color); border-radius: 8px; }
      .rplan-days { display: flex; gap: 3px; flex-wrap: wrap; }
      .rplan-day { font-size: .68rem; font-weight: 600; line-height: 1; padding: 4px 5px; border-radius: 5px; min-width: 15px; text-align: center; background: var(--secondary-background-color, rgba(0,0,0,.08)); color: var(--secondary-text-color); border: 1px solid transparent; }
      .rplan-day.on { background: var(--primary-color); color: #fff; }
      .rplan-line { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .rplan-info { display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap; }
      .rplan-field { display: inline-flex; align-items: baseline; gap: 5px; }
      .rplan-label { font-size: .68rem; text-transform: uppercase; letter-spacing: .04em; color: var(--secondary-text-color); }
      .rplan-value { font-size: .9rem; font-weight: 600; }
      .rplan-line .toggle { margin-left: auto; }

      .empty { text-align: center; padding: 24px; color: var(--secondary-text-color); font-size: .9rem; line-height: 1.8; }
      .empty code { background: var(--code-editor-background-color, #1e1e1e); color: var(--primary-color); padding: 1px 6px; border-radius: 4px; font-size: .82rem; }
      .empty-debug-hint { margin-top: 12px; font-size: .82rem; }
      button.debug-link {
        background: transparent; border: 1px solid var(--divider-color, #4b5563);
        color: var(--primary-color); border-radius: 6px;
        padding: 3px 10px; margin-left: 4px; cursor: pointer; font: inherit;
      }
      button.debug-link:hover { background: color-mix(in srgb, var(--primary-color) 10%, transparent); }

      .debug { font-size: .85rem; color: var(--primary-text-color); }
      .debug code { background: color-mix(in srgb, var(--primary-text-color) 8%, transparent); padding: 1px 5px; border-radius: 4px; font-size: .78rem; word-break: break-word; }
      .debug-header {
        display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
        padding-bottom: 10px; margin-bottom: 10px;
        border-bottom: 1px solid var(--divider-color, #4b5563);
      }
      .debug-title { font-size: 1rem; font-weight: 600; flex: 1; }
      .debug-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .debug-copy-btn {
        background: var(--primary-color); color: var(--text-primary-color, white);
        border: none; border-radius: 6px; padding: 6px 14px; cursor: pointer;
        font: inherit; font-weight: 600;
      }
      .debug-copy-btn:hover { filter: brightness(1.1); }
      .debug-mask { display: inline-flex; align-items: center; gap: 6px; font-size: .8rem; color: var(--secondary-text-color); cursor: pointer; }
      .debug-mask input { margin: 0; }
      .debug-toast {
        flex-basis: 100%; padding: 6px 10px; border-radius: 6px;
        font-size: .78rem; font-weight: 600;
      }
      .debug-toast.ok  { background: color-mix(in srgb, var(--evcc-green, #0a0)  18%, transparent); color: var(--evcc-green, #0a0); }
      .debug-toast.err { background: color-mix(in srgb, #ef4444 18%, transparent); color: #ef4444; }

      .debug-section { margin: 12px 0; }
      .debug-section-title { font-size: .78rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--secondary-text-color); margin-bottom: 6px; }
      .debug-kv { list-style: none; padding: 0; margin: 0; }
      .debug-kv li { padding: 3px 0; line-height: 1.5; }
      .debug-kv strong { color: var(--secondary-text-color); font-weight: 500; margin-right: 6px; }
      .debug-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
      .debug-list > li {
        padding: 8px 10px; border-radius: 6px;
        background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
        border: 1px solid var(--divider-color, #4b5563);
      }
      .debug-list-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .debug-count { color: var(--secondary-text-color); font-size: .78rem; }
      .debug-missing { margin-top: 4px; font-size: .76rem; color: var(--secondary-text-color); line-height: 1.5; }
      .debug-suffix-list { margin: 4px 0; font-size: .78rem; line-height: 1.6; }
      .debug-empty { color: var(--secondary-text-color); font-style: italic; padding: 4px 0; }
      .debug-pill {
        display: inline-flex; align-items: center; padding: 1px 8px;
        border-radius: 999px; font-size: .7rem; font-weight: 700;
      }
      .debug-pill.ok   { background: color-mix(in srgb, var(--evcc-green, #0a0)  20%, transparent); color: var(--evcc-green, #0a0); }
      .debug-pill.warn { background: color-mix(in srgb, var(--evcc-amber, #f59e0b) 20%, transparent); color: var(--evcc-amber, #f59e0b); }
      .debug-pill.err  { background: color-mix(in srgb, #ef4444 20%, transparent); color: #ef4444; }
      .debug-pill.info { background: color-mix(in srgb, var(--primary-text-color) 12%, transparent); color: var(--secondary-text-color); }
      .debug-missing-opt { margin-top: 6px; font-size: .76rem; color: var(--secondary-text-color); }
      .debug-missing-opt summary { cursor: pointer; user-select: none; padding: 2px 0; }
      .debug-missing-opt code { margin-top: 4px; display: inline-block; word-break: break-word; }
      .debug-warn-box { margin-top: 8px; padding: 8px 10px; border-radius: 6px; background: color-mix(in srgb, #ef4444 14%, transparent); color: #ef4444; font-size: .82rem; }
      .debug-cfg-note { margin-bottom: 6px; padding: 6px 10px; border-radius: 6px; background: color-mix(in srgb, var(--primary-color) 12%, transparent); color: var(--primary-color); font-size: .76rem; }
      .debug-yaml {
        background: var(--code-editor-background-color, #1e1e1e);
        color: var(--primary-text-color); padding: 10px; border-radius: 6px;
        font-size: .78rem; line-height: 1.5; white-space: pre-wrap; word-break: break-word;
        margin: 0; max-height: 220px; overflow: auto;
      }
      .debug-fallback-ta {
        width: 100%; min-height: 180px; margin-top: 8px;
        font-family: monospace; font-size: .75rem; padding: 8px;
        border-radius: 6px; border: 1px solid var(--divider-color, #4b5563);
        background: var(--card-background-color); color: var(--primary-text-color);
      }
      .compact-tabs {
        display: flex; gap: 4px; margin-bottom: 12px;
        border-bottom: 1px solid var(--divider-color, #e5e7eb); padding-bottom: 0;
      }
      .compact-tab {
        flex: 1; display: flex; flex-direction: column; align-items: center;
        gap: 2px; padding: 6px 4px 8px; background: transparent; border: none;
        border-bottom: 2px solid transparent; color: var(--secondary-text-color);
        cursor: pointer; font-size: .68rem; margin-bottom: -1px;
        transition: color .15s, border-color .15s;
      }
      .compact-tab:hover { color: var(--primary-text-color); }
      .compact-tab.active { color: var(--primary-color); border-bottom-color: var(--primary-color); font-weight: 600; }
      .compact-tab-icon  { font-size: 1rem; line-height: 1; }
      .compact-tab-label { font-size: .68rem; }
      .compact-panel[hidden] { display: none; }
      .compact-panel .plan-block,
      .compact-panel .session-block { border-top: none; margin-top: 0; padding-top: 0; }

      .priority-mode { display: flex; flex-direction: column; gap: 12px; }
      .priority-hint { font-size: .8rem; color: var(--secondary-text-color); }
      .priority-list {
        position: relative;
        display: flex; flex-direction: column;
        border: 1px solid var(--divider-color);
        border-radius: 6px;
        overflow: hidden;
        background: var(--card-background-color);
      }
      .priority-row {
        display: flex; align-items: center; gap: 10px;
        padding: 10px 12px;
        background: var(--card-background-color);
        user-select: none;
        border-bottom: 1px solid var(--divider-color);
        transition: background .15s ease;
      }
      .priority-row:last-child { border-bottom: none; }
      .priority-row.no-entity { opacity: .55; }
      .priority-handle {
        cursor: grab;
        font-size: 1.2rem; line-height: 1;
        color: var(--secondary-text-color);
        touch-action: none;
        padding: 4px 6px;
        user-select: none;
      }
      .priority-handle:active { cursor: grabbing; }
      .priority-row.no-entity .priority-handle { cursor: not-allowed; }
      .priority-row.priority-dragging {
        /* Out of the flow; left/right stretch it to the list width regardless
           of box-sizing, so no inline width is needed. */
        position: absolute; left: 0; right: 0; z-index: 5;
        opacity: .92;
        box-shadow: 0 4px 14px rgba(0, 0, 0, .22);
        background: var(--card-background-color);
        border-bottom: none;
        will-change: transform;
      }
      .priority-placeholder {
        background: var(--divider-color);
        opacity: .25;
      }
      .priority-name { flex: 1; font-weight: 500; }
      .priority-target {
        font-variant-numeric: tabular-nums;
        font-weight: 600;
        min-width: 2.5em;
        text-align: right;
      }
      .priority-target.changed { color: var(--evcc-amber); }
      .priority-was {
        font-weight: 400;
        color: var(--secondary-text-color);
        margin-left: 4px;
        font-size: .8em;
      }
      .priority-no-ent {
        font-weight: 400;
        font-size: .8em;
        color: var(--secondary-text-color);
      }
      .priority-empty-note {
        font-size: .8rem;
        color: var(--secondary-text-color);
        font-style: italic;
      }
      .priority-actions {
        display: flex; gap: 8px; justify-content: flex-end;
      }
      .priority-btn {
        padding: 6px 14px;
        border-radius: 4px;
        border: 1px solid var(--divider-color);
        background: var(--card-background-color);
        color: var(--primary-text-color);
        cursor: pointer;
        font: inherit;
      }
      .priority-btn:hover:not(:disabled) {
        background: var(--secondary-background-color);
      }
      .priority-btn:disabled { opacity: .5; cursor: not-allowed; }
      .priority-btn.apply:not(:disabled) {
        background: var(--evcc-green);
        color: white;
        border-color: transparent;
      }
`;

// _render() replaces the shadow root's innerHTML on every update, and a <style>
// element in there is parsed again each time: around 680 lines of CSS, up to
// every 300 ms and once per card on the dashboard. A constructed CSSStyleSheet
// is parsed once per page and adopted by every shadow root, where it survives
// each innerHTML replacement. null where the browser cannot construct one.
let sharedSheet;
function sharedStyleSheet() {
  if (sharedSheet !== undefined) return sharedSheet;
  try {
    sharedSheet = new CSSStyleSheet();
    sharedSheet.replaceSync(CSS);
  } catch {
    sharedSheet = null;
  }
  return sharedSheet;
}

// Attached to EvccCard.prototype.
export const styles = {
  _styles() {
    return CSS;
  },

  // Adopts the shared sheet on this card's shadow root, once, and returns the
  // markup _render() has to inline: nothing when the sheet is adopted, the
  // <style> element as before when constructed sheets are not supported.
  _styleTag() {
    const root  = this.shadowRoot;
    const sheet = sharedStyleSheet();
    if (sheet && root && Array.isArray(root.adoptedStyleSheets)) {
      if (!root.adoptedStyleSheets.includes(sheet)) {
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
      }
      return "";
    }
    return `<style>${CSS}</style>`;
  },
};
