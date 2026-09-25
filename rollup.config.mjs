// Bundles src/ into the single file HACS ships (dist/evcc-card.js).
// The sources are plain ES modules without external dependencies; the one
// plugin below only stamps the locale files into the bundle.
// Output stays an ES module and unminified: the locale loader resolves
// `import.meta.url`, and users debug the shipped file in the browser.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";

const LOCALES = "dist/locales";

// HA serves the locale files with a cache lifetime of a month, so the loader
// asks for them under a URL that changes with their content, not only with the
// card version: a text changed within one version would otherwise stay cached.
function localesHash() {
  return {
    name: "locales-hash",
    transform(code, id) {
      if (!id.endsWith("src/utils/translations.js")) return null;
      const hash = createHash("sha256");
      for (const file of readdirSync(LOCALES).filter(f => f.endsWith(".json")).sort()) {
        this.addWatchFile(`${LOCALES}/${file}`);
        hash.update(file).update(readFileSync(`${LOCALES}/${file}`));
      }
      return { code: code.replace("__LOCALES_HASH__", hash.digest("hex").slice(0, 8)), map: null };
    },
  };
}

export default {
  input: "src/index.js",
  plugins: [localesHash()],
  output: {
    file: "dist/evcc-card.js",
    format: "es",
    indent: false,
    generatedCode: "es2015",
    banner: "/* hass-evcc-card. Built from src/ with Rollup; edit the sources, not this file. */",
  },
  treeshake: false,
};
