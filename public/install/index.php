<?php
/* Abidora installer. Open /install/ once after uploading. It checks the hosting, creates the MySQL tables,
   creates the owner account, publishes all pages for this address, then locks itself for good. */
declare(strict_types=1);
require dirname(__DIR__) . '/_abidora/lib/boot.php';
require AB_DIR . '/lib/ui.php';
ab_session();

if (ab_installed()) { http_response_code(403); ab_page_head('Abidora is installed'); echo '<h1>Already installed</h1><p>This installer is locked. You can delete the <b>install</b> folder in File Manager.</p><p><a href="../admin/">Open the admin</a></p>'; ab_page_foot(); exit; }

/* ---------- hosting checks ---------- */
function ab_checks(): array {
  $c = [];
  $add = function (string $name, bool $ok, string $info, bool $required = true) use (&$c) { $c[] = compact('name', 'ok', 'info', 'required'); };
  $add('PHP 8.1 or newer', version_compare(PHP_VERSION, '8.1.0', '>='), 'This server runs PHP ' . PHP_VERSION . '. In cPanel: Select PHP Version / MultiPHP Manager.');
  $add('PDO MySQL driver', extension_loaded('pdo_mysql'), 'Needed for the MySQL database.');
  $add('mbstring', extension_loaded('mbstring'), 'Needed for the 10 languages.');
  $add('JSON', function_exists('json_encode'), 'Needed for translations.');
  $add('OpenSSL / random bytes', function_exists('random_bytes'), 'Needed for secure sessions and passwords.');
  $add('PDO SQLite (fallback only)', extension_loaded('pdo_sqlite'), 'Only used if you choose "no database".', false);
  $add('Zip (backups)', class_exists('ZipArchive'), 'Lets Admin > Backup download one file.', false);
  $add('cURL (future AI studio)', function_exists('curl_init'), 'Will be needed for server-side AI APIs later.', false);
  foreach (['_abidora/storage' => AB_STORE, '_abidora/i18n' => AB_DIR . '/i18n', '_abidora/data' => AB_DIR . '/data', 'site folder' => AB_PUB] as $n => $p)
    $add("Can write: $n", is_writable($p), $p);
  $ht = getenv('ABIDORA_HT') ?: ($_SERVER['ABIDORA_HT'] ?? ($_SERVER['REDIRECT_ABIDORA_HT'] ?? ''));
  $add('.htaccess is active', $ht !== '', $ht !== '' ? 'Rewrite rules and private folders work.' : 'The .htaccess file was not applied. Make sure hidden files were uploaded (File Manager > Settings > Show Hidden Files).');
  $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
  $add('HTTPS', $https, $https ? 'Secure connection.' : 'Open this page with https:// (cPanel: SSL/TLS Status > Run AutoSSL).', false);
  if (function_exists('curl_init') && $ht !== '') {
    $u = ab_base_from_request() . '/_abidora/data/site.json';
    $ch = curl_init($u); curl_setopt_array($ch, [CURLOPT_NOBODY => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 6, CURLOPT_SSL_VERIFYPEER => false]);
    curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch);
    $add('Private folder is blocked from the web', $code === 403 || $code === 404, $code ? "Server answered $code for a private file." : 'Could not test (the server cannot call itself); the .htaccess rule is in place.', $code !== 0);
  }
  return $c;
}
$checks = ab_checks();
$blocking = array_filter($checks, fn($c) => $c['required'] && !$c['ok']);

$err = ''; $done = null;
$v = fn(string $k, string $d = '') => trim((string)($_POST[$k] ?? $d));
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
  try {
    if (!ab_csrf_ok()) throw new RuntimeException('The form expired. Reload the page and try again.');
    if ($blocking) throw new RuntimeException('Fix the red items in the hosting check first.');
    $driver = $v('driver') === 'sqlite' ? 'sqlite' : 'mysql';
    $db = ['driver' => $driver, 'host' => $v('host', 'localhost'), 'name' => $v('name'), 'user' => $v('user'), 'pass' => (string)($_POST['pass'] ?? ''), 'port' => ''];
    if ($driver === 'mysql' && ($db['name'] === '' || $db['user'] === '')) throw new RuntimeException('Enter the database name and user from cPanel > MySQL Databases.');
    $au = $v('admin_user'); $ap = (string)($_POST['admin_pass'] ?? '');
    if (!preg_match('/^[A-Za-z0-9_.\-]{3,40}$/', $au)) throw new RuntimeException('Admin username: 3 to 40 letters, numbers, dot, dash or underscore.');
    if (mb_strlen($ap) < 10) throw new RuntimeException('Admin password must be at least 10 characters.');
    if ($ap !== (string)($_POST['admin_pass2'] ?? '')) throw new RuntimeException('The two admin passwords do not match.');
    $notify = $v('notify');
    if ($notify !== '' && !filter_var($notify, FILTER_VALIDATE_EMAIL)) throw new RuntimeException('The notification email is not valid.');

    try { $pdo = ab_pdo_from($db); }
    catch (PDOException $e) { throw new RuntimeException('Could not connect to the database. Check the name, user and password, and that the user was added to the database with ALL PRIVILEGES. (' . $e->getCode() . ')'); }
    ab_migrate($pdo, $driver);
    $pdo->prepare('DELETE FROM ab_users WHERE username = ?')->execute([$au]);
    $pdo->prepare("INSERT INTO ab_users (username, pass_hash, role, created_at) VALUES (?,?,'owner',?)")->execute([$au, password_hash($ap, PASSWORD_DEFAULT), ab_now()]);
    $up = $pdo->prepare($driver === 'mysql' ? 'INSERT INTO ab_settings (k,v) VALUES (?,?) ON DUPLICATE KEY UPDATE v=VALUES(v)' : 'INSERT OR REPLACE INTO ab_settings (k,v) VALUES (?,?)');
    $up->execute(['notify_email', $notify]);
    $base = ab_base_from_request(1);
    ab_save_config(['db' => $db, 'secret' => bin2hex(random_bytes(32)), 'base' => $base, 'installed_at' => ab_now(), 'version' => AB_VERSION]);
    $r = ab_publish_all(['base' => $base]);
    ab_fix_htaccess($base);
    $up->execute(['last_publish', ab_now()]);
    ab_write(AB_STORE . '/installed.lock', ab_now() . "\n");
    $pdo->prepare('INSERT INTO ab_audit (user_name, action, detail, ip_hash, created_at) VALUES (?,?,?,?,?)')->execute([$au, 'install', "Installed v" . AB_VERSION . " at $base, {$r['files']} files published", ab_ip_hash(), ab_now()]);
    $done = ['base' => $base, 'files' => $r['files']];
  } catch (Throwable $e) { $err = $e->getMessage(); }
}

ab_page_head('Install Abidora');
echo '<p class="mono">Abidora · installer · v' . AB_VERSION . '</p><h1>Install Abidora</h1>';
if ($done) {
  echo '<div class="flash ok"><b>Done.</b> The database is ready, your owner account exists and ' . (int)$done['files'] . ' pages were published for <b>' . ab_h($done['base']) . '</b>. This installer is now locked.</div>'
     . '<p class="row"><a class="btn" href="../">Open the site</a> <a class="btn btn2" href="../admin/">Open the admin</a></p><p class="note">You can delete the <b>install</b> folder in File Manager. It will refuse to run again either way.</p>';
  ab_page_foot(); exit;
}
if ($err) echo '<div class="flash bad">' . ab_h($err) . '</div>';
echo '<div class="card"><h2 style="margin-top:0">1. Hosting check</h2><table>';
foreach ($checks as $c) echo '<tr><td class="' . ($c['ok'] ? 'ok' : ($c['required'] ? 'bad' : 'warn')) . '">' . ($c['ok'] ? '✓' : ($c['required'] ? '✗' : '!')) . '</td><td><b>' . ab_h($c['name']) . '</b><br><span class="note">' . ab_h($c['info']) . '</span></td></tr>';
echo '</table>' . ($blocking ? '<p class="bad">Fix the red items, then reload this page.</p>' : '<p class="ok">Your hosting can run Abidora.</p>') . '</div>';
$sel = $v('driver', 'mysql');
echo '<form method="post" class="card" autocomplete="off"><input type="hidden" name="csrf" value="' . ab_h(ab_csrf()) . '">
<h2 style="margin-top:0">2. Database</h2><p class="note">In cPanel open <b>MySQL Databases</b>: create a database, create a user, then add the user to the database with <b>ALL PRIVILEGES</b>. cPanel adds your account name in front, for example <code>cpuser_abidora</code>; type the full names here.</p>
<label for="driver">Database type</label><select id="driver" name="driver"><option value="mysql"' . ($sel === 'mysql' ? ' selected' : '') . '>MySQL / MariaDB (recommended)</option><option value="sqlite"' . ($sel === 'sqlite' ? ' selected' : '') . '>No database server (SQLite file, fallback)</option></select>
<label for="host">Host</label><input id="host" name="host" value="' . ab_h($v('host', 'localhost')) . '">
<label for="name">Database name</label><input id="name" name="name" value="' . ab_h($v('name')) . '" placeholder="cpuser_abidora">
<label for="user">Database user</label><input id="user" name="user" value="' . ab_h($v('user')) . '" placeholder="cpuser_abidora">
<label for="pass">Database password</label><input id="pass" name="pass" type="password">
<h2>3. Your admin account</h2>
<label for="au">Admin username</label><input id="au" name="admin_user" value="' . ab_h($v('admin_user')) . '" autocomplete="username">
<label for="ap">Admin password (at least 10 characters)</label><input id="ap" name="admin_pass" type="password" autocomplete="new-password">
<label for="ap2">Admin password again</label><input id="ap2" name="admin_pass2" type="password" autocomplete="new-password">
<label for="nt">Email for new contact messages (optional)</label><input id="nt" name="notify" type="email" value="' . ab_h($v('notify', '')) . '">
<p style="margin-top:18px"><button type="submit"' . ($blocking ? ' disabled' : '') . '>Install</button></p></form>';
ab_page_foot();
