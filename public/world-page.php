<?php
/* Every world shares one HTML page (worlds/w/?w=N). Browsers fill in the world's name with JavaScript, but link
   previews (WhatsApp, Facebook, X) and simple search crawlers read only the HTML. This file serves the same page
   with that world's title, description, canonical address, language alternates and structured data already in
   the <head>. .htaccess sends worlds/w/?w=N here; anything unexpected falls back to the plain page. */
declare(strict_types=1);
header('X-Content-Type-Options: nosniff');
$langs = ['en', 'bn', 'es', 'fr', 'de', 'ar', 'zh', 'ja', 'ko', 'hi'];
$hl = ['zh' => 'zh-Hans'];
$l = (string)($_GET['l'] ?? ''); $l = rtrim($l, '/'); if ($l === '') $l = 'en';
$n = (int)($_GET['w'] ?? 0);
if (!in_array($l, $langs, true)) { http_response_code(404); exit; }
$dir = __DIR__; $pre = $l === 'en' ? '' : $l . '/';
$page = @file_get_contents("$dir/{$pre}worlds/w/index.html");
if ($page === false) { http_response_code(404); exit; }
$out = function (string $html): never { header('Content-Type: text/html; charset=utf-8'); header('Cache-Control: no-cache'); echo $html; exit; };

$exp = json_decode((string)@file_get_contents("$dir/_abidora/data/experiences.json"), true);
$item = null; foreach ((array)($exp['items'] ?? []) as $x) if ((int)($x['id'] ?? 0) === $n) { $item = $x; break; }
if (!$item || ($item['status'] ?? '') !== 'live' || ($item['page'] ?? 'world') !== 'world') $out($page);   // the page itself handles missing/planned worlds

$dict = json_decode((string)@file_get_contents("$dir/_abidora/i18n/$l.json"), true) ?: [];
$en = $l === 'en' ? $dict : (json_decode((string)@file_get_contents("$dir/_abidora/i18n/en.json"), true) ?: []);
$tr = fn (string $k) => (string)($dict[$k] ?? $en[$k] ?? '');
$name = $tr('x.' . $n); $desc = $tr('wd.' . $n);
if ($name === '') $out($page);
$brand = 'Abidora';
$e = fn (string $s) => htmlspecialchars($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');

/* the site address, taken from the absolute share-image link the published page already carries */
if (!preg_match('~<meta property="og:image" content="(https?://[^"]+?/)assets/~', $page, $m)) $out($page);
$base = $m[1];
$url = fn (string $lang) => $base . ($lang === 'en' ? '' : $lang . '/') . 'worlds/w/?w=' . $n;
$title = $name . ' · ' . $brand;

$head = '<link rel="canonical" href="' . $e($url($l)) . '">';
foreach ($langs as $x) $head .= '<link rel="alternate" hreflang="' . ($hl[$x] ?? $x) . '" href="' . $e($url($x)) . '">';
$head .= '<link rel="alternate" hreflang="x-default" href="' . $e($url('en')) . '">';
$head .= '<meta property="og:url" content="' . $e($url($l)) . '">';
$head .= '<script type="application/ld+json">' . json_encode([
  '@context' => 'https://schema.org', '@type' => 'WebPage', 'name' => $title, 'description' => $desc, 'inLanguage' => $hl[$l] ?? $l, 'url' => $url($l),
  'isPartOf' => ['@type' => 'WebSite', 'name' => $brand, 'url' => $base . ($l === 'en' ? '' : $l . '/')],
  'breadcrumb' => ['@type' => 'BreadcrumbList', 'itemListElement' => [
    ['@type' => 'ListItem', 'position' => 1, 'name' => $brand, 'item' => $base . ($l === 'en' ? '' : $l . '/')],
    ['@type' => 'ListItem', 'position' => 2, 'name' => $tr('nav.worlds') ?: 'Worlds', 'item' => $base . ($l === 'en' ? '' : $l . '/') . 'worlds/'],
    ['@type' => 'ListItem', 'position' => 3, 'name' => $name, 'item' => $url($l)]]],
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) . '</script>';

$p = $page;
$p = preg_replace('~<title>.*?</title>~s', '<title>' . $e($title) . '</title>', $p, 1);
if ($desc !== '') {
  $p = preg_replace('~<meta name="description" content="[^"]*">~', '<meta name="description" content="' . $e($desc) . '">', $p, 1);
  $p = preg_replace('~<meta property="og:description" content="[^"]*">~', '<meta property="og:description" content="' . $e($desc) . '">', $p, 1);
  $p = preg_replace('~<meta name="twitter:description" content="[^"]*">~', '<meta name="twitter:description" content="' . $e($desc) . '">', $p, 1);
}
$p = preg_replace('~<meta property="og:title" content="[^"]*">~', '<meta property="og:title" content="' . $e($title) . '">', $p, 1);
$p = preg_replace('~<meta name="twitter:title" content="[^"]*">~', '<meta name="twitter:title" content="' . $e($title) . '">', $p, 1);
$p = preg_replace('~<meta property="og:url" content="[^"]*">~', '', $p);
$p = preg_replace('~</head>~', $head . '</head>', $p, 1);
$out($p ?? $page);
