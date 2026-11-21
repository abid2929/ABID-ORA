# Bengali voice (text-to-speech): options, tests and limits (20 Nov 2026)

Status: TESTED where marked. The real microphone and speaker on the owner's phone are NOT tested yet; that needs the staging site.

## The three voices on the AI page and in the voice call
| Option | What it is | Bengali quality | Speed | Cost and limit |
|---|---|---|---|---|
| **Abid Islam · AI voice clone** | ElevenLabs voice "abid", cloned from the owner's own consented recording, model eleven_v4 | TESTED: a Bengali + English test sentence was transcribed back 33/33 words correct (ElevenLabs Scribe). Sound judged by the owner: pending. | Streams, usually well under 1 s to the first sound (not measured on the owner's host) | Paid ElevenLabs credits. About 2,190 left until 10 Dec. The site limits it to 300 characters a day, then switches to the next voice automatically. |
| **Natural AI voice (Google Gemini)** | Google Gemini TTS (gemini-3.8-flash-tts), made on the server with the site's Gemini key | TESTED: clear, correct Bengali. A transcript of the clip matched the text; an AI listener rated it 4/5 ("clear, slightly synthetic rhythm"). | About 2.5 to 3 s per sentence (measured 7 times) | **Free tier is only 10 clips a day per model** (Google's own error message, tested today). That is far too few for visitors, so this option is **OFF**. It is ready in the code, but it needs a paid Gemini plan and the owner's approval. |
| **Device voice** | The phone's or computer's own voice (Web Speech API) | Depends on the device. Android Chrome often has a Google Bengali voice. Most desktop browsers and many iPhones have **no Bengali voice**, and then the page says so. Not tested on real devices from here. | Instant | Free, unlimited, works offline |

**Order in use:** the clone when it is on and has credits. Then the natural voice, only if the owner turns it on. Then the device voice. A failure in one voice moves to the next one without stopping the conversation.

## Honest labels on screen
- **Clone:** "an AI-generated clone of Abid Islam's voice, used with permission. Abidora AI is an AI, not Abid Islam."
- **Natural voice:** "a natural AI voice made by Google Gemini. It is not a human and not Abid Islam."
- **Voice call:** described as "sequential". It listens, then thinks, then speaks. It is not real-time speech-to-speech.

## Privacy
- Text sent for speech goes to ElevenLabs (clone) or Google (natural voice).
- The microphone is used only after the visitor agrees, and only through the browser's own speech recognition (Google or Apple, depending on the device).
- The site does not record or store any audio. Generated speech clips are cached on the server so the same sentence is not paid for twice; they contain only the AI's words.

## What would make Bengali speech better (needs the owner's decision)
1. **Keep the clone as the main voice**, and buy more ElevenLabs characters if visitors use it a lot.
2. **Turn on the Gemini natural voice with a paid Gemini plan**, as a cheaper second voice. One switch in the config (`tts.natural = true`). The owner must approve any paid plan first.
3. For phones without a Bengali voice, the owner can install "Speech Services by Google" with Bengali voice data (Android).

## Files
- `api/tts.php`: the clone stream (existing) plus `ab_tts_natural()`, which is off by default and has a cache, daily limits, silence trimming and fallback between the two Gemini TTS models.
- `src/scripts/ai.ts`: `engine()` chooses clone, natural or device voice. Same queue for chat and voice call, with honest labels.
- Test: `audit/natcall2.js` runs a full voice call with the natural voice (stub audio) and checks the loop, barge-in, mute, transcript and end call. Result: PASSED.
