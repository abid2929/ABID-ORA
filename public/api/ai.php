<?php
/* Abidora AI chat endpoint.
   GET  -> {ok, ready} (is the assistant configured?)
   POST JSON {messages:[{role:user|assistant, content}], lang, memory:[..], call, files:[{name, mime, data|text}]} -> text/event-stream
        events: meta {provider, model} · data {t} (text pieces) · done {} · error {code}
   Tools (lib/tools.php): first the server decides if the message needs a web search, live crypto data or an image,
   and runs it. Extra events: tool {k, st, ...} · sources {items, at} · crypto {coins, at} · image {mime, data, w, h, ...}
   App (offline queue): `cid` is the message's own id. A repeat of a finished message (sent again after a lost connection)
   gets the same answer replayed from a short-lived copy (30 min, storage/cache/ai-once) and is not counted again; a repeat
   while the first is still running gets 409 {code:"dup"}. `lite: 1` (Data Saver): no pictures are made.
   Keys stay on the server (storage/config.php). Rate limits per visitor and a daily cap for the whole site. */
declare(strict_types=1);
require dirname(__DIR__) . '/_abidora/lib/boot.php';
require dirname(__DIR__) . '/_abidora/lib/ai.php';
require_once dirname(__DIR__) . '/_abidora/lib/tools.php';   // web search, live crypto, images
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
if (!ab_installed()) ab_json_out(['ok' => false, 'code' => 'offline'], 503);
$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method === 'GET') ab_json_out(['ok' => true, 'ready' => ab_ai_ready()]);
if ($method !== 'POST') ab_json_out(['ok' => false, 'code' => 'method'], 405);

/* only this site's own pages may use the assistant (stops other websites spending the free quota) */
$origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== parse_url('http://' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST)) ab_json_out(['ok' => false, 'code' => 'origin'], 403);
if (stripos((string)($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json') !== 0) ab_json_out(['ok' => false, 'code' => 'invalid'], 415);

$raw = (string)file_get_contents('php://input', false, null, 0, 7600000);   // room for attached files (about 5 MB)
if (strlen($raw) >= 7600000) ab_json_out(['ok' => false, 'code' => 'big'], 413);
$in = json_decode($raw, true);
if (!is_array($in) || !is_array($in['messages'] ?? null)) ab_json_out(['ok' => false, 'code' => 'invalid'], 422);
$clean = fn($s, int $max) => mb_substr(trim(str_replace("\0", '', (string)$s)), 0, $max);
$lang = (string)($in['lang'] ?? 'en'); if (!isset(AB_LANGS[$lang])) $lang = 'en';
$msgs = [];
foreach (array_slice($in['messages'], -24) as $m) {                 // the last 24 turns are enough context
  if (!is_array($m) || !in_array($m['role'] ?? '', ['user', 'assistant'], true)) continue;
  $t = $clean($m['content'] ?? '', 6000); if ($t === '') continue;
  $msgs[] = ['role' => $m['role'], 'content' => $t];
}
while ($msgs && $msgs[0]['role'] !== 'user') array_shift($msgs);
if (!$msgs || end($msgs)['role'] !== 'user') ab_json_out(['ok' => false, 'code' => 'invalid'], 422);
$total = 0; for ($i = count($msgs) - 1; $i >= 0; $i--) { $total += mb_strlen($msgs[$i]['content']); if ($total > 40000) { $msgs = array_slice($msgs, $i + 1); break; } }
while ($msgs && $msgs[0]['role'] !== 'user') array_shift($msgs);
$memory = []; foreach (array_slice((array)($in['memory'] ?? []), 0, 12) as $x) { $x = $clean($x, 200); if ($x !== '') $memory[] = $x; }
$call = $clean($in['call'] ?? '', 40);

/* files attached to the newest message: images and PDFs as base64, text files as text. Checked, never stored. */
$files = []; $bytes = 0;
foreach (array_slice((array)($in['files'] ?? []), 0, 4) as $f) {
  if (!is_array($f)) continue;
  $name = $clean(preg_replace('~[\r\n<>]~', '', (string)($f['name'] ?? 'file')), 120) ?: 'file';
  $mime = (string)($f['mime'] ?? '');
  if ($mime === 'text/plain') {
    $t = $clean($f['text'] ?? '', 60000); if ($t === '' || !mb_check_encoding($t, 'UTF-8')) ab_json_out(['ok' => false, 'code' => 'files'], 422);
    $files[] = ['name' => $name, 'mime' => $mime, 'text' => $t]; $bytes += strlen($t); continue;
  }
  $magic = ['image/jpeg' => "\xFF\xD8\xFF", 'image/png' => "\x89PNG", 'image/webp' => 'RIFF', 'application/pdf' => '%PDF'];
  if (!isset($magic[$mime])) ab_json_out(['ok' => false, 'code' => 'files'], 422);
  $bin = base64_decode((string)($f['data'] ?? ''), true);
  if ($bin === false || $bin === '' || strncmp($bin, $magic[$mime], strlen($magic[$mime])) !== 0 || ($mime === 'image/webp' && substr($bin, 8, 4) !== 'WEBP')) ab_json_out(['ok' => false, 'code' => 'files'], 422);
  if (strlen($bin) > ($mime === 'application/pdf' ? 4300000 : 3200000)) ab_json_out(['ok' => false, 'code' => 'big'], 413);
  $bytes += strlen($bin); $files[] = ['name' => $name, 'mime' => $mime, 'data' => base64_encode($bin)];
}
if ($bytes > 5600000) ab_json_out(['ok' => false, 'code' => 'big'], 413);

$cfg = ab_ai_cfg();
if (!$cfg['enabled'] || !$cfg['providers']) ab_json_out(['ok' => false, 'code' => 'notready'], 503);
$lite = !empty($in['lite']);   // Data Saver: text only

$sseOpen = function (): void {
  @ini_set('zlib.output_compression', '0'); @ini_set('output_buffering', '0'); @ini_set('implicit_flush', '1');
  while (ob_get_level() > 0) @ob_end_flush();
  if (function_exists('apache_setenv')) @apache_setenv('no-gzip', '1');
  ignore_user_abort(false); set_time_limit(150);
  header('Content-Type: text/event-stream; charset=utf-8');
  header('X-Accel-Buffering: no'); header('Cache-Control: no-cache, no-transform');
  echo ':' . str_repeat(' ', 2048) . "\n\n"; @flush();               // pushes past small proxy buffers
};

/* ---------- one answer per message: the offline queue may send the same message again after a lost connection ---------- */
$cid = (string)($in['cid'] ?? '');
if (preg_match('/^[a-z0-9]{10,40}$/i', $cid)) {
  $dd = AB_STORE . '/cache/ai-once'; if (!is_dir($dd)) @mkdir($dd, 0700, true);
  if (mt_rand(1, 30) === 1) foreach (glob("$dd/*.json") ?: [] as $f) if (@filemtime($f) < time() - 1800) @unlink($f);
  $once = $dd . '/' . hash('sha256', 'ai-once|' . $cid) . '.json';
  $fh = @fopen($once, 'x');                                      // created only by the first request with this id
  if ($fh === false) {
    $old = json_decode((string)@file_get_contents($once), true);
    $age = time() - (int)($old['t'] ?? 0);
    if (($old['st'] ?? '') === 'done' && $age < 1800 && is_array($old['ev'] ?? null)) {
      $sseOpen(); ab_ai_sse('meta', ['provider' => 'replay']);
      foreach ($old['ev'] as $e) if (is_array($e) && is_string($e[0] ?? null) && is_array($e[1] ?? null)) ab_ai_sse($e[0], $e[1]);
      exit;
    }
    if (($old['st'] ?? '') === 'busy' && $age < 150) ab_json_out(['ok' => false, 'code' => 'dup'], 409);
    $fh = @fopen($once, 'w');                                    // an old or broken record: start again
  }
  if ($fh) { fwrite($fh, json_encode(['st' => 'busy', 't' => time()])); fclose($fh); }
  $GLOBALS['ab_ai_rec'] = [];
  register_shutdown_function(function () use ($once): void {
    $ev = $GLOBALS['ab_ai_rec'] ?? []; $last = end($ev);
    if (!$ev || ($last[0] ?? '') !== 'done') { @unlink($once); return; }      // not finished: a repeat may try again
    $out = []; foreach ($ev as $e) {                              // text pieces joined, so the copy stays small
      $n = count($out);
      if ($e[0] === 'delta' && $n && $out[$n - 1][0] === 'delta') $out[$n - 1][1]['t'] .= (string)($e[1]['t'] ?? '');
      else $out[] = $e;
    }
    @file_put_contents($once, json_encode(['st' => 'done', 't' => time(), 'ev' => $out], JSON_UNESCAPED_UNICODE), LOCK_EX);
  });
}
try {
  if (!ab_throttle('ai-h', $cfg['ip_hour'], 3600) || !ab_throttle('ai-d', $cfg['ip_day'], 86400)) ab_json_out(['ok' => false, 'code' => 'wait'], 429);
  if (!ab_ai_global_ok($cfg['daily_cap'])) ab_json_out(['ok' => false, 'code' => 'cap'], 429);
} catch (Throwable $e) { error_log('abidora ai throttle: ' . $e->getMessage()); ab_json_out(['ok' => false, 'code' => 'fail'], 500); }

/* stream from here on */
$sseOpen();

$GLOBALS['ab_ai_today'] = gmdate('j F Y');
$GLOBALS['ab_ai_facts'] = ab_ai_site_facts();
$system = ab_ai_system($lang, $memory, $call);
$voiceLang = (string)($in['voice'] ?? ''); if (!isset(AB_LANGS[$voiceLang])) $voiceLang = '';   // set only during a voice call
$system .= ab_ai_turn_hints($voiceLang === 'bn' ? 'bn' : $lang, $msgs, $voiceLang);   // script, Banglish, "speak Bangla", tumi/apni: see the library
$temp = ab_ai_turn_temp($msgs);   // lower for letters, health, science, history, code and translation

/* ---------- tools: search, crypto, image (not during voice calls) ---------- */
$tcfg = ab_tools_cfg();
if ($voiceLang === '') {
  $system = ab_tools_system_patch($system, $tcfg);
  $imgFile = null; foreach ($files as $f) if (isset($f['data']) && str_starts_with($f['mime'], 'image/')) { $imgFile = base64_decode($f['data']); break; }
  $prevImg = ab_tools_b64_image((string)($in['previmg'] ?? ''), 2000000);
  $route = ab_tools_route($msgs, $imgFile !== null, $prevImg !== null, $voiceLang, $tcfg);
  $at = gmdate('Y-m-d H:i') . ' UTC';
  $toolLimit = function (string $k, int $ipDay, int $cap): bool {
    try { return ab_throttle($k . '-d', $ipDay, 86400) && ab_tools_global_ok($k . '-global', $cap); } catch (Throwable) { return false; }
  };
  if (!empty($route['off'])) {
    ab_ai_sse('tool', ['k' => $route['off'], 'st' => 'off']);
    $system .= "\n\nTOOL OFF: this message needs the site's " . ['search' => 'web search', 'crypto' => 'live crypto data', 'image' => 'image generator'][$route['off']] . ", which the site owner has not switched on yet. Say so in one short, plain sentence and help with what you can (for images: offer a detailed prompt the visitor can use elsewhere). Never invent current numbers.";
  } elseif ($route['tool'] === 'search') {
    ab_ai_sse('tool', ['k' => 'search', 'st' => 'start', 'q' => mb_substr($route['query'], 0, 200)]);
    $res = $toolLimit('srch', $tcfg['search']['ip_day'], $tcfg['search']['day_cap']) ? ab_tools_search($route['query'], $route['topic'], $tcfg) : ['ok' => false, 'code' => 'limit', 'items' => []];
    ab_ai_sse('tool', ['k' => 'search', 'st' => $res['ok'] ? 'done' : 'fail', 'code' => $res['code'], 'n' => count($res['items'])]);
    if ($res['ok']) ab_ai_sse('sources', ['items' => array_map(fn($x) => ['t' => $x['t'], 'u' => $x['u'], 'd' => $x['d'], 'dt' => $x['dt']], $res['items']), 'at' => time(), 'q' => $route['query'], 'provider' => $res['provider'], 'chip' => $lite ? '' : ($res['chip'] ?? '')]);
    $system .= ab_tools_search_prompt($res, $at); $temp = min($temp, 0.35);
  } elseif ($route['tool'] === 'crypto') {
    ab_ai_sse('tool', ['k' => 'crypto', 'st' => 'start', 'coins' => $route['coins']]);
    $res = ab_tools_crypto($route['coins'], $tcfg);
    ab_ai_sse('tool', ['k' => 'crypto', 'st' => $res['ok'] ? 'done' : 'fail', 'code' => $res['code']]);
    if ($res['ok']) ab_ai_sse('crypto', ['coins' => $res['coins'], 'at' => $res['at'], 'stale' => $res['stale']]);
    $system .= ab_tools_crypto_prompt($res); $temp = min($temp, 0.3);
    if (!empty($route['news']) && ab_tools_search_ready($tcfg)) {
      ab_ai_sse('tool', ['k' => 'search', 'st' => 'start', 'q' => $route['query']]);
      $sr = $toolLimit('srch', $tcfg['search']['ip_day'], $tcfg['search']['day_cap']) ? ab_tools_search($route['query'], 'news', $tcfg) : ['ok' => false, 'code' => 'limit', 'items' => []];
      ab_ai_sse('tool', ['k' => 'search', 'st' => $sr['ok'] ? 'done' : 'fail', 'code' => $sr['code'], 'n' => count($sr['items'])]);
      if ($sr['ok']) ab_ai_sse('sources', ['items' => array_map(fn($x) => ['t' => $x['t'], 'u' => $x['u'], 'd' => $x['d'], 'dt' => $x['dt']], $sr['items']), 'at' => time(), 'q' => $route['query'], 'provider' => $sr['provider'], 'chip' => $sr['chip'] ?? '']);
      $system .= ab_tools_search_prompt($sr, $at);
    }
  } elseif (in_array($route['tool'], ['image', 'edit'], true)) {
    /* the picture is the answer: make it, send it, add one short sentence, done */
    if ($lite) { ab_ai_sse('tool', ['k' => 'image', 'st' => 'fail', 'code' => 'lite']); ab_ai_sse('error', ['code' => 'img', 'why' => 'lite']); exit; }   // Data Saver: no pictures
    $edit = $route['tool'] === 'edit'; $refs = $edit ? [$imgFile ?? $prevImg] : [];
    $ar = isset(AB_T_AR[$in['ar'] ?? '']) ? (string)$in['ar'] : ($route['ar'] ?: ($edit && $refs[0] ? ab_tools_near_ar(...ab_tools_img_size((string)$refs[0])) : '1:1'));   // an edit keeps the shape of the picture
    ab_ai_sse('tool', ['k' => 'image', 'st' => 'start', 'stage' => 'prompt', 'edit' => $edit, 'ar' => $ar]);
    if (!ab_tools_image_ready($tcfg)) { ab_ai_sse('tool', ['k' => 'image', 'st' => 'fail', 'code' => 'notready']); ab_ai_sse('error', ['code' => 'img', 'why' => 'notready']); exit; }
    try { $why = ab_tools_image_allowed($tcfg); } catch (Throwable) { $why = 'fail'; }
    if ($why !== '') { ab_ai_sse('tool', ['k' => 'image', 'st' => 'fail', 'code' => $why]); ab_ai_sse('error', ['code' => 'img', 'why' => $why]); exit; }
    $pp = $route['prompt'] !== '' ? ['prompt' => $route['prompt'], 'caption' => $route['caption']] : ab_tools_image_prompt((string)end($msgs)['content'], $edit);
    ab_ai_sse('tool', ['k' => 'image', 'st' => 'render', 'prompt' => mb_substr($pp['prompt'], 0, 600), 'edit' => $edit, 'ar' => $ar]);
    $r = ab_tools_image($pp['prompt'], $ar, array_values(array_filter($refs)), $tcfg);
    if (!$r['ok']) { ab_ai_sse('tool', ['k' => 'image', 'st' => 'fail', 'code' => $r['code']]); ab_ai_sse('error', ['code' => 'img', 'why' => $r['code']]); exit; }
    ab_ai_sse('meta', ['provider' => 'image']);
    ab_ai_sse('image', ['mime' => $r['mime'], 'data' => $r['data'], 'w' => $r['w'], 'h' => $r['h'], 'prompt' => $pp['prompt'], 'model' => $r['model'], 'provider' => $r['provider'], 'ar' => $ar, 'edit' => $edit, 'seed' => $r['seed']]);
    $cap = $pp['caption'] !== '' ? $pp['caption'] : ab_tools_caption($lang, (string)end($msgs)['content'], $edit);
    ab_ai_sse('delta', ['t' => $cap]);
    ab_ai_sse('done', ['model' => $r['model']]); exit;
  }
}
$last = ['code' => 'empty'];
$t0 = microtime(true);
foreach ($cfg['providers'] as $i => $p) {
  /* a Gemini key gets a short chain of models: each has its own free per-minute quota, so when Google answers
     "busy" (503), "too many requests" (429) or stalls, the next model answers instead of the visitor seeing an error */
  if ($p['type'] === 'gemini') {          // several free models "race": the first that starts answering wins (see the library)
    $started = false; $pm = $p; $pm['temperature'] = $temp;
    $r = ab_ai_gemini_race($pm, ab_ai_gemini_chain($p), $system, $msgs, $files, function (string $t) use (&$started, $p) {
      if (!$started) { $started = true; ab_ai_sse('meta', ['provider' => $p['type']]); }
      ab_ai_sse('delta', ['t' => $t]);
    }, 2.0, 2);
    if ($r['ok']) { ab_ai_sse('done', ['model' => $r['model']]); exit; }
    $last = $r;
    if ($started) break;
  } else {
    $started = false; $pm = $p; $pm['temperature'] = $temp;
    $r = ab_ai_stream($pm, $system, $msgs, $files, function (string $t) use (&$started, $p) {
      if (!$started) { $started = true; ab_ai_sse('meta', ['provider' => $p['type']]); }
      ab_ai_sse('delta', ['t' => $t]);
    });
    if ($r['ok']) { ab_ai_sse('done', ['model' => $r['model']]); exit; }
    $last = $r;
    if ($started || microtime(true) - $t0 > 30) break;                                     // never restart an answer the visitor already sees
  }
  if (!in_array($last['code'], ['quota', 'down', 'network', 'empty', 'key', 'files'], true)) break;   // next provider
}
ab_ai_sse('error', ['code' => $last['code']]);
