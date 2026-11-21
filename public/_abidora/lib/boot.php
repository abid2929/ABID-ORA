<?php
/* Shared server bootstrap: config, database (MySQL via PDO; SQLite only as a fallback),
   sessions, CSRF tokens, rate limits and the audit log. Nothing here is reachable from the web
   (_abidora/ is blocked by .htaccess); only api/, admin/ and install/ include it. */
declare(strict_types=1);
define('AB_DIR', dirname(__DIR__));
define('AB_PUB', dirname(AB_DIR));
define('AB_STORE', AB_DIR . '/storage');
define('AB_CONFIG', AB_STORE . '/config.php');
define('AB_VERSION', '0.5.1');
require_once __DIR__ . '/render.php';

function ab_config(bool $reload = false): array { static $c = null; if ($c === null || $reload) { $c = is_file(AB_CONFIG) ? (require AB_CONFIG) : []; if (!is_array($c)) $c = []; } return $c; }
function ab_installed(): bool { return is_file(AB_STORE . '/installed.lock') && is_file(AB_CONFIG); }

/** Write the private config file (PHP array, so it can never be downloaded as text). */
function ab_save_config(array $c): void {
  ab_write(AB_CONFIG, "<?php\n// Abidora private configuration. Keep this file secret.\nreturn " . var_export($c, true) . ";\n");
  @chmod(AB_CONFIG, 0600);
  if (function_exists('opcache_invalidate')) @opcache_invalidate(AB_CONFIG, true);
  ab_config(true);
}

function ab_pdo_from(array $db): PDO {
  $o = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false];
  if (($db['driver'] ?? 'mysql') === 'sqlite') return new PDO('sqlite:' . AB_STORE . '/abidora.sqlite', null, null, $o);
  $dsn = 'mysql:host=' . ($db['host'] ?: 'localhost') . ';dbname=' . $db['name'] . ';charset=utf8mb4' . (!empty($db['port']) ? ';port=' . (int)$db['port'] : '');
  return new PDO($dsn, $db['user'], $db['pass'], $o + [PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4, time_zone = '+00:00'"]);
}
function ab_db(): PDO { static $p = null; return $p ??= ab_pdo_from(ab_config()['db'] ?? []); }
function ab_driver(): string { return ab_config()['db']['driver'] ?? 'mysql'; }

/** Table definitions; works on MySQL 5.7+/MariaDB 10.3+ and SQLite 3. */
function ab_schema(string $driver): array {
  $my = $driver === 'mysql';
  $id = $my ? 'INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  $tail = $my ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci' : '';
  return [
    "CREATE TABLE IF NOT EXISTS ab_users (id $id, username VARCHAR(60) NOT NULL UNIQUE, pass_hash VARCHAR(255) NOT NULL, role VARCHAR(20) NOT NULL DEFAULT 'editor', created_at DATETIME NOT NULL, last_login DATETIME NULL)$tail",
    "CREATE TABLE IF NOT EXISTS ab_messages (id $id, name VARCHAR(80) NOT NULL, email VARCHAR(120) NOT NULL, body TEXT NOT NULL, lang VARCHAR(5) NOT NULL DEFAULT 'en', ip_hash CHAR(16) NOT NULL, created_at DATETIME NOT NULL, read_at DATETIME NULL)$tail",
    "CREATE TABLE IF NOT EXISTS ab_audit (id $id, user_name VARCHAR(60) NOT NULL, action VARCHAR(60) NOT NULL, detail VARCHAR(500) NOT NULL DEFAULT '', ip_hash CHAR(16) NOT NULL, created_at DATETIME NOT NULL)$tail",
    "CREATE TABLE IF NOT EXISTS ab_throttle (id $id, k VARCHAR(80) NOT NULL, created_at DATETIME NOT NULL)$tail",
    "CREATE TABLE IF NOT EXISTS ab_settings (k VARCHAR(60) NOT NULL PRIMARY KEY, v TEXT NOT NULL)$tail",
    "CREATE TABLE IF NOT EXISTS ab_replies (id $id, message_id INT NOT NULL, body TEXT NOT NULL, sent_by VARCHAR(60) NOT NULL, ok TINYINT NOT NULL DEFAULT 0, created_at DATETIME NOT NULL)$tail",   /* 0.9.15: owner replies to contact messages */
    "CREATE TABLE IF NOT EXISTS ab_invites (id $id, email VARCHAR(120) NOT NULL, lang VARCHAR(5) NOT NULL DEFAULT 'en', sent_by VARCHAR(60) NOT NULL, ok TINYINT NOT NULL DEFAULT 0, note VARCHAR(120) NOT NULL DEFAULT '', created_at DATETIME NOT NULL)$tail",   /* 0.9.16: owner's invitations */
    $my ? "CREATE INDEX ab_throttle_k ON ab_throttle (k, created_at)" : "CREATE INDEX IF NOT EXISTS ab_throttle_k ON ab_throttle (k, created_at)",
  ];
}
function ab_migrate(PDO $pdo, string $driver): void {
  foreach (ab_schema($driver) as $sql) {
    try { $pdo->exec($sql); } catch (PDOException $e) { if (stripos($sql, 'CREATE INDEX') !== 0) throw $e; /* index already exists */ }
  }
  $pdo->prepare($driver === 'mysql' ? 'INSERT INTO ab_settings (k,v) VALUES (?,?) ON DUPLICATE KEY UPDATE v=VALUES(v)' : 'INSERT OR REPLACE INTO ab_settings (k,v) VALUES (?,?)')->execute(['schema_version', '1']);
}

function ab_now(): string { return gmdate('Y-m-d H:i:s'); }
function ab_ip_hash(): string { return substr(hash_hmac('sha256', (string)($_SERVER['REMOTE_ADDR'] ?? ''), (string)(ab_config()['secret'] ?? 'x')), 0, 16); }

/** true if this key was used fewer than $max times in the last $sec seconds (and records this use) */
function ab_throttle(string $key, int $max, int $sec): bool {
  $db = ab_db(); $since = gmdate('Y-m-d H:i:s', time() - $sec); $k = substr($key . ':' . ab_ip_hash(), 0, 80);
  if (random_int(1, 50) === 1) $db->prepare('DELETE FROM ab_throttle WHERE created_at < ?')->execute([gmdate('Y-m-d H:i:s', time() - 86400)]);
  $s = $db->prepare('SELECT COUNT(*) FROM ab_throttle WHERE k = ? AND created_at > ?'); $s->execute([$k, $since]);
  if ((int)$s->fetchColumn() >= $max) return false;
  $db->prepare('INSERT INTO ab_throttle (k, created_at) VALUES (?, ?)')->execute([$k, ab_now()]);
  return true;
}

function ab_setting(string $k, ?string $default = null): ?string {
  try { $s = ab_db()->prepare('SELECT v FROM ab_settings WHERE k = ?'); $s->execute([$k]); $v = $s->fetchColumn(); return $v === false ? $default : (string)$v; } catch (Throwable) { return $default; }
}
function ab_set_setting(string $k, string $v): void {
  $sql = ab_driver() === 'mysql' ? 'INSERT INTO ab_settings (k,v) VALUES (?,?) ON DUPLICATE KEY UPDATE v=VALUES(v)' : 'INSERT OR REPLACE INTO ab_settings (k,v) VALUES (?,?)';
  ab_db()->prepare($sql)->execute([$k, $v]);
}

/* ---- sessions + CSRF (admin only) ---- */
function ab_session(): void {
  if (session_status() === PHP_SESSION_ACTIVE) return;
  $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
  session_name('abidora_admin');
  session_set_cookie_params(['lifetime' => 0, 'path' => dirname($_SERVER['SCRIPT_NAME'] ?? '/') ?: '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
  session_start();
  if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
}
function ab_csrf(): string { ab_session(); return (string)$_SESSION['csrf']; }
function ab_csrf_ok(): bool { ab_session(); return is_string($_POST['csrf'] ?? null) && hash_equals((string)$_SESSION['csrf'], $_POST['csrf']); }

function ab_audit(string $user, string $action, string $detail = ''): void {
  try { ab_db()->prepare('INSERT INTO ab_audit (user_name, action, detail, ip_hash, created_at) VALUES (?,?,?,?,?)')->execute([$user, $action, mb_substr($detail, 0, 500), ab_ip_hash(), ab_now()]); } catch (Throwable) { /* never block the action on logging */ }
}

/** Absolute URL of the site root, worked out from the current request (works on any domain or subfolder). */
function ab_base_from_request(int $depth = 1): string {
  if (PHP_SAPI === 'cli' || empty($_SERVER['HTTP_HOST'])) return '';
  $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
  $host = preg_replace('/[^a-z0-9.\-:]/i', '', (string)$_SERVER['HTTP_HOST']);
  $dir = rtrim(str_replace('\\', '/', dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/'))), '/');
  for ($i = 0; $i < $depth; $i++) $dir = rtrim(str_replace('\\', '/', dirname($dir)), '/');
  if ($dir === '.' ) $dir = '';
  return ($https ? 'https' : 'http') . '://' . $host . $dir;
}

/** Point the 404 page at the right folder (ErrorDocument needs a path from the domain root). */
function ab_fix_htaccess(string $base): void {
  $f = AB_PUB . '/.htaccess'; if (!is_file($f)) return;
  $path = rtrim((string)(parse_url($base, PHP_URL_PATH) ?? ''), '/');
  $s = (string)file_get_contents($f);
  $s2 = preg_replace('~^ErrorDocument 404 .*$~m', 'ErrorDocument 404 ' . $path . '/404/index.html', $s);
  if ($s2 === null) return;
  /* a missing page under /bn/, /ar/ ... gets the "not found" page in that language */
  $blk = "# ab-404-lang\n";
  foreach (['bn', 'es', 'fr', 'de', 'ar', 'zh', 'ja', 'ko', 'hi'] as $l) $blk .= '<If "%{REQUEST_URI} =~ m#^' . $path . '/' . $l . '/#">' . "\n  ErrorDocument 404 {$path}/{$l}/404/index.html\n</If>\n";
  $blk .= "# /ab-404-lang\n";
  $s2 = preg_replace('~# ab-404-lang\n.*?# /ab-404-lang\n~s', '', $s2);
  $s2 = preg_replace('~^(ErrorDocument 404 .*\n)~m', '$1' . $blk, $s2, 1);
  if ($s2 !== null && $s2 !== $s) ab_write($f, $s2);
}

/** Publish every page with the current translations and the site address. */
function ab_publish_site(): array {
  $base = (string)(ab_config()['base'] ?? '');
  $r = ab_publish_all(['base' => $base]);
  try { ab_set_setting('last_publish', ab_now()); } catch (Throwable) {}
  return $r;
}

function ab_json_out(array $data, int $code = 200): never {
  http_response_code($code); header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store');
  echo json_encode($data, JSON_UNESCAPED_UNICODE); exit;
}
function ab_security_headers(): void {
  header('X-Content-Type-Options: nosniff'); header('Referrer-Policy: same-origin'); header('X-Frame-Options: DENY');
  header("Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'self'");
}

/**
 * Clean a translation or other editable text before it becomes part of a public page.
 * Only <em> <i> <b> <br> (and <a href> where the English text has a link) survive, with no other attributes.
 * Links may only point to http(s), mailto, or a relative address; entities are decoded before the check,
 * so tricks like "java&#115;cript:" or "<a/onmouseover=...>" cannot slip through.
 */
function ab_clean_inline(string $html, bool $allowLinks): string {
  $tags = ['em', 'i', 'b', 'br'];
  if ($allowLinks) $tags[] = 'a';
  if (!class_exists('DOMDocument')) {
    /* fallback without the DOM extension: plain text with only bare <em><i><b><br> */
    $t = strip_tags($html, '<em><i><b><br>');
    return (string)preg_replace('~<(/?)(em|i|b|br)\b[^>]*>~i', '<$1$2>', $t);
  }
  $doc = new DOMDocument();
  $prev = libxml_use_internal_errors(true);
  $doc->loadHTML('<?xml encoding="UTF-8"><div id="ab-root">' . $html . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD | LIBXML_NONET);
  libxml_clear_errors(); libxml_use_internal_errors($prev);
  $root = $doc->getElementById('ab-root') ?? $doc->documentElement;
  if (!$root) return htmlspecialchars(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
  $okHref = static function (string $h): bool {
    $h = trim(preg_replace('/[\x00-\x20\x7f]+/', '', $h) ?? '');
    if ($h === '') return false;
    if (preg_match('~^(https?:|mailto:)~i', $h)) return true;
    return !preg_match('~^[a-z][a-z0-9+.\-]*:~i', $h);          // relative, no other scheme
  };
  $walk = static function (DOMNode $n) use (&$walk, $tags, $okHref, $doc): void {
    for ($c = $n->firstChild; $c; $c = $next) {
      $next = $c->nextSibling;
      if ($c instanceof DOMElement) {
        $name = strtolower($c->nodeName);
        if (!in_array($name, $tags, true)) {
          if (in_array($name, ['script', 'style', 'iframe', 'object', 'embed', 'template', 'svg', 'math'], true)) { $n->removeChild($c); continue; }
          /* unknown tag: keep its text, drop the tag */
          while ($c->firstChild) $n->insertBefore($c->firstChild, $c);
          $n->removeChild($c); $next = $next ? $next : null; $walk($n); return;
        }
        $href = $name === 'a' ? $c->getAttribute('href') : '';
        $blank = $name === 'a' && strtolower($c->getAttribute('target')) === '_blank';
        while ($c->attributes->length) $c->removeAttribute($c->attributes->item(0)->nodeName);
        if ($name === 'a') { if ($okHref($href)) { $c->setAttribute('href', $href); if ($blank) { $c->setAttribute('rel', 'noopener'); $c->setAttribute('target', '_blank'); } } else { while ($c->firstChild) $n->insertBefore($c->firstChild, $c); $n->removeChild($c); $walk($n); return; } }
        $walk($c);
      } elseif (!($c instanceof DOMText)) {
        $n->removeChild($c);                                    // comments, processing instructions
      }
    }
  };
  $walk($root);
  $out = '';
  foreach ($root->childNodes as $c) $out .= $doc->saveHTML($c);
  return $out;
}
