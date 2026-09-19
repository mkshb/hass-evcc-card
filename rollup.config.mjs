// Bundles src/ into the single file HACS ships (dist/evcc-card.js).
// No plugins: the sources are plain ES modules without external dependencies.
// Output stays an ES module and unminified: the locale loader resolves
// `import.meta.url`, and users debug the shipped file in the browser.
export default {
  input: "src/index.js",
  output: {
    file: "dist/evcc-card.js",
    format: "es",
    indent: false,
    generatedCode: "es2015",
    banner: "/* hass-evcc-card. Built from src/ with Rollup; edit the sources, not this file. */",
  },
  treeshake: false,
};
