# Technical architecture

Version 0.4.0 · source in `abid-site/abidora/`.

## Overview
```
Astro (TypeScript) ──build──▶ page TEMPLATES with tokens ({{key}}, {{U:page}}, {{ROOT}} …)
                                     │
PHP renderer (_abidora/lib/render.php) ──▶ 6 pages × 10 languages = 60 static HTML files
        ▲                                     + sitemap.xml, robots.txt, AI knowledge files
        └── runs at build time (tools/publish.php) AND on the server (admin "Publish")
```
No Node is needed on the host. The server only needs PHP 8.1+ and MySQL (SQLite works as a fallback).

## Front end
- **Astro 7**, static output, `trailingSlash: always`, directory format. Vite emits relative URLs so the site works in any subfolder.
- **TypeScript** scripts per page: `common.ts` (wordmark, menu with focus trap, Studio settings), `home.ts` (preloader, WebGL hero shader, manifesto, index, reel, Studio, Lenis smooth scroll), `worlds.ts` (atlas search/filters), `galaxy-page.ts` + `galaxy-scene.ts` (Three.js), `portrait.ts` (founder parallax), `contact.ts`, `i18n.ts` (runtime dictionary, number formatting, language menu).
- **Three.js** galaxy: one point cloud (50k–180k stars by device) with a custom GLSL shader, morphing between four galaxy shapes on the GPU; pauses when hidden; image fallback without WebGL.
- **GSAP** for reveals and morphs, **Lenis** for smooth scroll (only when motion is on and reduced motion is off).
- Visitor settings: `localStorage` keys `abidora.studio`, `abidora.lang`.

## Back end (`public/_abidora/`, blocked from the web)
- `lib/boot.php`: config, PDO (MySQL/SQLite), schema + migrations, sessions, CSRF, throttling, audit log, security headers.
- `lib/render.php`: languages, pages, token renderer, publish-all, sitemap, robots, knowledge writer.
- `lib/ui.php`: admin/installer layout.
- `i18n/<lang>.json`: 487 keys per language. `data/site.json`, `data/assets.json`, `data/experiences.json`.
- `storage/`: config.php (created by installer, chmod 600), install lock, knowledge/, backups/.
- Tables: `ab_users`, `ab_messages`, `ab_audit`, `ab_throttle`, `ab_settings`.

## Public PHP endpoints
- `/install/` installer (locks itself after use).
- `/admin/` admin: overview, messages, translations, founder, worlds, users, audit, backup, settings, publish.
- `/api/contact.php` contact form (POST, JSON).

## Pages
| Key | Path | Notes |
|---|---|---|
| home | `/` | |
| worlds | `/worlds/` | atlas of 112 worlds |
| galaxy | `/worlds/digital-galaxy/` | World 074 |
| founder | `/founder/` | |
| credits | `/credits/` | generated from assets.json |
| notfound | `/404/` | Apache ErrorDocument |
Other languages live under `/<code>/…`.

## Adding a new world
1. Build its page under `src/pages/tpl/` with its own styles and script (lazy-loaded).
2. Add it to `AB_PAGES` / `AB_META` in render.php and its texts to every `i18n/*.json`.
3. Set its item in `experiences.json` to `"status":"live","page":"<key>"`.
4. Build, run the test matrix, Publish. The atlas, sitemap and Abidora AI knowledge pick it up automatically.

## Commands (developer machine)
- `npm run build`: type check, Astro build, render 10 languages, verify links and tokens.
- `npm run package`: the above plus `abidora.zip` for upload.
