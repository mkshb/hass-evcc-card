import { EVCC_CARD_VERSION, FEATURES } from "../core/constants.js";
import { discoverEntities } from "../core/entity-discovery.js";

// Debug mode: expected entities, config dump, debug report. Methods are mixed into EvccCard.prototype.
export const debugView = {
  _expectedLpSuffixes() {
    if (!this._cachedLpSuffixes) {
      this._cachedLpSuffixes = Array.from(new Set(FEATURES.filter(f => f.lp).map(f => f.suffix)));
    }
    return this._cachedLpSuffixes;
  },

  _expectedSiteSuffixes() {
    if (!this._cachedSiteSuffixes) {
      this._cachedSiteSuffixes = Array.from(new Set(FEATURES.filter(f => !f.lp).map(f => f.suffix)));
    }
    return this._cachedSiteSuffixes;
  },

  _coreLpSuffixes() {
    if (!this._cachedCoreLp) {
      this._cachedCoreLp = new Set(FEATURES.filter(f => f.lp && f.core).map(f => f.suffix));
    }
    return this._cachedCoreLp;
  },

  _coreSiteSuffixes() {
    if (!this._cachedCoreSite) {
      this._cachedCoreSite = new Set(FEATURES.filter(f => !f.lp && f.core).map(f => f.suffix));
    }
    return this._cachedCoreSite;
  },

  // Drops indexed features (pv_N_*, battery_N_*, charge_currents_N) from `suffixes`
  // when the previous index is also missing in `found`. So `pv_2_power` only
  // counts as "expected" if `pv_1_power` is present.
  _filterIndexedExpected(suffixes, found) {
    return suffixes.filter(s => {
      const mIdx = s.match(/^(pv|battery)_(\d+)_(.+)$/);
      if (mIdx) {
        const [, base, idxStr, stem] = mIdx;
        const idx = parseInt(idxStr, 10);
        if (idx === 0) return true;
        return found[`${base}_${idx-1}_${stem}`] != null;
      }
      const mCc = s.match(/^charge_currents_(\d+)$/);
      if (mCc) {
        const idx = parseInt(mCc[1], 10);
        if (idx === 0) return true;
        return found[`charge_currents_${idx-1}`] != null;
      }
      return true;
    });
  },

  // Splits a set of expected suffixes into { core, optional, missingCore, missingOpt }
  // relative to `found` (an object whose keys are the entity suffixes that exist).
  // Indexed features with N >= 1 (pv_2_*, battery_3_*, charge_currents_1, …) are
  // excluded from the missing-optional list because the actual count depends on
  // hardware (number of PV strings / batteries / phases) and is naturally variable.
  _splitCoreOptional(expected, found, coreSet) {
    const foundKeys   = new Set(Object.keys(found));
    const isIndexedHigh = s =>
      /^(pv|battery)_[1-9]\d*_/.test(s) || /^charge_currents_[1-9]\d*$/.test(s);
    const core        = expected.filter(s => coreSet.has(s));
    const opt         = expected.filter(s => !coreSet.has(s));
    const missingCore = core.filter(s => !foundKeys.has(s));
    const missingOpt  = opt.filter(s => !foundKeys.has(s) && !isIndexedHigh(s));
    const foundCore   = core.filter(s => foundKeys.has(s));
    const foundOpt    = opt.filter(s => foundKeys.has(s));
    return {
      core: core.length, foundCore: foundCore.length, missingCore,
      opt:  opt.length,  foundOpt:  foundOpt.length,  missingOpt,
    };
  },

  _formatConfigYaml(cfg, maskNames = false) {
    if (!cfg || typeof cfg !== "object") return String(cfg ?? "—");
    const out = ["type: custom:evcc-card"];
    const lpMaskCount = { i: 0 };
    const maskValue = (key, val) => {
      if (!maskNames) return val;
      if (key === "title") return "***";
      if (key === "loadpoints" || key === "no_plan" || key === "no_pv" || key === "repeating_plan_vehicles") {
        if (Array.isArray(val)) return val.map(() => `lp_${++lpMaskCount.i}`);
        if (typeof val === "string") return `lp_${++lpMaskCount.i}`;
      }
      return val;
    };
    for (const [k, raw] of Object.entries(cfg)) {
      if (k === "type") continue;
      const v = maskValue(k, raw);
      if (Array.isArray(v)) {
        if (v.length === 0) out.push(`${k}: []`);
        else out.push(`${k}:\n${v.map(item => `  - ${item}`).join("\n")}`);
      } else if (v != null && typeof v === "object") {
        out.push(`${k}: ${JSON.stringify(v)}`);
      } else {
        out.push(`${k}: ${v}`);
      }
    }
    return out.join("\n");
  },

  _renderDebugBlock(loadpoints, site, meters) {
    const prefix    = this._getPrefix();
    const haVer     = this._hass?.config?.version || "?";
    const lang      = (this._config.language
      || (this._hass?.language ?? "de")).split("-")[0].toLowerCase();
    const cfgLang   = this._config.language || null;
    const ua        = (typeof navigator !== "undefined" ? navigator.userAgent : "—");
    const evccCount = Object.keys(this._hass?.states || {})
      .filter(id => id.split(".")[1]?.startsWith(prefix)).length;

    const allLp   = this._expectedLpSuffixes();
    const allSite = this._expectedSiteSuffixes();
    const coreLp  = this._coreLpSuffixes();
    const coreSite = this._coreSiteSuffixes();

    const lpNames    = Object.keys(loadpoints || {});
    const meterNames = Object.keys(meters || {});
    const loadedLocales = Object.keys(this._translations || {});

    const expectedSite = this._filterIndexedExpected(allSite, site || {});
    const siteSplit    = this._splitCoreOptional(expectedSite, site || {}, coreSite);

    const pill = (tone, text) => `<span class="debug-pill ${tone}">${text}</span>`;
    const escUa = ua.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const lpRows = lpNames.length === 0
      ? `<div class="debug-empty">—</div>`
      : `<ul class="debug-list">${lpNames.map(name => {
          const ents     = loadpoints[name];
          const expected = this._filterIndexedExpected(allLp, ents);
          const split    = this._splitCoreOptional(expected, ents, coreLp);
          const coreTone = split.missingCore.length === 0 ? "ok" : "err";
          return `
            <li>
              <div class="debug-list-head">
                <code>${name}</code>
                ${pill(coreTone, `${this._t("debugCore")} ${split.foundCore}/${split.core}`)}
                ${pill("info", `${this._t("debugOptional")} ${split.foundOpt}/${split.opt}`)}
              </div>
              ${split.missingCore.length
                ? `<div class="debug-missing"><strong>${this._t("debugMissingCore")}:</strong> <code>${split.missingCore.join(", ")}</code></div>`
                : ""}
              ${split.missingOpt.length
                ? `<details class="debug-missing-opt"><summary>${this._t("debugMissingOptional")} (${split.missingOpt.length})</summary><code>${split.missingOpt.slice(0, 20).join(", ")}${split.missingOpt.length > 20 ? `, +${split.missingOpt.length - 20}` : ""}</code></details>`
                : ""}
            </li>`;
        }).join("")}</ul>`;

    const meterRows = meterNames.length === 0
      ? `<div class="debug-empty">—</div>`
      : `<ul class="debug-list">${meterNames.map(name => {
          const count = Object.keys(meters[name]).length;
          return `<li>
            <div class="debug-list-head">
              <code>${name}</code>
              <span class="debug-count">${count} ${this._t("debugEntities")}</span>
              ${pill("warn", this._t("debugOrphan"))}
            </div>
            <div class="debug-missing">${this._t("debugOrphanHint")}</div>
          </li>`;
        }).join("")}</ul>`;

    const cfgSource = this._origConfig || this._config;
    const cfgYaml = this._formatConfigYaml(cfgSource, this._debugMask === true);
    const cfgNote = this._origConfig
      ? `<div class="debug-cfg-note">${this._t("debugCfgFromEmptyState")}</div>`
      : "";

    return `
      <div class="debug">
        <div class="debug-header">
          <div class="debug-title">🐞 ${this._t("debugTitle")}</div>
          <div class="debug-actions">
            <button class="debug-copy-btn">${this._t("debugCopyReport")}</button>
            <label class="debug-mask">
              <input type="checkbox" class="debug-mask-toggle" ${this._debugMask ? "checked" : ""}/>
              ${this._t("debugMaskNames")}
            </label>
          </div>
          <div class="debug-toast" hidden></div>
        </div>

        <div class="debug-section">
          <div class="debug-section-title">${this._t("debugVersions")}</div>
          <ul class="debug-kv">
            <li><strong>Card:</strong> <code>${EVCC_CARD_VERSION}</code></li>
            <li><strong>Home Assistant:</strong> <code>${haVer}</code></li>
            <li><strong>Browser:</strong> <code>${escUa}</code></li>
            <li><strong>Language:</strong> <code>${lang}</code>${cfgLang ? ` (configured: <code>${cfgLang}</code>)` : ""}</li>
          </ul>
        </div>

        <div class="debug-section">
          <div class="debug-section-title">${this._t("debugIntegration")}</div>
          <ul class="debug-kv">
            <li><strong>${this._t("debugEvccEntities")}:</strong> ${evccCount} ${evccCount > 0 ? pill("ok", "OK") : pill("err", "0")}</li>
            <li><strong>${this._t("debugPrefixAuto")}:</strong> <code>${this._detectedPrefix || "—"}</code></li>
            <li><strong>${this._t("debugPrefixCfg")}:</strong> <code>${this._config.prefix || "—"}</code></li>
          </ul>
          ${evccCount === 0 ? `<div class="debug-warn-box">${this._t("debugNoIntg")}</div>` : ""}
        </div>

        <div class="debug-section">
          <div class="debug-section-title">WebSocket API</div>
          <ul class="debug-kv">
            <li><strong>Config entry id:</strong> <code>${this._entryId || "—"}</code></li>
            ${!this._capsLoaded
              ? `<li><em>Probing capabilities…</em></li>`
              : !this._caps || this._caps.commands.length === 0
                ? `<li>${pill("warn", "not supported")} <em>(older ha-evcc / unknown command)</em></li>`
                : (() => {
                    const items = [];
                    items.push(`<li><strong>Integration version:</strong> <code>${this._caps.version ?? "—"}</code></li>`);
                    items.push(`<li><strong>Commands:</strong> ${this._caps.commands.map(c => `<code>${c}</code>`).join(", ")}</li>`);
                    const lpMap = Object.entries(this._lpIndexMap || {});
                    items.push(`<li><strong>Loadpoint index map:</strong> ${lpMap.length ? lpMap.map(([id, i]) => `<code>${id}=${i}</code>`).join(", ") : `${pill("warn", "fallback")} <em>(heuristic/override; older ha-evcc)</em>`}</li>`);
                    // Show cached probe results (prefetched by _prefetchDebugProbes).
                    const fmtProbe = (label, cacheKey, fmt) => {
                      const c = this._wsCache[cacheKey];
                      if (!c) return `<li><strong>${label}:</strong> <em>loading…</em></li>`;
                      if (c.result.error) return `<li><strong>${label}:</strong> ${pill("err", "error")} <code>${c.result.error}</code></li>`;
                      return `<li><strong>${label}:</strong> ${fmt(c.result.data)}</li>`;
                    };
                    if (this._hasCmd("forecast"))
                      items.push(fmtProbe("forecast (grid)", "forecast:grid",
                        d => `${Array.isArray(d?.rates) ? d.rates.length : 0} rates${d?.unit ? ` (${d.unit})` : ""}`));
                    if (this._hasCmd("sessions"))
                      items.push(fmtProbe("sessions", "sessions::",
                        d => `${Array.isArray(d?.sessions) ? d.sessions.length : 0} sessions`));
                    return items.join("\n");
                  })()
            }
          </ul>
        </div>

        <div class="debug-section">
          <div class="debug-section-title">${this._t("debugLoadpoints")} (${lpNames.length})</div>
          ${lpRows}
        </div>

        <div class="debug-section">
          <div class="debug-section-title">${this._t("debugSiteFeatures")}</div>
          <div class="debug-list-head" style="margin-bottom:6px">
            ${pill(siteSplit.missingCore.length === 0 ? "ok" : "err", `${this._t("debugCore")} ${siteSplit.foundCore}/${siteSplit.core}`)}
            ${pill("info", `${this._t("debugOptional")} ${siteSplit.foundOpt}/${siteSplit.opt}`)}
          </div>
          ${siteSplit.missingCore.length ? `<div class="debug-suffix-list debug-missing"><strong>${this._t("debugMissingCore")}:</strong> <code>${siteSplit.missingCore.join(", ")}</code></div>` : ""}
          ${siteSplit.missingOpt.length ? `<details class="debug-missing-opt"><summary>${this._t("debugMissingOptional")} (${siteSplit.missingOpt.length})</summary><code>${siteSplit.missingOpt.slice(0, 24).join(", ")}${siteSplit.missingOpt.length > 24 ? `, +${siteSplit.missingOpt.length - 24}` : ""}</code></details>` : ""}
        </div>

        <div class="debug-section">
          <div class="debug-section-title">${this._t("debugMeters")} (${meterNames.length})</div>
          ${meterRows}
        </div>

        <div class="debug-section">
          <div class="debug-section-title">${this._t("debugCardConfig")}</div>
          ${cfgNote}
          <pre class="debug-yaml">${cfgYaml.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
        </div>

        <div class="debug-section">
          <div class="debug-section-title">${this._t("debugTranslations")}</div>
          <ul class="debug-kv">
            <li><strong>${this._t("debugLoaded")}:</strong> <code>${loadedLocales.join(", ") || "—"}</code></li>
          </ul>
        </div>
      </div>
    `;
  },

  _buildDebugReport(maskNames = false) {
    const prefix    = this._getPrefix();
    const haVer     = this._hass?.config?.version || "?";
    const lang      = (this._config.language
      || (this._hass?.language ?? "de")).split("-")[0].toLowerCase();
    const cfgLang   = this._config.language || null;
    const ua        = (typeof navigator !== "undefined" ? navigator.userAgent : "—").slice(0, 300);
    const evccCount = Object.keys(this._hass?.states || {})
      .filter(id => id.split(".")[1]?.startsWith(prefix)).length;

    const { loadpoints, site, meters } = discoverEntities(this._hass, prefix);

    const allLp    = this._expectedLpSuffixes();
    const allSite  = this._expectedSiteSuffixes();
    const coreLp   = this._coreLpSuffixes();
    const coreSite = this._coreSiteSuffixes();

    const lpNames    = Object.keys(loadpoints);
    const meterNames = Object.keys(meters);
    const lpMask    = Object.fromEntries(lpNames.map((n, i)    => [n, `lp_${i+1}`]));
    const meterMask = Object.fromEntries(meterNames.map((n, i) => [n, `meter_${i+1}`]));
    const dispLp    = n => maskNames ? lpMask[n]    : n;
    const dispMeter = n => maskNames ? meterMask[n] : n;

    const expectedSite = this._filterIndexedExpected(allSite, site);
    const siteSplit    = this._splitCoreOptional(expectedSite, site, coreSite);
    const loadedLocales = Object.keys(this._translations || {});

    const fmtList = (arr, max = 12) =>
      arr.length === 0 ? "—"
        : arr.slice(0, max).join(", ") + (arr.length > max ? `, +${arr.length - max}` : "");

    const out = [];
    out.push(`<details><summary>EVCC Card Debug Report (auto-generated)</summary>`);
    out.push(``);
    out.push(`**Versions**`);
    out.push(`- Card: ${EVCC_CARD_VERSION}`);
    out.push(`- Home Assistant: ${haVer}`);
    out.push(`- Browser: ${ua}`);
    out.push(`- Language: ${lang}${cfgLang ? ` (configured: ${cfgLang})` : ""}`);
    out.push(``);
    out.push(`**Integration**`);
    out.push(`- evcc entity IDs (\`${prefix}*\`): ${evccCount}`);
    out.push(`- Prefix detected: ${this._detectedPrefix ? `\`${this._detectedPrefix}\`` : "*(none)*"}`);
    out.push(`- Prefix configured: ${this._config.prefix ? `\`${this._config.prefix}\`` : "*(none)*"}`);
    out.push(``);

    // ── WebSocket data API (evcc_intg/forecast|sessions|plan_preview) ──
    out.push(`**WebSocket API**`);
    out.push(`- Config entry id: ${this._entryId ? `\`${this._entryId}\`` : "*(not found)*"}`);
    if (!this._capsLoaded) {
      out.push(`- Capabilities: *(probing…)*`);
    } else if (!this._caps || this._caps.commands.length === 0) {
      out.push(`- Capabilities: *not supported (older ha-evcc / unknown command)*`);
    } else {
      out.push(`- Integration version: \`${this._caps.version ?? "—"}\``);
      out.push(`- Commands: ${this._caps.commands.map(c => `\`${c}\``).join(", ")}`);

      // Live probes — read from cache (populated by visual debug block render).
      // Show prefetched probe results (cached by _prefetchDebugProbes).
      const probe = (label, cacheKey, fmt) => {
        const c = this._wsCache[cacheKey];
        if (!c) { out.push(`- ${label}: *(not fetched)*`); return; }
        if (c.result.error) { out.push(`- ${label}: **error** \`${c.result.error}\``); return; }
        out.push(`- ${label}: ${fmt(c.result.data)}`);
      };
      if (this._hasCmd("forecast"))
        probe("forecast (grid)", "forecast:grid",
          d => `${Array.isArray(d?.rates) ? d.rates.length : 0} rates${d?.unit ? ` (${d.unit})` : ""}`);
      if (this._hasCmd("sessions"))
        probe("sessions", "sessions::",
          d => `${Array.isArray(d?.sessions) ? d.sessions.length : 0} sessions`);
    }
    out.push(``);

    out.push(`**Loadpoints** (${lpNames.length})`);
    if (lpNames.length === 0) {
      out.push(`*(none detected)*`);
    } else {
      out.push(`| Name | Core | Optional | Missing core | Missing optional |`);
      out.push(`|---|---|---|---|---|`);
      for (const name of lpNames) {
        const ents     = loadpoints[name];
        const expected = this._filterIndexedExpected(allLp, ents);
        const sp       = this._splitCoreOptional(expected, ents, coreLp);
        const coreMark = sp.missingCore.length === 0 ? "✓" : "✗";
        out.push(`| \`${dispLp(name)}\` | ${sp.foundCore}/${sp.core} ${coreMark} | ${sp.foundOpt}/${sp.opt} | ${fmtList(sp.missingCore, 10)} | ${fmtList(sp.missingOpt, 10)} |`);
      }
    }
    out.push(``);
    out.push(`**Site features** — Core ${siteSplit.foundCore}/${siteSplit.core} ${siteSplit.missingCore.length === 0 ? "✓" : "✗"} · Optional ${siteSplit.foundOpt}/${siteSplit.opt}`);
    if (siteSplit.missingCore.length) out.push(`- Missing core: \`${siteSplit.missingCore.join(", ")}\``);
    if (siteSplit.missingOpt.length)  out.push(`- Missing optional: \`${fmtList(siteSplit.missingOpt, 24)}\``);
    out.push(``);
    out.push(`**Meters / orphan groups** (${meterNames.length})`);
    if (meterNames.length === 0) {
      out.push(`*(none)*`);
    } else {
      for (const name of meterNames) {
        const count = Object.keys(meters[name]).length;
        out.push(`- \`${dispMeter(name)}\` — ${count} entities (no \`charge_power\`)`);
      }
    }
    out.push(``);
    out.push(`**Card configuration**${this._origConfig ? " *(restored from empty state)*" : ""}`);
    out.push("```yaml");
    out.push(this._formatConfigYaml(this._origConfig || this._config, maskNames));
    out.push("```");
    out.push(``);
    out.push(`**Translations**`);
    out.push(`- Loaded: ${loadedLocales.join(", ") || "—"}`);
    out.push(``);
    out.push(`</details>`);
    return out.join("\n");
  },
};
