# Feature status: v0.5.0 (Wave A, 20 Nov 2026 afternoon)

Statuses: NOT STARTED · PLANNED · IN PROGRESS · IMPLEMENTED · TESTED · COMPLETED.
COMPLETED means the owner has signed off. Nothing is COMPLETED yet, so the highest status below is TESTED.

## Site and platform
| Feature | Status | Notes |
|---|---|---|
| Hosting fit: static build + PHP + MySQL, subfolder, one zip, installer, admin Publish | TESTED | Apache 2.4 + PHP 8 + MariaDB, in /abidora/ |
| 10 languages incl. Arabic RTL, localised URLs and SEO tags | TESTED | Non-English text is an AI draft, needs native review |
| Homepage (WebGL hero, 3D universe, discovery strip, pinned manifesto, index, reel, Studio, founder, contact) | TESTED | Phone Lighthouse 42–66 on the GPU-less test server; target 80 not met (see PERFORMANCE_REPORT) |
| 3D Universe map of all 112 worlds (I-1, I-4) | TESTED | en/bn/ar, desktop and phone, no-WebGL list, reduced motion |
| Cinematic page change + 12 world portals (I-2, I-3) | TESTED | Chromium; other browsers navigate normally |
| Discovery: world of the day, Guide me, Surprise me (I-7) | TESTED | Homepage only; atlas version and "Your input" filter PLANNED |
| Quality tiers (I-8) | IMPLEMENTED | Used by the universe only so far |
| Founder chapter bar, velocity headings (I-6) | TESTED | Approved founder sections unchanged |
| Worlds atlas (112 entries, search and filters) | TESTED | Lighthouse 100/100/100/100 on phone |
| World page system (favourites, full screen, prev/next, planned and not-found states) + world bar (how-to, share, reset, universe) | TESTED | Layout jump on phones fixed tonight (CLS 0.59 → about 0.02) |
| 100+ themes and 100+ cursors, saved per visitor | TESTED | Saved in the visitor's own browser |
| Personal Universe Studio (save, share link/code, import, reset) | TESTED | Lighthouse 100 on all four categories |
| Founder page, Credits, 404 | TESTED | |
| Admin (login, roles, audit, messages, translations, founder, users, backup, settings, publish) | TESTED | On the test server, not the live host |
| Contact form (saved in admin, owner copy, designed auto-reply in 10 languages, anti-spam limits) | TESTED | Tested with a local test mail server; real delivery needs the SMTP setup in EMAIL_SETUP_BN.md |
| Founder section on homepage (photo upright, all on one screen) | TESTED | New cutout from a real photo PLANNED (owner will send it) |
| Security headers, private folder protection, CSRF, throttling | TESTED | |

## Worlds (target 100+, plan is 112)
| Worlds | Status | Notes |
|---|---|---|
| 001–071 | TESTED | Each has its own design and working functions. Automated check: all 71 (plus 074) render with no errors in English, Bengali and Arabic. Worlds 053–070 also have unit tests (314 in total, all pass). |
| 074 Digital Galaxy | TESTED | Three.js, built in milestone 1 |
| 072–073, 075–112 | PLANNED | Next: 072 Historical Civilizations |

## Planned
- Global search across all content (atlas search exists).
- Visitor accounts and creator community with moderation.
- Abidora AI (needs paid API keys; see AI_ASSISTANT_PLAN.md). Nothing fake has been built.
- Video and 3D model assets.

## Not started
- Native translation review.
- Safari, Firefox and real-device testing.
- Email delivery test and Lighthouse on the live host.

See IMPLEMENTATION_REPORT.md for Wave A, MORNING_PROGRESS_REPORT.md for the night mission, KNOWN_LIMITATIONS.md for what is not proven.
