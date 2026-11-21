<?php
/* Outgoing email for Abidora: the owner's notification and the visitor's "message from the universe" reply.
   Two ways to send, chosen in Admin > Settings:
   · SMTP (for example Gmail with an app password). Mail then truly comes from that mailbox and lands well.
   · PHP mail() on the hosting (default). Mail comes from universe@<site domain>, with Reply-To set to the
     owner's address, because a server may not send "From: someone@gmail.com" (Gmail's DMARC rejects it).
   SMTP credentials live only in the private config file (storage/config.php), never in the database,
   backups of the database, or any page. */
declare(strict_types=1);

function ab_mail_host(): string {
  $base = (string)(ab_config()['base'] ?? '');
  $h = parse_url($base, PHP_URL_HOST) ?: (string)($_SERVER['HTTP_HOST'] ?? 'localhost');
  return preg_replace('/[^a-z0-9.\-]/i', '', strtolower($h)) ?: 'localhost';
}
function ab_mail_hdr(string $s): string { return preg_match('/[^\x20-\x7e]/', $s) ? '=?UTF-8?B?' . base64_encode($s) . '?=' : $s; }
function ab_mail_clean(string $s): string { return trim(preg_replace('/[\r\n\0]+/', ' ', $s)); }

/** Build a MIME message (multipart/alternative when an HTML part is given). Returns [headers, body]. */
function ab_mail_build(string $fromName, string $fromAddr, string $to, string $subject, string $text, ?string $html, ?string $replyTo, ?string $auto = null, array $extra = []): array {
  $host = ab_mail_host();
  $h = [
    'From: ' . ab_mail_hdr(ab_mail_clean($fromName)) . ' <' . ab_mail_clean($fromAddr) . '>',
    'MIME-Version: 1.0',
    'Date: ' . date(DATE_RFC2822),
    'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $host . '>',
    'X-Mailer: Abidora',
  ];
  /* a personal reply from the owner is a normal email (no Auto-Submitted header), so mail apps treat it like any other message */
  $auto ??= ($replyTo !== null && $html !== null ? 'auto-replied' : 'auto-generated');
  if ($auto !== 'no') $h[] = 'Auto-Submitted: ' . $auto;
  foreach ($extra as $x) $h[] = ab_mail_clean((string)$x);
  if ($replyTo !== null && filter_var($replyTo, FILTER_VALIDATE_EMAIL)) $h[] = 'Reply-To: ' . ab_mail_clean($replyTo);
  if ($html === null) {
    $h[] = 'Content-Type: text/plain; charset=UTF-8'; $h[] = 'Content-Transfer-Encoding: base64';
    $body = chunk_split(base64_encode($text));
  } else {
    $b = 'ab-' . bin2hex(random_bytes(8));
    $h[] = 'Content-Type: multipart/alternative; boundary="' . $b . '"';
    $body = "--$b\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($text))
      . "--$b\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($html)) . "--$b--\r\n";
  }
  return [$h, $body];
}

/** Send one email. $to must already be validated. Returns true when the transport accepted it. */
function ab_mail_send(string $to, string $subject, string $text, ?string $html = null, ?string $replyTo = null, string $fromName = 'Abidora', ?string $auto = null, array $extra = []): bool {
  if (!filter_var($to, FILTER_VALIDATE_EMAIL)) return false;
  $smtp = ab_config()['smtp'] ?? null;
  $useSmtp = is_array($smtp) && !empty($smtp['host']) && !empty($smtp['user']) && !empty($smtp['pass']);
  $from = $useSmtp ? (string)$smtp['user'] : 'universe@' . ab_mail_host();
  [$h, $body] = ab_mail_build($fromName, $from, $to, $subject, $text, $html, $replyTo, $auto, $extra);
  if ($useSmtp) {
    try { return ab_smtp_send($smtp, $from, $to, ab_mail_hdr(ab_mail_clean($subject)), $h, $body); }
    catch (Throwable $e) { error_log('abidora smtp: ' . $e->getMessage()); return false; }
  }
  if (!function_exists('mail')) return false;
  return @mail($to, ab_mail_hdr(ab_mail_clean($subject)), $body, implode("\r\n", $h), '-f' . $from);
}

/** A small SMTP client: implicit TLS (465) or STARTTLS (587), AUTH LOGIN. No third-party code. */
function ab_smtp_send(array $c, string $from, string $to, string $subject, array $headers, string $body): bool {
  $port = (int)($c['port'] ?? 465); $host = (string)$c['host'];
  $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'SNI_enabled' => true]]);
  $fp = @stream_socket_client(($port === 465 ? 'ssl://' : 'tcp://') . $host . ':' . $port, $en, $es, 15, STREAM_CLIENT_CONNECT, $ctx);
  if (!$fp) throw new RuntimeException("connect $host:$port failed: $es");
  stream_set_timeout($fp, 20);
  $read = function () use ($fp): array { $all = ''; while (($l = fgets($fp, 1024)) !== false) { $all .= $l; if (strlen($l) < 4 || $l[3] === ' ') break; } return [(int)substr($all, 0, 3), $all]; };
  $cmd = function (string $line, array $ok) use ($fp, $read): string { if ($line !== '') fwrite($fp, $line . "\r\n"); [$code, $txt] = $read(); if (!in_array($code, $ok, true)) throw new RuntimeException('SMTP ' . preg_replace('/AUTH.*/', 'AUTH …', $line) . ' -> ' . trim($txt)); return $txt; };
  $cmd('', [220]); $me = ab_mail_host();
  $cmd("EHLO $me", [250]);
  /* a relay on this same machine (for example cPanel's localhost:25) may be used without TLS; anything remote must use TLS */
  $local = in_array($host, ['127.0.0.1', 'localhost', '::1'], true) && $port !== 465 && $port !== 587;
  if ($port !== 465 && !$local) { $cmd('STARTTLS', [220]); if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT)) throw new RuntimeException('STARTTLS failed'); $cmd("EHLO $me", [250]); }
  $cmd('AUTH LOGIN', [334]); $cmd(base64_encode((string)$c['user']), [334]); $cmd(base64_encode((string)$c['pass']), [235]);
  $cmd('MAIL FROM:<' . $from . '>', [250]); $cmd('RCPT TO:<' . $to . '>', [250, 251]); $cmd('DATA', [354]);
  $data = implode("\r\n", array_merge($headers, ['To: <' . $to . '>', 'Subject: ' . $subject])) . "\r\n\r\n" . $body;
  $data = preg_replace('/^\./m', '..', str_replace(["\r\n", "\n"], ["\n", "\r\n"], $data));
  fwrite($fp, rtrim($data, "\r\n") . "\r\n.\r\n"); $cmd('', [250]);
  try { $cmd('QUIT', [221]); } catch (Throwable) {}
  fclose($fp); return true;
}

/* ---------- the visitor's reply: "a message from the Abidora universe" ---------- */
function ab_autoreply_text(string $lang): array {
  $T = [
    'en' => ['Your message reached the Abidora universe', 'Signal received', 'Hello %s,', 'Your message has crossed the universe and reached Abidora. Thank you for writing. It is now with Abid Islam, and you will hear back personally if a reply is needed.', 'While you wait, there are worlds to explore.', 'Explore the universe', 'You are receiving this one-time note because this address was used on the contact form at %s. If that was not you, you can ignore it; nothing else will be sent.', 'To reply, simply answer this email.'],
    'bn' => ['আপনার বার্তা Abidora মহাবিশ্বে পৌঁছেছে', 'সংকেত পাওয়া গেছে', 'হ্যালো %s,', 'আপনার বার্তা মহাবিশ্ব পেরিয়ে Abidora-য় পৌঁছেছে। লেখার জন্য ধন্যবাদ। বার্তাটি এখন আবিদ ইসলামের কাছে আছে, আর উত্তর দরকার হলে তিনি নিজেই আপনাকে জানাবেন।', 'অপেক্ষার মধ্যে ঘুরে দেখুন নানা জগৎ।', 'মহাবিশ্ব ঘুরে দেখুন', '%s-এর যোগাযোগ ফর্মে এই ঠিকানা ব্যবহার করা হয়েছে বলে আপনি এই একবারের বার্তাটি পাচ্ছেন। যদি আপনি না হন, এটি উপেক্ষা করুন; আর কিছু পাঠানো হবে না।', 'উত্তর দিতে এই ইমেইলের রিপ্লাই করুন।'],
    'es' => ['Tu mensaje llegó al universo Abidora', 'Señal recibida', 'Hola, %s:', 'Tu mensaje ha cruzado el universo y ha llegado a Abidora. Gracias por escribir. Ya está con Abid Islam y, si hace falta una respuesta, te escribirá personalmente.', 'Mientras tanto, hay mundos por explorar.', 'Explorar el universo', 'Recibes esta nota única porque esta dirección se usó en el formulario de contacto de %s. Si no fuiste tú, ignórala; no se enviará nada más.', 'Para responder, contesta a este correo.'],
    'fr' => ['Votre message a atteint l’univers Abidora', 'Signal reçu', 'Bonjour %s,', 'Votre message a traversé l’univers et a atteint Abidora. Merci d’avoir écrit. Il est maintenant entre les mains d’Abid Islam, qui vous répondra personnellement si nécessaire.', 'En attendant, des mondes vous attendent.', 'Explorer l’univers', 'Vous recevez ce message unique parce que cette adresse a été utilisée dans le formulaire de contact de %s. Si ce n’était pas vous, ignorez-le ; rien d’autre ne sera envoyé.', 'Pour répondre, répondez simplement à cet e-mail.'],
    'de' => ['Deine Nachricht hat das Abidora-Universum erreicht', 'Signal empfangen', 'Hallo %s,', 'Deine Nachricht hat das Universum durchquert und Abidora erreicht. Danke fürs Schreiben. Sie liegt jetzt bei Abid Islam, und wenn eine Antwort nötig ist, meldet er sich persönlich.', 'Bis dahin warten Welten darauf, entdeckt zu werden.', 'Das Universum entdecken', 'Du erhältst diese einmalige Nachricht, weil diese Adresse im Kontaktformular von %s angegeben wurde. Warst du das nicht, ignoriere sie einfach; es kommt nichts weiter.', 'Zum Antworten einfach auf diese E-Mail antworten.'],
    'ar' => ['وصلت رسالتك إلى كون Abidora', 'تم استلام الإشارة', 'مرحبًا %s،', 'عبرت رسالتك الكون ووصلت إلى Abidora. شكرًا لك على الكتابة. هي الآن لدى عابد إسلام، وسيردّ عليك شخصيًا إن احتاج الأمر إلى رد.', 'وفي أثناء الانتظار، هناك عوالم تنتظر أن تستكشفها.', 'استكشف الكون', 'تصلك هذه الرسالة لمرة واحدة لأن هذا العنوان استُخدم في نموذج التواصل على %s. إن لم تكن أنت، فتجاهلها؛ لن يُرسل شيء آخر.', 'للرد، أجب على هذه الرسالة فقط.'],
    'zh' => ['你的消息已抵达 Abidora 宇宙', '信号已收到', '%s，你好：', '你的消息穿越宇宙，已抵达 Abidora。感谢来信。消息现已交到 Abid Islam 手中，如需回复，他会亲自联系你。', '等待的时候，不妨去探索各个世界。', '探索宇宙', '你收到这封一次性邮件，是因为有人在 %s 的联系表单中填写了这个地址。如果不是你，请忽略，之后不会再发送任何邮件。', '如需回复，直接回复此邮件即可。'],
    'ja' => ['メッセージが Abidora の宇宙に届きました', 'シグナルを受信しました', '%s さん、こんにちは。', 'あなたのメッセージは宇宙を渡り、Abidora に届きました。ご連絡ありがとうございます。メッセージは Abid Islam のもとにあり、返信が必要な場合は本人からご連絡します。', 'それまで、いくつもの世界を探検してみてください。', '宇宙を探検する', 'このメールは、%s のお問い合わせフォームにこのアドレスが入力されたため、一度だけお送りしています。お心当たりがない場合は無視してください。これ以上は送信されません。', '返信するには、このメールにそのまま返信してください。'],
    'ko' => ['메시지가 Abidora 우주에 도착했습니다', '신호 수신 완료', '%s 님, 안녕하세요.', '보내주신 메시지가 우주를 건너 Abidora에 도착했습니다. 연락해 주셔서 감사합니다. 메시지는 지금 Abid Islam에게 전달되었고, 답장이 필요하면 직접 연락드립니다.', '기다리는 동안 여러 세계를 탐험해 보세요.', '우주 탐험하기', '%s의 문의 양식에 이 주소가 입력되어 이 안내를 한 번만 보내드립니다. 본인이 아니라면 무시하셔도 됩니다. 더 이상 아무것도 보내지 않습니다.', '답장하려면 이 이메일에 회신하세요.'],
    'hi' => ['आपका संदेश Abidora ब्रह्मांड तक पहुँच गया', 'संकेत मिल गया', 'नमस्ते %s,', 'आपका संदेश ब्रह्मांड पार करके Abidora तक पहुँच गया है। लिखने के लिए धन्यवाद। यह अब आबिद इस्लाम के पास है, और जवाब की ज़रूरत हुई तो वे ख़ुद आपसे संपर्क करेंगे।', 'तब तक, कई दुनिया आपका इंतज़ार कर रही हैं।', 'ब्रह्मांड घूमें', 'आपको यह एक बार का संदेश इसलिए मिला है क्योंकि %s के संपर्क फ़ॉर्म में यह पता दिया गया था। अगर वह आप नहीं थे, तो इसे अनदेखा करें; आगे कुछ नहीं भेजा जाएगा।', 'जवाब देने के लिए बस इस ईमेल का उत्तर दें।'],
  ];
  return $T[$lang] ?? $T['en'];
}
/** First name only, plain letters, short: the reply never repeats what the visitor wrote, so the form
    cannot be used to send arbitrary text or links to someone else's inbox. */
function ab_autoreply_name(string $name): string {
  $first = preg_split('/\s+/u', trim(strip_tags($name)))[0] ?? '';
  $first = preg_replace('/[^\p{L}\p{M}\'\-]/u', '', $first) ?? '';
  return mb_substr($first, 0, 24);
}
function ab_autoreply(string $lang, string $name): array {
  [$subj, $kick, $hello, $p1, $p2, $btn, $foot, $replyHint] = ab_autoreply_text($lang);
  $who = ab_autoreply_name($name); $site = (string)(ab_config()['base'] ?? ''); $siteName = ab_mail_host();
  $hello = sprintf($hello, $who !== '' ? $who : '✦');
  $e = fn(string $s) => htmlspecialchars($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
  $ls = in_array($lang, ['en', 'es', 'fr', 'de'], true); $sp = fn(string $v) => $ls ? $v : '0'; $rtl = $lang === 'ar'; $dir = $rtl ? 'rtl' : 'ltr'; $al = $rtl ? 'right' : 'left';
  $url = $site !== '' ? rtrim($site, '/') . '/' . ($lang !== 'en' ? $lang . '/' : '') : '';   /* 0.9.16: base may lack the last slash */
  /* stars: a fixed pattern of tiny dots, drawn with table cells so it works in mail apps without images */
  $stars = '';
  foreach ([[6, 20, .9], [18, 64, .5], [9, 78, .7], [24, 38, .4], [14, 90, .6], [4, 52, .5]] as [$t, $l, $o]) $stars .= '<div style="position:absolute;top:' . $t . 'px;left:' . $l . '%;width:2px;height:2px;border-radius:2px;background:#fff;opacity:' . $o . '"></div>';
  $html = '<!doctype html><html lang="' . $e($lang) . '" dir="' . $dir . '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>' . $e($subj) . '</title></head>'
    . '<body style="margin:0;padding:0;background:#07060b">'
    . '<div style="display:none;max-height:0;overflow:hidden">' . $e($p1) . '</div>'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#07060b;background-image:radial-gradient(60% 50% at 30% 0%,#3a1a3f 0%,rgba(7,6,11,0) 70%),radial-gradient(50% 40% at 90% 10%,#3b2a12 0%,rgba(7,6,11,0) 70%)"><tr><td align="center" style="padding:40px 16px">'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border:1px solid rgba(240,228,210,.14);border-radius:18px;background:#0f0d14;overflow:hidden">'
    . '<tr><td style="position:relative;padding:34px 34px 8px;font-family:Georgia,\'Times New Roman\',serif;color:#f0e6d6;text-align:' . $al . '">' . $stars
    . '<div style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:' . ($ls ? '11' : '13') . 'px;letter-spacing:' . $sp('.18em') . ';text-transform:uppercase;color:#e8b46a">✦ ' . $e($kick) . '</div>'
    . '<div style="font-size:34px;line-height:1.05;margin:14px 0 6px;letter-spacing:-.01em">Abidora</div>'
    . '<div style="height:1px;background:linear-gradient(90deg,#d6568c,#e8b46a,rgba(232,180,106,0));margin:18px 0 22px"></div></td></tr>'
    . '<tr><td style="padding:0 34px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#e6ddd0;text-align:' . $al . '">'
    . '<p style="margin:0 0 14px">' . $e($hello) . '</p><p style="margin:0 0 14px">' . $e($p1) . '</p><p style="margin:0 0 26px;color:#b9ae9f">' . $e($p2) . '</p>'
    . ($url !== '' ? '<p style="margin:0 0 30px"><a href="' . $e($url) . '" style="display:inline-block;padding:13px 24px;border-radius:999px;background:#f0e6d6;color:#0f0d14;text-decoration:none;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:' . ($ls ? '12' : '14') . 'px;letter-spacing:' . $sp('.12em') . ';text-transform:uppercase">' . $e($btn) . ' →</a></p>' : '')
    . '<p style="margin:0 0 6px;font-family:Georgia,serif;font-style:italic;color:#e8b46a">— ABIDORA</p><p style="margin:0 0 30px;font-size:13px;color:#8f8676">' . $e($replyHint) . '</p></td></tr>'
    . '<tr><td style="padding:18px 34px 26px;border-top:1px solid rgba(240,228,210,.1);font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#7d7568;text-align:' . $al . '">' . $e(sprintf($foot, $siteName)) . '</td></tr>'
    . '</table></td></tr></table></body></html>';
  $text = "✦ $kick\n\nABIDORA\n\n$hello\n\n$p1\n\n$p2\n" . ($url !== '' ? "\n$btn: $url\n" : '') . "\n— ABIDORA\n$replyHint\n\n" . sprintf($foot, $siteName) . "\n";
  return [$subj, $text, $html];
}

/** Abuse limits for the automatic reply: one per recipient address per day, and at most 30 per hour in total.
    Together with the per-visitor limit on the form, the reply cannot be turned into a way to flood strangers. */
function ab_autoreply_allowed(string $email): bool {
  $db = ab_db(); $day = gmdate('Y-m-d H:i:s', time() - 86400); $hour = gmdate('Y-m-d H:i:s', time() - 3600);
  $k = 'ar:' . substr(hash_hmac('sha256', strtolower($email), (string)(ab_config()['secret'] ?? 'x')), 0, 24);
  $s = $db->prepare('SELECT COUNT(*) FROM ab_throttle WHERE k = ? AND created_at > ?'); $s->execute([$k, $day]);
  if ((int)$s->fetchColumn() > 0) return false;
  $s = $db->prepare("SELECT COUNT(*) FROM ab_throttle WHERE k LIKE 'ar:%' AND created_at > ?"); $s->execute([$hour]);
  if ((int)$s->fetchColumn() >= 30) return false;
  $db->prepare('INSERT INTO ab_throttle (k, created_at) VALUES (?, ?)')->execute([$k, ab_now()]);
  return true;
}

/** 0.9.15: the owner's own reply to a contact message, written in Admin > Messages.
    Sent in the same dark Abidora frame as the "message from the universe" email: his words, his name,
    then the visitor's original message quoted below. Returns [subject, text, html]. */
function ab_owner_reply(string $toName, string $reply, string $original, string $sentAt, string $signName): array {
  $e = fn(string $s) => htmlspecialchars($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
  $br = fn(string $s) => nl2br($e($s), false);
  $site = (string)(ab_config()['base'] ?? ''); $host = ab_mail_host();
  $subj = 'Re: your message to Abidora';
  $quoted = preg_replace('/^/m', '> ', $original);
  $text = "✦ A REPLY FROM ABIDORA\n\n" . $reply . "\n\n— " . $signName . "\nFounder, Abidora" . ($site !== '' ? "\n" . $site : '')
        . "\n\nOn " . $sentAt . ' UTC, ' . $toName . " wrote:\n" . $quoted . "\n\nYou can reply to this email directly.\n";
  $stars = '';
  foreach ([[6, 20, .9], [18, 64, .5], [9, 78, .7], [24, 38, .4], [14, 90, .6], [4, 52, .5]] as [$t, $l, $o]) $stars .= '<div style="position:absolute;top:' . $t . 'px;left:' . $l . '%;width:2px;height:2px;border-radius:2px;background:#fff;opacity:' . $o . '"></div>';
  $sans = 'font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif';
  $html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>' . $e($subj) . '</title></head>'
    . '<body style="margin:0;padding:0;background:#07060b">'
    . '<div style="display:none;max-height:0;overflow:hidden">' . $e(mb_substr($reply, 0, 120)) . '</div>'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#07060b;background-image:radial-gradient(60% 50% at 30% 0%,#3a1a3f 0%,rgba(7,6,11,0) 70%),radial-gradient(50% 40% at 90% 10%,#3b2a12 0%,rgba(7,6,11,0) 70%)"><tr><td align="center" style="padding:40px 16px">'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border:1px solid rgba(240,228,210,.14);border-radius:18px;background:#0f0d14;overflow:hidden">'
    . '<tr><td style="position:relative;padding:34px 34px 8px;font-family:Georgia,\'Times New Roman\',serif;color:#f0e6d6">' . $stars
    . '<div style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#e8b46a">✦ A reply from Abidora</div>'
    . '<div style="font-size:34px;line-height:1.05;margin:14px 0 6px;letter-spacing:-.01em">Abidora</div>'
    . '<div style="height:1px;background:linear-gradient(90deg,#d6568c,#e8b46a,rgba(232,180,106,0));margin:18px 0 22px"></div></td></tr>'
    . '<tr><td style="padding:0 34px;' . $sans . ';font-size:16px;line-height:1.65;color:#e6ddd0">'
    . '<div style="margin:0 0 24px">' . $br($reply) . '</div>'
    . '<p style="margin:0 0 2px;font-family:Georgia,serif;font-style:italic;font-size:18px;color:#e8b46a">— ' . $e($signName) . '</p>'
    . '<p style="margin:0 0 26px;font-size:13px;color:#8f8676">Founder, Abidora</p>'
    . '<div style="margin:0 0 26px;padding:14px 16px;border-left:2px solid rgba(232,180,106,.45);background:rgba(240,228,210,.04);border-radius:0 10px 10px 0;font-size:14px;line-height:1.55;color:#a89f92">'
    . '<div style="margin:0 0 6px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#7d7568">Your message · ' . $e($sentAt) . ' UTC</div>'
    . $br($original) . '</div>'
    . ($site !== '' ? '<p style="margin:0 0 30px"><a href="' . $e($site) . '" style="display:inline-block;padding:13px 24px;border-radius:999px;background:#f0e6d6;color:#0f0d14;text-decoration:none;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;letter-spacing:.12em;text-transform:uppercase">Visit Abidora →</a></p>' : '')
    . '</td></tr>'
    . '<tr><td style="padding:18px 34px 26px;border-top:1px solid rgba(240,228,210,.1);' . $sans . ';font-size:12px;line-height:1.5;color:#7d7568">You can reply to this email directly. · ' . $e($host) . '</td></tr>'
    . '</table></td></tr></table></body></html>';
  return [$subj, $text, $html];
}

/** 0.9.16: the owner's ready-made invitation ("come and see Abidora"), sent from Admin > Invite.
    Same dark Abidora frame as the other emails. English or Bangla. Returns [subject, text, html]. */
function ab_invite_text(string $lang): array {
  if ($lang === 'bn') return [
    '%s আপনাকে Abidora দেখার আমন্ত্রণ জানিয়েছেন', '✦ ব্যক্তিগত আমন্ত্রণ', 'আপনার জন্য একটি আমন্ত্রণ',
    'আমি Abidora বানিয়েছি। এটা একটা ফ্রি ওয়েবসাইট, যেখানে আসল 3D জিনিস ঘুরিয়ে, রং বদলে আর খেলে দেখা যায়: জামাকাপড়, জুতা, গেম, মহাকাশ, আর একটা AI সহকারী। ১০টা ভাষায় চলে, বাংলাও আছে।',
    'একটু সময় নিয়ে ঘুরে দেখুন। কেমন লাগল জানালে খুব খুশি হব, এই ইমেইলের উত্তর দিলেই হবে।',
    'Abidora ঘুরে দেখুন', 'প্রতিষ্ঠাতা, Abidora',
    'এই ইমেইলটি পেয়েছেন কারণ %s নিজে আপনাকে আমন্ত্রণ পাঠিয়েছেন। আর না চাইলে এই ইমেইলের উত্তরে STOP লিখুন, আর পাঠানো হবে না।'];
  return [
    '%s invited you to Abidora', '✦ A personal invitation', 'You’re invited',
    'I built Abidora, a free website where you can turn, change and play with real 3D things: clothes, shoes, games, space, and an AI helper. It works in 10 languages.',
    'Take a few minutes and look around. I would love to hear what you think. Just reply to this email.',
    'Visit Abidora', 'Founder, Abidora',
    'You got this because %s invited you personally. Don’t want these? Reply STOP and you won’t get another.'];
}
function ab_invite(string $lang, string $signName): array {
  [$subj, $kick, $head, $p1, $p2, $btn, $role, $foot] = ab_invite_text($lang);
  $subj = sprintf($subj, $signName); $foot = sprintf($foot, $signName);
  $e = fn(string $s) => htmlspecialchars($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
  $site = (string)(ab_config()['base'] ?? ''); $host = ab_mail_host();
  $url = $site !== '' ? rtrim($site, '/') . '/' . ($lang !== 'en' ? $lang . '/' : '') : '';   /* 0.9.16: base may lack the last slash */
  $bn = $lang === 'bn'; $ls = $bn ? '0' : '.18em';
  $stars = '';
  foreach ([[6, 20, .9], [18, 64, .5], [9, 78, .7], [24, 38, .4], [14, 90, .6], [4, 52, .5], [30, 12, .4], [22, 84, .5]] as [$t, $l, $o]) $stars .= '<div style="position:absolute;top:' . $t . 'px;left:' . $l . '%;width:2px;height:2px;border-radius:2px;background:#fff;opacity:' . $o . '"></div>';
  $sans = 'font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,' . ($bn ? '\'Noto Sans Bengali\',\'Hind Siliguri\',' : '') . 'sans-serif';
  $html = '<!doctype html><html lang="' . $e($lang) . '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>' . $e($subj) . '</title></head>'
    . '<body style="margin:0;padding:0;background:#07060b">'
    . '<div style="display:none;max-height:0;overflow:hidden">' . $e($p1) . '</div>'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#07060b;background-image:radial-gradient(60% 50% at 30% 0%,#3a1a3f 0%,rgba(7,6,11,0) 70%),radial-gradient(50% 40% at 90% 10%,#3b2a12 0%,rgba(7,6,11,0) 70%)"><tr><td align="center" style="padding:40px 16px">'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border:1px solid rgba(240,228,210,.14);border-radius:18px;background:#0f0d14;overflow:hidden">'
    . '<tr><td style="position:relative;padding:34px 34px 8px;font-family:Georgia,\'Times New Roman\',serif;color:#f0e6d6">' . $stars
    . '<div style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:' . ($bn ? '13' : '11') . 'px;letter-spacing:' . $ls . ';text-transform:uppercase;color:#e8b46a">' . $e($kick) . '</div>'
    . '<div style="font-size:40px;line-height:1.02;margin:14px 0 4px;letter-spacing:-.01em">Abidora</div>'
    . '<div style="font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#a89f92;font-family:ui-monospace,Menlo,Consolas,monospace">A Universe Without Limits</div>'
    . '<div style="height:1px;background:linear-gradient(90deg,#d6568c,#e8b46a,rgba(232,180,106,0));margin:20px 0 22px"></div></td></tr>'
    . '<tr><td style="padding:0 34px;' . $sans . ';font-size:16px;line-height:1.65;color:#e6ddd0">'
    . '<p style="margin:0 0 14px;font-family:Georgia,serif;font-size:24px;line-height:1.2;color:#f0e6d6">' . $e($head) . '</p>'
    . '<p style="margin:0 0 14px">' . $e($p1) . '</p><p style="margin:0 0 26px;color:#b9ae9f">' . $e($p2) . '</p>'
    . ($url !== '' ? '<p style="margin:0 0 30px"><a href="' . $e($url) . '" style="display:inline-block;padding:14px 26px;border-radius:999px;background:#f0e6d6;color:#0f0d14;text-decoration:none;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:' . ($bn ? '15' : '12') . 'px;letter-spacing:' . ($bn ? '0' : '.12em') . ';text-transform:uppercase">' . $e($btn) . ' →</a></p>'
      . '<p style="margin:-18px 0 28px;font-size:12px;color:#7d7568;word-break:break-all">' . $e($url) . '</p>' : '')
    . '<p style="margin:0 0 2px;font-family:Georgia,serif;font-style:italic;font-size:18px;color:#e8b46a">— ' . $e($signName) . '</p>'
    . '<p style="margin:0 0 30px;font-size:13px;color:#8f8676">' . $e($role) . '</p></td></tr>'
    . '<tr><td style="padding:18px 34px 26px;border-top:1px solid rgba(240,228,210,.1);' . $sans . ';font-size:12px;line-height:1.5;color:#7d7568">' . $e($foot) . ' · ' . $e($host) . '</td></tr>'
    . '</table></td></tr></table></body></html>';
  $text = "$kick\n\nABIDORA · A Universe Without Limits\n\n$head\n\n$p1\n\n$p2\n" . ($url !== '' ? "\n$btn: $url\n" : '') . "\n— $signName\n$role\n\n$foot\n";
  return [$subj, $text, $html];
}
