<?php
/* Contact form endpoint. Validates again on the server, blocks bots (honeypot) and floods (rate limit),
   stores the message for Admin > Messages, emails the owner and sends the visitor a one-time styled reply (lib/mail.php). Answers JSON: {ok, code}. */
declare(strict_types=1);
require dirname(__DIR__) . '/_abidora/lib/boot.php';
header('X-Content-Type-Options: nosniff');
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') ab_json_out(['ok' => false, 'code' => 'method'], 405);
if (!ab_installed()) ab_json_out(['ok' => false, 'code' => 'offline'], 503);

$s = fn(string $k, int $max) => mb_substr(trim(str_replace("\0", '', (string)($_POST[$k] ?? ''))), 0, $max);
$name = $s('name', 80); $email = $s('email', 120); $msg = $s('message', 3000); $lang = $s('lang', 5);
if (!isset(AB_LANGS[$lang])) $lang = 'en';
if ($s('website', 200) !== '') ab_json_out(['ok' => true]);                      // honeypot: pretend success
if ($name === '' || $msg === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $name . $email)) ab_json_out(['ok' => false, 'code' => 'invalid'], 422);

try {
  if (!ab_throttle('contact', 4, 3600)) ab_json_out(['ok' => false, 'code' => 'wait'], 429);
  ab_db()->prepare('INSERT INTO ab_messages (name, email, body, lang, ip_hash, created_at) VALUES (?,?,?,?,?,?)')->execute([$name, $email, $msg, $lang, ab_ip_hash(), ab_now()]);
} catch (Throwable $e) {
  error_log('abidora contact: ' . $e->getMessage());
  ab_json_out(['ok' => false, 'code' => 'fail'], 500);
}
require_once dirname(__DIR__) . '/_abidora/lib/mail.php';
/* 1) the owner's copy, with Reply-To set to the visitor so a reply goes straight back to them */
$to = (string)(ab_setting('notify_email', '') ?? '');
if ($to !== '' && filter_var($to, FILTER_VALIDATE_EMAIL)) {
  $body = "New message from the Abidora contact form\n\nName: $name\nEmail: $email\nLanguage: $lang\n\n$msg\n";
  if (!ab_mail_send($to, 'Abidora: new message from ' . ab_mail_clean($name), $body, null, $email, 'Abidora contact form')) error_log('abidora contact: owner email not sent');
}
/* 2) the visitor's one-time "message from the universe" (can be switched off in Admin > Settings) */
if (ab_setting('autoreply', '1') === '1') {
  try {
    if (ab_autoreply_allowed($email)) {
      [$subj, $text, $html] = ab_autoreply($lang, $name);
      $reply = $to !== '' ? $to : null;
      if (!ab_mail_send($email, $subj, $text, $html, $reply, 'Abidora Universe')) error_log('abidora contact: auto-reply not sent');
    }
  } catch (Throwable $e) { error_log('abidora autoreply: ' . $e->getMessage()); }
}
ab_json_out(['ok' => true]);
