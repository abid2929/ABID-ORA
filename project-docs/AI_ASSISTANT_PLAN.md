# Abidora AI: plan

Status: **PLANNED**. Starts after milestone 1. Nothing on the site pretends to be an AI today.

## What the owner asked for
- A real assistant named **Abidora AI** (it never presents itself as Abid Islam), floating on every page.
- Platform guide: knows every world, recommends and navigates; learns new worlds automatically when they are published.
- Real model, real web search with real citations, memory (conversation; long-term only with consent and with view/edit/delete; per-user isolation; knowledge retrieval), files and images, tools, text and voice, 10 languages.
- Voice in the owner's authorised cloned voice.
- Keys only on the PHP server, rate limits, cost caps, privacy.

## Build order (owner's)
1 text chat → 2 history → 3 memory → 4 web search → 5 platform knowledge → 6 files/images → 7 tools → 8 voice → 9 tests in 10 languages. The text chatbot ships first; it is not held back for voice.

## Already in place
Every Publish writes `_abidora/storage/knowledge/<lang>.json`: all 112 worlds (name, category, status, link, summary), the pages, and founder-approved information (title, tagline, philosophy, vision, actual projects, interests marked "not expertise"). The assistant will answer about Abidora only from this.

## First deliverable of the phase: provider comparison
To be written with current prices at the time (prices change):
| Need | Candidates to compare |
|---|---|
| Language model | Anthropic Claude, OpenAI, Google Gemini |
| Web search with citations | provider-built search tools, or a search API (Brave, Bing, Tavily) |
| Speech to text | OpenAI, Google, Deepgram, ElevenLabs |
| Cloned voice (commercial rights, consent rules) | ElevenLabs, others |
Criteria: quality in all 10 languages, price per conversation, commercial voice-cloning terms, data retention, streaming support.

## Shared-hosting limits to plan around
- PHP streaming: long responses need output buffering off and `X-Accel-Buffering: no`; some hosts still buffer. Fallback: send the reply when complete.
- Request time limits (often 30–60 s) cap long tool runs.
- MySQL has no vector search; retrieval will use keyword/full-text search over the knowledge files, or a hosted vector service.
- Uploads: host size limits; files scanned and stored outside the web root.
- `.htaccess` currently blocks the microphone (`Permissions-Policy`); voice mode needs this relaxed for the site's own origin.

## Owner inputs needed at that time
Provider choice and paid API keys, voice recordings and written consent for the clone, monthly budget cap.
