# Deployment guide (cPanel)

For: boostnixmedia.com/abidora (a folder inside the existing hosting). Version 0.4.0.

You need: cPanel login, the file `abidora-v0.4.1.zip`, 15 minutes.
Host requirements: PHP 8.1 or newer with pdo_mysql and mbstring (normal on cPanel), Apache or LiteSpeed with .htaccess allowed.

## A. Create an empty database (once)
1. cPanel → **MySQL® Databases**.
2. *Create New Database*: type `abidora` → **Create Database**. cPanel shows the full name, for example `cpuser_abidora`. Write it down.
3. *Add New User*: username `ab`, a strong password → **Create User**. Full name looks like `cpuser_ab`. Write down the name and password.
4. *Add User To Database*: pick the user and the database → **Add** → tick **ALL PRIVILEGES** → **Make Changes**.

## B. Upload and extract
1. cPanel → **File Manager** → open `public_html`.
2. **+ Folder** → name it `abidora` → open it. (Do not extract into public_html itself; that would mix with the Boostnix site.)
3. **Upload** → choose `abidora-v0.4.1.zip` → wait for 100% → back.
4. Right-click the zip → **Extract** → keep the path `/public_html/abidora` → **Extract Files**.
5. Delete the zip from the server after extracting.
6. In File Manager settings tick **Show Hidden Files** and check that `.htaccess` is inside `abidora`.

## C. Run the installer
1. Open `https://boostnixmedia.com/abidora/install/`.
2. All checks should be green. If one is red it tells you what is missing.
3. Fill in database host `localhost`, the database name, user and password from step A.
4. Choose the admin username and password (10+ characters, typed twice) and the email for contact-form alerts.
5. Press **Install**. It creates the tables, your admin account and all 60 pages, then locks itself.

## D. Check
- Site: `https://boostnixmedia.com/abidora/`
- Admin: `https://boostnixmedia.com/abidora/admin/`
- `https://boostnixmedia.com/abidora/_abidora/` must show *Forbidden* (that is correct).

## Updating to a new version
1. Admin → **Backup** → download the backup zip first.
2. Upload the new zip into `public_html/abidora`, extract, and choose to overwrite.
3. Your settings, messages and admin users are kept: they live in `_abidora/storage/config.php` and the database, which the zip never contains.
4. **Translations you edited in admin are replaced by the zip's version.** If you edited any, upload the `i18n/` folder from your backup into `_abidora/` again (overwrite). (A later version will keep admin edits in a separate layer so this step disappears.)
5. Admin → **Publish** so every page is rebuilt.

## Editing content
- Admin → **Translations**: edit any text in any language → Save → **Publish**.
- Admin → **Founder**: mark skills as current or learning → Save → **Publish**.
- Admin → **Settings**: brand name, notification email, site address, password.

## Restore
1. Upload the backup's `i18n/` and `data/` folders into `_abidora/` (overwrite).
2. The database part is in `database.json`; send it to us to re-import, or use phpMyAdmin.
3. Admin → **Publish**.

## Moving to your own domain later
Upload the same files to the new place, then Admin → **Settings** → site address → Save → **Publish**. Links are relative, so nothing else changes.
