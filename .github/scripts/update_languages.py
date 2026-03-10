import json, re

with open("dist/locales/index.json") as f:
    langs = json.load(f)

badge_label = " | ".join(langs).replace(" ", "%20").replace("|", "%7C")
badge = f"![Supported languages](https://img.shields.io/badge/languages-{badge_label}-blue)"

new_readme = re.sub(
    r"<!-- LANGUAGES_START -->.*?<!-- LANGUAGES_END -->",
    f"<!-- LANGUAGES_START -->{badge}<!-- LANGUAGES_END -->",
    open("README.md").read(),
    flags=re.DOTALL
)

with open("README.md", "w") as f:
    f.write(new_readme)