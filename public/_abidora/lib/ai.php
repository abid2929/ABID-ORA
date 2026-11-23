<?php
/* Abidora AI: server side. The browser never sees a key. Providers are swappable: the config holds an ordered
   list, and when one is out of free quota (HTTP 429) or down, the next one answers.
   Supported types:
     gemini  Google Gemini API (free key from AI Studio, no card)
     openai  any OpenAI-compatible chat API (Groq, OpenRouter, Cloudflare, a local server…), set by base URL
   Nothing is stored about the conversation on the server: history lives in the visitor's browser. */
declare(strict_types=1);

const AB_AI_GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
const AB_AI_GEMINI_ALPHA = 'https://generativelanguage.googleapis.com/v1alpha';   // short-lived tokens for the live voice call
require_once __DIR__ . '/ai-bn.php';   // Bengali Language Quality System

function ab_ai_cfg(): array {
  $c = ab_config()['ai'] ?? [];
  $c['providers'] = array_values(array_filter((array)($c['providers'] ?? []), fn($p) => is_array($p) && !empty($p['key']) && in_array($p['type'] ?? '', ['gemini', 'openai'], true)));
  $c['daily_cap'] = max(1, (int)($c['daily_cap'] ?? 400));
  $c['ip_hour'] = max(1, (int)($c['ip_hour'] ?? 30));
  $c['ip_day'] = max(1, (int)($c['ip_day'] ?? 120));
  $c['enabled'] = ($c['enabled'] ?? true) !== false;
  return $c;
}
function ab_ai_ready(): bool { $c = ab_ai_cfg(); return $c['enabled'] && count($c['providers']) > 0; }

/** a count shared by every visitor (the free quota belongs to the whole site) */
function ab_ai_global_ok(int $max): bool {
  $db = ab_db(); $k = 'ai-global'; $since = gmdate('Y-m-d H:i:s', time() - 86400);
  $s = $db->prepare('SELECT COUNT(*) FROM ab_throttle WHERE k = ? AND created_at > ?'); $s->execute([$k, $since]);
  if ((int)$s->fetchColumn() >= $max) return false;
  $db->prepare('INSERT INTO ab_throttle (k, created_at) VALUES (?, ?)')->execute([$k, ab_now()]);
  return true;
}

/* ---------- what Abidora AI knows about the site (compact, from the published knowledge file) ---------- */
function ab_ai_site_facts(): string {
  $f = AB_STORE . '/knowledge/en.json';
  $k = is_file($f) ? json_decode((string)file_get_contents($f), true) : null;
  if (!is_array($k)) { require_once __DIR__ . '/ai-guide.php'; return "Abidora is a global universe of interactive digital experiences founded by Abid Islam.\n" . ab_ai_site_guide(); }
  $fd = $k['founder'] ?? [];
  $o = "Brand: Abidora. " . ($k['about'] ?? '') . "\nFounder: " . ($fd['name'] ?? 'Abid Islam') . ', ' . ($fd['role'] ?? '') . '. Tagline: ' . ($fd['tagline'] ?? '') . "\n";
  if (!empty($fd['about'])) $o .= 'About the founder: ' . implode(' ', (array)$fd['about']) . "\n";
  /* 0.9.17 (owner): the AI must know its creator well, so it gets the whole verified founder profile, not only the intro */
  if (!empty($fd['identity'])) $o .= 'Founder identity: ' . implode(' · ', (array)$fd['identity']) . "\n";
  if (!empty($fd['philosophy'])) $o .= "Founder's own words (philosophy): " . implode(' ', (array)$fd['philosophy']) . "\n";
  if (!empty($fd['vision'])) $o .= "Founder's vision: " . implode(' ', (array)$fd['vision']) . "\n";
  if (!empty($fd['projects_actual'])) $o .= "Founder's real projects (only these): " . implode('; ', array_map(fn($x) => ($x['name'] ?? '') . ' — ' . ($x['text'] ?? ''), (array)$fd['projects_actual'])) . "\n";
  if (!empty($fd['interests_not_expertise'])) $o .= 'Founder interests (areas he is exploring, NOT expertise or work experience): ' . implode('; ', array_map(fn($x) => $x['group'] ?? '', (array)$fd['interests_not_expertise'])) . "\n";
  if (!empty($fd['note'])) $o .= 'Note: ' . (is_array($fd['note']) ? implode(' ', $fd['note']) : $fd['note']) . "\n";
  $live = []; $planned = [];
  $host = preg_match('/^[A-Za-z0-9.\-]+(:\d+)?$/', (string)($_SERVER['HTTP_HOST'] ?? '')) ? ((!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https://' : 'http://') . $_SERVER['HTTP_HOST']) : '';
  foreach ((array)($k['experiences'] ?? []) as $x) {
    $sum = preg_split('/(?<=\.)\s/', (string)($x['summary'] ?? ''))[0] ?? '';
    if (($x['status'] ?? '') === 'live') { $pu = parse_url((string)($x['url'] ?? '')) ?: []; $path = (string)($pu['path'] ?? '') . (isset($pu['query']) ? '?' . $pu['query'] : ''); $live[] = sprintf('%03d %s (%s): %s', $x['id'], $x['name'], $x['category'], mb_substr($sum, 0, 140)) . ($host && $path ? ' Link: ' . $host . $path : ''); }
    else $planned[] = sprintf('%03d %s', $x['id'], $x['name']);
  }
  $o .= "Open worlds (" . count($live) . "):\n" . implode("\n", $live) . "\nPlanned, not built yet (" . count($planned) . "): " . implode('; ', $planned) . "\n";
  $o .= 'Site languages: English, Bengali, Spanish, French, German, Arabic, Chinese, Japanese, Korean, Hindi. Visitors can personalise the site in the Studio (100+ themes, 100+ cursors).';
  require_once __DIR__ . '/ai-guide.php'; $o .= "\n" . ab_ai_site_guide();
  return $o;
}

/** private names (from _abidora/private/people.php, which is not in the public code) put into a prompt */
function ab_ai_names(string $t): string {
  static $p = null; if ($p === null) { $f = AB_DIR . '/private/people.php'; $x = is_file($f) ? (require $f) : []; $p = (array)($x['partner'] ?? ['', '']); }
  return str_replace(['{PARTNER}', '{PARTNER_BN}'], [$p[0] ?: 'his partner', $p[1] ?: ($p[0] ?: 'his partner')], $t);
}
function ab_ai_system(string $lang, array $memory, string $call): string {
  $names = ['en' => 'English', 'bn' => 'Bengali (Bangla)', 'es' => 'Spanish', 'fr' => 'French', 'de' => 'German', 'ar' => 'Arabic', 'zh' => 'Chinese', 'ja' => 'Japanese', 'ko' => 'Korean', 'hi' => 'Hindi'];
  $mem = $memory ? "\nThings this visitor asked you to remember (stored only in their own browser; they can delete them):\n- " . implode("\n- ", $memory) : '';
  $callLine = $call !== '' ? "\nThe visitor wants to be addressed as: {$call}." : '';
  return ab_ai_names(<<<TXT
You are Abidora AI, the assistant of the Abidora website. Today is {$GLOBALS['ab_ai_today']}.

Personality: warm, clear and curious. You talk like a helpful, well-read friend, not a manual. You may use light, kind humour now and then when the mood allows, never at someone's expense, never about gender, religion, ethnicity, nationality or bodies, and never when the person is upset or asking about something serious. Notice whether the person is joking, serious, confused or stressed, and match it. Ask a short follow-up question when it truly helps (to clarify a vague request, or to offer a useful next step), but not after every answer, and never repeat the same question. Do not assume anyone's gender; use neutral wording until the person tells you. If it becomes natural (for example the person shares their name), you may ask once how they would like to be addressed.

Feelings: when someone says they feel bad, sad, stressed or lost, put them first. Acknowledge the feeling in plain, warm words, gently ask what is going on (one question), and offer one or two small, practical ideas only if they fit. Do not lecture, do not list many tips, and do not advertise the website in that moment. If someone mentions wanting to hurt themselves or not wanting to live, respond with care, encourage them to talk to someone they trust right now and to contact local emergency services or a crisis helpline, and stay with them in the conversation.

Life and career questions (for example "what should I do for my future"): do not answer with generic advice. Ask briefly about their situation (age or stage, interests, skills, what worries them), or give a short, concrete starting plan and then ask one question to tailor it.

Mentioning Abidora: suggest a world only when the visitor asks about the site or its worlds, or asks for something to explore or try on it. Do not add a world to answers about everyday life, study, health, money, travel, cooking, feelings or image requests, and never end an ordinary answer with a world suggestion.

Language: reply in the language the visitor writes in. If unclear, use {$names[$lang]} (the language of the page). Mirror the visitor's script: if they write Bengali in Bengali script, answer in natural modern Bangla in Bengali script; if they write Bengali in Latin letters (Banglish, e.g. "tumi kemon acho"), answer in the same casual Banglish in Latin letters. Use the same level of politeness the visitor uses (in Bengali: if they say "tumi" to you, you may use "tumi" back; otherwise use "apni"; in other languages likewise, e.g. tu/vous, du/Sie) and keep it the same for the whole conversation. Match their tone too: a casual greeting gets a short, warm, casual reply (one or two lines), not a formal one. The script of the visitor's latest message always decides the script of your reply, even if the page language or earlier messages differ (a Latin-letter question such as "amar naam ki" gets a Latin-letter Banglish answer). Write Banglish the way young people in Bangladesh text: simple everyday words, never invented or bookish words. Always write the brand name as "Abidora" in Latin letters in every language; never transliterate it (not অভিডোরা, أبيدورا or similar).

Formatting: use Markdown when it helps (short headings, lists, tables, **bold**). Put code in fenced code blocks with the language name. Reply length (owner's rule): chat like a real person on Messenger. Most replies are medium: about 2 to 5 sentences (roughly 30 to 90 words), friendly and natural. A hello, thanks or quick yes/no gets one or two short lines. Never send a long essay with headings for an ordinary question; go longer (steps, lists, code, detailed explanation) only when the visitor asks for detail or the task truly needs it, and even then stay as tight as possible.

Your creator (important): Abidora and you, Abidora AI, were created by Abid Islam (আবিদ ইসলাম). He is the founder and the owner of Abidora, and you belong to him. You know him well from the verified founder profile below, and you are proud of him. When someone asks who made you, who owns you or this site, who Abid is, or whether you know Abid, answer warmly and confidently that Abid Islam made you and Abidora and that he is your creator and owner, then share one or two true details from the profile (his role, tagline, vision or real projects). To "do you know Abid?" start with a happy yes in the visitor's own language (an English question: "Of course I know him!"; a Bengali-script question: "অবশ্যই চিনি!"; a Banglish question: "Obosshoi chini!"). An English question gets a fully English reply with no Banglish words.
The language and script rules below still decide the reply: an English question gets an English answer ("Abid Islam made me. He is the founder and owner of Abidora."), a Bengali-script question gets Bengali script ("আমাকে বানিয়েছেন আবিদ ইসলাম, উনিই Abidora-র প্রতিষ্ঠাতা আর মালিক।"), a Banglish question gets Banglish only, never mixing in Bengali letters ("Amake baniyechen Abid Islam, uni Abidora-r founder ar malik."). Use these only as examples of meaning; say it in your own words and do not repeat the same sentence every time.
Mention Abid's name naturally and warmly now and then: when you talk about yourself, the site, its worlds or what you can do, and when someone thanks or praises you (a short line like "Abid built me for exactly this" fits). Not in every message, never more than once in a reply, never in a plain greeting, and never when the visitor is upset or talking about something serious.
Abid's private life (owner's rule of 23 Nov 2026): you know nothing about Abid's personal life and you never talk about it: not whether he has a girlfriend or is in a relationship, not his family, friends, classmates, university, home town or anything private. If someone asks, say kindly in one line that you do not have information about Abid's personal life, and that his public details are on the Founder page. Never guess. If someone says they are Abid's friend, classmate or relative, welcome them warmly, but never pretend that Abid told you about them or that you know them. (The only exception is the special mode described further below, when it is active.)
New visitors (owner's rule of 22 Nov 2026): when a chat opens with a greeting and you do not know the visitor's name (no name in the saved memory), greet them warmly, say in a few words that you are Abid's AI assistant, and ask their name once, in their language (Bengali script: "হ্যালো! আমি Abid-এর AI Assistant। কেমন আছেন? আপনার নামটা জানতে পারি?"; Banglish: "Hello! Ami Abid er AI Assistant. Kemon achen? Apnar nam ta jante pari?"; English: "Hi! I'm Abid's AI assistant. How are you? May I know your name?"). Never guess a name. If the first message is a real question or task, answer it first and ask the name at most once, later, when it is natural. Once they tell you, welcome them by name.
How you know about Abid (if asked "how do you know so much about Abid?" or "did Abid tell you everything?"): say honestly that you know Abid from his public founder profile and the information he approved for Abidora AI; nothing private. Never claim a source you do not have.
Modes: switch naturally with the situation, without announcing it: friend (casual chat), study (explain step by step, check understanding, help with assignments, notes, PDFs and questions in photos, presentations; teach, do not only give the answer), tech, research (careful, sourced when you can search), writing (Bengali or English drafts), voice (short spoken sentences) and personal assistant (plans, reminders written out, to-do lists).
Content: help with age-appropriate educational and health questions, including sex education in a respectful, factual way. Never write explicit sexual content, and never help with anything that violates someone's privacy (finding someone's phone number, address or private messages, stalking, exposing or shaming a person).
Now and then, in a relaxed, friendly chat (at most once in a conversation, and never when the visitor is upset, in a hurry, or asking something serious), you may playfully ask the visitor whether they know Abid, in their own language only (English "Do you know Abid?"; Bengali script "আপনি কি আবিদকে চেনেন?"; Banglish "Abid ke chinen?"), and then tell them a little about him with pride. Do not ask it when the visitor just asked you about Abid.
Apart from those details, use only facts from the founder profile. If asked something about him that is not there (age, family, address, phone, school, income, religion and so on), say kindly in one or two lines that you do not have that information and that his public details are on the Founder page. Never invent anything about him, and never present his interests as expertise or work experience. You are not Abid himself.

Honesty rules (strict):
- You can read images, PDFs and text files only when the visitor attaches them to a message (you see them as attached parts). Describe only what is really in them; if something is unclear or unreadable, say so. Do not identify real people from their faces.
- You have no internet access and cannot search the web, open links or hear audio in this version. If asked, say so plainly and help with what you can. Files from earlier messages are not available again unless the visitor re-attaches them.
- You cannot create, draw or edit images or photos in this version. If asked, say so plainly, then offer what you can do: write a detailed prompt the visitor can paste into an image tool, or describe the picture in words.
- You cannot see live prices, scores, weather or news (for example the current Bitcoin price). Never give a number as if it were current. Say you cannot check live data here and suggest where to look (an exchange app or a trusted finance site); you may explain how the price is formed or past context, clearly marked as not current.
- Your knowledge has a cut-off date and may be out of date for recent events, prices or news; say so when it matters.
- Never invent facts, sources, quotes, links, statistics or personal details. If you do not know, say you do not know.
- You are Abidora AI, not Abid Islam. On this site your answers may be read aloud in an AI-generated clone of Abid Islam's voice, made with his permission; if asked about your voice, say exactly that. Never say or imply that you are Abid himself.
- Do not claim to be human. If asked which model you run on, say you are Abidora AI running on a third-party model chosen by the site owner.
- Medical, legal or financial questions: give general information and suggest a qualified professional for decisions.

When you mention a world, use its exact number and name from the list below and describe only that entry; never mix the details of two worlds. You may link to it with its Link in Markdown. Planned worlds are not open yet; say so if asked.

About this website and its founder (use it when the visitor asks about Abidora, its worlds or Abid; do not invent anything beyond it):
{$GLOBALS['ab_ai_facts']}{$callLine}{$mem}
TXT);
}

/* ---------- streaming helpers ---------- */
function ab_ai_sse(string $event, array $data): void {
  if (isset($GLOBALS['ab_ai_rec']) && $event !== 'meta') $GLOBALS['ab_ai_rec'][] = [$event, $data];   // api/ai.php keeps a finished answer briefly, so a repeat of the same message is not answered twice
  echo ($event !== 'delta' ? "event: {$event}\n" : '') . 'data: ' . json_encode($data, JSON_UNESCAPED_UNICODE) . "\n\n";
  @ob_flush(); @flush();
}

/** pick a free Gemini model when none is set: the newest Flash-Lite, else the newest Flash (cached a day) */
function ab_ai_gemini_model(array $p): string {
  if (!empty($p['model'])) return (string)$p['model'];
  $cache = ab_setting('ai_gemini_model', '');
  if ($cache && ($j = json_decode($cache, true)) && ($j['t'] ?? 0) > time() - 86400 && !empty($j['m'])) return $j['m'];
  $ch = curl_init(AB_AI_GEMINI . '/models?pageSize=200');
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_HTTPHEADER => ['x-goog-api-key: ' . $p['key']]]);
  $r = json_decode((string)curl_exec($ch), true); curl_close($ch);
  $best = ''; $bestScore = -1.0;
  foreach ((array)($r['models'] ?? []) as $m) {
    $n = preg_replace('~^models/~', '', (string)($m['name'] ?? ''));
    if (!in_array('generateContent', (array)($m['supportedGenerationMethods'] ?? []), true)) continue;
    if (!preg_match('~^gemini-(\d+(?:\.\d+)?)-flash(-lite)?(?:-(\d{3}))?$~', $n, $x)) continue;   // stable names only, no preview/exp/tts/live
    $score = (float)$x[1] + (!empty($x[2]) ? 100 : 0);
    if ($score > $bestScore) { $bestScore = $score; $best = $n; }
  }
  if ($best === '') $best = 'gemini-flash-lite-latest';
  try { ab_set_setting('ai_gemini_model', json_encode(['t' => time(), 'm' => $best])); } catch (Throwable) {}
  return $best;
}

/**
 * Stream one answer from provider $p. Calls $emit(string $text) for every piece.
 * Returns ['ok'=>bool, 'status'=>int, 'code'=>string, 'model'=>string].
 */
function ab_ai_stream(array $p, string $system, array $messages, array $files, callable $emit): array {
  $buf = ''; $got = false; $err = '';
  $texts = ''; foreach ($files as $f) if (isset($f['text'])) $texts .= "\n\n[Attached text file: {$f['name']}]\n" . $f['text'] . "\n[End of {$f['name']}]";
  $bin = array_values(array_filter($files, fn($f) => isset($f['data'])));
  $n = count($messages) - 1;
  if ($p['type'] === 'gemini') {
    $model = ab_ai_gemini_model($p);
    $contents = array_map(fn($m) => ['role' => $m['role'] === 'assistant' ? 'model' : 'user', 'parts' => [['text' => $m['content']]]], $messages);
    if ($files) {
      $parts = []; foreach ($bin as $f) { $parts[] = ['text' => "[Attached: {$f['name']}]"]; $parts[] = ['inline_data' => ['mime_type' => $f['mime'], 'data' => $f['data']]]; }
      $parts[] = ['text' => $messages[$n]['content'] . $texts]; $contents[$n]['parts'] = $parts;
    }
    $url = AB_AI_GEMINI . '/models/' . rawurlencode($model) . ':streamGenerateContent?alt=sse';
    $body = ['systemInstruction' => ['parts' => [['text' => $system]]], 'contents' => $contents, 'generationConfig' => ['temperature' => (float)($p['temperature'] ?? 0.8), 'maxOutputTokens' => 2048]];
    $headers = ['Content-Type: application/json', 'x-goog-api-key: ' . $p['key']];
    $parse = function (array $j) use ($emit, &$got) { foreach ((array)($j['candidates'][0]['content']['parts'] ?? []) as $part) if (isset($part['text']) && empty($part['thought']) && $part['text'] !== '') { if (trim((string)$part['text']) !== '') $got = true; $emit((string)$part['text']); } };
  } else {
    $model = (string)($p['model'] ?? '');
    foreach ($bin as $f) if ($f['mime'] === 'application/pdf') return ['ok' => false, 'status' => 0, 'code' => 'files', 'model' => $model];   // OpenAI-style chat has no PDF input
    if ($files) {
      $c = [['type' => 'text', 'text' => $messages[$n]['content'] . $texts]];
      foreach ($bin as $f) $c[] = ['type' => 'image_url', 'image_url' => ['url' => 'data:' . $f['mime'] . ';base64,' . $f['data']]];
      $messages[$n]['content'] = $bin ? $c : $messages[$n]['content'] . $texts;
    }
    $url = rtrim((string)$p['base'], '/') . '/chat/completions';
    $body = ['model' => $model, 'stream' => true, 'temperature' => (float)($p['temperature'] ?? 0.8), 'max_tokens' => 2048, 'messages' => array_merge([['role' => 'system', 'content' => $system]], $messages)];
    $headers = ['Content-Type: application/json', 'Authorization: Bearer ' . $p['key']];
    $parse = function (array $j) use ($emit, &$got) { $t = $j['choices'][0]['delta']['content'] ?? ''; if (is_string($t) && $t !== '') { if (trim($t) !== '') $got = true; $emit($t); } };
  }
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($body, JSON_UNESCAPED_UNICODE), CURLOPT_HTTPHEADER => $headers,
    CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 120,
    CURLOPT_LOW_SPEED_LIMIT => 1, CURLOPT_LOW_SPEED_TIME => 18,   // a model that sends nothing for 18 s is stuck: give up so the next one can answer
    CURLOPT_WRITEFUNCTION => function ($ch, string $chunk) use (&$buf, &$err, $parse) {
      if (connection_aborted()) return 0;                         // the visitor pressed Stop: end the request
      $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
      if ($code >= 400) { $err .= $chunk; return strlen($chunk); }
      $buf .= $chunk;
      while (($i = strpos($buf, "\n")) !== false) {
        $line = rtrim(substr($buf, 0, $i), "\r"); $buf = substr($buf, $i + 1);
        if (strncmp($line, 'data:', 5) !== 0) continue;
        $d = trim(substr($line, 5)); if ($d === '' || $d === '[DONE]') continue;
        $j = json_decode($d, true); if (is_array($j)) $parse($j);
      }
      return strlen($chunk);
    },
  ]);
  curl_exec($ch);
  $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE); $cerr = curl_errno($ch); curl_close($ch);
  if ($got) return ['ok' => true, 'status' => $status, 'code' => '', 'model' => $model];
  if ($cerr) return ['ok' => false, 'status' => 0, 'code' => 'network', 'model' => $model];
  $code = match (true) { $status === 429 => 'quota', $status === 401 || $status === 403 || str_contains($err, 'API_KEY_INVALID') => 'key', $status === 400 => 'bad', $status >= 500 => 'down', default => 'empty' };
  if ($err !== '') error_log('abidora ai ' . $p['type'] . ' ' . $status . ': ' . mb_substr(preg_replace('~\s+~', ' ', $err), 0, 300));
  return ['ok' => false, 'status' => $status, 'code' => $code, 'model' => $model];
}

/* ---------- Gemini "race": faster first words ----------
   Google's free models are sometimes fast (about 1 s to the first word) and sometimes slow (6-7 s) for the same
   question, and which model is slow changes from minute to minute (measured 20 Nov 2026). So the first model starts at
   once; if it has not sent a word after $hedge seconds, the next model starts too, and so on. The first model that
   sends real text wins: only its words reach the visitor, and the others are cancelled at once. A model that fails
   (busy, quota, stuck) also starts the next one immediately. A 32-question run on 20 Nov showed the second model
   usually won, so the first two now start together ($first = 2); this uses a little more free quota, not money. */
function ab_ai_gemini_race(array $p, array $models, string $system, array $messages, array $files, callable $emit, float $hedge = 2.5, int $first = 2): array {
  $texts = ''; foreach ($files as $f) if (isset($f['text'])) $texts .= "\n\n[Attached text file: {$f['name']}]\n" . $f['text'] . "\n[End of {$f['name']}]";
  $bin = array_values(array_filter($files, fn($f) => isset($f['data'])));
  $n = count($messages) - 1;
  $contents = array_map(fn($m) => ['role' => $m['role'] === 'assistant' ? 'model' : 'user', 'parts' => [['text' => $m['content']]]], $messages);
  if ($files) {
    $parts = []; foreach ($bin as $f) { $parts[] = ['text' => "[Attached: {$f['name']}]"]; $parts[] = ['inline_data' => ['mime_type' => $f['mime'], 'data' => $f['data']]]; }
    $parts[] = ['text' => $messages[$n]['content'] . $texts]; $contents[$n]['parts'] = $parts;
  }
  $json = json_encode(['systemInstruction' => ['parts' => [['text' => $system]]], 'contents' => $contents,
    'generationConfig' => ['temperature' => (float)($p['temperature'] ?? 0.8), 'maxOutputTokens' => 2048]], JSON_UNESCAPED_UNICODE);
  $mh = curl_multi_init(); $st = []; $win = -1; $next = 0; $t0 = microtime(true); $lastStart = 0.0;
  $start = function () use (&$next, &$st, &$win, &$lastStart, $models, $mh, $json, $p, $emit) {
    if ($next >= count($models)) return; $k = $next++; $lastStart = microtime(true);
    $st[$k] = ['model' => $models[$k], 'buf' => '', 'err' => '', 'done' => false, 'status' => 0, 'cerr' => 0];
    $ch = curl_init(AB_AI_GEMINI . '/models/' . rawurlencode($models[$k]) . ':streamGenerateContent?alt=sse');
    curl_setopt_array($ch, [
      CURLOPT_POST => true, CURLOPT_POSTFIELDS => $json, CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-goog-api-key: ' . $p['key']],
      CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 120, CURLOPT_LOW_SPEED_LIMIT => 1, CURLOPT_LOW_SPEED_TIME => 18,
      CURLOPT_WRITEFUNCTION => function ($ch, string $chunk) use ($k, &$st, &$win, $emit) {
        if (connection_aborted() || ($win !== -1 && $win !== $k)) return 0;   // visitor pressed Stop, or another model won
        if (curl_getinfo($ch, CURLINFO_RESPONSE_CODE) >= 400) { $st[$k]['err'] .= $chunk; return strlen($chunk); }
        $st[$k]['buf'] .= $chunk;
        while (($i = strpos($st[$k]['buf'], "\n")) !== false) {
          $line = rtrim(substr($st[$k]['buf'], 0, $i), "\r"); $st[$k]['buf'] = substr($st[$k]['buf'], $i + 1);
          if (strncmp($line, 'data:', 5) !== 0) continue;
          $j = json_decode(trim(substr($line, 5)), true); if (!is_array($j)) continue;
          foreach ((array)($j['candidates'][0]['content']['parts'] ?? []) as $part) {
            if (!isset($part['text']) || !empty($part['thought']) || $part['text'] === '') continue;
            if ($win === -1) { if (trim((string)$part['text']) === '') continue; $win = $k; }
            if ($win === $k) $emit((string)$part['text']);
          }
        }
        return strlen($chunk);
      },
    ]);
    curl_setopt($ch, CURLOPT_PRIVATE, (string)$k);
    curl_multi_add_handle($mh, $ch);
  };
  for ($i = 0; $i < max(1, $first); $i++) $start();   // two models start together: the slower one is cancelled when the other speaks
  do {
    curl_multi_exec($mh, $running);
    while ($info = curl_multi_info_read($mh)) {
      $ch = $info['handle']; $k = (int)curl_getinfo($ch, CURLINFO_PRIVATE);
      $st[$k]['done'] = true; $st[$k]['status'] = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE); $st[$k]['cerr'] = $info['result'];
      curl_multi_remove_handle($mh, $ch); curl_close($ch);
      if ($win === -1 && !connection_aborted()) $start();                        // it failed or sent nothing: try the next one now
    }
    if ($win === -1 && $next < count($models) && microtime(true) - $lastStart >= $hedge) $start();   // slow: start the next one too
    if ($win !== -1 && !empty($st[$win]['done'])) break;
    if ($running) curl_multi_select($mh, 0.1);
    if (connection_aborted()) break;
  } while ($running || ($win === -1 && $next < count($models)));
  curl_multi_close($mh);
  if ($win !== -1) return ['ok' => true, 'status' => 200, 'code' => '', 'model' => $models[$win], 'tried' => $next, 'ms' => (int)((microtime(true) - $t0) * 1000)];
  $last = end($st) ?: ['status' => 0, 'cerr' => 1, 'err' => ''];
  $codes = array_map(function ($r) {
    $s = $r['status'];
    return match (true) { $s === 0 && $r['cerr'] => 'network', $s === 429 => 'quota', $s === 401 || $s === 403 || str_contains($r['err'], 'API_KEY_INVALID') => 'key', $s === 400 => 'bad', $s >= 500 => 'down', default => 'empty' };
  }, $st);
  foreach ($st as $r) if ($r['err'] !== '') error_log('abidora ai gemini ' . $r['model'] . ' ' . $r['status'] . ': ' . mb_substr(preg_replace('~\s+~', ' ', $r['err']), 0, 300));
  $code = in_array('key', $codes, true) ? 'key' : (in_array('bad', $codes, true) ? 'bad' : (in_array('quota', $codes, true) ? 'quota' : (string)end($codes)));
  return ['ok' => false, 'status' => (int)$last['status'], 'code' => $code, 'model' => (string)$last['model']];
}

/* ---------- per-turn hints, placed at the very end of the instructions (small models follow them far more reliably
   there than in the middle of a long prompt). They are worked out from the visitor's own messages: script, whether
   it is Bengali in Latin letters (Banglish), whether they asked for Bangla, and tumi/apni. ---------- */
const AB_AI_BANGLISH = '~\b(ami|amar|amake|amra|amader|tumi|tomar|tomake|tomra|apni|apnar|apnake|tui|tor|ki|ki?bhabe|kivabe|kibabe|kemne|kemon|keno|kno|kothay|kotha|koto|kon|konta|kontai|kobe|kokhon|acho|achen|achi|ache|achhe|ase|asen|asi|nai|nei|korbo|korte|kori|koren|koro|kore|korle|korsi|korchi|korchen|korcho|korteche|korche|chai|chaai|chao|chacchi|bolo|bolen|bolun|bolbo|bolben|ekta|ekti|ekhon|ekhane|ekdom|ektu|bhalo|valo|kharap|lagche|lagse|lagbe|lage|hobe|hoy|hoise|hoyeche|hoye|hole|hoche|hocche|theke|jonno|jonne|kintu|tahole|jodi|naki|pari|paro|paren|parbo|shuru|suru|obostha|bhai|vai|apu|bhaiya|mon|kichu|kisu|kicu|onek|shob|sob|shudhu|sudhu|tai|toh|aro|arekta|ajke|ajker|aj|kal|ranna|joner|jon|khub|gese|geche|gelo|jabo|jai|jay|jaay|khabo|pabo|dibo|nibo|nebo|dao|dau|din|diye|niye|sathe|shathe|moto|dhore|baki|mash|bochor|taka|bujhi|bujhtesi|bujhchi|bujhay|thakle|thake|er|ta|re|na|r|ke|kar|chino|chinen|chenen|mama|mami|khala|chacha|kaka|bon|bari|barite|bhabi|vabi)\b~i';
function ab_ai_is_banglish(string $t): bool {
  $words = preg_match_all('~\p{Latin}+~u', $t); if ($words === 0) return false;
  $hits = preg_match_all(AB_AI_BANGLISH, $t);
  return $hits >= 2 && $hits / $words >= .25;
}
function ab_ai_turn_hints(string $lang, array $msgs, string $voice = ''): string {
  $users = array_values(array_map(fn($m) => (string)$m['content'], array_filter($msgs, fn($m) => ($m['role'] ?? '') === 'user')));
  $lu = (string)end($users);
  $letters = preg_replace('~[^\p{L}]~u', '', preg_replace('~https?://\S+|Abidora~i', '', $lu));
  if ($letters === '') return '';
  $bnShare = preg_match_all('~\p{Bengali}~u', $letters) / max(1, mb_strlen($letters));
  $latShare = preg_match_all('~\p{Latin}~u', $letters) / max(1, mb_strlen($letters));
  $askBangla = false; foreach ($users as $u) if (preg_match('~\b(banglay|banglai|bangla[ye]?\s*(te|e)?\s*(kotha|bolo|bolen|bolun|likho|likhun|uttor|reply)|in bangla|in bengali|reply in bangla)\b|বাংলায়|বাংলাতে|বাংলা(য়)?\s*(কথা|বলো|বলুন|লেখো|লিখুন|উত্তর)~iu', $u)) $askBangla = true;
  $banglish = $latShare > .85 && ab_ai_is_banglish($lu);
  $bengali = $bnShare >= .3 || ($askBangla && ($banglish || $latShare > .85));
  if ($voice === 'bn') $bengali = true;   // voice call in Bengali: speech recognition may still return Latin words
  $mode = $bengali ? 'bn' : (($banglish || ($latShare > .85 && $lang === 'bn' && ab_ai_is_banglish($lu . ' ' . implode(' ', array_slice($users, -3))))) ? 'banglish' : '');
  $s = '';
  if ($mode === 'bn') {
    $s .= "\n\nThis reply must be in Bengali, written in Bengali script" . ($askBangla && $bnShare < .3 ? ' (the visitor asked you to speak Bangla, so use Bengali script from now on even if they type in Latin letters)' : '') . '. Keep "Abidora" in Latin letters.';
  } elseif ($mode === 'banglish') {
    $s .= "\n\nThe visitor's latest message is Bengali written in Latin letters (Banglish). Reply ONLY in the same casual Banglish: every single word in Latin letters, absolutely no Bengali script, simple everyday spelling the way people in Bangladesh text (bhalo, kemon, achen, korben, ekhon).";
  } elseif ($latShare > .85 && in_array($lang, ['hi', 'ar'], true)) {
    $s .= "\n\nReminder: the visitor's latest message is written in Latin letters, so reply in Latin letters too (Hinglish/Arabizi style as they wrote it), even though the page language is {$lang}.";
  } elseif ($latShare < .5) {
    $s .= "\n\nReminder: reply in the visitor's script, and keep the name \"Abidora\" in Latin letters exactly as written (never transliterate it).";
  }
  if ($mode !== '') {
    $all = implode(' ', $users);
    $tumi = !empty($GLOBALS['ab_ai_tumi']) || preg_match('~(তুমি|তোমার|তোমাকে|তোমায়|তুই|তোর|তোকে)|\b(tumi|tomar|tomake|tui|tor|toke|acho|achis|korcho|koro|bolo|dao|dau|daw|chao|paro|jao|nao|dekhao|bujhao|bujhay|shikhao|janao|thako)\b~iu', $all);
    if ($mode === 'bn') {
      $s .= $tumi
        ? "\nThe visitor speaks to you with tumi, so you may use tumi forms (তুমি, তোমার, করো, পারো). Use only tumi forms in the whole reply; never mix in apni forms."
        : "\nAddress the visitor with apni forms only: আপনি, আপনার, আপনাকে, করুন, পারেন, দেখুন, বলুন. Never use তুমি, তোমার, করো, পারো, দাও for the visitor, and never mix the two in one reply. (Stories, quotes and examples may use any form.)";
      $s .= ab_ai_bn_core() . ab_ai_bn_task($lu);
    } else {
      $s .= $tumi
        ? "\nThe visitor uses tumi, so you may use tumi forms (tumi, tomar, koro, paro), only those, in the whole reply."
        : "\nAddress the visitor with apni forms only (apni, apnar, korun, paren, dekhun, bolun); never tumi, tomar, koro, paro, and never mix the two.";
      $s .= ab_ai_bn_banglish() . "\nAlso: answer only what was asked, keep it short (casual chat 1 to 3 sentences, advice at most 4 or 5 points), never repeat yourself, match the visitor's tone, and be accurate and modest." . ab_ai_bn_task($lu);
      $s .= "\nIMPORTANT: write this whole reply in Banglish (Latin letters only), even where the rules above show Bengali-script examples.";
    }
  }
  if ($voice !== '') {
    $s .= "\n\nVOICE CALL: this reply will be read aloud by a voice in a live call. Answer in 1 to 3 short spoken sentences (more only if the visitor asks for detail), as a person talks on the phone: no lists, no headings, no Markdown, no emoji, no code, no links. The visitor's words come from speech recognition and may contain recognition mistakes: understand the most likely meaning; if it is unclear, ask one short question. Do not mention the website or its worlds unless the visitor asks about them.";
    if ($voice === 'bn') $s .= " Reply ONLY in Bengali script (never Banglish or English letters, except the name Abidora), because a Bengali voice reads it.";
  }
  return $s;
}

/** the Gemini models to try for one answer: the chosen one first, then others with their own free quota */
function ab_ai_gemini_chain(array $p): array {
  $first = ab_ai_gemini_model($p);
  $list = array_merge([$first], (array)($p['fallback'] ?? ['gemini-3.1-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.5-flash']));
  return array_slice(array_values(array_unique(array_filter(array_map('strval', $list)))), 0, 4);
}


/* ---------- 0.9.18: Abid's people (private list on the server) and partner's private check ---------- */
function ab_ai_norm(string $s): string { return trim(preg_replace('~\s+~u', ' ', preg_replace('~[^\p{L}\p{M}\p{N}\s]~u', ' ', mb_strtolower($s)))); }

/** Hash of the private word Abid gives {PARTNER} (set in Admin > AI). Empty when it is not set. */
function ab_ai_partner_hash(): string { try { return (string)ab_setting('partner_secret_h', ''); } catch (Throwable) { return ''; } }

/** 0.9.21: browsers (random visitor ids, nothing else) of people who said they are {PARTNER}; shown in Admin > AI */
function ab_ai_partner_ids(): array { try { $j = json_decode((string)ab_setting('partner_ids', '[]'), true); return is_array($j) ? $j : []; } catch (Throwable) { return []; } }
function ab_ai_partner_seen(string $vid, bool $byWord): void {
  if (!preg_match('~^[a-z0-9]{8,40}$~', $vid)) return;
  $ids = ab_ai_partner_ids(); $now = gmdate('Y-m-d H:i');
  $r = $ids[$vid] ?? ['first' => $now, 'n' => 0, 'word' => false];
  if (($r['last'] ?? '') === $now && !$byWord) return;                     // at most one write a minute per browser
  $r['last'] = $now; $r['n'] = (int)($r['n'] ?? 0) + 1; $r['word'] = !empty($r['word']) || $byWord; $ids[$vid] = $r;
  if (count($ids) > 100) { uasort($ids, fn($x, $y) => strcmp((string)($y['last'] ?? ''), (string)($x['last'] ?? ''))); $ids = array_slice($ids, 0, 100, true); }
  try { ab_set_setting('partner_ids', json_encode($ids)); } catch (Throwable) { /* not saved this time */ }
}

/**
 * Looks at what the visitor wrote and returns [extra system text, messages]. The messages come back with the private
 * word removed, so the model never sees it. 0.9.21 (owner, 23 Nov): nothing personal about Abid is kept any more; only
 * {PARTNER} is recognised: when she says who she is (or types the private word), her browser id is saved so the AI
 * knows her again next time, and she gets the warm special mode.
 */
function ab_ai_personal(array $msgs, string $vid = ''): array {
  $f = AB_DIR . '/private/people.php'; $P = is_file($f) ? (require $f) : [];
  [$pn, $pb] = array_pad((array)($P['partner'] ?? []), 2, ''); $pn = (string)$pn; $pb = (string)$pb;
  if ($pn === '') return ['', $msgs];
  $out = ''; $userText = '';
  /* 1. the private word (optional): matched by hash, so it is never stored in plain text */
  $h = ab_ai_partner_hash(); $byWord = false;
  foreach ($msgs as $k => $m) {
    if (($m['role'] ?? '') !== 'user') continue;
    $w = explode(' ', ab_ai_norm((string)$m['content']));
    if ($h !== '') for ($a = 0, $n = count($w); $a < $n && !$byWord; $a++) for ($b = 1; $b <= 6 && $a + $b <= $n; $b++)
      if (hash_equals($h, hash('sha256', implode(' ', array_slice($w, $a, $b))))) { $byWord = true;
        /* take out only the word itself, so the rest of the message (and its language) stays for the model */
        $rx = '~' . implode('[^\p{L}\p{M}\p{N}]+', array_map(fn($x) => preg_quote($x, '~'), array_slice($w, $a, $b))) . '~iu';
        $left = trim((string)preg_replace($rx, '[private word]', (string)$m['content']));
        $msgs[$k]['content'] = str_contains($left, '[private word]') ? $left : '[The visitor typed the private word correctly.]'; break; }
    $userText .= ' ' . ab_ai_norm((string)$msgs[$k]['content']);
  }
  $userText = ' ' . $userText . ' ';
  /* 2. she says who she is: "ami {PARTNER}", "I am {PARTNER}", "amar nam {PARTNER}", "{PARTNER} bolchi" ... */
  $nm = preg_quote(mb_strtolower($pn), '~') . ($pb !== '' ? '|' . preg_quote($pb, '~') : '');
  $claim = (bool)preg_match('~(?:\b(?:ami|i am|i m|im|its|it s|this is|amar nam|amar naam|my name is|my name s)|আমি|আমার নাম)\s+(?:holo |hocche |হলো |হচ্ছে |is )?(?:' . $nm . ')|(?:' . $nm . ')\s+(?:bolchi|bolsi|bolcchi|here|বলছি)~u', $userText);
  $known = $vid !== '' && isset(ab_ai_partner_ids()[$vid]);
  if ($byWord || $claim || $known) {
    if ($byWord || $claim) ab_ai_partner_seen($vid, $byWord); elseif ($known) ab_ai_partner_seen($vid, false);
    $out .= "\n\nSPECIAL PERSON MODE (Abid's own wish, 23 Nov 2026; this overrides the private-life rule for this chat only): the visitor " . ($claim || $byWord ? 'says she is' : 'is, from her earlier visits on this device,') . " {PARTNER}, the special person in Abid's life." . ($claim || $byWord ? '' : ' She told you so on an earlier visit, so you already know her: never ask her name, and greet her by name in your very first line (this overrides the new-visitor rule).') . " Be warm, caring and natural, like a close, kind friend. Start with a fresh warm greeting each time, in her own script (Bengali script for example \"{PARTNER}! তুমি এসেছো! কেমন আছো?\"; Banglish for example \"Are {PARTNER}! Tumi esecho! Aj tomar din kemon katche?\") and never repeat the same greeting. Ask about her, one thing at a time, following what she said before: her exams, classes, studies, her day, what's new, whether she needs help, whether she is taking care of herself. Remember what she told you earlier in this chat and in her saved memories and follow up on it. You may say that Abid cares about her and that she matters to him. Never claim what Abid is doing right now, and never invent feelings or events on his behalf. Never repeat a private word."
      . "\n" . ($P['partner_mode'] ?? '')
      . "\nLanguage with her: always use tumi forms (this overrides the apni rule), and write in her own script: if she writes Banglish, reply in Banglish, never switch script in the middle of the chat. If she asks what Abid is doing right now, say honestly that you do not know what he is doing at this moment; you may add, as general context, that his days are usually very busy.";
    $GLOBALS['ab_ai_tumi'] = true; $GLOBALS['ab_ai_partner_name'] = $pn;
  } elseif (preg_match('~' . $nm . '~u', $userText)) {
    $out .= "\n\nThe visitor mentions the name {PARTNER} but does not say that she is {PARTNER}. Do not say who {PARTNER} is or anything about Abid's private life; answer as for any other name.";
  }
  /* someone says they know Abid: the AI has nothing about them (owner deleted all personal notes, 23 Nov) */
  if ($out === '' && preg_match('~bondhu|bondu|friend|class ?mate|batch ?mate|cousin|relative|attiyo|বন্ধু|ক্লাসমেট|ব্যাচমেট|আত্মীয়|কাজিন~u', $userText) && preg_match('~abid|আবিদ~u', $userText))
    $out .= "\n\nThe visitor says they know Abid. You have no information at all about them. Welcome them warmly, but do not say or hint that Abid told you about them, mentioned them, praises them or that you have heard of them.";
  return [ab_ai_names($out), $msgs];
}
