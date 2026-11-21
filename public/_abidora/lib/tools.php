<?php
/* Abidora AI tools: web search, live crypto prices and image generation / editing.
   Used by api/ai.php (the chat picks a tool by itself) and api/image.php (the image endpoint other pages reuse).
   Every key stays in storage/config.php ('tools' block, set in Admin > AI). Nothing the visitor sends is stored.

   Providers (free first; paid ones are off until the owner switches them on in Admin):
     search  tavily      free plan, 1,000 searches a month, no card (keyless mode works too, with a lower limit)
             gemini      Google Search grounding, needs Gemini billing (paid)            -> off by default
     crypto  coingecko   free (keyless public API, or a free Demo key)
     image   cloudflare  Workers AI FLUX (10,000 free neurons a day, no card)
             gemini      Nano Banana image models, needs Gemini billing (paid)            -> off by default */
declare(strict_types=1);

if (!defined('AB_T_TAVILY')) define('AB_T_TAVILY', 'https://api.tavily.com');
if (!defined('AB_T_COINGECKO')) define('AB_T_COINGECKO', 'https://api.coingecko.com/api/v3');
if (!defined('AB_T_COINGECKO_PRO')) define('AB_T_COINGECKO_PRO', 'https://pro-api.coingecko.com/api/v3');
if (!defined('AB_T_CF')) define('AB_T_CF', 'https://api.cloudflare.com/client/v4');

const AB_T_AR = ['1:1' => [1024, 1024], '4:3' => [1024, 768], '3:4' => [768, 1024], '16:9' => [1280, 720], '9:16' => [720, 1280]];

function ab_tools_cfg(): array {
  $t = (array)(ab_config()['tools'] ?? []);
  $s = (array)($t['search'] ?? []); $c = (array)($t['crypto'] ?? []); $i = (array)($t['image'] ?? []);
  $int = fn($v, int $d, int $lo, int $hi) => max($lo, min($hi, (int)($v ?? $d)));
  return [
    'search' => [
      'enabled' => ($s['enabled'] ?? true) !== false,
      'provider' => in_array($s['provider'] ?? 'tavily', ['tavily', 'gemini'], true) ? ($s['provider'] ?? 'tavily') : 'tavily',
      'tavily_key' => (string)($s['tavily_key'] ?? ''),
      'keyless' => ($s['keyless'] ?? true) !== false,                 // Tavily keyless mode when no key is saved
      'paid_ok' => !empty($s['paid_ok']),                              // the owner approved paid Gemini grounding
      'ip_day' => $int($s['ip_day'] ?? null, 20, 1, 1000), 'day_cap' => $int($s['day_cap'] ?? null, 60, 1, 100000),
    ],
    'crypto' => ['enabled' => ($c['enabled'] ?? true) !== false, 'key' => (string)($c['key'] ?? ''), 'pro' => !empty($c['pro'])],
    'image' => [
      'enabled' => ($i['enabled'] ?? true) !== false,
      'provider' => in_array($i['provider'] ?? 'cloudflare', ['cloudflare', 'gemini'], true) ? ($i['provider'] ?? 'cloudflare') : 'cloudflare',
      'cf_account' => (string)($i['cf_account'] ?? ''), 'cf_token' => (string)($i['cf_token'] ?? ''),
      'cf_model' => (string)($i['cf_model'] ?? '@cf/black-forest-labs/flux-2-klein-4b'),
      'cf_edit_model' => (string)($i['cf_edit_model'] ?? '@cf/black-forest-labs/flux-2-klein-4b'),
      'gemini_model' => (string)($i['gemini_model'] ?? 'gemini-2.5-flash-image'),
      'paid_ok' => !empty($i['paid_ok']),
      'ip_day' => $int($i['ip_day'] ?? null, 15, 1, 1000), 'day_cap' => $int($i['day_cap'] ?? null, 120, 1, 100000),
    ],
  ];
}
function ab_tools_gemini_key(): string { foreach (ab_ai_cfg()['providers'] as $p) if ($p['type'] === 'gemini') return (string)$p['key']; return ''; }
function ab_tools_search_ready(?array $c = null): bool {
  $s = ($c ?? ab_tools_cfg())['search']; if (!$s['enabled']) return false;
  return $s['provider'] === 'gemini' ? ($s['paid_ok'] && ab_tools_gemini_key() !== '') : ($s['tavily_key'] !== '' || $s['keyless']);
}
function ab_tools_image_ready(?array $c = null): bool {
  $i = ($c ?? ab_tools_cfg())['image']; if (!$i['enabled']) return false;
  return $i['provider'] === 'gemini' ? ($i['paid_ok'] && ab_tools_gemini_key() !== '') : ($i['cf_account'] !== '' && $i['cf_token'] !== '');
}
/** a shared daily counter for the whole site (like ab_ai_global_ok, for another key) */
function ab_tools_global_ok(string $k, int $max): bool {
  $db = ab_db(); $since = gmdate('Y-m-d H:i:s', time() - 86400);
  $s = $db->prepare('SELECT COUNT(*) FROM ab_throttle WHERE k = ? AND created_at > ?'); $s->execute([$k, $since]);
  if ((int)$s->fetchColumn() >= $max) return false;
  $db->prepare('INSERT INTO ab_throttle (k, created_at) VALUES (?, ?)')->execute([$k, ab_now()]);
  return true;
}

/* ---------- small HTTP helper ---------- */
function ab_tools_http(string $method, string $url, array $headers = [], $body = null, int $timeout = 20): array {
  $ch = curl_init($url);
  $o = [CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 8, CURLOPT_TIMEOUT => $timeout, CURLOPT_HTTPHEADER => $headers, CURLOPT_HEADER => false,
    CURLOPT_USERAGENT => 'Abidora/1.0 (+site assistant)'];
  if ($method === 'POST') { $o[CURLOPT_POST] = true; $o[CURLOPT_POSTFIELDS] = $body; }
  curl_setopt_array($ch, $o);
  $raw = curl_exec($ch); $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE); $ctype = (string)curl_getinfo($ch, CURLINFO_CONTENT_TYPE); $err = curl_errno($ch); curl_close($ch);
  return ['status' => $err ? 0 : $status, 'body' => is_string($raw) ? $raw : '', 'ctype' => $ctype, 'cerr' => $err];
}
function ab_tools_code(int $status, string $body = ''): string {
  return match (true) { $status === 0 => 'network', $status === 429 || $status === 432 || $status === 433 => 'quota', $status === 401 || $status === 403 => 'key', $status === 400 || $status === 422 => 'bad', $status >= 500 => 'down', default => 'empty' };
}

/* ---------- a short JSON answer from free Gemini (used to route a message and to write image prompts) ---------- */
function ab_tools_gemini_json(string $instr, string $text, array $schema, int $timeout = 9): ?array {
  $key = ab_tools_gemini_key(); if ($key === '') return null;
  $p = null; foreach (ab_ai_cfg()['providers'] as $x) if ($x['type'] === 'gemini') { $p = $x; break; }
  $models = array_slice(ab_ai_gemini_chain($p), 0, 3); $t0 = microtime(true);
  $body = json_encode(['systemInstruction' => ['parts' => [['text' => $instr]]], 'contents' => [['role' => 'user', 'parts' => [['text' => $text]]]],
    'generationConfig' => ['temperature' => 0.1, 'maxOutputTokens' => 600, 'responseMimeType' => 'application/json', 'responseSchema' => $schema]], JSON_UNESCAPED_UNICODE);
  foreach ($models as $m) {
    $left = $timeout - (int)(microtime(true) - $t0); if ($left < 2) break;
    $r = ab_tools_http('POST', AB_AI_GEMINI . '/models/' . rawurlencode($m) . ':generateContent', ['Content-Type: application/json', 'x-goog-api-key: ' . $key], $body, $left);
    if ($r['status'] !== 200) { if ($r['status'] === 400 || $r['status'] === 401 || $r['status'] === 403) break; continue; }
    $j = json_decode($r['body'], true); $out = '';
    foreach ((array)($j['candidates'][0]['content']['parts'] ?? []) as $part) if (isset($part['text']) && empty($part['thought'])) $out .= $part['text'];
    $d = json_decode(trim(preg_replace('~^```(?:json)?|```$~m', '', $out)), true);
    if (is_array($d)) return $d;
  }
  return null;
}

/* ---------- 1. choosing a tool ----------
   Cheap word rules first: most messages need no tool and cost nothing extra. When the rules see a hint of a tool,
   one short free Gemini call confirms it and writes the search query or the image prompt. If that call fails,
   the rules decide alone (the raw message becomes the query). */
const AB_T_COINS = [
  'bitcoin' => 'bitcoin', 'btc' => 'bitcoin', 'বিটকয়েন' => 'bitcoin', 'বিটকয়েনের' => 'bitcoin', 'bitkoin' => 'bitcoin',
  'ethereum' => 'ethereum', 'eth' => 'ethereum', 'ether' => 'ethereum', 'ইথেরিয়াম' => 'ethereum', 'ইথেরিয়ামের' => 'ethereum', 'itherium' => 'ethereum',
  'tether' => 'tether', 'usdt' => 'tether', 'bnb' => 'binancecoin', 'binance coin' => 'binancecoin', 'solana' => 'solana', 'sol' => 'solana', 'সোলানা' => 'solana',
  'xrp' => 'ripple', 'ripple' => 'ripple', 'usdc' => 'usd-coin', 'dogecoin' => 'dogecoin', 'doge' => 'dogecoin', 'ডজকয়েন' => 'dogecoin', 'cardano' => 'cardano', 'ada' => 'cardano',
  'tron' => 'tron', 'trx' => 'tron', 'toncoin' => 'the-open-network', 'ton' => 'the-open-network', 'avalanche' => 'avalanche-2', 'avax' => 'avalanche-2',
  'shiba inu' => 'shiba-inu', 'shib' => 'shiba-inu', 'polkadot' => 'polkadot', 'dot' => 'polkadot', 'chainlink' => 'chainlink', 'link' => 'chainlink',
  'litecoin' => 'litecoin', 'ltc' => 'litecoin', 'polygon' => 'polygon-ecosystem-token', 'pol' => 'polygon-ecosystem-token', 'matic' => 'polygon-ecosystem-token',
  'sui' => 'sui', 'pepe' => 'pepe', 'near' => 'near', 'aptos' => 'aptos', 'apt' => 'aptos', 'stellar' => 'stellar', 'xlm' => 'stellar', 'monero' => 'monero', 'xmr' => 'monero',
  'bitcoin cash' => 'bitcoin-cash', 'bch' => 'bitcoin-cash', 'hyperliquid' => 'hyperliquid', 'hype' => 'hyperliquid',
];
const AB_T_LIVE = '~\b(price|prices|pricing|cost|rate|rates|dam|daam|koto|koto taka|market|market ?cap|volume|chart|today|tonight|now|right now|currently|current|latest|newest|recent|recently|news|update|updates|release|released|launch|launched|announce[ds]?|this (week|month|year)|yesterday|live|score|scores|result|results|weather|forecast|stock|stocks|share price|exchange rate|dollar rate|ajke|ajker|aj|ekhon|ekhonkar|khobor|sorboshesh|notun|202[4-9]|who won|who is the (current|new)|in stock|available in|buy|kinte|kothay pabo|vs\.?|versus|compare|comparison|tulona|better than|which is better)\b|দাম|মূল্য|কত টাকা|দর|বাজার|আজ|আজকের|এখন|এখনকার|বর্তমান|সর্বশেষ|সাম্প্রতিক|নতুন|খবর|সংবাদ|আপডেট|লঞ্চ|রিলিজ|ফলাফল|স্কোর|আবহাওয়া|কে জিতেছে|তুলনা|কোনটা ভালো|২০২[৪-৯]~iu';
const AB_T_NEWS = '~\b(news|headline|headlines|khobor|latest .*(ai|tech|technology)|what happened|breaking)\b|খবর|সংবাদ|শিরোনাম|কী ঘটেছে~iu';
const AB_T_IMG_NOUN = '~\b(image|images|picture|pictures|pic|pics|photo|photos|photograph|wallpaper|logo|poster|illustration|drawing|painting|artwork|art|render|3d render|sketch|portrait|banner|thumbnail|icon|chobi|chhobi|chobii|sobi|design)\b|ছবি|চিত্র|পোস্টার|লোগো|ওয়ালপেপার|ডিজাইন|ইলাস্ট্রেশন|আর্ট~iu';
const AB_T_IMG_VERB = '~\b(create|generate|make|draw|paint|design|render|imagine|produce|show me|give me|banao|banaw|banan|banai|banaye|baniye|baniya|toiri|tairi|toyri|ako|aako|aakao|eke|deo|dao|chai)\b|বানাও|বানান|বানাও|বানিয়ে|বানাতে|তৈরি|আঁকো|আঁকুন|এঁকে|আঁকতে|দাও|দিন|চাই|ডিজাইন কর~iu';
const AB_T_EDIT = '~\b(edit|change|changes|remove|erase|delete|replace|background|bg|make it|make the|turn it|turn (him|her|this|the)|convert|restyle|style it|recolou?r|colou?r|brighter|darker|enhance|upscale|sharpen|fix|add|put|swap|blur|crop|instead|more|less|bigger|smaller|bodlao|bodle|poriborton|sorao|sorie|muche|muchhe|kore dao|koro|banao|lal|nil|sobuj|holud|kalo|sada)\b|বদলাও|বদলে|পরিবর্তন|সরাও|সরিয়ে|মুছে|ব্যাকগ্রাউন্ড|যোগ কর|লাল|নীল|সবুজ|হলুদ|কালো|সাদা|আরও|আরো|বড়|ছোট|উজ্জ্বল|করো|করে দাও~iu';
const AB_T_CODEISH = '~\b(website|web ?site|landing page|html|css|react|app|code|database|ui kit|figma|resume|cv|lesson|course|plan|strategy|career)\b|ওয়েবসাইট|কোড|অ্যাপ~iu';

/** finds coins named in the text: ['bitcoin', 'ethereum', ...] */
function ab_tools_coins(string $t): array {
  $low = mb_strtolower($t); $out = [];
  foreach (AB_T_COINS as $name => $id) {
    $re = preg_match('~^\p{Latin}~u', $name) ? '~(?<![\p{L}\p{N}])' . preg_quote($name, '~') . '(?![\p{L}\p{N}])~u' : '~' . preg_quote($name, '~') . '~u';
    if (in_array($name, ['sol', 'dot', 'link', 'near', 'ton', 'pol', 'ada', 'apt', 'hype', 'sui', 'pepe', 'ether'], true) && !preg_match('~\b(coin|crypto|token|price|dam|usdt|binance|exchange|kripto)\b|ক্রিপ্টো|কয়েন~iu', $t)) continue;   // common words: only with a crypto hint
    if (preg_match($re, $low)) $out[$id] = true;
  }
  return array_slice(array_keys($out), 0, 5);
}

/**
 * Decide what the newest message needs.
 * $hasImg: the visitor attached an image now; $prevImg: the last answer in this chat was an image this chat made.
 * Returns ['tool' => chat|search|crypto|image|edit, 'query', 'topic', 'coins', 'prompt', 'ar', 'caption', 'via' => rules|ai]
 */
function ab_tools_route(array $msgs, bool $hasImg, bool $prevImg, string $voice, array $cfg): array {
  $last = (string)end($msgs)['content'];
  $r = ['tool' => 'chat', 'query' => $last, 'topic' => 'general', 'coins' => [], 'prompt' => '', 'ar' => '', 'caption' => '', 'via' => 'rules'];
  if ($voice !== '') return $r;                                       // the voice call keeps its own fast path
  $searchOk = ab_tools_search_ready($cfg); $imgOk = $cfg['image']['enabled']; $cryptoOk = $cfg['crypto']['enabled'];
  $t = preg_replace('~https?://\S+~', ' ', $last);
  $coins = ab_tools_coins($t);
  $live = (bool)preg_match(AB_T_LIVE, $t);
  $imgAsk = preg_match(AB_T_IMG_NOUN, $t) && preg_match(AB_T_IMG_VERB, $t) && !preg_match(AB_T_CODEISH, $t);
  if (preg_match('~^\s*/(image|img|imagine|draw)\b~i', $t)) $imgAsk = true;
  /* "Create a realistic 3D futuristic city": no picture word, but a make-verb on a short request that is not about writing or code */
  $imgMaybe = !$imgAsk && mb_strlen($t) < 160 && preg_match('~\b(create|generate|draw|paint|render|design|imagine|banao|banan|baniye|toiri|tairi|ako|aako)\b|বানাও|বানান|বানিয়ে|তৈরি কর|আঁকো|আঁকুন|এঁকে~iu', $t)
    && !preg_match(AB_T_CODEISH, $t) && !preg_match('~\b(write|text|poem|story|letter|essay|email|caption|list|table|summary|song|joke|quiz|recipe|likh|likho|kobita|golpo|chithi)\b|লিখ|কবিতা|গল্প|চিঠি|রচনা|তালিকা|গান~iu', $t);
  $editAsk = ($hasImg || $prevImg) && preg_match(AB_T_EDIT, $t) && mb_strlen($t) < 400;
  /* first guess from the rules */
  $g = 'chat';
  if ($hasImg && $editAsk && !preg_match('~\b(what|which|who|why|how|explain|describe|identify|ki|keno|kivabe|bolo to)\b|কী|কি |কোন|কেন|কীভাবে|বুঝিয়ে|শনাক্ত|বলো তো~iu', $t)) $g = 'edit';
  elseif ($imgAsk) $g = 'image';
  elseif ($prevImg && $editAsk && mb_strlen($t) < 160) $g = 'edit';
  elseif ($coins && ($live || mb_strlen($t) < 24)) $g = 'crypto';
  elseif ($live) $g = 'search';
  elseif ($imgMaybe) $g = 'maybe-image';
  if ($g === 'chat') return $r;
  /* confirm with a short Gemini call that also writes the query / prompt */
  $ctx = []; foreach (array_slice($msgs, -5, 4) as $m) $ctx[] = strtoupper($m['role']) . ': ' . mb_substr($m['content'], 0, 300);
  $instr = 'You route messages for a chat assistant that has tools. Today is ' . gmdate('j F Y') . ". Tools:\n"
    . "- search: the answer depends on current, changing or recent facts (prices of products in shops, news, releases, scores, weather, exchange rates, comparisons of current products, who holds a position now). Not for timeless knowledge, explanations, maths, writing or advice.\n"
    . "- crypto: live price / market data of a cryptocurrency (price, 24h change, market cap, volume, chart).\n"
    . "- image: the user wants a NEW picture to be generated (a photo, illustration, design, logo, wallpaper).\n"
    . "- edit: the user wants to change an existing picture (" . ($hasImg ? 'they attached one now' : ($prevImg ? 'the previous answer was a generated picture' : 'none available, so never choose edit')) . ").\n"
    . "- chat: everything else, including questions ABOUT an attached image (describe, identify, explain) and requests to write a prompt.\n"
    . "Return JSON. query: a short web search query in English (add 'Bangladesh' for local prices in taka when the user writes Bengali or asks about BD). topic: news if they want news/latest happenings, else general. coins: CoinGecko ids. prompt: for image/edit, a detailed English image prompt (subject, setting, style, lighting, camera/quality words) faithful to the request, no text in the image unless asked; for edit, describe only the change and what to keep. ar: 1:1, 4:3, 3:4, 16:9 or 9:16 if the user implies a shape (portrait/phone wallpaper 9:16, landscape/banner 16:9), else empty. caption: one short friendly sentence in the user's language and script (Bengali script, Banglish in Latin letters, or English) saying what you made.";
  $schema = ['type' => 'OBJECT', 'properties' => [
    'tool' => ['type' => 'STRING', 'enum' => ['chat', 'search', 'crypto', 'image', 'edit']], 'query' => ['type' => 'STRING'], 'topic' => ['type' => 'STRING', 'enum' => ['general', 'news']],
    'coins' => ['type' => 'ARRAY', 'items' => ['type' => 'STRING']], 'prompt' => ['type' => 'STRING'], 'ar' => ['type' => 'STRING'], 'caption' => ['type' => 'STRING']], 'required' => ['tool']];
  $d = ab_tools_gemini_json($instr, ($ctx ? "Earlier:\n" . implode("\n", $ctx) . "\n\n" : '') . "NEW MESSAGE: " . $last . ($hasImg ? "\n[The user attached an image to this message.]" : ''), $schema);
  if (is_array($d) && isset($d['tool'])) {
    $r['via'] = 'ai'; $r['tool'] = (string)$d['tool'];
    if ($r['tool'] === 'edit' && !$hasImg && !$prevImg) $r['tool'] = 'image';
    $r['query'] = trim((string)($d['query'] ?? '')) ?: $last; $r['topic'] = ($d['topic'] ?? '') === 'news' ? 'news' : 'general';
    $r['coins'] = array_values(array_filter(array_map(fn($x) => preg_replace('~[^a-z0-9\-]~', '', strtolower((string)$x)), (array)($d['coins'] ?? [])))) ?: $coins;
    $r['prompt'] = trim((string)($d['prompt'] ?? '')); $r['ar'] = isset(AB_T_AR[$d['ar'] ?? '']) ? (string)$d['ar'] : ''; $r['caption'] = mb_substr(trim((string)($d['caption'] ?? '')), 0, 300);
  } else {
    $r['tool'] = $g === 'maybe-image' ? 'chat' : $g; $r['coins'] = $coins; if (preg_match(AB_T_NEWS, $t)) $r['topic'] = 'news';   // without the AI check, only clear picture requests make pictures
  }
  if ($r['tool'] === 'crypto' && !$r['coins']) $r['tool'] = 'search';
  if ($r['tool'] === 'crypto' && preg_match(AB_T_NEWS, $t)) $r['news'] = true;   // "bitcoin news": live data plus a news search
  /* a tool that is switched off: the chat answers and says so */
  if ($r['tool'] === 'search' && !$searchOk) $r['off'] = 'search';
  if ($r['tool'] === 'crypto' && !$cryptoOk) $r['off'] = 'crypto';
  if (in_array($r['tool'], ['image', 'edit'], true) && !$imgOk) $r['off'] = 'image';
  return $r;
}

/* ---------- 2. web search ---------- */
/** returns ['ok', 'code', 'items' => [['t' title, 'u' url, 'd' domain, 'dt' date|null, 'c' snippet]], 'answer', 'provider'] */
function ab_tools_search(string $q, string $topic, array $cfg): array {
  $s = $cfg['search'];
  $q = mb_substr(trim($q), 0, 380);
  if ($s['provider'] === 'gemini' && $s['paid_ok']) return ab_tools_search_gemini($q);
  $body = ['query' => $q, 'search_depth' => 'basic', 'topic' => $topic === 'news' ? 'news' : 'general', 'max_results' => 6, 'include_answer' => false, 'include_published_date' => true, 'chunks_per_source' => 2];
  if ($topic === 'news') $body['time_range'] = 'week';
  $h = ['Content-Type: application/json'];
  if ($s['tavily_key'] !== '') $h[] = 'Authorization: Bearer ' . $s['tavily_key']; else $h[] = 'X-Tavily-Access-Mode: keyless';
  $r = ab_tools_http('POST', AB_T_TAVILY . '/search', $h, json_encode($body, JSON_UNESCAPED_UNICODE), 20);
  if ($r['status'] !== 200) { error_log('abidora search tavily ' . $r['status'] . ': ' . mb_substr($r['body'], 0, 200)); return ['ok' => false, 'code' => ab_tools_code($r['status']), 'items' => [], 'provider' => 'tavily']; }
  $j = json_decode($r['body'], true); $items = [];
  foreach ((array)($j['results'] ?? []) as $x) {
    $u = (string)($x['url'] ?? ''); if (!preg_match('~^https?://~i', $u)) continue;
    $items[] = ['t' => mb_substr(trim((string)($x['title'] ?? '')), 0, 160) ?: parse_url($u, PHP_URL_HOST), 'u' => $u, 'd' => preg_replace('~^www\.~', '', (string)parse_url($u, PHP_URL_HOST)),
      'dt' => ab_tools_date((string)($x['published_date'] ?? '')), 'c' => mb_substr(preg_replace('~\s+~u', ' ', (string)($x['content'] ?? '')), 0, 900)];
  }
  return ['ok' => (bool)$items, 'code' => $items ? '' : 'nothing', 'items' => $items, 'provider' => 'tavily'];
}
function ab_tools_date(string $s): ?string { $s = preg_replace('~^[A-Za-z]{3},\s*~', '', trim($s)); if ($s === '') return null; $t = strtotime($s); return $t ? gmdate('Y-m-d', $t) : null; }

/** paid: Gemini answers with Google Search itself; we keep the found pages as sources (needs billing) */
function ab_tools_search_gemini(string $q): array {
  $key = ab_tools_gemini_key();
  $body = json_encode(['contents' => [['role' => 'user', 'parts' => [['text' => "Search the web and list the key current facts (with dates) for: " . $q]]]], 'tools' => [['google_search' => (object)[]]], 'generationConfig' => ['temperature' => 0.2, 'maxOutputTokens' => 900]], JSON_UNESCAPED_UNICODE);
  $r = ab_tools_http('POST', AB_AI_GEMINI . '/models/gemini-3.1-flash-lite:generateContent', ['Content-Type: application/json', 'x-goog-api-key: ' . $key], $body, 25);
  if ($r['status'] !== 200) return ['ok' => false, 'code' => ab_tools_code($r['status']), 'items' => [], 'provider' => 'gemini'];
  $j = json_decode($r['body'], true); $c = $j['candidates'][0] ?? []; $txt = '';
  foreach ((array)($c['content']['parts'] ?? []) as $p) $txt .= (string)($p['text'] ?? '');
  $items = [];
  foreach ((array)($c['groundingMetadata']['groundingChunks'] ?? []) as $g) { $w = $g['web'] ?? null; if (!$w || empty($w['uri'])) continue; $items[] = ['t' => (string)($w['title'] ?? ''), 'u' => (string)$w['uri'], 'd' => (string)($w['title'] ?? ''), 'dt' => null, 'c' => '']; }
  if ($items) $items[0]['c'] = mb_substr($txt, 0, 2500);
  return ['ok' => (bool)$items, 'code' => $items ? '' : 'nothing', 'items' => array_slice($items, 0, 6), 'provider' => 'gemini', 'chip' => (string)($c['groundingMetadata']['searchEntryPoint']['renderedContent'] ?? '')];
}

/** the search results as instructions for the answer */
function ab_tools_search_prompt(array $res, string $at): string {
  if (!$res['ok']) return "\n\nWEB SEARCH: you tried to search the web for this message but it failed ({$res['code']}). Say briefly and plainly that the live search did not work right now and the visitor can try again. Do NOT give current prices, news or other live facts from memory; you may explain general background, clearly marked as not current.";
  $o = "\n\nWEB SEARCH RESULTS (searched {$at}). Answer the newest message using ONLY these results for anything current (prices, dates, news, specs of new products). Rules: cite the sources you use inline as [1], [2] (the number of the result); mention the date of the information when a result has one (or say the date is not shown); if results disagree, say so and give the range; if the results do not contain the answer, say you could not find it, do not guess; prices: give the currency and say prices change and vary by shop. Do not add a list of links at the end (the page shows the sources). Keep the visitor's language and script.\n";
  foreach ($res['items'] as $i => $x) $o .= '[' . ($i + 1) . '] ' . $x['t'] . ' (' . $x['d'] . ($x['dt'] ? ', published ' . $x['dt'] : ', no date shown') . ")\n" . $x['c'] . "\n";
  return $o;
}

/* ---------- 3. crypto (CoinGecko) ---------- */
function ab_tools_cg(string $path, array $q, array $cfg, int $ttl = 60): ?array {
  $c = $cfg['crypto']; $dir = AB_STORE . '/cache'; if (!is_dir($dir)) @mkdir($dir, 0700, true);
  $url = ($c['key'] !== '' && $c['pro'] ? AB_T_COINGECKO_PRO : AB_T_COINGECKO) . $path . '?' . http_build_query($q);
  $f = $dir . '/cg-' . md5($url) . '.json';
  if (is_file($f) && filemtime($f) > time() - $ttl && ($d = json_decode((string)file_get_contents($f), true))) return $d;
  $h = ['Accept: application/json']; if ($c['key'] !== '') $h[] = ($c['pro'] ? 'x-cg-pro-api-key: ' : 'x-cg-demo-api-key: ') . $c['key'];
  $r = ab_tools_http('GET', $url, $h, null, 12);
  if ($r['status'] === 200 && is_array($d = json_decode($r['body'], true))) { @file_put_contents($f, $r['body'], LOCK_EX); return $d; }
  if (is_file($f) && filemtime($f) > time() - 900 && ($d = json_decode((string)file_get_contents($f), true))) { $d['_stale'] = filemtime($f); return $d; }   // up to 15 min old, marked
  error_log('abidora crypto ' . $r['status'] . ' ' . $path);
  return null;
}
/** live data for up to 4 coins: ['ok', 'code', 'coins' => [...], 'at' => unix] */
function ab_tools_crypto(array $ids, array $cfg): array {
  $ids = array_slice(array_values(array_unique($ids)), 0, 4);
  /* unknown names: ask CoinGecko's search */
  foreach ($ids as $k => $id) if (!in_array($id, AB_T_COINS, true)) {
    $s = ab_tools_cg('/search', ['query' => $id], $cfg, 86400); $hit = $s['coins'][0]['id'] ?? null; if ($hit) $ids[$k] = (string)$hit; else unset($ids[$k]);
  }
  $ids = array_values(array_unique($ids)); if (!$ids) return ['ok' => false, 'code' => 'nothing', 'coins' => []];
  $m = ab_tools_cg('/coins/markets', ['vs_currency' => 'usd', 'ids' => implode(',', $ids), 'price_change_percentage' => '24h,7d', 'sparkline' => 'true'], $cfg, 60);
  if (!is_array($m) || !array_is_list(array_filter($m, 'is_int', ARRAY_FILTER_USE_KEY))) return ['ok' => false, 'code' => 'down', 'coins' => []];
  $bdt = ab_tools_cg('/simple/price', ['ids' => implode(',', $ids), 'vs_currencies' => 'bdt'], $cfg, 120);
  $out = []; $at = 0;
  foreach ($m as $k => $x) {
    if (!is_int($k) || !is_array($x)) continue;
    $t = strtotime((string)($x['last_updated'] ?? '')) ?: time(); $at = max($at, $t);
    $sp = array_values(array_filter((array)($x['sparkline_in_7d']['price'] ?? []), 'is_numeric'));
    if (count($sp) > 84) { $step = count($sp) / 84; $sp = array_map(fn($i) => $sp[(int)floor($i * $step)], range(0, 83)); }
    $out[] = ['id' => (string)$x['id'], 'sym' => strtoupper((string)($x['symbol'] ?? '')), 'name' => (string)($x['name'] ?? ''), 'img' => (string)($x['image'] ?? ''),
      'usd' => (float)($x['current_price'] ?? 0), 'bdt' => isset($bdt[$x['id']]['bdt']) ? (float)$bdt[$x['id']]['bdt'] : null,
      'ch24' => isset($x['price_change_percentage_24h']) ? round((float)$x['price_change_percentage_24h'], 2) : null,
      'ch7' => isset($x['price_change_percentage_7d_in_currency']) ? round((float)$x['price_change_percentage_7d_in_currency'], 2) : null,
      'cap' => (float)($x['market_cap'] ?? 0), 'rank' => (int)($x['market_cap_rank'] ?? 0), 'vol' => (float)($x['total_volume'] ?? 0),
      'hi' => (float)($x['high_24h'] ?? 0), 'lo' => (float)($x['low_24h'] ?? 0), 'spark' => array_map(fn($v) => round((float)$v, 6), $sp), 'upd' => $t];
  }
  if (!$out) return ['ok' => false, 'code' => 'nothing', 'coins' => []];
  return ['ok' => true, 'code' => '', 'coins' => $out, 'at' => $at, 'stale' => !empty($m['_stale'])];
}
function ab_tools_crypto_prompt(array $res): string {
  if (!$res['ok']) return "\n\nLIVE CRYPTO DATA: the live market data service did not answer right now ({$res['code']}). Say plainly that live prices could not be loaded and the visitor can try again; do NOT give a current price from memory.";
  $o = "\n\nLIVE CRYPTO DATA from CoinGecko (the page shows a card with these numbers and a 7-day chart). Use exactly these numbers, mention the time (UTC" . ($res['stale'] ? ', note: cached, may be a few minutes old' : '') . ") and currency, do not invent other figures, do not predict prices and do not give buy/sell advice (you may add one short line that crypto is volatile and this is not financial advice). Keep the visitor's language and script; write numbers clearly.\n";
  foreach ($res['coins'] as $c) $o .= sprintf("%s (%s): price %s USD%s; 24h change %s%%; 7d change %s%%; 24h high %s / low %s USD; market cap %s USD (rank %d); 24h volume %s USD; updated %s UTC\n",
    $c['name'], $c['sym'], ab_tools_num($c['usd']), $c['bdt'] ? ' (about ' . ab_tools_num($c['bdt']) . ' BDT)' : '', $c['ch24'] ?? 'n/a', $c['ch7'] ?? 'n/a', ab_tools_num($c['hi']), ab_tools_num($c['lo']), ab_tools_num($c['cap']), $c['rank'], ab_tools_num($c['vol']), gmdate('Y-m-d H:i', $c['upd']));
  return $o;
}
function ab_tools_num(float $v): string { return $v >= 100 ? number_format($v, 0) : ($v >= 1 ? number_format($v, 2) : rtrim(rtrim(number_format($v, 8), '0'), '.')); }

/* ---------- 4. images ---------- */
/** shrink an image so its longest side is <= $max px (FLUX.2 klein needs references under 512x512); returns [mime, bytes] */
function ab_tools_shrink(string $bin, int $max = 511): array {
  if (!function_exists('imagecreatefromstring')) return ['', ''];
  $im = @imagecreatefromstring($bin); if (!$im) return ['', ''];
  $w = imagesx($im); $h = imagesy($im); $k = min(1, $max / max($w, $h));
  if ($k < 1) { $nw = max(1, (int)floor($w * $k)); $nh = max(1, (int)floor($h * $k)); $dst = imagecreatetruecolor($nw, $nh); imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255)); imagecopyresampled($dst, $im, 0, 0, 0, 0, $nw, $nh, $w, $h); imagedestroy($im); $im = $dst; }
  ob_start(); imagejpeg($im, null, 90); $out = (string)ob_get_clean(); imagedestroy($im);
  return ['image/jpeg', $out];
}
function ab_tools_img_size(string $bin): array { $s = @getimagesizefromstring($bin); return $s ? [(int)$s[0], (int)$s[1]] : [0, 0]; }

/** writes an English image prompt when the router did not (image endpoint, or the router call failed) */
function ab_tools_image_prompt(string $text, bool $edit): array {
  if (preg_match('~^[\x20-\x7E\s]+$~', $text) && !ab_ai_is_banglish($text) && mb_strlen($text) > 25) return ['prompt' => $text, 'caption' => ''];
  $d = ab_tools_gemini_json('Turn the user request into ' . ($edit ? 'a short English image-edit instruction (only the change, and what to keep)' : 'one detailed English text-to-image prompt (subject, setting, style, lighting, quality words), faithful to the request, no text in the image unless asked') . '. Also give caption: one short friendly sentence in the user\'s language and script saying what you made.', $text,
    ['type' => 'OBJECT', 'properties' => ['prompt' => ['type' => 'STRING'], 'caption' => ['type' => 'STRING']], 'required' => ['prompt']]);
  return ['prompt' => trim((string)($d['prompt'] ?? '')) ?: $text, 'caption' => mb_substr(trim((string)($d['caption'] ?? '')), 0, 300)];
}

/**
 * Make or edit one image. $refs: list of raw image bytes (edit). $ar: one of AB_T_AR.
 * Returns ['ok', 'code', 'mime', 'data' (base64), 'w', 'h', 'model', 'provider', 'seed']
 */
function ab_tools_image(string $prompt, string $ar, array $refs, array $cfg, ?int $seed = null): array {
  $i = $cfg['image']; [$w, $h] = AB_T_AR[$ar] ?? AB_T_AR['1:1']; $seed ??= random_int(1, 2147483646);
  if ($i['provider'] === 'gemini' && $i['paid_ok']) return ab_tools_image_gemini($prompt, $ar, $refs, $i['gemini_model'], $seed);
  if ($i['cf_account'] === '' || $i['cf_token'] === '') return ['ok' => false, 'code' => 'notready'];
  $model = $refs ? $i['cf_edit_model'] : $i['cf_model'];
  $url = AB_T_CF . '/accounts/' . rawurlencode($i['cf_account']) . '/ai/run/' . $model;
  $hdr = ['Authorization: Bearer ' . $i['cf_token']];
  if (str_contains($model, 'flux-2')) {                           // FLUX.2 takes multipart form data, also without images
    $form = ['prompt' => mb_substr($prompt, 0, 2000), 'width' => (string)$w, 'height' => (string)$h, 'seed' => (string)$seed];
    foreach (array_slice($refs, 0, 4) as $k => $bin) {
      [$mime, $small] = ab_tools_shrink($bin); if ($small === '') return ['ok' => false, 'code' => 'gd'];
      $form['input_image_' . $k] = new CURLStringFile($small, 'ref' . $k . '.jpg', $mime);
    }
    $r = ab_tools_http('POST', $url, $hdr, $form, 90);
  } else {                                                        // FLUX.1 schnell: JSON, square only
    $r = ab_tools_http('POST', $url, array_merge($hdr, ['Content-Type: application/json']), json_encode(['prompt' => mb_substr($prompt, 0, 2000), 'steps' => 6, 'seed' => $seed]), 90);
  }
  if (str_starts_with($r['ctype'], 'image/') && $r['status'] === 200) { $bin = $r['body']; $mime = strtok($r['ctype'], ';'); }
  else {
    $j = json_decode($r['body'], true);
    if ($r['status'] !== 200 || empty($j['result']['image'])) {
      $msg = json_encode($j['errors'] ?? $r['body']); error_log('abidora image cf ' . $r['status'] . ': ' . mb_substr((string)$msg, 0, 300));
      $code = ab_tools_code($r['status']);
      if (preg_match('~(daily|neuron|free allocation|limit)~i', (string)$msg) && $r['status'] !== 401) $code = 'quota';
      if (preg_match('~(nsfw|safety|flagged|unsafe|content policy)~i', (string)$msg)) $code = 'safety';
      return ['ok' => false, 'code' => $code];
    }
    $bin = base64_decode((string)$j['result']['image'], true) ?: ''; $mime = str_starts_with($bin, "\x89PNG") ? 'image/png' : 'image/jpeg';
  }
  if ($bin === '') return ['ok' => false, 'code' => 'empty'];
  [$rw, $rh] = ab_tools_img_size($bin);
  return ['ok' => true, 'code' => '', 'mime' => $mime, 'data' => base64_encode($bin), 'w' => $rw ?: $w, 'h' => $rh ?: $h, 'model' => $model, 'provider' => 'cloudflare', 'seed' => $seed];
}

/** paid: Gemini "Nano Banana" models (generate and edit in one call). Off unless the owner approved it. */
function ab_tools_image_gemini(string $prompt, string $ar, array $refs, string $model, int $seed): array {
  $parts = []; foreach (array_slice($refs, 0, 3) as $bin) { [$m, $small] = ab_tools_shrink($bin, 1024); $parts[] = ['inline_data' => ['mime_type' => $m ?: 'image/jpeg', 'data' => base64_encode($small ?: $bin)]]; }
  $parts[] = ['text' => $prompt];
  $body = json_encode(['contents' => [['role' => 'user', 'parts' => $parts]], 'generationConfig' => ['responseModalities' => ['TEXT', 'IMAGE'], 'imageConfig' => ['aspectRatio' => $ar ?: '1:1'], 'seed' => $seed]], JSON_UNESCAPED_UNICODE);
  $r = ab_tools_http('POST', AB_AI_GEMINI . '/models/' . rawurlencode($model) . ':generateContent', ['Content-Type: application/json', 'x-goog-api-key: ' . ab_tools_gemini_key()], $body, 90);
  if ($r['status'] !== 200) { error_log('abidora image gemini ' . $r['status'] . ': ' . mb_substr($r['body'], 0, 300)); return ['ok' => false, 'code' => ab_tools_code($r['status'])]; }
  $j = json_decode($r['body'], true);
  foreach ((array)($j['candidates'][0]['content']['parts'] ?? []) as $p) {
    $d = $p['inlineData'] ?? $p['inline_data'] ?? null;
    if ($d && !empty($d['data'])) { $bin = base64_decode((string)$d['data']); [$w, $h] = ab_tools_img_size($bin); return ['ok' => true, 'code' => '', 'mime' => (string)($d['mimeType'] ?? $d['mime_type'] ?? 'image/png'), 'data' => (string)$d['data'], 'w' => $w, 'h' => $h, 'model' => $model, 'provider' => 'gemini', 'seed' => $seed]; }
  }
  return ['ok' => false, 'code' => ($j['candidates'][0]['finishReason'] ?? '') === 'SAFETY' || isset($j['promptFeedback']['blockReason']) ? 'safety' : 'empty'];
}

/** limits shared by the chat's image tool and api/image.php */
function ab_tools_image_allowed(array $cfg): string {
  if (!ab_throttle('img-d', $cfg['image']['ip_day'], 86400)) return 'wait';
  if (!ab_tools_global_ok('img-global', $cfg['image']['day_cap'])) return 'cap';
  return '';
}

/** checks base64 image input from the browser; returns raw bytes or null */
function ab_tools_b64_image(string $b64, int $max = 3200000): ?string {
  $bin = base64_decode(preg_replace('~^data:[^,]+,~', '', $b64), true);
  if ($bin === false || $bin === '' || strlen($bin) > $max) return null;
  $ok = str_starts_with($bin, "\xFF\xD8\xFF") || str_starts_with($bin, "\x89PNG") || (str_starts_with($bin, 'RIFF') && substr($bin, 8, 4) === 'WEBP');
  return $ok ? $bin : null;
}

/* ---------- what the assistant may now say about itself ---------- */
function ab_tools_system_patch(string $system, array $cfg): string {
  $s = ab_tools_search_ready($cfg); $img = ab_tools_image_ready($cfg); $cr = $cfg['crypto']['enabled'];
  if ($s) $system = str_replace('- You have no internet access and cannot search the web, open links or hear audio in this version. If asked, say so plainly and help with what you can.',
    '- This site can search the web for you: when a message needs current information, the search runs automatically BEFORE you answer and the results are given to you below. If no results are given below, you have not searched for this message: do not pretend you did; you may suggest the visitor ask again for a live search. You cannot open links the visitor pastes or hear audio.', $system);
  if ($img) $system = str_replace('- You cannot create, draw or edit images or photos in this version. If asked, say so plainly, then offer what you can do: write a detailed prompt the visitor can paste into an image tool, or describe the picture in words.',
    '- This site can create and edit images: when the visitor asks for a picture, the image tool runs automatically and the picture appears in the chat (not through you). If you are answering in text, you did not make a picture for this message; never claim you did and never output fake image links or placeholders. If an image request reaches you, say the visitor can ask again, e.g. "create an image of ...".', $system);
  if ($cr) $system = str_replace('- You cannot see live prices, scores, weather or news (for example the current Bitcoin price). Never give a number as if it were current.',
    '- Live data (crypto prices from CoinGecko, web search for other prices, scores, weather or news) is given to you below only when a tool ran for this message. Without it, never give a number as if it were current.', $system);
  return $system;
}

/** a short fallback sentence under a picture, in the visitor's script */
function ab_tools_caption(string $lang, string $last, bool $edit): string {
  if (preg_match('~\p{Bengali}~u', $last)) return $edit ? 'এই নিন, ছবিটা বদলে দিলাম। আরও কিছু বদলাতে চাইলে বলুন।' : 'এই নিন আপনার ছবি। কিছু বদলাতে চাইলে বলুন।';
  if (ab_ai_is_banglish($last)) return $edit ? 'Ei nin, chobita bodle dilam. Aro kichu bodlate chaile bolun.' : 'Ei nin apnar chobi. Kichu bodlate chaile bolun.';
  return $edit ? 'Here is the edited image. Tell me if you want any other changes.' : 'Here is your image. Tell me if you want to change anything.';
}

/** the supported shape closest to a width x height */
function ab_tools_near_ar(int $w, int $h): string {
  if ($w < 1 || $h < 1) return '1:1';
  $best = '1:1'; $d = 9.0; foreach (AB_T_AR as $k => [$aw, $ah]) { $x = abs(log(($w / $h) / ($aw / $ah))); if ($x < $d) { $d = $x; $best = $k; } }
  return $best;
}
