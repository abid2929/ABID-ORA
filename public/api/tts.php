<?php
/* Abidora AI voice: reads a short piece of an answer aloud in the owner's own (cloned) ElevenLabs voice.
   GET  -> {ok, ready, name}
   POST JSON {text, lang} -> audio/mpeg, or JSON {ok:false, code}
   Off unless the owner turns it on in Admin > AI. The key stays on the server. Every character costs ElevenLabs
   credits, so there is a daily character limit for the whole site, a per-visitor limit, and a cache: the same
   sentence is never paid for twice. When anything fails the page falls back to the free browser voice. */
declare(strict_types=1);
require dirname(__DIR__) . '/_abidora/lib/boot.php';
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
if (!ab_installed()) ab_json_out(['ok' => false, 'code' => 'offline'], 503);

function ab_tts_cfg(): array {
  $c = ab_config()['tts'] ?? [];
  return [
    'enabled' => !empty($c['enabled']) && !empty($c['key']) && !empty($c['voice']),
    'key' => (string)($c['key'] ?? ''), 'voice' => (string)($c['voice'] ?? ''),
    'name' => (string)($c['name'] ?? 'Abid Islam'),
    'model' => (string)($c['model'] ?? '') ?: 'eleven_v4',
    'daily' => max(0, (int)($c['daily_chars'] ?? 2000)),
    'ip_day' => max(1, (int)($c['ip_day_chars'] ?? 1500)),
    'stability' => (float)($c['stability'] ?? 0.45), 'similarity' => (float)($c['similarity'] ?? 0.85), 'style' => (float)($c['style'] ?? 0.15),
    /* only for local tests; the real site always talks to ElevenLabs */
    'base' => (isset($c['base']) && str_starts_with((string)$c['base'], 'http://127.0.0.1:')) ? rtrim((string)$c['base'], '/') : 'https://api.elevenlabs.io',
  ];
}
$cfg = ab_tts_cfg();
$method = $_SERVER['REQUEST_METHOD'] ?? '';
/* auto-off: after a credit or key error ElevenLabs is paused (quota: retry after 6 hours; key: until the owner saves new
   settings in Admin), and once the site's daily limit is used up it is off until tomorrow. While off, the page uses the
   free browser voice from the start instead of trying the clone sentence by sentence. */
function ab_tts_paused(): ?array { try { $p = json_decode((string)ab_setting('tts_paused', ''), true); } catch (Throwable) { return null; } if (!is_array($p)) return null; if (!empty($p['until']) && (int)$p['until'] < time()) return null; return $p; }
function ab_tts_used(): int { try { $u = json_decode((string)ab_setting('tts_used', ''), true); } catch (Throwable) { return 0; } return (is_array($u) && ($u['d'] ?? '') === gmdate('Y-m-d')) ? (int)$u['n'] : 0; }
if ($cfg['enabled'] && (ab_tts_paused() || ab_tts_used() >= $cfg['daily'])) $cfg['enabled'] = false;
/* the optional "natural" voice: Google Gemini text-to-speech with the site's Gemini key. OFF unless config tts.natural is
   true: Google's free tier allows only 10 clips a day per TTS model (tested 20 Nov 2026), so it needs a paid Gemini plan
   to be useful, and the owner has to approve that first. */
require_once dirname(__DIR__) . '/_abidora/lib/ai.php';
/* the free Google Gemini voice is the Bengali fallback when the clone is off and the device has no Bengali voice
   (owner test 20 Nov: silent call on a computer). On by default; tts.natural = false in the config turns it off. */
function ab_tts_nat_cfg(): array {
  $t = ab_config()['tts'] ?? []; $key = '';
  foreach (ab_ai_cfg()['providers'] as $p) if ($p['type'] === 'gemini') { $key = (string)$p['key']; break; }
  $paused = false; try { $pz = json_decode((string)ab_setting('tts_nat_paused', ''), true); $paused = is_array($pz) && (int)($pz['until'] ?? 0) > time(); } catch (Throwable) {}
  return ['enabled' => $key !== '' && (!array_key_exists('natural', $t) || !empty($t['natural'])) && !$paused, 'key' => $key,
    'voice' => preg_match('~^[A-Za-z]{2,20}$~', (string)($t['natural_voice'] ?? '')) ? (string)$t['natural_voice'] : 'Kore',
    'daily' => max(0, (int)($t['natural_daily'] ?? 1500)), 'ip_day' => max(1, (int)($t['natural_ip_day'] ?? 300))];
}
$nat = ab_tts_nat_cfg();
if ($method === 'GET') ab_json_out(['ok' => true, 'ready' => $cfg['enabled'], 'name' => $cfg['enabled'] ? $cfg['name'] : '', 'natural' => $nat['enabled']]);
if ($method !== 'POST') ab_json_out(['ok' => false, 'code' => 'method'], 405);
$origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== parse_url('http://' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST)) ab_json_out(['ok' => false, 'code' => 'origin'], 403);
if (stripos((string)($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json') !== 0) ab_json_out(['ok' => false, 'code' => 'invalid'], 415);
$in = json_decode((string)file_get_contents('php://input', false, null, 0, 8000), true);
$text = trim(preg_replace('~\s+~u', ' ', str_replace("\0", '', (string)($in['text'] ?? ''))));
$text = mb_substr($text, 0, 400);
if ($text === '' || !preg_match('~[\p{L}\p{N}]~u', $text)) ab_json_out(['ok' => false, 'code' => 'invalid'], 422);
$len = mb_strlen($text);
if (($in['voice'] ?? '') === 'natural') { ab_tts_natural($nat, $text); }
if (!$cfg['enabled']) ab_json_out(['ok' => false, 'code' => 'notready'], 503);

/* the same sentence, voice and model is paid for only once */
$dir = AB_STORE . '/tts-cache'; @mkdir($dir, 0700, true);
$file = $dir . '/' . hash('sha256', $cfg['voice'] . '|' . $cfg['model'] . '|' . $text) . '.mp3';
$send = function (string $f): never { header('Content-Type: audio/mpeg'); header('Content-Length: ' . filesize($f)); readfile($f); exit; };
if (is_file($file) && filesize($file) > 0) { @touch($file); $send($file); }

try {
  /* per visitor: count characters through the shared throttle table, in steps of 100 characters */
  $steps = (int)ceil($len / 100);
  for ($i = 0; $i < $steps; $i++) if (!ab_throttle('tts-ip', (int)ceil($cfg['ip_day'] / 100), 86400)) ab_json_out(['ok' => false, 'code' => 'wait'], 429);
  /* whole site, per day */
  $day = gmdate('Y-m-d'); $u = json_decode((string)ab_setting('tts_used', ''), true);
  $used = (is_array($u) && ($u['d'] ?? '') === $day) ? (int)$u['n'] : 0;
  if ($used + $len > $cfg['daily']) ab_json_out(['ok' => false, 'code' => 'cap'], 429);
} catch (Throwable $e) { error_log('abidora tts limits: ' . $e->getMessage()); ab_json_out(['ok' => false, 'code' => 'fail'], 500); }

/* Stream: ElevenLabs' streaming endpoint sends audio while it is still being made; it goes straight to the visitor
   (first sound in well under a second on a good line) and is written to the cache at the same time. */
$cut = static function () { while (ob_get_level() > 0) @ob_end_clean(); if (function_exists('apache_setenv')) @apache_setenv('no-gzip', '1'); @ini_set('zlib.output_compression', '0'); };
$status = 0; $type = ''; $started = false; $err = ''; $buf = ''; $tmp = $file . '.' . bin2hex(random_bytes(4)) . '.part'; $fh = null;
$ch = curl_init($cfg['base'] . '/v1/text-to-speech/' . rawurlencode($cfg['voice']) . '/stream?output_format=mp3_44100_64');
curl_setopt_array($ch, [
  CURLOPT_POST => true, CURLOPT_CONNECTTIMEOUT => 6, CURLOPT_TIMEOUT => 45,
  CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: audio/mpeg', 'xi-api-key: ' . $cfg['key']],
  CURLOPT_POSTFIELDS => json_encode(['text' => $text, 'model_id' => $cfg['model'],
    'voice_settings' => ['stability' => $cfg['stability'], 'similarity_boost' => $cfg['similarity'], 'style' => $cfg['style'], 'use_speaker_boost' => true]], JSON_UNESCAPED_UNICODE),
  CURLOPT_HEADERFUNCTION => function ($c, string $line) use (&$status, &$type) {
    if (preg_match('~^HTTP/\S+\s+(\d{3})~', $line, $m)) $status = (int)$m[1];
    elseif (stripos($line, 'content-type:') === 0) $type = trim(substr($line, 13));
    return strlen($line);
  },
  CURLOPT_WRITEFUNCTION => function ($c, string $data) use (&$status, &$type, &$started, &$err, &$buf, &$fh, $tmp, $cut) {
    if (!$started) {
      if ($status !== 200 || stripos($type, 'audio') === false) { $err .= $data; return strlen($err) > 4000 ? 0 : strlen($data); }
      $buf .= $data; if (strlen($buf) < 1024) return strlen($data);           // a tiny first piece is still not proof of audio
      $started = true; $cut();
      header('Content-Type: audio/mpeg'); header('X-Accel-Buffering: no'); header('Cache-Control: no-store');
      $fh = @fopen($tmp, 'wb'); $data = $buf; $buf = '';
    }
    echo $data; @flush(); if ($fh) fwrite($fh, $data);
    return strlen($data);
  },
]);
$ok = curl_exec($ch); $cerr = curl_errno($ch); curl_close($ch);
if (!$started && $buf !== '' && $status === 200 && stripos($type, 'audio') !== false && strlen($buf) >= 200) {   // a very short clip
  $cut(); header('Content-Type: audio/mpeg'); echo $buf; $fh = @fopen($tmp, 'wb'); if ($fh) fwrite($fh, $buf); $started = true;
}
if (!$started) {
  if ($cerr && $status === 0) ab_json_out(['ok' => false, 'code' => 'network'], 502);
  $code = match (true) { str_contains($err, 'quota') || $status === 402 => 'quota', $status === 401 || $status === 403 => 'key', $status === 429 => 'quota', $status >= 500 => 'down', default => 'bad' };
  if ($code === 'quota' || $code === 'key') { try { ab_set_setting('tts_paused', json_encode(['code' => $code, 'at' => time(), 'until' => $code === 'quota' ? time() + 6 * 3600 : 0])); } catch (Throwable) {} }
  error_log('abidora tts ' . $status . ': ' . mb_substr(preg_replace('~\s+~', ' ', $err), 0, 200));
  ab_json_out(['ok' => false, 'code' => $code], 502);
}
/* the audio is already with the visitor; count it, and keep it in the cache only if it arrived whole */
try { ab_set_setting('tts_used', json_encode(['d' => $day, 'n' => $used + $len])); } catch (Throwable) {}
if ($fh) { fclose($fh); if ($ok && !$cerr && filesize($tmp) >= 200) @rename($tmp, $file); else @unlink($tmp); }
if (random_int(1, 50) === 1) foreach (glob($dir . '/*.mp3') ?: [] as $f) if (filemtime($f) < time() - 30 * 86400) @unlink($f);   // keep the cache small
exit;

/** Gemini TTS: whole clip (WAV), cached; quiet lead-in and tail trimmed so speech starts sooner */
function ab_tts_natural(array $nat, string $text): never {
  if (!$nat['enabled']) ab_json_out(['ok' => false, 'code' => 'notready'], 503);
  $dir = AB_STORE . '/tts-cache'; @mkdir($dir, 0700, true);
  $file = $dir . '/' . hash('sha256', 'gemini|' . $nat['voice'] . '|' . $text) . '.wav';
  $send = function (string $f): never { header('Content-Type: audio/wav'); header('Content-Length: ' . filesize($f)); readfile($f); exit; };
  if (is_file($file) && filesize($file) > 44) { @touch($file); $send($file); }
  try {
    if (!ab_throttle('tts-nat-ip', $nat['ip_day'], 86400)) ab_json_out(['ok' => false, 'code' => 'wait'], 429);
    $day = gmdate('Y-m-d'); $u = json_decode((string)ab_setting('tts_nat_used', ''), true);
    $used = (is_array($u) && ($u['d'] ?? '') === $day) ? (int)$u['n'] : 0;
    if ($used >= $nat['daily']) ab_json_out(['ok' => false, 'code' => 'cap'], 429);
  } catch (Throwable $e) { error_log('abidora tts natural limits: ' . $e->getMessage()); ab_json_out(['ok' => false, 'code' => 'fail'], 500); }
  $body = json_encode(['contents' => [['parts' => [['text' => $text]]]],
    'generationConfig' => ['responseModalities' => ['AUDIO'], 'speechConfig' => ['voiceConfig' => ['prebuiltVoiceConfig' => ['voiceName' => $nat['voice']]]]]], JSON_UNESCAPED_UNICODE);
  $pcm = null; $status = 0;
  foreach (['gemini-3.8-flash-tts', 'gemini-3.1-flash-tts-preview'] as $model) {
    $ch = curl_init(AB_AI_GEMINI . '/models/' . $model . ':generateContent');
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body, CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 6, CURLOPT_TIMEOUT => 25,
      CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-goog-api-key: ' . $nat['key']]]);
    $r = (string)curl_exec($ch); $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch);
    $j = json_decode($r, true); $d = $j['candidates'][0]['content']['parts'][0]['inlineData'] ?? null;
    if ($status === 200 && is_array($d) && !empty($d['data'])) {
      $raw = (string)base64_decode((string)$d['data']);
      $pcm = str_starts_with($raw, 'RIFF') ? ab_wav_pcm($raw) : $raw;      // models answer either as WAV or as bare 16-bit 24 kHz PCM
      if ($pcm !== null && strlen($pcm) > 2000) break;
      $pcm = null;
    }
    if ($status !== 200) error_log('abidora tts natural ' . $model . ' ' . $status . ': ' . mb_substr(preg_replace('~\s+~', ' ', $r), 0, 200));
  }
  if ($pcm === null) {
    if ($status === 429) { try { ab_set_setting('tts_nat_paused', json_encode(['at' => time(), 'until' => time() + 3600])); } catch (Throwable) {} }
    ab_json_out(['ok' => false, 'code' => $status === 429 ? 'quota' : ($status >= 500 || $status === 0 ? 'down' : 'bad')], 502);
  }
  /* trim silence: keep 120 ms before the first and 250 ms after the last sound */
  $n = intdiv(strlen($pcm), 2); $s = unpack('v*', $pcm); $a = 0; $b = $n;
  for ($i = 1; $i <= $n; $i++) { $v = $s[$i] >= 32768 ? $s[$i] - 65536 : $s[$i]; if (abs($v) > 600) { $a = $i; break; } }
  for ($i = $n; $i > $a; $i--) { $v = $s[$i] >= 32768 ? $s[$i] - 65536 : $s[$i]; if (abs($v) > 600) { $b = $i; break; } }
  $a = max(0, $a - 2880); $b = min($n, $b + 6000);
  $pcm = substr($pcm, $a * 2, ($b - $a) * 2);
  $wav = 'RIFF' . pack('V', 36 + strlen($pcm)) . 'WAVEfmt ' . pack('VvvVVvv', 16, 1, 1, 24000, 48000, 2, 16) . 'data' . pack('V', strlen($pcm)) . $pcm;
  $tmp = $file . '.' . bin2hex(random_bytes(4)) . '.part';
  if (@file_put_contents($tmp, $wav) !== false) @rename($tmp, $file);
  try { ab_set_setting('tts_nat_used', json_encode(['d' => $day, 'n' => $used + 1])); } catch (Throwable) {}
  if (random_int(1, 50) === 1) foreach (glob($dir . '/*.wav') ?: [] as $f) if (filemtime($f) < time() - 30 * 86400) @unlink($f);
  header('Content-Type: audio/wav'); header('Content-Length: ' . strlen($wav)); echo $wav; exit;
}
function ab_wav_pcm(string $w): ?string {
  $p = 12; $len = strlen($w);
  while ($p + 8 <= $len) { $id = substr($w, $p, 4); $sz = unpack('V', substr($w, $p + 4, 4))[1]; if ($id === 'data') return substr($w, $p + 8, $sz); $p += 8 + $sz + ($sz & 1); }
  return null;
}
