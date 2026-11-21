# Security

Version 0.5.0.

## Secrets
- Database password and the site secret live only in `_abidora/storage/config.php` (written by the installer, chmod 600, folder blocked from the web). They are never in the zip, the front end or the docs.
- Future AI provider keys will be stored the same way and only used from PHP.

## Web access
- `.htaccess` blocks `_abidora/`, dotfiles and `.md .sql .zip .log .sqlite .lock` files. Both new (`Require all denied`) and old (`Deny from all`) Apache syntax are covered.
- The installer checks that the private folder really returns 403 before installing, and locks itself afterwards.

## Admin
- Passwords: `password_hash` (bcrypt/argon per PHP default), minimum 10 characters.
- Sessions: HttpOnly, SameSite=Strict, Secure on HTTPS, regenerated at login.
- CSRF token on every form.
- Login throttle: 8 attempts per 15 minutes per IP (IP stored as a keyed hash, not in plain text).
- Roles: owner, editor, translator. Audit log of every change.
- Translation edits are sanitised: tags removed except em/i/b/br; links only where the English text has one; no event handlers or javascript:/data: URLs. A backup is kept before each save.

## Contact form
POST only, server-side validation, length limits, hidden honeypot field, 4 messages per hour per IP, stored with prepared statements.

## Headers
- PHP pages: Content-Security-Policy (self only, no framing), nosniff, referrer policy.
- All pages: X-Content-Type-Options, Referrer-Policy, X-Frame-Options SAMEORIGIN, Permissions-Policy (camera, mic, location off).

## Privacy
No analytics, no cookies on public pages. Visitor preferences stay in their own browser (localStorage).

## Worlds (v0.5.0)
- No new server code and no new secrets.
- Files a visitor opens in a world (photos, CSV, any file to fingerprint) are read only in the browser and never uploaded.
- The Logo (world 59) and assembly (world 63) languages are interpreted by our own code; nothing uses `eval` or `new Function`.

## Open items
CSP for static pages; self-hosted fonts; a security review before Abidora AI goes live (rate limits, cost caps, upload scanning).
