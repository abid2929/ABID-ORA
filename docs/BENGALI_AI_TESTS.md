# Bengali AI quality: investigation and tests (20 Nov 2026)

Status: IN PROGRESS. Automatic checks run and passed as shown below. Native-speaker rating: waiting for the owner (see `BENGALI_RATING_SHEET.md`). Nothing here claims native-level quality.

## How the AI answers in Bengali (the pipeline)
1. The browser sends the last 24 turns, the page language and any memory (`src/scripts/ai.ts` → `api/ai.php`).
2. The server builds the system prompt (`_abidora/lib/ai.php`, `ab_ai_system`) and, new in this version, adds per-message hints at the end (`ab_ai_turn_hints`).
3. The server streams the answer from Google Gemini. The free model is chosen automatically (now `gemini-3.5-flash-lite`).

## Root causes found
| Problem seen | Cause |
|---|---|
| tumi and apni mixed in one answer, or tumi used with a stranger | The prompt said "use apni unless they say tumi", but this was in the middle of a long prompt. The small model drifted, mostly towards tumi. |
| "banglai kotha bolo" answered in Banglish (Latin letters) | The script rule followed only the letters of the latest message. A request for Bangla was not detected. |
| Broken or slangy sentences ("শুন খারাপ লাগলো", "বলবা") | There was no Bengali style guidance (standard colloquial, no dialect forms). |
| A website "world" suggested in travel or image answers | The rule allowed "a world clearly fits"; the model read that too widely. |
| Error instead of an answer when Google is busy | One Gemini model only. Google's free tier returns 429 (per-minute limit) or 503 (busy), and there was no backup. A stuck request also waited 120 s. |
| Banglish answers turning into Bengali script (seen during the fix) | The Bengali style hint contained Bengali-script examples. Banglish now gets its own Latin-only hint. |

## What changed
- `ab_ai_turn_hints()` (new, `_abidora/lib/ai.php`) works out the following from the visitor's own messages and adds a short, explicit rule at the very end of the instructions:
  - **Script:** Bengali script, Banglish, or English. A Banglish word list is used, so Banglish is recognised even on the English page.
  - **Bangla request:** whether the visitor asked for Bangla ("banglai kotha bolo", "বাংলায় বলো"). From then on, answers use Bengali script.
  - **tumi or apni:** tumi only if the visitor used tumi or tui; otherwise apni forms, with the verb forms spelled out, and never mixed.
  - **Bengali style:** standard colloquial Bangladeshi Bangla, correct grammar, no সাধু or dialect forms, no word-for-word translation.
- The world-suggestion rule is now strict: worlds are suggested only when the visitor asks about the site or something to explore.
- **Model chain:** `api/ai.php` tries up to 4 free Gemini models in turn (the auto pick, then gemini-3.1-flash-lite, gemini-3.5-flash and gemini-flash-lite-latest).
  - The next model is tried when one model is busy, over quota or stuck, but only before any words have been shown.
  - A stuck model is dropped after 18 s with no data, and the whole chain stops after 30 s.
  - Tested with a broken first model: the chain moves on correctly. During the test, Google answered 503 for gemini-3.1-flash-lite and gemini-3.5-flash stalled, which shows why the chain is needed.
- Models compared on Bengali: gemini-3.5-flash-lite (fast, about 0.9 s to the first words, reliable today), gemini-3.5-flash and gemini-3.8-flash.
  - The bigger models answered with similar Bengali but took 4 to 11 s for the first words.
  - They also often failed with 503 or stalled on the free tier.
  - Decision: keep Flash-Lite as the main model and use the bigger ones only as backups.

## Test set
55 conversations (`tests/bengali/bn50.json`) in these categories:
- greetings and casual chat
- feelings
- study
- career and business
- tech and code
- writing (application, caption, poem, translation)
- humour
- daily life
- health
- money
- honesty traps (live price, news, drawing, "are you Abid?")
- site questions
- mixed Bangla/English
- multi-turn context
- religion and culture

Each answer is checked automatically for:
- the right script
- tumi/apni consistency
- "Abidora" kept in Latin letters
- website pushing
- doctor advice on health
- no fake live prices

I also read every flagged answer by hand.

## Results (same 55 conversations, real Gemini, before and after the change)
| Check | Before | After |
|---|---|---|
| Answers that failed (Google free quota) | 3 | 0 |
| Wrong script (includes the 3 empty answers before) | 5 | 2 |
| tumi/apni wrong or mixed | 12 | 1 |
| Website pushed into an unrelated answer | 1 | 0 (2 found by reading before) |
| Answers with any automatic flag | 18 | 3 |
| Median time to first words | 0.89 s | 0.94 s |

The 3 flags left after the change:
- **"kemon acho?" answered with tumi.** This is correct, because the visitor used tumi ("acho"). The check was too strict.
- **"hi bhai ki obostha" answer had one Bengali-script word** ("Bhalo আছি") inside Banglish. This is a real but small model slip.
- **Drawing request.** The answer contains an English image prompt on purpose, so this flag is a false alarm.

## Known limits (honest)
- The test runner retries the same model, while the real endpoint now uses the model chain. "0 failed" also depends on Google's load at that moment.
- Flash-Lite still makes small word choices a native speaker may find odd, for example "মায়া লাগল" where "খারাপ লাগল" is more natural. Banglish spelling is sometimes uneven ("xarap"). Only a native reader can judge this: see the rating sheet.
- The automatic checks are heuristics. They catch script and tumi/apni errors, but not tone or naturalness.
- Free-tier limits are set by Google and can change. When every model in the chain is over its limit, the visitor sees the quota message with Retry.

## Files
- `_abidora/lib/ai.php`: `ab_ai_turn_hints`, `ab_ai_is_banglish`, `ab_ai_gemini_chain`, the stricter world rule, and the stall timeout.
- `api/ai.php`: uses the hints and the model chain.
- `tests/bengali/`: the test set, runner, raw results before and after, and the model comparison.
