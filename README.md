# ABIDORA — A Universe Without Limits

Abidora is a global website by **Abid Islam**. It contains interactive 3D "worlds" (fashion, watches, racing, space, oceans, technology and more), a world studio, and Abidora AI, an assistant with chat and voice. The site is available in 10 languages: English, Bangla, Spanish, French, German, Arabic (RTL), Chinese, Japanese, Korean and Hindi.

Version: **0.9.14** (21 Nov 2026). Staging site: https://abidora.boostnixmedia.com

## Stack
- **Astro + TypeScript**. Builds static page templates and bundled JS/CSS.
- **Three.js, GSAP, Lenis, cannon-es** for 3D, motion and physics.
- **PHP 8** for the API, the admin panel, the AI proxy and the 10-language page renderer (`tools/publish.php`, `public/_abidora/lib/`).
- **MySQL** (optional) and JSON translation files (`public/_abidora/i18n/*.json`).

## Folders
| Folder | What it holds |
|---|---|
| `src/` | Pages, layouts, components, world code (`src/worlds/`), styles |
| `public/` | Files copied as-is: assets, PHP API (`api/`), admin, installer, private lib (`_abidora/`) |
| `tools/` | Build, publish, package and check scripts |
| `docs/` | Plans, audits, design system, changelog, feature status |

## Build
```bash
npm install
npm run build        # full check + build + render all 10 languages into dist/
npm run package      # makes abidora.zip for upload
```
Needs Node 20+ and PHP 8 on the build machine.

## Install on a server
1. Upload the zip to the web folder (for example `public_html/abidora`) and extract it.
2. Open `/install/` in the browser. Enter the admin password and, optionally, the database details.
3. Put the AI keys (Gemini and the others) only in the admin panel or in the server config. They are saved to `_abidora/storage/config.php`, which the web server never serves.

## Not in this repository (on purpose)
- **No secrets.** API keys, database logins, admin passwords and `storage/config.php` / `installed.lock` are never committed (see `.gitignore`). If a key is ever committed by mistake, revoke it at the provider right away.
- The installer's default notification email field is left empty here.
- Private notes (email setup, the old archive) are not included in `docs/`.

## Assets and licences
- 3D models: only CC BY / CC0 models are used. Each one is credited on the site's Credits page and in `docs/ASSET_SOURCES_AND_LICENSES.md`.
- Photos: Unsplash and similar free-licence sources, also credited on the Credits page.
- The largest folders are `public/assets/models` (about 140 MB) and `public/assets/music` (about 48 MB). No single file is over 20 MB, so Git LFS is not needed. Raw source models and videos are kept outside this repository.

## Rules for contributors
- Never commit keys, passwords or server config.
- Keep backups. Never overwrite the live site without the owner's approval.
- Never mark a feature COMPLETED unless it has been implemented and tested.

© Abid Islam. All rights reserved unless a file says otherwise.
