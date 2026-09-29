// Bundles src/ into the single file HACS ships (dist/evcc-card.js).
// The sources are plain ES modules without external dependencies; the plugin
// below stamps the locale files into the bundle, terser strips what only the
// sources need.
// Output stays an ES module (the locale loader resolves `import.meta.url`) and
// is not minified beyond comments and whitespace: no code is rewritten and no
// name is shortened, so the shipped file still reads in the browser's pretty
// print and a stack trace names the function it came from.
import { createHash } from "node:crypto";
import terser from "@rollup/plugin-terser";
import { readdirSync, readFileSync } from "node:fs";

const LOCALES = "dist/locales";
const BANNER  = "/* hass-evcc-card. Built from src/ with Rollup; edit the sources, not this file. */";

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
  plugins: [
    localesHash(),
    // Comments and whitespace out, everything else as written. The banner stays;
    // the plugin hands its options to a worker as text, so the filter is a
    // pattern and not a function that would need BANNER from this file.
    terser({
      module:   true,
      compress: false,
      mangle:   false,
      format:   { comments: /^ hass-evcc-card\. Built from src\// },
    }),
  ],
  output: {
    file: "dist/evcc-card.js",
    format: "es",
    indent: false,
    generatedCode: "es2015",
    banner: BANNER,
  },
  treeshake: false,
};
