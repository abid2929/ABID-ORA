# Known limitations

Version 0.5.0 · 2026-11-20. Honest list of what is not done or not proven yet.

1. **71 of 112 worlds are built** (001–070 and 074). Worlds 071–073 and 075–112 are named and listed, not built. Some world labels beyond the translated keys still show in English. Several worlds are teaching models, not exact engineering tools.
2. **Translations are AI drafts.** All 9 non-English languages need a native speaker's review. The site and admin mark them as drafts.
3. **Photographer names are missing** for the 26 Unsplash photos. unsplash.com shows a bot check from the build server and we did not bypass it. The Credits page says "Not recorded".
4. **Four photos show brand logos** (sneaker, watch, car and similar). Replace before public launch.
5. **Home page phone performance is about 59** in Lighthouse (WebGL hero and preloader). Other tested pages score 94–100.
6. **No visitor accounts yet**; settings are saved per browser only.
7. **Email notifications untested.** Contact messages are always saved in admin; the email alert depends on the host's `mail()`.
8. **Fonts load from Google Fonts.** Self-hosting is possible later for privacy and speed.
9. **robots.txt in a subfolder is not read by search engines.** At boostnixmedia.com/abidora, only the root robots.txt counts. Fine for now; solved when Abidora gets its own domain.
10. **Updating overwrites admin-edited translations** unless you re-upload them from a backup (see DEPLOYMENT_GUIDE.md).
11. **Static pages have no Content-Security-Policy header** (PHP pages do). The other security headers are set.
12. **`Permissions-Policy` blocks the microphone.** Must be relaxed for Abidora AI voice mode.
13. **Galaxy engine is about 560 KB** (about 140 KB gzipped). It loads only on the galaxy page.
14. **No video or 3D model assets yet**; most media sources are blocked from the build server.
15. **Tested in Chromium only**; Safari, Firefox and real phones still to do.
16. **Abidora AI is not built.** Only its knowledge files exist; nothing on the site pretends to be an AI.
