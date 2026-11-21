<?php
/* Abidora owner admin. English interface (owner tool). Roles: owner (everything), editor (messages,
   translations, founder skills), translator (translations only). Every change is written to the audit log. */
declare(strict_types=1);
require dirname(__DIR__) . '/_abidora/lib/boot.php';
require AB_DIR . '/lib/ui.php';
if (!ab_installed()) { header('Location: ../install/'); exit; }
ab_session();

const ROLES = ['owner' => 'Owner', 'editor' => 'Editor', 'translator' => 'Translator'];
const CAN = [
  'overview' => ['owner', 'editor', 'translator'], 'messages' => ['owner', 'editor'], 'translations' => ['owner', 'editor', 'translator'],
  'founder' => ['owner', 'editor'], 'worlds' => ['owner', 'editor'], 'users' => ['owner'], 'audit' => ['owner'], 'backup' => ['owner'], 'settings' => ['owner'], 'ai' => ['owner'],
];
$me = $_SESSION['user'] ?? null;
$flash = $_SESSION['flash'] ?? null; unset($_SESSION['flash']);
function go(string $q, string $msg = '', bool $ok = true): never { if ($msg) $_SESSION['flash'] = [$ok, $msg]; header('Location: ./' . ($q ? "?$q" : '')); exit; }
function can(?array $me, string $tab): bool { return $me && in_array($me['role'], CAN[$tab] ?? [], true); }

/* ---------- login / logout ---------- */
$act = (string)($_POST['act'] ?? '');
if ($act === 'login') {
  $err = 'Wrong username or password.';
  if (!ab_csrf_ok()) $err = 'The form expired. Try again.';
  elseif (!ab_throttle('login', 8, 900)) $err = 'Too many attempts. Wait 15 minutes.';
  else {
    $s = ab_db()->prepare('SELECT * FROM ab_users WHERE username = ?'); $s->execute([(string)($_POST['u'] ?? '')]); $u = $s->fetch();
    if ($u && password_verify((string)($_POST['p'] ?? ''), $u['pass_hash'])) {
      session_regenerate_id(true); $_SESSION['user'] = ['id' => (int)$u['id'], 'name' => $u['username'], 'role' => $u['role']]; $_SESSION['csrf'] = bin2hex(random_bytes(32));
      if (password_needs_rehash($u['pass_hash'], PASSWORD_DEFAULT)) ab_db()->prepare('UPDATE ab_users SET pass_hash=? WHERE id=?')->execute([password_hash((string)$_POST['p'], PASSWORD_DEFAULT), $u['id']]);
      ab_db()->prepare('UPDATE ab_users SET last_login=? WHERE id=?')->execute([ab_now(), $u['id']]);
      ab_audit($u['username'], 'login'); go('');
    }
    ab_audit((string)($_POST['u'] ?? '?'), 'login_failed');
  }
  $_SESSION['flash'] = [false, $err]; go('');
}
if (!$me) {
  ab_page_head('Abidora admin');
  echo '<p class="mono">Abidora · admin</p><h1>Sign in</h1>';
  if ($flash) echo '<div class="flash ' . ($flash[0] ? 'ok' : 'bad') . '">' . ab_h($flash[1]) . '</div>';
  echo '<form method="post" class="card" style="max-width:420px"><input type="hidden" name="act" value="login"><input type="hidden" name="csrf" value="' . ab_h(ab_csrf()) . '"><label for="u">Username</label><input id="u" name="u" autocomplete="username" required><label for="p">Password</label><input id="p" name="p" type="password" autocomplete="current-password" required><p style="margin-top:16px"><button>Sign in</button></p></form>';
  ab_page_foot(); exit;
}

/* ---------- actions (all POST + CSRF) ---------- */
if ($act !== '') {
  if (!ab_csrf_ok()) go('', 'The form expired. Try again.', false);
  $who = $me['name'];
  switch ($act) {
    case 'logout': ab_audit($who, 'logout'); $_SESSION = []; session_destroy(); go('');
    case 'msg_read': if (!can($me, 'messages')) break; ab_db()->prepare('UPDATE ab_messages SET read_at=? WHERE id=?')->execute([ab_now(), (int)$_POST['id']]); go('tab=messages');
    case 'msg_del': if (!can($me, 'messages')) break; ab_db()->prepare('DELETE FROM ab_messages WHERE id=?')->execute([(int)$_POST['id']]); ab_audit($who, 'message_delete', '#' . (int)$_POST['id']); go('tab=messages', 'Message deleted.');
    case 'tr_save':
      if (!can($me, 'translations')) break;
      $l = (string)($_POST['lang'] ?? ''); if (!isset(AB_LANGS[$l])) go('tab=translations', 'Unknown language.', false);
      $file = AB_DIR . "/i18n/$l.json"; $d = ab_json($file); $en = ab_dict('en'); $n = 0;
      foreach ((array)($_POST['v'] ?? []) as $k => $val) {
        if (!is_string($k) || !array_key_exists($k, $en) || $k === '_meta') continue;
        $val = str_replace("\r\n", "\n", trim((string)$val));
        /* allow only the inline tags the design uses */
        /* plain text stays exactly as typed; anything with markup goes through the strict cleaner */
        if (str_contains($val, '<') || str_contains($val, '&')) $val = ab_clean_inline($val, str_contains((string)$en[$k], '<a '));
        if (($d[$k] ?? null) !== $val) { $d[$k] = $val; $n++; }
      }
      if (isset($_POST['status']) && $l !== 'en') { $st = $_POST['status'] === 'reviewed' ? 'reviewed' : 'draft'; if (($d['_meta']['status'] ?? '') !== $st) { $d['_meta']['status'] = $st; $n++; } }
      if ($n) {
        @mkdir(AB_STORE . '/backups/i18n', 0755, true);
        if (is_file($file)) copy($file, AB_STORE . "/backups/i18n/$l-" . gmdate('Ymd-His') . '.json');
        ab_write($file, json_encode($d, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n"); ab_dict($l, true);
        ab_audit($who, 'translation_save', "$l: $n changes"); ab_set_setting('unpublished', '1');
      }
      go('tab=translations&lang=' . $l . '&f=' . urlencode((string)($_POST['f'] ?? '')), $n ? "$n change(s) saved. Press Publish to put them on the site." : 'Nothing changed.');
    case 'publish':
      if (!can($me, 'translations')) break;
      try { $r = ab_publish_site(); ab_set_setting('unpublished', '0'); ab_audit($who, 'publish', $r['files'] . ' files'); go((string)($_POST['back'] ?? ''), 'Published ' . $r['files'] . ' pages in 10 languages.'); }
      catch (Throwable $e) { go('', 'Publishing failed: ' . $e->getMessage(), false); }
    case 'skills':
      if (!can($me, 'founder')) break;
      $f = AB_DIR . '/data/site.json'; $s = ab_json($f);
      foreach ($s['founder_skills'] as &$k) { $lv = (string)($_POST['lv'][$k['key']] ?? ''); $k['level'] = in_array($lv, ['current', 'learning'], true) ? $lv : ''; } unset($k);
      ab_write($f, json_encode($s, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n"); ab_audit($who, 'founder_skills'); ab_set_setting('unpublished', '1');
      go('tab=founder', 'Saved. Press Publish to update the Founder page.');
    case 'user_add':
      if (!can($me, 'users')) break;
      $u = trim((string)$_POST['u']); $p = (string)$_POST['p']; $r = (string)$_POST['role'];
      if (!preg_match('/^[A-Za-z0-9_.\-]{3,40}$/', $u) || mb_strlen($p) < 10 || !isset(ROLES[$r])) go('tab=users', 'Username 3 to 40 characters, password at least 10, valid role.', false);
      try { ab_db()->prepare('INSERT INTO ab_users (username, pass_hash, role, created_at) VALUES (?,?,?,?)')->execute([$u, password_hash($p, PASSWORD_DEFAULT), $r, ab_now()]); }
      catch (PDOException) { go('tab=users', 'That username already exists.', false); }
      ab_audit($who, 'user_add', "$u ($r)"); go('tab=users', 'User added.');
    case 'user_del':
      if (!can($me, 'users')) break;
      $id = (int)$_POST['id']; if ($id === $me['id']) go('tab=users', 'You cannot delete yourself.', false);
      ab_db()->prepare('DELETE FROM ab_users WHERE id=?')->execute([$id]); ab_audit($who, 'user_delete', "#$id"); go('tab=users', 'User removed.');
    case 'password':
      $s = ab_db()->prepare('SELECT pass_hash FROM ab_users WHERE id=?'); $s->execute([$me['id']]);
      if (!password_verify((string)$_POST['old'], (string)$s->fetchColumn())) go('tab=settings', 'Current password is wrong.', false);
      if (mb_strlen((string)$_POST['new']) < 10) go('tab=settings', 'New password must be at least 10 characters.', false);
      ab_db()->prepare('UPDATE ab_users SET pass_hash=? WHERE id=?')->execute([password_hash((string)$_POST['new'], PASSWORD_DEFAULT), $me['id']]); ab_audit($who, 'password_change'); go('tab=settings', 'Password changed.');
    case 'ai_save':
      if (!can($me, 'ai')) break;
      /* Abidora AI providers. Keys live only in the private config file; an empty key field keeps the saved key. */
      $c = ab_config(); $old = (array)($c['ai']['providers'] ?? []); $find = function (string $type) use ($old) { foreach ($old as $p) if (($p['type'] ?? '') === $type) return $p; return []; };
      $prov = [];
      $gk = preg_replace('/\s+/', '', (string)($_POST['g_key'] ?? '')); $g = $find('gemini');
      if (empty($_POST['g_del'])) { $key = $gk !== '' ? $gk : (string)($g['key'] ?? ''); if ($key !== '') { if (!preg_match('/^[A-Za-z0-9_.\-]{20,160}$/', $key)) go('tab=ai', 'The Gemini key does not look right. Copy it again from AI Studio.', false); $gm = trim((string)($_POST['g_model'] ?? '')); if ($gm !== '' && !preg_match('/^[a-z0-9.\-]{3,60}$/', $gm)) go('tab=ai', 'Model name: letters, numbers, dots and dashes only.', false); $prov[] = ['type' => 'gemini', 'key' => $key, 'model' => $gm]; } }
      $ok = preg_replace('/\s+/', '', (string)($_POST['o_key'] ?? '')); $o = $find('openai');
      if (empty($_POST['o_del'])) { $key = $ok !== '' ? $ok : (string)($o['key'] ?? ''); $base = trim((string)($_POST['o_base'] ?? '')); $om = trim((string)($_POST['o_model'] ?? ''));
        if ($key !== '' || $base !== '') {
          if (!preg_match('~^https://[a-z0-9.\-]+(:\d+)?(/[A-Za-z0-9._\-/]*)?$~i', $base) || !preg_match('/^[A-Za-z0-9_.:\/\-]{2,100}$/', $om) || !preg_match('/^[A-Za-z0-9_\-\.]{10,200}$/', $key)) go('tab=ai', 'Backup provider: enter an https address, a model name and a key.', false);
          $o2 = ['type' => 'openai', 'base' => rtrim($base, '/'), 'key' => $key, 'model' => $om];
          if (($_POST['order'] ?? 'g') === 'o') array_unshift($prov, $o2); else $prov[] = $o2;
        } }
      $c['ai'] = ['enabled' => !empty($_POST['enabled']), 'providers' => $prov, 'daily_cap' => max(1, min(100000, (int)($_POST['cap'] ?? 400))), 'ip_hour' => max(1, min(1000, (int)($_POST['iph'] ?? 30))), 'ip_day' => max(1, min(5000, (int)($_POST['ipd'] ?? 120)))];
      ab_save_config($c); try { ab_set_setting('ai_gemini_model', ''); } catch (Throwable) {}
      if (!empty($_POST['test'])) {
        require_once AB_DIR . '/lib/ai.php'; $GLOBALS['ab_ai_today'] = gmdate('j F Y'); $GLOBALS['ab_ai_facts'] = '';
        $res = [];
        foreach (ab_ai_cfg()['providers'] as $p) { $txt = ''; $r = ab_ai_stream($p, 'Reply with one short friendly sentence.', [['role' => 'user', 'content' => 'Say hello in Bengali.']], [], function ($t) use (&$txt) { $txt .= $t; });
          $res[] = ($p['type'] === 'gemini' ? 'Gemini' : 'Backup') . ' (' . $r['model'] . '): ' . ($r['ok'] ? 'works. Reply: “' . mb_substr(trim($txt), 0, 120) . '”' : 'failed (' . $r['code'] . ', HTTP ' . $r['status'] . ').'); }
        ab_audit($who, 'ai_settings'); go('tab=ai', 'Saved. ' . ($res ? implode(' ', $res) : 'No provider has a key yet.'), !$res || !str_contains(implode(' ', $res), 'failed'));
      }
      ab_audit($who, 'ai_settings'); go('tab=ai', 'AI settings saved.');
    case 'tools_save':
      if (!can($me, 'ai')) break;
      /* Abidora AI tools: web search, live crypto, images. Keys live only in the private config file; an empty key field keeps the saved key.
         Paid options (Gemini search grounding, Gemini images) stay off unless the owner ticks "I approve the cost". */
      require_once AB_DIR . '/lib/ai.php'; require_once AB_DIR . '/lib/tools.php';
      $c = ab_config(); $t = (array)($c['tools'] ?? []); $s = (array)($t['search'] ?? []); $cr = (array)($t['crypto'] ?? []); $im = (array)($t['image'] ?? []);
      $key = fn(string $n) => preg_replace('/\s+/', '', (string)($_POST[$n] ?? ''));
      $num = fn(string $n, int $d, int $hi) => max(1, min($hi, (int)($_POST[$n] ?? $d)));
      $tk = $key('tv_key'); if ($tk !== '') { if (!preg_match('/^tvly-[A-Za-z0-9_\-]{10,120}$/', $tk)) go('tab=ai', 'This does not look like a Tavily key (it starts with tvly-). Nothing was changed.', false); $s['tavily_key'] = $tk; }
      if (!empty($_POST['tv_del'])) $s['tavily_key'] = '';
      $s = array_merge($s, ['enabled' => !empty($_POST['s_on']), 'keyless' => !empty($_POST['s_keyless']), 'provider' => ($_POST['s_prov'] ?? '') === 'gemini' ? 'gemini' : 'tavily', 'paid_ok' => !empty($_POST['s_paid']), 'ip_day' => $num('s_ipd', 20, 1000), 'day_cap' => $num('s_cap', 60, 100000)]);
      $ck = $key('cg_key'); if ($ck !== '') { if (!preg_match('/^CG-[A-Za-z0-9]{10,60}$/', $ck)) go('tab=ai', 'This does not look like a CoinGecko key (it starts with CG-). Nothing was changed.', false); $cr['key'] = $ck; }
      if (!empty($_POST['cg_del'])) $cr['key'] = '';
      $cr = array_merge($cr, ['enabled' => !empty($_POST['c_on']), 'pro' => !empty($_POST['cg_pro'])]);
      $acc = trim((string)($_POST['cf_acc'] ?? '')); if ($acc !== '' && !preg_match('/^[a-f0-9]{32}$/', $acc)) go('tab=ai', 'The Cloudflare Account ID is 32 letters and numbers (a-f, 0-9). Find it on the Workers & Pages page. Nothing was changed.', false);
      $ct = $key('cf_tok'); if ($ct !== '') { if (!preg_match('/^[A-Za-z0-9_\-]{30,120}$/', $ct)) go('tab=ai', 'The Cloudflare API token does not look right. Copy it again. Nothing was changed.', false); $im['cf_token'] = $ct; }
      if (!empty($_POST['cf_del'])) $im['cf_token'] = '';
      $models = ['@cf/black-forest-labs/flux-2-klein-4b', '@cf/black-forest-labs/flux-1-schnell', '@cf/black-forest-labs/flux-2-klein-9b', '@cf/black-forest-labs/flux-2-dev'];
      $gm = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image-preview', 'gemini-3.1-flash-lite-image', 'gemini-3-pro-image-preview'];
      $im = array_merge($im, ['enabled' => !empty($_POST['i_on']), 'cf_account' => $acc !== '' ? $acc : (string)($im['cf_account'] ?? ''), 'provider' => ($_POST['i_prov'] ?? '') === 'gemini' ? 'gemini' : 'cloudflare', 'paid_ok' => !empty($_POST['i_paid']),
        'cf_model' => in_array($_POST['cf_model'] ?? '', $models, true) ? $_POST['cf_model'] : '@cf/black-forest-labs/flux-2-klein-4b', 'gemini_model' => in_array($_POST['g_imodel'] ?? '', $gm, true) ? $_POST['g_imodel'] : 'gemini-2.5-flash-image',
        'ip_day' => $num('i_ipd', 15, 1000), 'day_cap' => $num('i_cap', 120, 100000)]);
      if (!empty($_POST['cf_clear_acc'])) $im['cf_account'] = '';
      $c['tools'] = ['search' => $s, 'crypto' => $cr, 'image' => $im]; ab_save_config($c);
      $msg = 'Tool settings saved.'; $cfg = ab_tools_cfg();
      if (!empty($_POST['t_search']) && ab_tools_search_ready($cfg)) { $r = ab_tools_search('Bitcoin price today', 'general', $cfg); $msg .= ' Web search: ' . ($r['ok'] ? 'works (' . count($r['items']) . ' results, first: ' . ab_h($r['items'][0]['d']) . ').' : 'failed (' . $r['code'] . ').'); }
      if (!empty($_POST['t_crypto']) && $cfg['crypto']['enabled']) { $r = ab_tools_crypto(['bitcoin'], $cfg); $msg .= ' Crypto: ' . ($r['ok'] ? 'works (Bitcoin ' . ab_tools_num($r['coins'][0]['usd']) . ' USD).' : 'failed (' . $r['code'] . ').'); }
      if (!empty($_POST['t_image']) && ab_tools_image_ready($cfg)) { $r = ab_tools_image('a small red paper boat on calm blue water, soft light, photo', '1:1', [], $cfg); $msg .= ' Images: ' . ($r['ok'] ? 'works (' . $r['w'] . '×' . $r['h'] . ', ' . ab_h($r['model']) . ').' : 'failed (' . $r['code'] . ').'); }
      ab_audit($who, 'tools_settings'); go('tab=ai', $msg, !str_contains($msg, 'failed'));
    case 'tts_save':
      if (!can($me, 'ai')) break;
      /* the owner's AI voice clone (ElevenLabs). The key stays in the private config file; an empty field keeps it. */
      ab_set_setting('tts_paused', '');   // saving the settings switches an automatic pause off again
      $c = ab_config(); $t = (array)($c['tts'] ?? []);
      $k = preg_replace('/\s+/', '', (string)($_POST['t_key'] ?? '')); if ($k !== '') { if (!preg_match('/^sk_[A-Za-z0-9_\-]{20,120}$/', $k)) go('tab=ai', 'This is not an ElevenLabs API key: an ElevenLabs key starts with sk_ (ElevenLabs > Developers > API Keys). If your browser filled this box by itself, clear it and paste the key again. Nothing was changed.', false); $t['key'] = $k; }
      if (!empty($_POST['t_del'])) $t['key'] = '';
      $v = trim((string)($_POST['t_voice'] ?? '')); if ($v !== '' && !preg_match('/^[A-Za-z0-9]{10,40}$/', $v)) go('tab=ai', 'The Voice ID has letters and numbers only (find it in ElevenLabs > Voices > your voice > ID).', false);
      $models = ['eleven_v4', 'eleven_v3', 'eleven_multilingual_v2', 'eleven_flash_v2_5', 'eleven_turbo_v2_5'];
      $m = (string)($_POST['t_model'] ?? 'eleven_v4'); if (!in_array($m, $models, true)) $m = 'eleven_v4';
      $f = fn(string $n, float $d) => max(0, min(1, round((float)($_POST[$n] ?? $d), 2)));
      $t = array_merge($t, ['enabled' => !empty($_POST['t_on']), 'voice' => $v, 'name' => mb_substr(trim((string)($_POST['t_name'] ?? 'Abid Islam')) ?: 'Abid Islam', 0, 40), 'model' => $m,
        'daily_chars' => max(0, min(1000000, (int)($_POST['t_daily'] ?? 2000))), 'ip_day_chars' => max(100, min(100000, (int)($_POST['t_ipd'] ?? 1500))),
        'stability' => $f('t_stab', .45), 'similarity' => $f('t_sim', .85), 'style' => $f('t_style', .15)]);
      $c['tts'] = $t; ab_save_config($c);
      $msg = 'Voice settings saved.';
      if (!empty($_POST['t_test']) && !empty($t['key'])) {      // checks the key and the voice; costs no credits
        $base = (isset($t['base']) && str_starts_with((string)$t['base'], 'http://127.0.0.1:')) ? rtrim((string)$t['base'], '/') : 'https://api.elevenlabs.io';
        $get = function (string $path) use ($base, $t) { $ch = curl_init($base . $path); curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_HTTPHEADER => ['xi-api-key: ' . $t['key']]]); $r = curl_exec($ch); $s = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch); return [$s, json_decode((string)$r, true)]; };
        /* ElevenLabs explains a refusal in detail.status / detail.message; show that so the owner knows what to change */
        $why = function (?array $b): string { $d = $b['detail'] ?? null; $t = is_array($d) ? trim((string)($d['status'] ?? '') . ': ' . (string)($d['message'] ?? ''), ': ') : (is_string($d) ? $d : ''); return $t === '' ? '' : ' ElevenLabs says: “' . ab_h(mb_substr($t, 0, 220)) . '”'; };
        [$s1, $sub] = $get('/v1/user/subscription');
        $msg .= $s1 === 200 ? ' Key works. Credits used this month: ' . (int)($sub['character_count'] ?? 0) . ' of ' . (int)($sub['character_limit'] ?? 0) . '.' : ' Credit check failed (HTTP ' . $s1 . ').' . $why($sub);
        if ($v === '') $msg .= ' Voice ID is empty: paste your voice ID and save again.';
        else { [$s2, $vo] = $get('/v1/voices/' . rawurlencode($v)); $msg .= $s2 === 200 ? ' Voice found: “' . ab_h((string)($vo['name'] ?? '')) . '”.' : ' Voice not found (HTTP ' . $s2 . ').' . $why($vo); }
      }
      ab_audit($who, 'tts_settings'); go('tab=ai', $msg, !str_contains($msg, 'failed') && !str_contains($msg, 'not found') && !str_contains($msg, 'is empty'));
    case 'settings':
      if (!can($me, 'settings')) break;
      $n = trim((string)$_POST['notify']); if ($n !== '' && !filter_var($n, FILTER_VALIDATE_EMAIL)) go('tab=settings', 'Email is not valid.', false);
      ab_set_setting('notify_email', $n);
      ab_set_setting('autoreply', empty($_POST['autoreply']) ? '0' : '1');
      /* SMTP (for example Gmail + app password). Kept only in the private config file; an empty password field keeps the saved one. */
      $c = ab_config(); $sh = trim((string)($_POST['smtp_host'] ?? '')); $su = trim((string)($_POST['smtp_user'] ?? '')); $sp = (string)($_POST['smtp_pass'] ?? ''); $sport = (int)($_POST['smtp_port'] ?? 465);
      if (!empty($_POST['smtp_off'])) { unset($c['smtp']); ab_save_config($c); }
      elseif ($sh !== '' || $su !== '') {
        if (!preg_match('/^[a-z0-9.\-]{3,100}$/i', $sh) || !filter_var($su, FILTER_VALIDATE_EMAIL) || !in_array($sport, [465, 587], true)) go('tab=settings', 'Mail server: enter a host such as smtp.gmail.com, port 465 or 587, and the full email address.', false);
        $pass = $sp !== '' ? preg_replace('/\s+/', '', $sp) : (string)($c['smtp']['pass'] ?? '');
        if ($pass === '') go('tab=settings', 'Mail server: enter the app password.', false);
        $c['smtp'] = ['host' => strtolower($sh), 'port' => $sport, 'user' => $su, 'pass' => $pass]; ab_save_config($c);
      }
      if (!empty($_POST['smtp_test'])) {
        require_once AB_DIR . '/lib/mail.php';
        $ok = $n !== '' && ab_mail_send($n, 'Abidora: test email', "This is a test from Abidora Admin > Settings. If you can read it, outgoing email works.\n");
        ab_audit($who, 'settings'); go('tab=settings', $ok ? 'Settings saved. A test email was sent to ' . $n . '. Check the inbox and the spam folder.' : 'Settings saved, but the test email could not be sent. Check the mail server details.', $ok);
      }
      $brand = trim((string)$_POST['brand']); if ($brand !== '' && mb_strlen($brand) <= 40) { $f = AB_DIR . '/data/site.json'; $s = ab_json($f); if (($s['brand'] ?? '') !== $brand) { $s['brand'] = $brand; ab_write($f, json_encode($s, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n"); ab_set_setting('unpublished', '1'); } }
      if (!empty($_POST['rebase'])) { $c = ab_config(); $c['base'] = ab_base_from_request(1); ab_save_config($c); ab_fix_htaccess($c['base']); }
      ab_audit($who, 'settings'); go('tab=settings', 'Settings saved.');
  }
  go('', 'You do not have permission for that.', false);
}

/* ---------- downloads ---------- */
if (($_GET['dl'] ?? '') === 'backup' && can($me, 'backup')) {
  if (!class_exists('ZipArchive')) go('tab=backup', 'This server has no Zip support.', false);
  $tmp = tempnam(sys_get_temp_dir(), 'abk'); $z = new ZipArchive(); $z->open($tmp, ZipArchive::OVERWRITE);
  foreach (['i18n', 'data'] as $dir) foreach (glob(AB_DIR . "/$dir/*.json") as $f) $z->addFile($f, "_abidora/$dir/" . basename($f));
  $dump = [];
  foreach (['ab_users', 'ab_messages', 'ab_audit', 'ab_settings'] as $t) $dump[$t] = ab_db()->query("SELECT * FROM $t")->fetchAll();
  $z->addFromString('database.json', json_encode($dump, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
  $z->addFromString('README.txt', "Abidora backup " . gmdate('c') . "\nContains translations, site data and the database (users with hashed passwords, messages, audit log, settings).\nKeep it private. Restore steps: docs/DEPLOYMENT_GUIDE.md, section Restore.\n");
  $z->close(); ab_audit($me['name'], 'backup_download');
  header('Content-Type: application/zip'); header('Content-Disposition: attachment; filename="abidora-backup-' . gmdate('Ymd-His') . '.zip"'); header('Content-Length: ' . filesize($tmp)); readfile($tmp); unlink($tmp); exit;
}

/* ---------- pages ---------- */
$tab = (string)($_GET['tab'] ?? 'overview'); if (!can($me, $tab)) $tab = 'overview';
$unpub = ab_setting('unpublished', '0') === '1';
ab_page_head('Abidora admin');
echo '<div class="row" style="justify-content:space-between"><div><p class="mono">Abidora · admin · v' . AB_VERSION . '</p><h1>' . ab_h(ucfirst($tab)) . '</h1></div><form method="post" class="row"><span class="note">' . ab_h($me['name']) . ' · ' . ROLES[$me['role']] . '</span><input type="hidden" name="csrf" value="' . ab_h(ab_csrf()) . '"><button class="btn btn2" name="act" value="logout">Sign out</button></form></div>';
echo '<nav class="tabs">'; foreach (array_keys(CAN) as $t) if (can($me, $t)) echo '<a href="?tab=' . $t . '"' . ($t === $tab ? ' class="on"' : '') . '>' . ($t === 'ai' ? 'AI' : ucfirst($t)) . '</a>'; echo '<a href="../" target="_blank" rel="noopener">View site ↗</a></nav>';
if ($flash) echo '<div class="flash ' . ($flash[0] ? 'ok' : 'bad') . '">' . ab_h($flash[1]) . '</div>';
$pubBtn = fn(string $back) => can($me, 'translations') ? '<form method="post" style="display:inline"><input type="hidden" name="csrf" value="' . ab_h(ab_csrf()) . '"><input type="hidden" name="back" value="' . ab_h($back) . '"><button name="act" value="publish">Publish to the site</button></form>' : '';
if ($unpub) echo '<div class="flash"><b class="warn">Unpublished changes.</b> Visitors still see the previous version. ' . $pubBtn('tab=' . $tab) . '</div>';
$csrf = '<input type="hidden" name="csrf" value="' . ab_h(ab_csrf()) . '">';

if ($tab === 'overview') {
  $unread = (int)ab_db()->query('SELECT COUNT(*) FROM ab_messages WHERE read_at IS NULL')->fetchColumn();
  $xs = ab_json(AB_DIR . '/data/experiences.json')['items'] ?? []; $live = count(array_filter($xs, fn($x) => ($x['status'] ?? '') === 'live'));
  echo '<div class="grid"><div class="card stat"><span class="mono">Unread messages</span><b>' . $unread . '</b></div><div class="card stat"><span class="mono">Worlds live</span><b>' . $live . ' / ' . count($xs) . '</b></div><div class="card stat"><span class="mono">Languages</span><b>' . count(AB_LANGS) . '</b></div><div class="card stat"><span class="mono">Last publish</span><b style="font-size:18px">' . ab_h(ab_setting('last_publish', 'never') ?? 'never') . ' UTC</b></div></div>';
  echo '<h2>Translation status</h2><div class="card"><table><tr><th>Language</th><th>Missing</th><th>Status</th><th></th></tr>';
  foreach (AB_LANGS as $l => [$n]) { $d = ab_dict($l); $m = count(ab_missing($l)); $st = $l === 'en' ? 'source' : ($d['_meta']['status'] ?? 'draft');
    echo '<tr><td>' . ab_h($n) . ' <span class="k">' . $l . '</span></td><td class="' . ($m ? 'bad' : 'ok') . '">' . $m . '</td><td class="' . ($st === 'reviewed' || $st === 'source' ? 'ok' : 'warn') . '">' . ab_h($st === 'draft' ? 'AI draft, needs native review' : $st) . '</td><td><a href="?tab=translations&lang=' . $l . '">Edit</a></td></tr>'; }
  echo '</table></div><p>' . $pubBtn('') . '</p>';
}
if ($tab === 'messages') {
  $rows = ab_db()->query('SELECT * FROM ab_messages ORDER BY id DESC LIMIT 200')->fetchAll();
  if (!$rows) echo '<p class="note">No messages yet.</p>';
  foreach ($rows as $r) echo '<div class="card"' . ($r['read_at'] ? '' : ' style="border-color:var(--sig)"') . '><div class="row" style="justify-content:space-between"><b>' . ab_h($r['name']) . '</b><span class="note">' . ab_h($r['created_at']) . ' UTC · ' . ab_h($r['lang']) . '</span></div><p><a href="mailto:' . ab_h($r['email']) . '">' . ab_h($r['email']) . '</a></p><p style="white-space:pre-wrap">' . ab_h($r['body']) . '</p><form method="post" class="row">' . $csrf . '<input type="hidden" name="id" value="' . (int)$r['id'] . '">' . ($r['read_at'] ? '' : '<button class="btn btn2" name="act" value="msg_read">Mark read</button>') . '<button class="danger" name="act" value="msg_del" onclick="return confirm(\'Delete this message?\')">Delete</button></form></div>';
}
if ($tab === 'translations') {
  $l = (string)($_GET['lang'] ?? 'bn'); if (!isset(AB_LANGS[$l])) $l = 'bn';
  $f = (string)($_GET['f'] ?? ''); $q = mb_strtolower(trim((string)($_GET['q'] ?? '')));
  $en = ab_dict('en'); $d = ab_dict($l); $miss = array_flip(ab_missing($l));
  echo '<form method="get" class="row card"><input type="hidden" name="tab" value="translations"><label style="margin:0">Language</label><select name="lang" style="width:auto" onchange="this.form.submit()">';
  foreach (AB_LANGS as $c => [$n]) echo '<option value="' . $c . '"' . ($c === $l ? ' selected' : '') . '>' . ab_h($n) . ' (' . count(ab_missing($c)) . ' missing)</option>';
  echo '</select><select name="f" style="width:auto"><option value="">All strings</option><option value="missing"' . ($f === 'missing' ? ' selected' : '') . '>Only missing</option></select><input name="q" value="' . ab_h($q) . '" placeholder="Search key or English text" style="width:240px"><button class="btn btn2">Filter</button></form>';
  echo '<p class="note">Edit the text on the right. English is shown for reference. Keep placeholders like {brand}, {owner}, {n} and tags like &lt;em&gt; exactly as they are. After saving, press <b>Publish</b> so visitors see the change.</p>';
  echo '<form method="post">' . $csrf . '<input type="hidden" name="act" value="tr_save"><input type="hidden" name="lang" value="' . $l . '"><input type="hidden" name="f" value="' . ab_h($f) . '">';
  if ($l !== 'en') { $st = $d['_meta']['status'] ?? 'draft'; echo '<div class="card row"><b>Review status</b><select name="status" style="width:auto"><option value="draft"' . ($st !== 'reviewed' ? ' selected' : '') . '>Draft: AI translation, needs native review (visitors see a notice)</option><option value="reviewed"' . ($st === 'reviewed' ? ' selected' : '') . '>Reviewed by a native speaker (notice hidden)</option></select></div>'; }
  echo '<table class="tt"><thead><tr><th style="width:22%">Key</th><th style="width:34%">English</th><th>' . ab_h(AB_LANGS[$l][0]) . '</th></tr></thead><tbody>'; $shown = 0;
  foreach ($en as $k => $v) {
    if ($k === '_meta' || ($f === 'missing' && !isset($miss[$k]))) continue;
    if ($q !== '' && !str_contains(mb_strtolower($k . ' ' . $v), $q)) continue;
    if (++$shown > 400) break;
    echo '<tr' . (isset($miss[$k]) ? ' class="miss"' : '') . '><td class="k">' . ab_h($k) . '</td><td class="en">' . ab_h((string)$v) . '</td><td><textarea name="v[' . ab_h($k) . ']" dir="' . AB_LANGS[$l][1] . '" lang="' . AB_LANGS[$l][2] . '" rows="' . max(1, min(6, (int)ceil(mb_strlen((string)$v) / 60))) . '">' . ab_h((string)($d[$k] ?? '')) . '</textarea></td></tr>';
  }
  echo '</tbody></table>' . ($shown > 400 ? '<p class="note">Showing the first 400. Use the search to narrow down.</p>' : '') . '<p style="position:sticky;bottom:0;background:var(--ink);padding:12px 0"><button>Save ' . ab_h(AB_LANGS[$l][0]) . '</button></p></form>';
}
if ($tab === 'founder') {
  $s = ab_site(); $en = ab_dict('en');
  echo '<p class="note">Mark each skill as a <b>current skill</b> or a <b>learning interest</b>. Leave all blank to show one neutral "Skills & interests" list. Only you know which is which, so nothing is pre-filled.</p><form method="post" class="card">' . $csrf . '<input type="hidden" name="act" value="skills"><table>';
  foreach ($s['founder_skills'] as $k) { $lv = $k['level'] ?? ''; echo '<tr><td>' . ab_h((string)($en['sk.' . $k['key']] ?? $k['key'])) . '</td><td><select name="lv[' . ab_h($k['key']) . ']" style="width:auto"><option value="">(not set)</option><option value="current"' . ($lv === 'current' ? ' selected' : '') . '>Current skill</option><option value="learning"' . ($lv === 'learning' ? ' selected' : '') . '>Learning interest</option></select></td></tr>'; }
  echo '</table><p><button>Save</button></p></form>';
}
if ($tab === 'worlds') {
  $xs = ab_json(AB_DIR . '/data/experiences.json'); $en = ab_dict('en');
  echo '<p class="note">A world is marked <b>live</b> only when its page is built, tested and shipped in an update. Planned worlds appear in the public atlas as "Planned". Status is changed by code updates, not here, so a page can never be shown as live before it exists.</p><div class="card"><table><tr><th>#</th><th>World</th><th>Category</th><th>Status</th></tr>';
  foreach ($xs['items'] as $x) echo '<tr><td class="k">' . str_pad((string)$x['id'], 3, '0', STR_PAD_LEFT) . '</td><td>' . ab_h((string)($en['x.' . $x['id']] ?? '')) . '</td><td>' . ab_h((string)($en['cat.' . $x['cat']] ?? '')) . '</td><td class="' . ($x['status'] === 'live' ? 'ok' : 'note') . '">' . ab_h($x['status']) . '</td></tr>';
  echo '</table></div>';
}
if ($tab === 'users') {
  echo '<div class="card"><table><tr><th>User</th><th>Role</th><th>Last sign-in</th><th></th></tr>';
  foreach (ab_db()->query('SELECT id, username, role, last_login FROM ab_users ORDER BY id')->fetchAll() as $u) echo '<tr><td>' . ab_h($u['username']) . '</td><td>' . ab_h(ROLES[$u['role']] ?? $u['role']) . '</td><td class="note">' . ab_h((string)($u['last_login'] ?? '')) . '</td><td>' . ((int)$u['id'] === $me['id'] ? '<span class="note">you</span>' : '<form method="post">' . $csrf . '<input type="hidden" name="id" value="' . (int)$u['id'] . '"><button class="danger" name="act" value="user_del" onclick="return confirm(\'Remove this user?\')">Remove</button></form>') . '</td></tr>';
  echo '</table></div><form method="post" class="card" style="max-width:520px">' . $csrf . '<input type="hidden" name="act" value="user_add"><h2 style="margin-top:0">Add a user</h2><p class="note">Editor: messages, translations, founder skills. Translator: translations only.</p><label>Username</label><input name="u" required><label>Password (at least 10 characters)</label><input name="p" type="password" autocomplete="new-password" required><label>Role</label><select name="role"><option value="translator">Translator</option><option value="editor">Editor</option><option value="owner">Owner</option></select><p style="margin-top:14px"><button>Add user</button></p></form>';
}
if ($tab === 'audit') {
  echo '<div class="card"><table><tr><th>When (UTC)</th><th>User</th><th>Action</th><th>Detail</th></tr>';
  foreach (ab_db()->query('SELECT * FROM ab_audit ORDER BY id DESC LIMIT 300')->fetchAll() as $a) echo '<tr><td class="note">' . ab_h($a['created_at']) . '</td><td>' . ab_h($a['user_name']) . '</td><td>' . ab_h($a['action']) . '</td><td class="note">' . ab_h($a['detail']) . '</td></tr>';
  echo '</table></div>';
}
if ($tab === 'backup') {
  echo '<div class="card"><p>Download one file with all translations, site data and the database (users with hashed passwords, messages, audit log, settings).</p><p><a class="btn" href="?dl=backup">Download backup</a></p><p class="note">Translation edits also keep automatic copies in _abidora/storage/backups/i18n on the server. For a full-site copy including images, also use cPanel > Backup.</p></div>';
}
if ($tab === 'ai') {
  require_once AB_DIR . '/lib/ai.php'; $a = ab_config()['ai'] ?? []; $ps = (array)($a['providers'] ?? []); $g = []; $o = []; $first = $ps[0]['type'] ?? 'gemini';
  foreach ($ps as $p) { if (($p['type'] ?? '') === 'gemini') $g = $p; if (($p['type'] ?? '') === 'openai') $o = $p; }
  $mask = fn(array $p) => !empty($p['key']) ? ' (saved, ends …' . ab_h(substr((string)$p['key'], -4)) . '; leave empty to keep it)' : '';
  $used = 0; try { $q = ab_db()->prepare('SELECT COUNT(*) FROM ab_throttle WHERE k = ? AND created_at > ?'); $q->execute(['ai-global', gmdate('Y-m-d H:i:s', time() - 86400)]); $used = (int)$q->fetchColumn(); } catch (Throwable) {}
  echo '<div class="card" style="max-width:720px"><p>Status: ' . (ab_ai_ready() ? '<b class="ok">ready</b>' : '<b class="warn">not ready (add a key below)</b>') . ' · Questions in the last 24 hours: <b>' . $used . '</b> of ' . (int)($a['daily_cap'] ?? 400) . '</p><p class="note">Keys are kept only in the private config file on this server. Visitors never see them. Conversations are not stored on the server; each visitor\'s history stays in their own browser.</p><p class="note"><b>Free tiers:</b> Google\'s free Gemini tier needs no card, but Google may use free-tier conversations to improve its products, and the daily limit is set by Google (see aistudio.google.com/rate-limit). The chat page tells visitors this.</p></div>';
  echo '<form method="post" class="card" style="max-width:720px">' . $csrf . '<input type="hidden" name="act" value="ai_save">';
  echo '<label class="row" style="color:var(--bone)"><input type="checkbox" name="enabled" value="1" style="width:auto"' . (($a['enabled'] ?? true) !== false ? ' checked' : '') . '> Abidora AI is on</label>';
  echo '<h2>Google Gemini (free key)</h2><p class="note">Get a key at aistudio.google.com/apikey with any Google account. No card needed.</p><label>API key' . $mask($g) . '</label><input name="g_key" type="password" autocomplete="new-password" spellcheck="false"><label>Model (leave empty: the newest free Flash-Lite is chosen automatically)</label><input name="g_model" value="' . ab_h((string)($g['model'] ?? '')) . '" placeholder="automatic">' . ($g ? '<label class="row" style="color:var(--bone)"><input type="checkbox" name="g_del" value="1" style="width:auto"> Remove the Gemini key</label>' : '');
  echo '<h2>Backup provider (optional, OpenAI-compatible)</h2><p class="note">Used when Gemini is over its free limit or down. Groq: address https://api.groq.com/openai/v1, model openai/gpt-oss-120b, free key at console.groq.com. OpenRouter: https://openrouter.ai/api/v1, a model ending in :free.</p><label>Address</label><input name="o_base" value="' . ab_h((string)($o['base'] ?? '')) . '" placeholder="https://api.groq.com/openai/v1"><label>Model</label><input name="o_model" value="' . ab_h((string)($o['model'] ?? '')) . '" placeholder="openai/gpt-oss-120b"><label>API key' . $mask($o) . '</label><input name="o_key" type="password" autocomplete="off">' . ($o ? '<label class="row" style="color:var(--bone)"><input type="checkbox" name="o_del" value="1" style="width:auto"> Remove the backup provider</label>' : '') . '<label>Ask first</label><select name="order"><option value="g">Gemini, then backup</option><option value="o"' . ($first === 'openai' ? ' selected' : '') . '>Backup, then Gemini</option></select>';
  echo '<h2>Limits</h2><label>Questions per day for the whole site</label><input name="cap" type="number" min="1" value="' . (int)($a['daily_cap'] ?? 400) . '"><label>Per visitor per hour</label><input name="iph" type="number" min="1" value="' . (int)($a['ip_hour'] ?? 30) . '"><label>Per visitor per day</label><input name="ipd" type="number" min="1" value="' . (int)($a['ip_day'] ?? 120) . '">';
  echo '<label class="row" style="color:var(--bone)"><input type="checkbox" name="test" value="1" style="width:auto" checked> Test each provider after saving</label><p><button>Save AI settings</button></p></form>';
  /* ---- Abidora AI tools: web search, live crypto, images ---- */
  require_once AB_DIR . '/lib/tools.php'; $tc = ab_tools_cfg(); $tr = (array)(ab_config()['tools'] ?? []);
  $cnt = function (string $k) { try { $q = ab_db()->prepare('SELECT COUNT(*) FROM ab_throttle WHERE k = ? AND created_at > ?'); $q->execute([$k, gmdate('Y-m-d H:i:s', time() - 86400)]); return (int)$q->fetchColumn(); } catch (Throwable) { return 0; } };
  $chk = fn(bool $on) => $on ? ' checked' : ''; $saved = fn(string $v) => $v !== '' ? ' (saved, ends …' . ab_h(substr($v, -4)) . '; leave empty to keep it)' : '';
  $ss = $tc['search']; $cc = $tc['crypto']; $ii = $tc['image'];
  echo '<form method="post" class="card" style="max-width:720px">' . $csrf . '<input type="hidden" name="act" value="tools_save"><h2 style="margin-top:0">Abidora AI tools: web search, live crypto, images</h2>';
  echo '<p class="note">The chat decides by itself when a message needs a tool. Free services are used first. <b>Paid options stay off until you tick “I approve the cost”.</b> Keys stay in the private config file only.</p>';
  echo '<p>Status: web search ' . (ab_tools_search_ready($tc) ? '<b class="ok">on</b>' : '<b class="warn">off</b>') . ' (' . $cnt('srch-global') . ' of ' . $ss['day_cap'] . ' today) · crypto ' . ($cc['enabled'] ? '<b class="ok">on</b>' : '<b class="warn">off</b>') . ' · images ' . (ab_tools_image_ready($tc) ? '<b class="ok">on</b>' : '<b class="warn">off (add a Cloudflare key)</b>') . ' (' . $cnt('img-global') . ' of ' . $ii['day_cap'] . ' today)</p>';
  echo '<h3>Web search</h3><label class="row" style="color:var(--bone)"><input type="checkbox" name="s_on" value="1" style="width:auto"' . $chk($ss['enabled']) . '> Web search is on</label>';
  echo '<p class="note"><b>Tavily (free):</b> 1,000 searches a month, no card. Sign up at app.tavily.com and copy the API key (starts with tvly-). Without a key, Tavily\'s “keyless” mode is used, which has a lower limit.</p><label>Tavily API key' . $saved((string)($tr['search']['tavily_key'] ?? '')) . '</label><input name="tv_key" type="password" autocomplete="new-password" spellcheck="false">' . (!empty($tr['search']['tavily_key']) ? '<label class="row" style="color:var(--bone)"><input type="checkbox" name="tv_del" value="1" style="width:auto"> Remove the Tavily key</label>' : '');
  echo '<label class="row" style="color:var(--bone)"><input type="checkbox" name="s_keyless" value="1" style="width:auto"' . $chk($ss['keyless']) . '> Use keyless mode while no key is saved</label>';
  echo '<label>Search with</label><select name="s_prov"><option value="tavily">Tavily (free)</option><option value="gemini"' . ($ss['provider'] === 'gemini' ? ' selected' : '') . '>Google Search through Gemini (PAID: needs Gemini billing; 5,000 searches a month free, then about $14 per 1,000)</option></select>';
  echo '<label class="row" style="color:var(--bone)"><input type="checkbox" name="s_paid" value="1" style="width:auto"' . $chk(!empty($tr['search']['paid_ok'])) . '> I approve the cost of paid Google search</label>';
  echo '<label>Searches per visitor per day</label><input name="s_ipd" type="number" min="1" value="' . $ss['ip_day'] . '"><label>Searches per day for the whole site (Tavily free = about 33 a day)</label><input name="s_cap" type="number" min="1" value="' . $ss['day_cap'] . '">';
  echo '<h3>Live crypto (CoinGecko, free)</h3><label class="row" style="color:var(--bone)"><input type="checkbox" name="c_on" value="1" style="width:auto"' . $chk($cc['enabled']) . '> Live crypto prices are on</label><p class="note">Works without a key (about 5 requests a minute, cached 60 s). A free Demo key from coingecko.com/en/developers/dashboard (starts with CG-) allows more. The chat shows “Data: CoinGecko” as their terms ask.</p><label>CoinGecko key (optional)' . $saved((string)($tr['crypto']['key'] ?? '')) . '</label><input name="cg_key" type="password" autocomplete="new-password" spellcheck="false">' . (!empty($tr['crypto']['key']) ? '<label class="row" style="color:var(--bone)"><input type="checkbox" name="cg_del" value="1" style="width:auto"> Remove the CoinGecko key</label>' : '') . '<label class="row" style="color:var(--bone)"><input type="checkbox" name="cg_pro" value="1" style="width:auto"' . $chk($cc['pro']) . '> This is a paid Pro key</label>';
  echo '<h3>Images (create and edit)</h3><label class="row" style="color:var(--bone)"><input type="checkbox" name="i_on" value="1" style="width:auto"' . $chk($ii['enabled']) . '> Image creation is on</label>';
  echo '<p class="note"><b>Cloudflare Workers AI (free):</b> 10,000 free “neurons” a day, no card; one 1024×1024 picture uses about 60 to 130, so roughly 75 to 150 pictures a day. When the free amount is used up, pictures stop until 06:00 Dhaka time; no bill. Create a free account at dash.cloudflare.com, copy the Account ID (Workers & Pages page), then My Profile > API Tokens > Create Token > template “Workers AI”.</p>';
  echo '<label>Cloudflare Account ID</label><input name="cf_acc" value="' . ab_h($ii['cf_account']) . '" placeholder="32 characters" spellcheck="false"><label>Cloudflare API token' . $saved($ii['cf_token']) . '</label><input name="cf_tok" type="password" autocomplete="new-password" spellcheck="false">' . ($ii['cf_token'] !== '' ? '<label class="row" style="color:var(--bone)"><input type="checkbox" name="cf_del" value="1" style="width:auto"> Remove the token</label>' : '');
  $om = fn(string $v) => $ii['cf_model'] === $v ? ' selected' : '';
  echo '<label>Cloudflare model</label><select name="cf_model"><option value="@cf/black-forest-labs/flux-2-klein-4b"' . $om('@cf/black-forest-labs/flux-2-klein-4b') . '>FLUX.2 klein 4B (good quality, all shapes, editing; ~75–100 a day free)</option><option value="@cf/black-forest-labs/flux-1-schnell"' . $om('@cf/black-forest-labs/flux-1-schnell') . '>FLUX.1 schnell (square only, cheapest; ~150 a day free)</option><option value="@cf/black-forest-labs/flux-2-klein-9b"' . $om('@cf/black-forest-labs/flux-2-klein-9b') . '>FLUX.2 klein 9B (better, ~7 a day free; check its licence for commercial use)</option><option value="@cf/black-forest-labs/flux-2-dev"' . $om('@cf/black-forest-labs/flux-2-dev') . '>FLUX.2 dev (best Cloudflare quality, uses a lot of neurons)</option></select><p class="note">Editing always uses FLUX.2 klein 4B.</p>';
  $og = fn(string $v) => $ii['gemini_model'] === $v ? ' selected' : '';
  echo '<label>Make pictures with</label><select name="i_prov"><option value="cloudflare">Cloudflare (free)</option><option value="gemini"' . ($ii['provider'] === 'gemini' ? ' selected' : '') . '>Google Gemini “Nano Banana” (PAID: needs Gemini billing; about $0.04 per picture)</option></select><label>Gemini image model (paid)</label><select name="g_imodel"><option value="gemini-2.5-flash-image"' . $og('gemini-2.5-flash-image') . '>Nano Banana, about $0.039 a picture</option><option value="gemini-3.1-flash-image-preview"' . $og('gemini-3.1-flash-image-preview') . '>Nano Banana 2, about $0.067</option><option value="gemini-3.1-flash-lite-image"' . $og('gemini-3.1-flash-lite-image') . '>3.1 Flash-Lite Image</option><option value="gemini-3-pro-image-preview"' . $og('gemini-3-pro-image-preview') . '>Nano Banana Pro, about $0.134</option></select>';
  echo '<label class="row" style="color:var(--bone)"><input type="checkbox" name="i_paid" value="1" style="width:auto"' . $chk(!empty($tr['image']['paid_ok'])) . '> I approve the cost of paid Gemini pictures</label>';
  echo '<label>Pictures per visitor per day</label><input name="i_ipd" type="number" min="1" value="' . $ii['ip_day'] . '"><label>Pictures per day for the whole site</label><input name="i_cap" type="number" min="1" value="' . $ii['day_cap'] . '">';
  echo '<h3>Test after saving</h3><label class="row" style="color:var(--bone)"><input type="checkbox" name="t_search" value="1" style="width:auto" checked> Test web search (uses 1 search)</label><label class="row" style="color:var(--bone)"><input type="checkbox" name="t_crypto" value="1" style="width:auto" checked> Test crypto (free)</label><label class="row" style="color:var(--bone)"><input type="checkbox" name="t_image" value="1" style="width:auto"> Test images (makes 1 picture)</label><p><button>Save tool settings</button></p></form>';
  $t = (array)(ab_config()['tts'] ?? []); $tu = json_decode((string)ab_setting('tts_used', ''), true); $tused = (is_array($tu) && ($tu['d'] ?? '') === gmdate('Y-m-d')) ? (int)$tu['n'] : 0;
  $sel = fn(string $v) => (($t['model'] ?? 'eleven_v4') === $v ? ' selected' : '');
  echo '<form method="post" class="card" style="max-width:720px">' . $csrf . '<input type="hidden" name="act" value="tts_save"><h2 style="margin-top:0">Your AI voice (ElevenLabs)</h2>';
  echo '<p class="note">Reads Abidora AI\'s answers aloud in an AI clone of your voice. The chat page always says that the voice is an AI clone, and the assistant never claims to be you. <b>Every character costs ElevenLabs credits from your plan</b>; repeated sentences come from a cache for free. When the limit is reached or anything fails, visitors hear their device\'s free voice instead.</p>';
  echo '<p>Characters spoken today: <b>' . $tused . '</b> of ' . (int)($t['daily_chars'] ?? 2000) . '</p>';
  $tp = json_decode((string)ab_setting('tts_paused', ''), true); if (is_array($tp) && (empty($tp['until']) || (int)$tp['until'] > time())) echo '<p class="warn"><b>Paused automatically</b>: ' . ($tp['code'] === 'key' ? 'ElevenLabs refused the key. Check it and save again.' : 'ElevenLabs credits ran out. It will try again after ' . h(gmdate('H:i', (int)$tp['until'] + 6 * 3600)) . ' (Dhaka time), or save to try now.') . ' Visitors hear the free browser voice meanwhile.</p>';
  elseif ($tused >= (int)($t['daily_chars'] ?? 2000)) echo '<p class="warn">Today\'s limit is used up, so visitors hear the free browser voice until tomorrow (06:00 Dhaka).</p>';
  echo '<label class="row" style="color:var(--bone)"><input type="checkbox" name="t_on" value="1" style="width:auto"' . (!empty($t['enabled']) ? ' checked' : '') . '> Use my AI voice on the chat page</label>';
  echo '<label>API key' . (!empty($t['key']) ? ' (saved, ends …' . ab_h(substr((string)$t['key'], -4)) . '; leave empty to keep it)' : '') . '</label><input name="t_key" type="password" autocomplete="new-password" spellcheck="false">' . (!empty($t['key']) ? '<label class="row" style="color:var(--bone)"><input type="checkbox" name="t_del" value="1" style="width:auto"> Remove the key</label>' : '');
  echo '<label>Voice ID</label><input name="t_voice" value="' . ab_h((string)($t['voice'] ?? '')) . '" placeholder="from ElevenLabs > Voices"><label>Name shown to visitors</label><input name="t_name" value="' . ab_h((string)($t['name'] ?? 'Abid Islam')) . '" maxlength="40">';
  echo '<label>Model</label><select name="t_model"><option value="eleven_v4"' . $sel('eleven_v4') . '>Eleven v4 (tested with your voice: clear Bangla, English and numbers)</option><option value="eleven_v3"' . $sel('eleven_v3') . '>Eleven v3 (expressive, Bangla)</option><option value="eleven_multilingual_v2"' . $sel('eleven_multilingual_v2') . '>Multilingual v2 (stable; no Bangla)</option><option value="eleven_flash_v2_5"' . $sel('eleven_flash_v2_5') . '>Flash v2.5 (fastest, half price; no Bangla)</option><option value="eleven_turbo_v2_5"' . $sel('eleven_turbo_v2_5') . '>Turbo v2.5</option></select>';
  echo '<label>Stability (lower = more expressive, higher = steadier): ' . '</label><input name="t_stab" type="number" step="0.05" min="0" max="1" value="' . ab_h((string)($t['stability'] ?? 0.45)) . '"><label>Similarity to your voice</label><input name="t_sim" type="number" step="0.05" min="0" max="1" value="' . ab_h((string)($t['similarity'] ?? 0.85)) . '"><label>Style / emotion</label><input name="t_style" type="number" step="0.05" min="0" max="1" value="' . ab_h((string)($t['style'] ?? 0.15)) . '">';
  echo '<label>Characters per day for the whole site</label><input name="t_daily" type="number" min="0" value="' . (int)($t['daily_chars'] ?? 2000) . '"><label>Characters per visitor per day</label><input name="t_ipd" type="number" min="100" value="' . (int)($t['ip_day_chars'] ?? 1500) . '">';
  echo '<label class="row" style="color:var(--bone)"><input type="checkbox" name="t_test" value="1" style="width:auto" checked> Check the key and voice after saving (free)</label><p><button>Save voice settings</button></p></form>';
}
if ($tab === 'settings') {
  $c = ab_config();
  echo '<form method="post" class="card" style="max-width:620px">' . $csrf . '<input type="hidden" name="act" value="settings"><h2 style="margin-top:0">Site</h2><label>Brand name (used on every page)</label><input name="brand" value="' . ab_h((string)(ab_site()['brand'] ?? 'Abidora')) . '" maxlength="40"><label>Email for new contact messages</label><input name="notify" type="email" value="' . ab_h((string)ab_setting('notify_email', '')) . '"><label class="row" style="color:var(--bone)"><input type="checkbox" name="autoreply" value="1" style="width:auto"' . (ab_setting('autoreply', '1') === '1' ? ' checked' : '') . '> Send visitors a one-time styled reply (“a message from the Abidora universe”), at most once per address per day</label><h3>Outgoing mail</h3><p class="note">' . (!empty($c['smtp']['host']) ? 'Now sending through <b>' . ab_h((string)$c['smtp']['host']) . '</b> as <b>' . ab_h((string)$c['smtp']['user']) . '</b>.' : 'Now sending with the hosting’s own mail, from universe@' . ab_h((string)(parse_url((string)($c['base'] ?? ''), PHP_URL_HOST) ?: 'your-domain')) . ', with replies going to the email above.') . ' To send from a Gmail address instead, turn on 2-Step Verification in that Google account, create an app password (Google Account > Security > App passwords), and enter it here.</p><label>Mail server</label><input name="smtp_host" placeholder="smtp.gmail.com" value="' . ab_h((string)($c['smtp']['host'] ?? '')) . '"><label>Port</label><select name="smtp_port"><option value="465"' . ((int)($c['smtp']['port'] ?? 465) === 465 ? ' selected' : '') . '>465 (SSL)</option><option value="587"' . ((int)($c['smtp']['port'] ?? 465) === 587 ? ' selected' : '') . '>587 (STARTTLS)</option></select><label>Email address</label><input name="smtp_user" type="email" value="' . ab_h((string)($c['smtp']['user'] ?? '')) . '"><label>Password (mailbox password, or a Gmail app password)' . (!empty($c['smtp']['pass']) ? ' (saved; leave empty to keep it)' : '') . '</label><input name="smtp_pass" type="password" autocomplete="new-password"><label class="row" style="color:var(--bone)"><input type="checkbox" name="smtp_off" value="1" style="width:auto"> Stop using this mail server</label><label class="row" style="color:var(--bone)"><input type="checkbox" name="smtp_test" value="1" style="width:auto"> Send a test email to the address above after saving</label><p class="note">Site address used for search engines: <b>' . ab_h((string)($c['base'] ?? '')) . '</b></p><label class="row" style="color:var(--bone)"><input type="checkbox" name="rebase" value="1" style="width:auto"> Use this address instead: ' . ab_h(ab_base_from_request(1)) . ' (after moving to a new domain or folder, then press Publish)</label><p><button>Save settings</button></p></form>';
  echo '<form method="post" class="card" style="max-width:620px">' . $csrf . '<input type="hidden" name="act" value="password"><h2 style="margin-top:0">Your password</h2><label>Current password</label><input name="old" type="password" autocomplete="current-password"><label>New password (at least 10 characters)</label><input name="new" type="password" autocomplete="new-password"><p><button>Change password</button></p></form>';
  echo '<div class="card note">Database: ' . ab_h(ab_driver()) . ' · PHP ' . PHP_VERSION . ' · Abidora v' . AB_VERSION . '</div>';
}
ab_page_foot();
