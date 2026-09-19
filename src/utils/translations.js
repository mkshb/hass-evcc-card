import { EVCC_CARD_VERSION } from "../core/constants.js";

/* ── Shared translation cache (used by both EvccCard and EvccCardEditor) ── */
let _sharedTranslations = {};
let _sharedTranslationsReady = false;
let _sharedTranslationsLoading = null;   // Promise while loading, null otherwise

export async function loadSharedTranslations() {
  if (_sharedTranslationsReady) return;
  if (_sharedTranslationsLoading) return _sharedTranslationsLoading;

  _sharedTranslationsLoading = (async () => {
    const base = new URL("locales/", import.meta.url).href;
    let langs = ["de", "en"];
    try {
      const idxResp = await fetch(`${base}index.json?v=${EVCC_CARD_VERSION}`);
      if (idxResp.ok) langs = await idxResp.json();
      else console.warn("[evcc-card] locales/index.json not found, using fallback:", langs);
    } catch (e) {
      console.warn("[evcc-card] Could not load locales/index.json, using fallback:", langs);
    }
    const results = await Promise.allSettled(
      langs.map(lang =>
        fetch(`${base}${lang}.json?v=${EVCC_CARD_VERSION}`)
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
          .then(data => ({ lang, data }))
      )
    );
    for (const result of results) {
      if (result.status === "fulfilled") {
        _sharedTranslations[result.value.lang] = result.value.data;
      } else {
        console.warn("[evcc-card] Failed to load translation:", result.reason);
      }
    }
    _sharedTranslationsReady = true;
    _sharedTranslationsLoading = null;
  })();

  return _sharedTranslationsLoading;
}

export function sharedTranslations() { return _sharedTranslations; }
export function sharedTranslationsReady() { return _sharedTranslationsReady; }
