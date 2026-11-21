# Internationalisation

Version 0.4.0.

## Languages
English (default, `/`), Bengali `/bn/`, Spanish `/es/`, French `/fr/`, German `/de/`, Arabic `/ar/` (right-to-left), Chinese Simplified `/zh/`, Japanese `/ja/`, Korean `/ko/`, Hindi `/hi/`.

## How it works
- Texts: `_abidora/i18n/<lang>.json`, 487 keys each, 0 missing. Placeholders `{brand}`, `{owner}`, `{p1}`… are checked to match English.
- Pages are rendered per language with localised titles, descriptions, `lang`/`dir`, canonical and hreflang links (absolute once the site address is set), and a sitemap.
- Fonts per script: Noto Sans Bengali, Devanagari, Arabic, SC, JP, KR, loaded only for that language. Non-Latin headings get adjusted line height and no letter spacing.
- Numbers: locale formatting; Arabic uses Western digits (`ar-u-nu-latn`); Bengali labels use Bengali digits.
- Language menu on every page. The choice is remembered; English visitors with a saved choice are redirected to it once.

## Quality status
Every non-English language is an **AI draft** and marked `"status":"draft"` with the note "needs review by a native speaker". Admin → Translations lets a reviewer edit and mark it reviewed. Nobody has professionally reviewed them yet.

## Adding or changing text
Admin → Translations → pick language → edit → Save → Publish. New keys appear in every language automatically, using English until translated.

## Founder page note
Technology interest lists keep standard technical terms (LLM, RAG, WebGL, IoT…) in Latin script inside translations, as is normal in tech writing in each language.
