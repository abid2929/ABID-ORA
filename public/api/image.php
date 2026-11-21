<?php
/* Abidora image endpoint (reusable by any page of this site, e.g. the AI Creation Studio worlds).
   GET  -> {ok, ready, edit, provider, ar}
   POST JSON {prompt, mode: generate|edit, ar: 1:1|4:3|3:4|16:9|9:16, images: [base64], style, raw, seed}
        -> {ok:true, mime, data (base64), w, h, prompt, provider, model, seed} | {ok:false, code}
   Same-origin only. Keys stay in the server config. Nothing is stored. Limits are shared with the chat's image tool. */
declare(strict_types=1);
require dirname(__DIR__) . '/_abidora/lib/boot.php';
require dirname(__DIR__) . '/_abidora/lib/ai.php';
require_once dirname(__DIR__) . '/_abidora/lib/tools.php';
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
if (!ab_installed()) ab_json_out(['ok' => false, 'code' => 'offline'], 503);
$cfg = ab_tools_cfg();
$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method === 'GET') ab_json_out(['ok' => true, 'ready' => ab_tools_image_ready($cfg), 'edit' => ab_tools_image_ready($cfg), 'provider' => ab_tools_image_ready($cfg) ? $cfg['image']['provider'] : '', 'ar' => array_keys(AB_T_AR)]);
if ($method !== 'POST') ab_json_out(['ok' => false, 'code' => 'method'], 405);
$origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== parse_url('http://' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST)) ab_json_out(['ok' => false, 'code' => 'origin'], 403);
if (stripos((string)($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json') !== 0) ab_json_out(['ok' => false, 'code' => 'invalid'], 415);
$raw = (string)file_get_contents('php://input', false, null, 0, 17000000);
if (strlen($raw) >= 17000000) ab_json_out(['ok' => false, 'code' => 'big'], 413);
$in = json_decode($raw, true);
if (!is_array($in)) ab_json_out(['ok' => false, 'code' => 'invalid'], 422);
$prompt = mb_substr(trim(str_replace("\0", '', (string)($in['prompt'] ?? ''))), 0, 1500);
$style = mb_substr(trim(preg_replace('~[\r\n]+~', ' ', (string)($in['style'] ?? ''))), 0, 200);
$mode = ($in['mode'] ?? 'generate') === 'edit' ? 'edit' : 'generate';
$ar = isset(AB_T_AR[$in['ar'] ?? '']) ? (string)$in['ar'] : '1:1';
$seed = isset($in['seed']) && is_numeric($in['seed']) ? max(1, min(2147483646, (int)$in['seed'])) : null;
if ($prompt === '') ab_json_out(['ok' => false, 'code' => 'invalid'], 422);
$refs = [];
if ($mode === 'edit') {
  foreach (array_slice((array)($in['images'] ?? []), 0, 4) as $b) { $bin = ab_tools_b64_image((string)$b); if ($bin === null) ab_json_out(['ok' => false, 'code' => 'invalid'], 422); $refs[] = $bin; }
  if (!$refs) ab_json_out(['ok' => false, 'code' => 'invalid'], 422);
}
if (!ab_tools_image_ready($cfg)) ab_json_out(['ok' => false, 'code' => 'notready'], 503);
try { if ($why = ab_tools_image_allowed($cfg)) ab_json_out(['ok' => false, 'code' => $why], 429); }
catch (Throwable $e) { error_log('abidora image throttle: ' . $e->getMessage()); ab_json_out(['ok' => false, 'code' => 'fail'], 500); }
set_time_limit(150);
$p = empty($in['raw']) ? ab_tools_image_prompt($prompt, $mode === 'edit')['prompt'] : $prompt;
if ($style !== '') $p .= ', ' . $style;
$r = ab_tools_image($p, $ar, $refs, $cfg, $seed);
if (!$r['ok']) ab_json_out(['ok' => false, 'code' => $r['code']], match ($r['code']) { 'quota', 'wait', 'cap' => 429, 'safety', 'bad' => 422, 'notready', 'key', 'gd' => 503, default => 502 });
ab_json_out(['ok' => true, 'mime' => $r['mime'], 'data' => $r['data'], 'w' => $r['w'], 'h' => $r['h'], 'prompt' => $p, 'provider' => $r['provider'], 'model' => $r['model'], 'seed' => $r['seed']]);
