# Abidora master requirements

Version 0.4.0 (milestone 1) · 2026-11-19 · Founder: Abid Islam · Vision: *A Universe Without Limits.*

Status scale (owner's definition): **NOT STARTED · PLANNED · IN PROGRESS · IMPLEMENTED · TESTED · COMPLETED**. IMPLEMENTED means the code exists. TESTED means it passed the checks listed in TEST_REPORT.md. COMPLETED needs the owner's sign-off, so nothing is marked COMPLETED yet. Nothing is marked done just because its screen exists.

## Standing quality rules (owner, 2026-11-19, apply to every milestone)
Follow the 25-day roadmap (DAY_PLAN.md) one milestone at a time, but quality, originality, functionality, security and performance always come before the deadline. If a milestone needs more time, it takes more time.
1. Every world has its own unique design and meaningful functionality.
2. The 112-world roadmap is preserved; scope is never reduced.
3. The Personal Universe Studio really saves and applies user preferences.
4. Abidora AI has real intelligence, persistent memory, live web search, file understanding and voice.
5. Every milestone delivers a working preview, source code, ZIP, test report and backup.
6. No feature is marked complete until it is implemented and tested.

## Platform and delivery
| # | Requirement | Status | Notes |
|---|---|---|---|
| 1 | Approved stack: Astro + TypeScript, Three.js/GLSL, GSAP, Lenis, PHP 8, MySQL, JSON i18n | TESTED | React not needed so far |
| 2 | Static build that runs from public_html, no Node on the server | TESTED | Apache 2.4 + PHP 8 + MariaDB 10.11 test install |
| 3 | Works in a subfolder (boostnixmedia.com/abidora) | TESTED | All paths relative; tested at /abidora/ |
| 4 | One zip + web installer (/install) that creates tables, admin, then locks | TESTED | See DEPLOYMENT_GUIDE.md |
| 5 | Admin "Publish" re-renders all pages on the server | TESTED | Same renderer as the build |
| 6 | Backups (admin download of translations, data, database) | TESTED | Restore is manual (documented) |

## Identity and design
| # | Requirement | Status | Notes |
|---|---|---|---|
| 7 | Abidora brand, ora-ring wordmark, configurable brand name | TESTED | Admin → Settings |
| 8 | Global-first, editorial, cinematic design language | IMPLEMENTED | Awaiting owner review |
| 9 | Each experience has its own identity, not repeated cards | IN PROGRESS | 1 of 112 worlds built (Digital Galaxy) |

## Pages
| # | Requirement | Status | Notes |
|---|---|---|---|
| 10 | Homepage: WebGL hero, manifesto, index, reel, Studio, founder section, contact | TESTED | |
| 11 | Worlds atlas: all 112 worlds, search, category and status filters | TESTED | |
| 12 | World 074 Digital Galaxy (Three.js, 4 galaxy shapes, fly-in, fallback) | TESTED | |
| 13 | Founder page with the owner's portrait and the 5 approved sections | TESTED | Interests shown as exploration, not expertise |
| 14 | Credits page generated from the asset register | TESTED | Photographer names missing (see limits) |
| 15 | Localised 404 page | TESTED | |

## Languages
| # | Requirement | Status | Notes |
|---|---|---|---|
| 16 | 10 languages (en, bn, es, fr, de, ar, zh, ja, ko, hi), English default | TESTED | 487 keys each, 0 missing |
| 17 | Arabic right-to-left | TESTED | |
| 18 | Localised URLs, titles, descriptions, hreflang, sitemap | TESTED | Absolute URLs once the site address is set |
| 19 | Remember the visitor's language | TESTED | |
| 20 | Translation editing in admin, draft/reviewed flag | TESTED | |
| 21 | Native-speaker review of translations | NOT STARTED | All are AI drafts and marked as such |

## Experiences and customisation
| # | Requirement | Status | Notes |
|---|---|---|---|
| 22 | 100+ experiences | IN PROGRESS | 112 planned, 1 live |
| 23 | Studio: mood, cursor, motion, grain saved per visitor | TESTED | 5 moods, 3 cursors |
| 24 | 100+ themes and 100+ cursors | PLANNED | |
| 25 | Visitor accounts and saved profiles | PLANNED | |
| 26 | Global search across all content | IN PROGRESS | Atlas search done |

## Backend and security
| # | Requirement | Status | Notes |
|---|---|---|---|
| 27 | Secure admin login (password hash, sessions, CSRF, lockout) | TESTED | |
| 28 | Roles: owner, editor, translator; audit log | TESTED | |
| 29 | Contact form saved to admin, spam honeypot, rate limit | TESTED | Email notification untested (mail()) |
| 30 | Private folders blocked from the web | TESTED | 403 confirmed on Apache |
| 31 | Security headers and CSP | TESTED | CSP on PHP pages; static pages get nosniff, referrer, frame and permissions headers |

## Media
| # | Requirement | Status | Notes |
|---|---|---|---|
| 32 | Only licensed or owner-provided media, with a register | TESTED | ASSET_SOURCES_AND_LICENSES.md |
| 33 | Founder portrait: exact photo, optimised, trademarks cropped, original backed up | TESTED | |
| 34 | Video, 3D models and wider media sources | NOT STARTED | Most sources blocked from the build server |

## Quality
| # | Requirement | Status | Notes |
|---|---|---|---|
| 35 | Responsive desktop, tablet and mobile | TESTED | |
| 36 | Reduced-motion support and calm mode | TESTED | |
| 37 | WebGL fallbacks | TESTED | Galaxy and hero fall back to images |
| 38 | Lazy-loading heavy parts | TESTED | Galaxy engine loads only on its page |
| 39 | Lighthouse-style performance audit | NOT STARTED | See PERFORMANCE_REPORT.md |

## Abidora AI (next phase)
| # | Requirement | Status | Notes |
|---|---|---|---|
| 40 | Text chat with a real model, keys on the PHP server | PLANNED | First step of the AI phase |
| 41 | History, memory (with consent), real web search with citations, knowledge of all worlds | PLANNED | Knowledge files already written on each publish |
| 42 | Files and images, tools, voice in the owner's authorised cloned voice | PLANNED | Needs provider accounts and voice recordings |
| 43 | Provider comparison and hosting-limits document | PLANNED | AI_ASSISTANT_PLAN.md is the outline |
