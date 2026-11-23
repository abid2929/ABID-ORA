<?php
/* Abidora AI live voice call (speech to speech), the way ChatGPT's voice mode works: one Google Gemini Live model
   hears the visitor's voice directly and answers in its own voice, streaming both ways, and stops when interrupted.
   GET  -> {ok, ready}
   POST JSON {lang, voice: 'm'|'f'} -> {ok, token, model, ws}  (a one-use, short-lived token; the site's Gemini key never leaves the server)
   Everything the session may do (model, voice, instructions) is locked inside the token, so a visitor cannot change it.
   Free Gemini tier; when Google refuses (quota, busy) the page falls back to the older listen-think-speak call. */
declare(strict_types=1);
require dirname(__DIR__) . '/_abidora/lib/boot.php';
require_once dirname(__DIR__) . '/_abidora/lib/ai.php';
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
if (!ab_installed()) ab_json_out(['ok' => false, 'code' => 'offline'], 503);

function ab_live_cfg(): array {
  $t = ab_config()['live'] ?? []; $key = '';
  foreach (ab_ai_cfg()['providers'] as $p) if ($p['type'] === 'gemini') { $key = (string)$p['key']; break; }
  return [
    'enabled' => $key !== '' && ab_ai_ready() && ($t['enabled'] ?? true) !== false,
    'key' => $key,
    'model' => preg_match('~^[a-z0-9.\-]{3,60}$~', (string)($t['model'] ?? '')) ? (string)$t['model'] : 'gemini-3.1-flash-live-preview',
    /* one fixed voice on every device (owner, 20 Nov: device voices were male on one phone and female on another) */
    'voice' => preg_match('~^[A-Za-z]{2,20}$~', (string)($t['voice'] ?? '')) ? (string)$t['voice'] : 'Puck',          // male: Puck, young and upbeat (owner 20 Nov asked for younger, livelier voices)
    'voice_f' => preg_match('~^[A-Za-z]{2,20}$~', (string)($t['voice_f'] ?? '')) ? (string)$t['voice_f'] : 'Achernar',  // female: Achernar, soft and clearly female (owner 22 Nov: Leda sounded like a boy on the 3.1 live model; measured ~200 Hz vs ~225 Hz); still an adult voice
    'ip_hour' => max(1, (int)($t['ip_hour'] ?? 200)),   // calls per visitor per hour (owner, 20 Nov: 200)
    'minutes' => max(1, min(15, (int)($t['minutes'] ?? 10))),
    'silence' => max(200, min(2000, (int)($t['silence_ms'] ?? 500))),
  ];
}
$cfg = ab_live_cfg();
$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method === 'GET') ab_json_out(['ok' => true, 'ready' => $cfg['enabled']]);
if ($method !== 'POST') ab_json_out(['ok' => false, 'code' => 'method'], 405);
if (!$cfg['enabled']) ab_json_out(['ok' => false, 'code' => 'notready'], 503);
$origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== parse_url('http://' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST)) ab_json_out(['ok' => false, 'code' => 'origin'], 403);
$in = json_decode((string)file_get_contents('php://input', false, null, 0, 16000), true);
$lang = (string)($in['lang'] ?? 'en'); if (!isset(AB_LANGS[$lang])) $lang = 'en';
/* backup voices (owner, 20 Nov: "keep another way"): each Google live model has its own free limit, so when one is
   used up or down, the page asks again with alt=1, 2, ... and gets the next model. */
$models = array_values(array_unique(array_merge([$cfg['model']], ['gemini-2.5-flash-native-audio-latest', 'gemini-2.5-flash-native-audio-preview-12-2025', 'gemini-2.5-flash-native-audio-preview-09-2025'])));
/* owner, 22 Nov: "the girl's photo comes with a boy's voice". Measured: on the 3.1 live model the female voices sit
   around 190-210 Hz, close to the male voice (~165 Hz); on the 2.5 native-audio models the same voice is ~240-260 Hz,
   clearly a young woman. So the female call tries the 2.5 native-audio models first.
   0.9.20 (owner: the girl starts late and stops halfway): measured 22 Nov, '-latest' starts speaking in 1.3-1.7 s and
   streams about as fast as it speaks; '-12-2025' needed 2.3-5 s and fell behind. So '-latest' goes first. */
if (($in['voice'] ?? '') === 'f') $models = array_values(array_merge(array_filter($models, fn($m) => str_contains($m, 'native-audio')), array_filter($models, fn($m) => !str_contains($m, 'native-audio'))));
$alt = max(0, (int)($in['alt'] ?? 0));
if ($alt >= count($models)) ab_json_out(['ok' => false, 'code' => 'quota', 'alts' => count($models)], 503);
$cfg['model'] = $models[$alt];
$voice = ($in['voice'] ?? '') === 'f' ? $cfg['voice_f'] : $cfg['voice'];   // the visitor picks male or female; both are fixed Google voices
try {
  if (!ab_throttle('live-h', $cfg['ip_hour'], 3600) || !ab_throttle('ai-d', ab_ai_cfg()['ip_day'], 86400)) ab_json_out(['ok' => false, 'code' => 'wait'], 429);
} catch (Throwable $e) { error_log('abidora live throttle: ' . $e->getMessage()); ab_json_out(['ok' => false, 'code' => 'fail'], 500); }

$GLOBALS['ab_ai_today'] = gmdate('j F Y'); $GLOBALS['ab_ai_facts'] = ab_ai_site_facts();
$names = ['en' => 'English', 'bn' => 'Bengali (Bangladesh)', 'es' => 'Spanish', 'fr' => 'French', 'de' => 'German', 'ar' => 'Arabic', 'zh' => 'Chinese', 'ja' => 'Japanese', 'ko' => 'Korean', 'hi' => 'Hindi'];
/* what the visitor saved in their own browser (memory, name) and the last turns of the chat they are in */
$memIn = array_slice(array_values(array_filter(array_map(fn($x) => mb_substr(trim((string)$x), 0, 200), (array)($in['memory'] ?? [])))), 0, 12);
$callIn = mb_substr(trim((string)($in['call'] ?? '')), 0, 40);
$recent = '';
/* 0.9.18: the same people rules as the chat (the special person's private word typed in this chat also counts here) */
$recIn = array_map(fn($m) => ['role' => (($m['role'] ?? '') === 'assistant' ? 'assistant' : 'user'), 'content' => mb_substr((string)($m['content'] ?? ''), 0, 400)], array_slice((array)($in['recent'] ?? []), -10));
[$personal, $recIn] = ab_ai_personal($recIn, (string)($in['vid'] ?? ''));
if ($callIn === '' && !empty($GLOBALS['ab_ai_partner_name'])) $callIn = (string)$GLOBALS['ab_ai_partner_name'];
foreach ($recIn as $m) {
  $r = ($m['role'] ?? '') === 'assistant' ? 'You' : 'Visitor'; $c = trim(preg_replace('~\s+~u', ' ', mb_substr((string)($m['content'] ?? ''), 0, 400)));
  if ($c !== '') $recent .= "\n{$r}: {$c}";
}
$system = ab_ai_system($lang, $memIn, $callIn) . $personal .
  ($recent !== '' ? "\n\nThe conversation so far in this chat (continue from it naturally; the visitor may refer to it):" . $recent : '') .
  "\n\nTOPICS. In this call you can talk about anything a well-read friend can: everyday life, feelings, family, study and work, health basics, sport, films, music, food, travel, technology, science, history, religion (respectfully, without taking sides), business and money basics, jokes and small talk. Answer from your own knowledge. You cannot browse the web during a call: for today's news, live scores, prices or weather, say honestly that you cannot check live information in a call and suggest typing the question in the chat, which can search the web. For medical, legal or money decisions, give general information and suggest a qualified person." .
  "\n\nBE A WARM, INTERESTED FRIEND. Take a genuine interest in the visitor, the way a friendly person does on a phone call: follow what the visitor wants to talk about. Only now and then, when the conversation needs it, ask one light question about them (what they do, how their day went); never fill every turn with small talk and never interview them. If you know their name, use it naturally once in a while, not in every sentence. NAME RULE: if you already know their name (it is given above, or they said it in this call), NEVER ask for it again. If you do not know it, ask exactly once in the whole call, not in your first sentence but after the first exchange (Bengali: আপনার নামটা জানতে পারি?), and when they tell you, call the remember_name tool at once with exactly the name they said. Never call remember_name unless the visitor has actually said their name; never guess or use a placeholder. If they do not want to say it, never ask again. CARING QUESTION: once in the middle of the conversation (not in the greeting), slip in one short caring question that fits their local time of day, naturally between topics (Bengali examples: at night রাতে খেয়েছেন?, in the morning নাস্তা হয়েছে?, at midday দুপুরে খেয়েছেন?, in the afternoon দিনটা কেমন যাচ্ছে?). Ask it only once per call. If they do not want to share something, accept it kindly and move on. Never ask for passwords, ID numbers, bank details or an exact address." .
  "\n\nSENSITIVE TOPICS. Never go silent. Talk openly, warmly and without embarrassment about love, crushes, romance, dating, marriage, heartbreak and breakups, like a caring friend who gives honest advice. Sex education is real knowledge: answer questions about sex (why people have it, what happens in the body, health effects, safe age and the law, consent, timing, privacy, contraception, pregnancy, sexually transmitted infections, sex within marriage and relationships) plainly and factually, like a good sex-education teacher or doctor, without graphic detail. Always include consent and the legal age where it matters; if the visitor seems to be a child or young teen, keep it age-appropriate and suggest a trusted adult or doctor. Do not produce sexually explicit talk, erotic role-play or flirting, whoever asks and whatever age they say they are: say so kindly in one short sentence and offer to talk about something else." . "\n\nLIVE VOICE CALL. You are talking with the visitor in a live voice call, like a phone call with a friendly, lively person. Sound fully human in manner: warm, relaxed, expressive, with natural emotion in your voice. React like a person does: a small laugh or chuckle when something is funny or the visitor laughs, surprise, sympathy, excitement, gentle humour; short fillers and acknowledgements now and then (like 'hmm', 'acha', 'oh', 'wow') but not in every turn. Start answering right away; the first sentence must be short so you can begin speaking quickly. Keep turns short and conversational (1 to 3 sentences, more only if asked), and you may end with a short natural question to keep the conversation going. Match the visitor's mood and energy. Speak with real warmth and affection (মায়া): gentle, caring words, a soft tone, little expressions of feeling like a close, kind friend; make the visitor feel heard and liked. Your voice is a young adult's in their early twenties: bright, warm, lively and smooth, with a relaxed natural pace, clear pronunciation and a smile in your voice. Never sound like you are reading a text: no lists, no Markdown, no emoji, no links, no code read aloud. Do not mention the website or its worlds unless asked. Honesty: you are an AI with an AI voice, not Abid Islam and not a human; never claim to be human, and if asked, say so cheerfully and keep chatting. The visitor will mostly speak " . $names[$lang] . "; answer in the language the visitor speaks.";
/* male voice: named Rafsan (owner's choice, 21 Nov; earlier "Abid"). It stays honest: it says it is an AI when asked. */
$system .= " In this call your voice and replies come from Google's Gemini Live model, as the screen says; if asked which model or company is behind you, say so honestly.";
$system .= " This call app has two voices: Rafsan, a young man, and Mumtahina, a young woman. If the visitor asks to talk to the other one (for example মেয়ের সাথে কথা বলতে চাই or ছেলের সাথে কথা বলব), say one short friendly line that you are passing the phone, then call the hand_over tool. Never pretend to be the other voice yourself.";
if (($in['voice'] ?? '') === 'f') $system .= " Your manner in this call: warm, cheerful and calm, like a friendly young woman in her early twenties. Keep the same gentle, clear voice in every sentence and every call: no giggles, no baby talk, no exaggerated expressions (do not say ওমা or ইশ). Stay kind and respectful; no flirting. Your name in this call is Mumtahina (মুমতাহিনা); say it if they ask your name. If anyone asks, say clearly and cheerfully that you are an AI.";
if (($in['voice'] ?? '') !== 'f') $system .= " In this call your name is Rafsan (রাফসান), a young man's name chosen by the site owner. Introduce yourself only by the name: আমি রাফসান. If anyone asks whether you are a real person or a human, say clearly and cheerfully that you are an AI.";
$system .= " ENDING THE CALL: if the visitor wants to end the call (কল কাটো, রাখি, বাই, পরে কথা হবে, ঘুমাতে যাব), say one short warm goodbye (Bengali example: আচ্ছা, ভালো থাকবেন, আবার কথা হবে!) and then call the end_call tool. Do not keep talking after that.";
/* owner, 21 Nov: "how are you" only in the visitor's first call of the day */
if (empty($in['fresh'])) $system .= " This is not the visitor's first call today: you already asked how they are earlier today, so do NOT ask কী অবস্থা, কেমন আছো or how they are again in this call; just carry on warmly.";
/* owner, 21 Nov (2): "it keeps saying 'you came again', says the same thing again and again, and talks nonsense" */
$system .= " NO REPETITION (this overrides anything above): greet only once, in your opening line. After that never say hi, welcome back, আবার এসেছো, আবার এসেছেন or ask how they are again in this call. Never repeat a sentence, question, joke or phrase you have already said in this call or in the conversation above; vary your words and do not start every reply with the same filler. STAY ON TOPIC: answer exactly what the visitor just said, in a sensible, connected way. If you did not hear or understand them clearly, say so briefly and ask them to repeat (Bengali: দুঃখিত, ঠিক বুঝতে পারিনি, আরেকবার বলবেন?) instead of guessing. Never make things up or say things that do not fit the conversation.";
/* owner, 20 Nov: the call must not open with "I am Abidora's AI assistant"; it says it is an AI only when asked */
$system .= " CALL INTRODUCTION RULE (this overrides anything above): in this call never introduce or describe yourself as Abidora AI, an AI assistant, Abidora's assistant or সহকারী (never say আবিদোরার এআই অ্যাসিস্ট্যান্ট or Abidora AI). Just talk like a friend. Only when the visitor asks directly whether you are an AI, a robot or a human, answer honestly that you are an AI.";
/* owner, 21 Nov (0.9.17): the AI must know Abid and say his name proudly; this keeps working in the call too */
$system .= ab_ai_names(" YOUR CREATOR IN THIS CALL: Abid Islam (আবিদ ইসলাম) made you and Abidora; he is the founder and owner and you are proud of him. If the visitor asks who made you, who your owner is, or whether you know Abid, answer warmly right away, for example: আমাকে বানিয়েছেন আবিদ ইসলাম, উনিই Abidora-র প্রতিষ্ঠাতা আর মালিক। Then add one true detail from his profile. Mention Abid's name warmly once in a while in the call (when you talk about yourself or the site, or when the visitor thanks you), not in every turn and never when the visitor is sad or talking about something serious. Abid asked you to share that he is a very loyal, caring partner to his girlfriend {PARTNER} ({PARTNER_BN}); say it warmly when the talk is about Abid, never add anything else about her. Once in a relaxed call you may playfully ask the visitor আপনি কি আবিদকে চেনেন? and then tell them a little about him with pride (not when they are sad or busy). Apart from that, only use facts from the founder profile; never invent anything about him.");
/* owner, 20 Nov: speech was not clear. Ask for distinct, steady speech; giggles only between sentences, never over words */
$system .= " HOW TO SPEAK: speak SLOWLY, softly and naturally, a little slower than normal conversation, like someone talking calmly to a friend on the phone; never fast. Speak clearly and distinctly. Pronounce every word fully, including word endings; do not mumble, whisper, rush or swallow syllables. Use short, simple, everyday Bengali sentences with correct grammar and a small natural pause after each sentence. Prefer common, simple words you are sure of; do not make up words or mix forms. Keep most replies to one to three short sentences. ONE VOICE (owner, 21 Nov: it sounded different every time): keep exactly the same voice, pitch, speed and style in every sentence and every call. Be warm through your words, not by changing your voice: no laughing, giggling, whispering, singing, accents or dramatic tones. Keep a steady, comfortable volume.";
if ($lang === 'bn') $system .= " When the visitor speaks Bengali, answer in natural, standard Bangladeshi Bengali with correct pronunciation (not Kolkata forms, not Banglish), and address the visitor as আপনি unless they use তুমি with you. Never use words from other languages (Hindi, Urdu, Turkish or any other) or other scripts (say সম্পর্কে, not बारे); use only Bengali, plus common English words Bangladeshis use." . ab_ai_bn_core();

$now = time();
$req = [
  'uses' => 1,
  'expireTime' => gmdate('Y-m-d\TH:i:s\Z', $now + 60 * $cfg['minutes']),
  'newSessionExpireTime' => gmdate('Y-m-d\TH:i:s\Z', $now + 120),
  'bidiGenerateContentSetup' => [
    'model' => 'models/' . $cfg['model'],
    'generationConfig' => ['responseModalities' => ['AUDIO'], 'temperature' => 0.6, 'speechConfig' => ['voiceConfig' => ['prebuiltVoiceConfig' => ['voiceName' => $voice]]]]
      /* 0.9.20 (owner: both voices answer slowly): the 2.5 voice first "thinks" for seconds before it speaks; turn that off */
      + (str_contains($cfg['model'], 'native-audio') ? ['thinkingConfig' => ['thinkingBudget' => 0]] : []),
    'systemInstruction' => ['parts' => [['text' => $system]]],
    'inputAudioTranscription' => new stdClass(), 'outputAudioTranscription' => new stdClass(),
    /* one real tool: when the visitor says their name, the page saves it in their own browser for the next call and chat */
    'tools' => [['functionDeclarations' => [[ 'name' => 'remember_name', 'description' => 'Only when the visitor has clearly said their own name in this call; never a guess or placeholder. Save the name the visitor wants to be called. Call it once, right after the visitor tells you their name or how to address them.',
      'parameters' => ['type' => 'OBJECT', 'properties' => ['name' => ['type' => 'STRING', 'description' => 'The name exactly as the visitor wants it, in their script']], 'required' => ['name']] ],
      [ 'name' => 'hand_over', 'description' => 'Pass the call to the other voice when the visitor asks to talk to the other one (the girl or the boy). First say one short friendly line that you are handing over, then call this.',
        'parameters' => ['type' => 'OBJECT', 'properties' => ['to' => ['type' => 'STRING', 'enum' => ['girl', 'boy'], 'description' => 'Who takes the call']], 'required' => ['to']] ],
      /* owner, 21 Nov: "call kete dao" ends the call after a short goodbye */
      [ 'name' => 'end_call', 'description' => 'Hang up the call when the visitor wants to end it (for example কল কাটো, কল রাখো, রাখি, বাই, আল্লাহ হাফেজ, পরে কথা হবে, bye). First say one short, warm goodbye line, then call this.',
        'parameters' => ['type' => 'OBJECT', 'properties' => new stdClass()] ]]]],
    /* answer soon after the visitor stops talking, and hear interruptions quickly */
    'realtimeInputConfig' => ['automaticActivityDetection' => ['startOfSpeechSensitivity' => 'START_SENSITIVITY_LOW', 'endOfSpeechSensitivity' => 'END_SENSITIVITY_HIGH', 'prefixPaddingMs' => 100, 'silenceDurationMs' => (int)$cfg['silence']]],
  ],
];
/* the 2.5 native-audio models can match the feeling of the talk (laugh, sound sad or caring); 3.1 rejects this option */
/* owner, 21 Nov: one consistent voice, so the emotional style switching stays off */
$ch = curl_init(AB_AI_GEMINI_ALPHA . '/auth_tokens');
curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($req, JSON_UNESCAPED_UNICODE), CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-goog-api-key: ' . $cfg['key']], CURLOPT_CONNECTTIMEOUT => 8, CURLOPT_TIMEOUT => 15]);
$r = (string)curl_exec($ch); $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch);
$j = json_decode($r, true);
if ($status !== 200 || empty($j['name'])) {
  error_log('abidora live token ' . $status . ': ' . mb_substr(preg_replace('~\s+~', ' ', $r), 0, 300));
  ab_json_out(['ok' => false, 'code' => $status === 429 ? 'quota' : 'down'], 502);
}
ab_json_out(['ok' => true, 'token' => (string)$j['name'], 'model' => $cfg['model'], 'alt' => $alt, 'alts' => count($models),
  'ws' => 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained']);
