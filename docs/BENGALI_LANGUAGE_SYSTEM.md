# Abidora AI: Bengali Language Quality System

Status: IMPLEMENTED and tested with automatic checks. Native-speaker sign-off by the owner is pending.

## How it works
Each Bengali message triggers rules that are added to the end of the AI's instructions. They come from `ab_ai_turn_hints()` in `_abidora/lib/ai.php` and the new file `_abidora/lib/ai-bn.php`.

The rules are general writing rules for every future conversation. They do not contain stored answers.

There are three layers:
1. **Core rules** for every Bengali answer.
2. **Banglish rules**, used only when the answer is in English letters.
3. **Task rules**, added only when the latest message needs them.

## The owner's 10 areas and where each one lives
| Area | Rule |
|---|---|
| Natural Bengali conversation | Core 1, 6, 7: think in Bengali, use everyday words, give short answers, match the tone, no "অবশ্যই!" openers, no repeated points |
| Correct Bengali grammar | Core 2, 3, 4: one person (আপনি/তুমি) throughout, correct verb forms, spelling list (কী/কি, কোনো, হলো…), দাঁড়ি punctuation |
| Banglish understanding | Detection by a Banglish word list (works on the English page too); Banglish rules (common spellings, real words only, English words for modern things) |
| Bengali-English translation | Translation task rule: translate the meaning, not word by word, and keep the tone |
| Proper sentence formation | Core 2 and 6; Bangladeshi vocabulary in Core 9 (পানি, গোসল…) |
| Context-aware responses | "Speak Bangla" request detection, tumi/apni from the visitor's own words, Core 7 (tone by age and situation), feelings task rule |
| Educational Bengali | Study task rule: definition, step by step, local example, textbook terms, exact science, plain-text formulas (Core 10) |
| Professional Bengali writing | Letter task rule (standard Bangladeshi application format, no "মহাত্মন"/"বাধিত করবেন"); caption task rule (3 styles, hook, call to action, hashtags) |
| Friendly conversational tone | Core 7, feelings rule (plain empathy, no drama) |
| Bengali voice pronunciation compatibility | Core 11: no "/" between words, no emoji inside sentences, no tables for simple answers, spell out abbreviations; numbered lists now render properly |

Other task rules: health (safety first, warning signs, see a doctor, no doses), live data (never guess, name only real sources), history and culture (accepted view plus the other view, no overstatement), code (one code block, short Bengali explanation).

## Other fixes made with it
- The site's Markdown renderer now treats "১." and "२." lists as real numbered lists. Before, they showed as one block of text, which was the formatting problem in question 4.
- Bengali answers are marked `lang="bn"`, so list numbers, fonts and screen readers use Bengali.

## Tests (20 Nov 2026, real Gemini 3.5 Flash-Lite)
- **The same 17 rated questions,** old answers vs new: see `BENGALI_BEFORE_AFTER_17.md`. My estimate moves from 3.3 to about 4.2, but that needs the owner's own rating.
- **All 55 Bengali conversations:** 55/55 answered and 3 automatic flags.
  - All 3 flags were checked by hand and are false alarms (the visitor used tumi; a story with dialogue; an English image prompt on purpose).
  - Median time to the first words was 0.89 s.
- **No regressions** in the voice, memory or API structure. Only the instructions and display changed.

## Still left (honest)
- Flash-Lite still makes small slips:
  - কি/কী
  - an occasional typo ("শিশুগামী", "বভাগ")
  - once a Bengali digit inside a chemical formula
- Banglish is the weakest area. It is much better than before, but odd words still appear sometimes. A stronger Gemini model would help, but on the free tier those models are often busy (503) or out of quota today.
- There is no web search in this version. Google's search tool for Gemini has its own limits, and it needs the owner's approval before it is turned on.
