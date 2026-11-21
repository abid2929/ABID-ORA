<?php
/* Abidora page renderer.
   Astro builds one template per page (with {{key}} tokens) into _abidora/templates/.
   This file turns each template into static HTML for every language. It runs:
     - at build time:   php tools/publish.php
     - on the server:   Admin > Translations > Publish (no Node.js needed on the host)
   Tokens:  {{key}} trusted HTML from the dictionary   {{attr:key}} escaped text   {{json:key}} JSON string
            {{U:page}} relative link to a page in the same language   {{ROOT}} relative path to the site root */
declare(strict_types=1);
if (!defined('AB_DIR')) define('AB_DIR', dirname(__DIR__));          // .../_abidora
if (!defined('AB_PUB')) define('AB_PUB', dirname(AB_DIR));          // the public folder (public_html or a subfolder)

const AB_LANGS = [
  'en' => ['English',  'ltr', 'en'],
  'bn' => ['বাংলা',     'ltr', 'bn'],
  'es' => ['Español',  'ltr', 'es'],
  'fr' => ['Français', 'ltr', 'fr'],
  'de' => ['Deutsch',  'ltr', 'de'],
  'ar' => ['العربية',   'rtl', 'ar'],
  'zh' => ['中文',      'ltr', 'zh-Hans'],
  'ja' => ['日本語',    'ltr', 'ja'],
  'ko' => ['한국어',    'ltr', 'ko'],
  'hi' => ['हिन्दी',     'ltr', 'hi'],
];
/* page key => path inside a language */
const AB_PAGES = ['home' => '', 'worlds' => 'worlds/', 'galaxy' => 'worlds/digital-galaxy/', 'founder' => 'founder/', 'credits' => 'credits/', 'notfound' => '404/', 'themes' => 'studio/themes/', 'cursors' => 'studio/cursors/', 'studio' => 'studio/', 'world' => 'worlds/w/', 'ai' => 'ai/'];
const AB_META  = ['home' => 'meta', 'worlds' => 'wl.meta', 'galaxy' => 'gx.meta', 'founder' => 'fd.meta', 'credits' => 'cr.meta', 'notfound' => 'nf.meta', 'themes' => 'th.meta', 'cursors' => 'cu.meta', 'studio' => 'us.meta', 'world' => 'wo.meta', 'ai' => 'ai.meta'];
/* extra dictionary keys a page script needs (besides all js.* keys) */
const AB_JSKEYS = ['ai' => ['ai.'], 'home' => ['wd.'], 'galaxy' => ['gx.s.', 'gx.d.', 'gx.nogl', 'gx.err'], 'themes' => ['th.'], 'cursors' => ['th.', 'cu.'], 'studio' => ['th.', 'cu.', 'us.', 'x.'], 'world' => ['x.', 'cat.', 'wd.', 'wh.', 'wo.', 'wi.']];
const AB_FONTS = [
  'bn' => ['Noto Serif Bengali', 'Noto Sans Bengali'],
  'ar' => ['Noto Naskh Arabic', 'Noto Sans Arabic'],
  'zh' => ['Noto Serif SC', 'Noto Sans SC'],
  'ja' => ['Noto Serif JP', 'Noto Sans JP'],
  'ko' => ['Noto Serif KR', 'Noto Sans KR'],
  'hi' => ['Noto Serif Devanagari', 'Noto Sans Devanagari'],
];
const AB_CODES = ['en'=>'EN','bn'=>'BN','es'=>'ES','fr'=>'FR','de'=>'DE','ar'=>'AR','zh'=>'ZH','ja'=>'JA','ko'=>'KO','hi'=>'HI'];

function ab_json(string $f): array { $d = is_file($f) ? json_decode((string)file_get_contents($f), true) : null; return is_array($d) ? $d : []; }
function ab_dict(string $lang, bool $fresh = false): array { static $c = []; if ($fresh) unset($c[$lang]); return $c[$lang] ??= ab_json(AB_DIR . "/i18n/$lang.json"); }
function ab_h(string $s): string { return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function ab_prefix(string $lang): string { return $lang === 'en' ? '' : "$lang/"; }
function ab_site(): array { return ab_json(AB_DIR . '/data/site.json'); }

/** keys of the English source that a language has not translated yet */
function ab_missing(string $lang): array {
  $en = ab_dict('en'); $d = ab_dict($lang); $out = [];
  foreach ($en as $k => $v) if ($k !== '_meta' && (!isset($d[$k]) || trim((string)$d[$k]) === '')) $out[] = $k;
  return $out;
}

/**
 * Render one page in one language.
 * $opt['export'] true  -> links end in index.html (for opening files without a web server)
 * $opt['base']  string -> absolute site URL (e.g. https://example.com/abidora) for hreflang, canonical, og:url
 */
function ab_render(string $lang, string $page, array $opt = []): string {
  if (!isset(AB_LANGS[$lang])) $lang = 'en';
  if (!isset(AB_PAGES[$page])) $page = 'home';
  $export = !empty($opt['export']); $base = rtrim((string)($opt['base'] ?? ''), '/');
  $tf = AB_DIR . "/templates/$page.html";
  if (!is_file($tf)) throw new RuntimeException("Missing template $page");
  $tpl = (string)file_get_contents($tf);
  $en = ab_dict('en'); $d = ab_dict($lang);
  $site = ab_site();
  $brand = trim((string)($site['brand'] ?? '')) ?: 'Abidora';
  $owner = trim((string)($site['name'] ?? '')) ?: 'Abid Islam';
  /* first word and the rest, for layouts that split the name (the founder stage) */
  $op = preg_split('/\s+/u', $owner, 2); $owner1 = $op[0]; $owner2 = $op[1] ?? '';
  [$lname, $dir, $loc] = AB_LANGS[$lang];

  $path = ab_prefix($lang) . AB_PAGES[$page];
  $root = str_repeat('../', substr_count($path, '/'));
  /* the 404 page is served at whatever address was missing (e.g. /abidora/a/b/c), so its links and assets
     must start from the site folder, not from the page; the address is known once the site is installed */
  if ($page === 'notfound' && $base) $root = rtrim((string)(parse_url($base, PHP_URL_PATH) ?? ''), '/') . '/';
  $idx = $export ? 'index.html' : '';
  /* link from this page to page $p in language $l */
  $url = function (string $l, string $p) use ($root, $idx): string { $u = $root . ab_prefix($l) . AB_PAGES[$p] . $idx; return $u === '' ? './' : $u; };
  $urls = []; foreach (AB_PAGES as $p => $_) $urls[$p] = $url($lang, $p);

  $pills = [];
  if ($page === 'home') foreach (['earth-orbit', 'neon-street', 'octopus', 'watch'] as $p) $pills[] = '<span class="pill"><img src="' . $root . 'assets/home/' . $p . '-t.jpg" alt="" width="160" height="160" loading="lazy" decoding="async"></span>';   /* 0.9.14: 160 px thumb, the pill is about 80 px wide */
  $missing = 0;
  $get = function (string $k) use ($d, $en, &$missing): string {
    if (isset($d[$k]) && trim((string)$d[$k]) !== '') return (string)$d[$k];
    $missing++; return (string)($en[$k] ?? $k);
  };
  $sub = function (string $s) use ($brand, $owner, $pills): string {
    $s = str_replace(['{brand}', '{owner}'], [ab_h($brand), ab_h($owner)], $s);
    foreach ($pills as $i => $p) $s = str_replace('{p' . ($i + 1) . '}', $p, $s);
    return $s;
  };

  /* ---- generated blocks ---- */
  $blocks = [];
  if ($page === 'founder') {
    $cur = []; $learn = []; $all = [];
    foreach ($site['founder_skills'] ?? [] as $s) {
      $k = (string)($s['key'] ?? ''); if ($k === '') continue; $li = '<li>' . $sub($get("sk.$k")) . '</li>';
      $all[] = $li; if (($s['level'] ?? '') === 'current') $cur[] = $li; elseif (($s['level'] ?? '') === 'learning') $learn[] = $li;
    }
    if ($cur || $learn) {
      $html = '';
      if ($cur) $html .= '<div class="skg"><h3 class="mono">' . $get('fd.sk.current') . '</h3><ul class="chips">' . implode('', $cur) . '</ul></div>';
      if ($learn) $html .= '<div class="skg"><h3 class="mono">' . $get('fd.sk.learning') . '</h3><ul class="chips">' . implode('', $learn) . '</ul></div>';
    } else $html = '<ul class="chips">' . implode('', $all) . '</ul>';
    $blocks['SKILLS'] = $html;
  }
  if ($page === 'credits') {
    $rows = '';
    foreach (ab_json(AB_DIR . '/data/assets.json') as $a) {
      $name = preg_replace('/\.jpg.*$/', '', basename(explode(' ', (string)$a['file'])[0]));
      $owned = ($a['kind'] ?? '') === 'owner';
      $thumb = (string)($a['thumb'] ?? 'assets/home/' . $name . '-s.jpg');
      $key = (string)($a['key'] ?? "asset.$name");
      $creator = trim((string)($a['creator'] ?? ''));
      $used = array_map(fn($p) => isset(AB_PAGES[$p]) ? '<a href="' . ab_h($url($lang, $p)) . '">' . $sub($get(AB_META[$p] . '.short')) . '</a>' : '', (array)($a['used'] ?? []));
      $src = $owned ? $sub($get('cr.owner.src')) : '<a href="' . ab_h($a['source']) . '" rel="noopener" target="_blank">' . ab_h((string)($a['provider'] ?? 'Unsplash')) . ' ↗</a>';
      $who = $creator !== '' ? ab_h($creator) : ($owned ? $sub($get('cr.owner.src')) : '<span class="mute">' . $get('cr.creator.na') . '</span>');
      $rows .= '<tr><td><img src="' . $root . ab_h($thumb) . '" alt="" loading="lazy" width="72" height="48"></td><td>' . $sub($get($key)) . '</td><td>'
        . $who . '</td><td>' . $src . '</td><td>' . $get($owned ? 'cr.lic.owner' : 'cr.lic') . '</td><td>' . (implode(', ', array_filter($used)) ?: '—') . '</td></tr>';
    }
    $blocks['CREDITS_ROWS'] = $rows;
  }
  if ($page === 'home') {
    $xs = ab_json(AB_DIR . '/data/experiences.json'); $n = 0;
    foreach ($xs['items'] ?? [] as $x) if (($x['status'] ?? '') === 'live') $n++;
    $blocks['N_LIVE'] = (string)$n; $blocks['N_TOTAL'] = (string)count($xs['items'] ?? []); $blocks['N_LANGS'] = (string)count(AB_LANGS);
    /* Universe (Wave A, I-1): every world grouped by category. It is the accessible list view and also the data the 3D map reads. */
    $by = []; foreach ($xs['items'] ?? [] as $x) $by[$x['cat']][] = $x;
    $uv = '';
    foreach ($xs['categories'] ?? [] as $c) {
      $id = (string)$c['id']; $items = $by[$id] ?? []; if (!$items) continue;
      $live = 0; foreach ($items as $x) if (($x['status'] ?? '') === 'live' && isset(AB_PAGES[$x['page'] ?? ''])) $live++;
      $uv .= '<section data-c="' . ab_h($id) . '" data-col="' . ab_h((string)$c['color']) . '" style="--cc:' . ab_h((string)$c['color']) . '"><h3>' . $sub($get("cat.$id")) . ' <span class="mono">' . $live . '/' . count($items) . '</span></h3><ul>';
      foreach ($items as $x) {
        $isLive = ($x['status'] ?? '') === 'live' && isset(AB_PAGES[$x['page'] ?? '']); $nm = $sub($get('x.' . $x['id']));
        $uv .= $isLive ? '<li data-id="' . (int)$x['id'] . '" data-s="live"><a href="' . ab_h($url($lang, $x['page']) . ($x['page'] === 'world' ? '?w=' . (int)$x['id'] : '')) . '">' . $nm . '</a></li>'
                       : '<li data-id="' . (int)$x['id'] . '" data-s="planned"><span>' . $nm . '</span></li>';
      }
      $uv .= '</ul></section>';
    }
    $blocks['UNIVERSE_LIST'] = $uv;
  }
  if ($page === 'worlds') {
    $xs = ab_json(AB_DIR . '/data/experiences.json');
    $cats = []; foreach ($xs['categories'] ?? [] as $c) $cats[$c['id']] = $c;
    $live = 0; $planned = 0; $by = [];
    foreach ($xs['items'] ?? [] as $x) { $by[$x['cat']][] = $x; if (($x['status'] ?? '') === 'live') $live++; else $planned++; }
    $tally = '<div class="lv"><dt>' . $get('wl.st.live') . '</dt><dd>' . $live . '</dd></div><div><dt>' . $get('wl.st.planned') . '</dt><dd>' . $planned . '</dd></div><div><dt>' . $get('wl.total') . '</dt><dd>' . ($live + $planned) . '</dd></div>';
    $chips = '<button type="button" data-c="" aria-pressed="true">' . $get('wl.filter.all') . '</button>';
    $list = '';
    foreach ($cats as $id => $c) {
      $items = $by[$id] ?? []; if (!$items) continue;
      $cname = $sub($get("cat.$id"));
      $chips .= '<button type="button" data-c="' . $id . '" aria-pressed="false">' . $cname . '<b>' . count($items) . '</b></button>';
      $list .= '<section class="cat" id="cat-' . $id . '" style="--cc:' . ab_h((string)$c['color']) . '" aria-labelledby="ch-' . $id . '"><header><span class="L" aria-hidden="true">' . $id . '</span><h2 id="ch-' . $id . '">' . $cname . '</h2><span class="mono">' . count($items) . '</span></header><ul class="xs">';
      foreach ($items as $x) {
        $n = str_pad((string)$x['id'], 3, '0', STR_PAD_LEFT); $nm = $sub($get('x.' . $x['id']));
        $isLive = ($x['status'] ?? '') === 'live' && isset(AB_PAGES[$x['page'] ?? '']);
        $attrs = ' data-c="' . $id . '" data-s="' . ($isLive ? 'live' : 'planned') . '" data-en="' . ab_h(mb_strtolower(strip_tags((string)($en['x.' . $x['id']] ?? '')))) . '"';
        $inner = '<span class="n">' . $n . '</span><span class="nm">' . $nm . '</span><span class="s">' . $get($isLive ? 'wl.st.live' : 'wl.st.planned') . '</span>';
        $list .= $isLive ? '<li' . $attrs . '><a class="live" href="' . ab_h($url($lang, $x['page']) . ($x['page'] === 'world' ? '?w=' . (int)$x['id'] : '')) . '">' . $inner . '</a></li>' : '<li' . $attrs . '><div class="x">' . $inner . '</div></li>';
      }
      $list .= '</ul></section>';
    }
    $blocks['WORLD_TALLY'] = $tally; $blocks['WORLD_CHIPS'] = $chips; $blocks['WORLD_LIST'] = $list;
  }

  /* ---- head: fonts, hreflang, canonical, Open Graph, remembered-language redirect ---- */
  $fam = 'family=Instrument+Serif:ital@0;1&family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;500';
  foreach (AB_FONTS[$lang] ?? [] as $f) $fam .= '&family=' . str_replace(' ', '+', $f) . ':wght@400;500;600';
  $head = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
        /* loaded without blocking the first paint; text shows in a fallback font for a moment (display=swap) */
        . '<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?' . ab_h($fam) . '&amp;display=swap" onload="this.onload=null;this.rel=\'stylesheet\'">'
        . '<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?' . ab_h($fam) . '&amp;display=swap"></noscript>';
  $alts = [];
  foreach (AB_LANGS as $l => $_) { $alts[$l] = $url($l, $page); }
  /* a single world lives at worlds/w/?w=N, so its canonical and hreflang carry the query and are added by world-page.ts */
  if ($page !== 'notfound' && $page !== 'world') {
    foreach (AB_LANGS as $l => $_) $head .= "\n" . '<link rel="alternate" hreflang="' . AB_LANGS[$l][2] . '" href="' . ab_h($base ? $base . '/' . ab_prefix($l) . AB_PAGES[$page] : $alts[$l]) . '">';
    $head .= "\n" . '<link rel="alternate" hreflang="x-default" href="' . ab_h($base ? $base . '/' . AB_PAGES[$page] : $alts['en']) . '">';
    if ($base) $head .= "\n" . '<link rel="canonical" href="' . ab_h($base . '/' . $path) . '"><meta property="og:url" content="' . ab_h($base . '/' . $path) . '">';
  }
  $mk = AB_META[$page];
  $head .= "\n" . '<meta property="og:site_name" content="' . ab_h($brand) . '"><meta property="og:title" content="' . ab_h(strip_tags($sub($get("$mk.title")))) . '"><meta property="og:description" content="' . ab_h(strip_tags($sub($get("$mk.desc")))) . '"><meta property="og:locale" content="' . str_replace('-', '_', $loc) . '"><meta property="og:type" content="website">';
  /* share image: social networks need an absolute URL, so it is written only when the site address is known */
  if ($base) $head .= '<meta property="og:image" content="' . ab_h($base . '/assets/abidora-share.jpg') . '"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="' . ab_h($brand) . '"><meta name="twitter:card" content="summary_large_image">';
  else $head .= '<meta name="twitter:card" content="summary">';
  /* structured data that describes only what is really on the page */
  $ld = [];
  $abs = fn(string $p) => $base ? $base . '/' . ab_prefix($lang) . AB_PAGES[$p] : null;
  $pname = fn(string $p) => trim(explode('·', strip_tags($sub($get(AB_META[$p] . '.title'))))[0]);
  if ($page === 'home') {
    $ws = ['@type' => 'WebSite', 'name' => $brand, 'description' => strip_tags($sub($get('meta.desc'))), 'inLanguage' => AB_LANGS[$lang][2], 'publisher' => ['@type' => 'Organization', 'name' => $brand, 'founder' => ['@type' => 'Person', 'name' => $owner]]];
    if ($base) { $ws['url'] = $abs('home'); $ws['publisher']['url'] = $base . '/'; }
    $ld[] = $ws;
  } elseif ($base && !in_array($page, ['notfound', 'world'], true)) {
    $trail = ['home'];
    if ($page === 'galaxy') $trail[] = 'worlds';
    if ($page === 'themes' || $page === 'cursors') $trail[] = 'studio';
    $trail[] = $page; $items = [];
    foreach ($trail as $i => $p) $items[] = ['@type' => 'ListItem', 'position' => $i + 1, 'name' => $p === 'home' ? $brand : $pname($p), 'item' => $abs($p)];
    $ld[] = ['@type' => 'BreadcrumbList', 'itemListElement' => $items];
  }
  foreach ($ld as $x) $head .= "\n" . '<script type="application/ld+json">' . json_encode(['@context' => 'https://schema.org'] + $x, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) . '</script>';
  if ($lang === 'en' && $page !== 'notfound') {
    $head .= "\n<script>(function(){try{var p=localStorage.getItem('abidora.lang'),k=sessionStorage.getItem('abidora.keep'),A=" . json_encode($alts, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) . ";if(!k&&p&&p!=='en'&&A[p]&&!/[?&]lang=en/.test(location.search))location.replace(A[p]+location.hash)}catch(e){}})()</script>";
  }

  /* ---- language menu: a disclosure button + real links (works without JavaScript) ---- */
  $menu = '<button class="mono lgb" id="lgb" type="button" aria-expanded="false" aria-controls="lgm" aria-label="' . AB_CODES[$lang] . ' · ' . ab_h(strip_tags($get('a.lang'))) . ' (' . ab_h($lname) . ')">' . AB_CODES[$lang] . '</button>';
  $panel = '<div id="lgm" class="lgm" hidden><p class="mono">' . $get('lang.title') . '</p><ul>';
  foreach (AB_LANGS as $l => [$n, $ldir]) {
    $panel .= '<li><a href="' . ab_h($alts[$l]) . '" hreflang="' . AB_LANGS[$l][2] . '" lang="' . AB_LANGS[$l][2] . '" dir="' . $ldir . '" data-l="' . $l . '"' . ($l === $lang ? ' aria-current="true"' : '') . '><span class="mono">' . AB_CODES[$l] . '</span>' . ab_h($n) . '</a></li>';
  }
  $panel .= '</ul>' . ($lang !== 'en' && (($d['_meta']['status'] ?? '') !== 'reviewed') ? '<p class="note">' . $get('lang.note') . '</p>' : '') . '</div>';

  /* ---- strings for scripts ---- */
  $js = [];
  foreach ($en as $k => $v) {
    if ($k === '_meta') continue;
    if (strncmp($k, 'js.', 3) === 0) { $js[substr($k, 3)] = $sub($get($k)); continue; }
    foreach (AB_JSKEYS[$page] ?? [] as $pre) if (strncmp($k, $pre, strlen($pre)) === 0) $js[$k] = $sub($get($k));
  }
  $boot = ['lang' => $lang, 'loc' => $loc, 'rtl' => $dir === 'rtl', 'root' => $root, 'page' => $page, 'alts' => $alts, 'hl' => array_map(fn($L) => $L[2], AB_LANGS), 'urls' => $urls,
           'brand' => $brand, 'owner' => $owner, 'dict' => $js, 'langs' => array_keys(AB_LANGS)];

  /* ---- per-script typography ---- */
  $lc = '';
  if (isset(AB_FONTS[$lang])) {
    [$sf, $ss] = AB_FONTS[$lang];
    $lc .= ":root{--serif:'Instrument Serif','$sf',Georgia,serif;--sans:'Inter Tight','$ss',system-ui,sans-serif;--mono:'$ss','JetBrains Mono',ui-monospace,monospace}"
         . "body .ttl h1{line-height:1.16;padding:.06em 0 .1em}body.home .ttl h1{font-size:clamp(64px,13vw,200px)}body .gtl h1{line-height:1.16;padding:.06em 0 .1em}body.galaxy .gtl h1{font-size:clamp(52px,7.5vw,128px)}.idx .t,.xs .nm{line-height:1.3}"
         . "body .wlh h1,body .fh h1,body .nfm h1{line-height:1.12;padding:.06em 0 .08em}body .wlh h1{font-size:clamp(56px,10vw,170px)}"
         . "h1,h2,h3,.idx .t,.mani p,.big{letter-spacing:0!important}.mani p,h2{line-height:1.25}.mono,.chips2 button,.pill2{text-transform:none;letter-spacing:.02em}";
  }
  if ($lang === 'ar') $lc .= '*{letter-spacing:0!important}';
  if ($dir === 'rtl') $lc .= "#pre .cnt{left:auto;right:var(--gx)}#pre .lbl{right:auto;left:var(--gx);text-align:left}.hero .meta{left:auto;right:var(--gx)}.ctrl{right:auto;left:var(--gx)}.scr{left:auto;right:var(--gx)}"
         . ".arw svg{transform:scaleX(-1)}.dots button i{left:auto;right:0}.reel .bar2 i{left:auto;right:0}.mq span{margin-right:0;margin-left:28px}.mq div{animation-direction:reverse}"
         . ".idx a:hover .t{transform:translateX(-24px)}.lgm{right:auto;left:var(--gx)}";

  $rep = [
    '{{LANG}}' => $loc, '{{DIR}}' => $dir, '{{ROOT}}' => $root, '{{LANGCODE}}' => $lang,
    '{{HEAD}}' => $head, '{{LANGMENU}}' => $menu, '{{LANGPANEL}}' => $panel, '{{LANGCSS}}' => $lc,
    '{{RUNTIME}}' => '<script>window.I18N_BOOT=' . json_encode($boot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) . ';</script>',
    '{{json:BRAND}}' => trim(json_encode($brand, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG), '"'),
  ];
  foreach ($blocks as $k => $v) $rep['{{' . $k . '}}'] = $v;
  $out = strtr($tpl, $rep);
  $out = preg_replace_callback('/\{\{U:([a-z]+)\}\}/', fn($m) => ab_h($urls[$m[1]] ?? './'), $out);
  $out = preg_replace_callback('/\{\{attr:([a-z0-9_.\-]+)\}\}/i', fn($m) => ab_h(html_entity_decode(strip_tags($sub($get($m[1]))), ENT_QUOTES, 'UTF-8')), $out);
  $out = preg_replace_callback('/\{\{json:([a-z0-9_.\-]+)\}\}/i', fn($m) => trim(json_encode(html_entity_decode(strip_tags($sub($get($m[1]))), ENT_QUOTES, 'UTF-8'), JSON_UNESCAPED_UNICODE | JSON_HEX_TAG), '"'), $out);
  $out = preg_replace_callback('/\{\{([a-z][a-z0-9_.\-]*)\}\}/', fn($m) => $sub($get($m[1])), $out);
  /* Astro emits root-absolute asset URLs; make them relative so the site works in any folder */
  $out = str_replace(['="/_astro/', "='/_astro/"], ['="' . $root . '_astro/', "='" . $root . '_astro/'], $out);
  $out = str_replace(['{brand}', '{owner}', '{owner1}', '{owner2}'], [ab_h($brand), ab_h($owner), ab_h($owner1), ab_h($owner2)], $out);
  return str_replace('</html>', "<!-- lang:$lang missing:$missing -->\n</html>", $out);
}

/**
 * Write every page in every language as static files under $out (default: the public folder).
 * Returns a report: files written and missing-key counts.
 */
function ab_publish_all(array $opt = []): array {
  $out = rtrim((string)($opt['out'] ?? AB_PUB), '/');
  $base = rtrim((string)($opt['base'] ?? ''), '/');
  $rep = ['files' => 0, 'missing' => []];
  foreach (AB_LANGS as $l => $_) {
    ab_dict($l, true);
    foreach (AB_PAGES as $p => $path) {
      $html = ab_render($l, $p, $opt);
      if (preg_match('/missing:(\d+) -->/', $html, $m)) $rep['missing'][$l] = ($rep['missing'][$l] ?? 0) + (int)$m[1];
      $dir = $out . '/' . ab_prefix($l) . $path;
      if (!is_dir($dir) && !mkdir($dir, 0755, true)) throw new RuntimeException("Cannot create $dir");
      ab_write($dir . 'index.html', $html); $rep['files']++;
    }
  }
  /* sitemap + robots: a sitemap needs absolute URLs, so it is written only when the site address is known */
  $robots = "User-agent: *\nDisallow: /_abidora/\nDisallow: /admin/\nDisallow: /api/\n";
  if ($base) {
    $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">' . "\n";
    $locs = [];
    foreach (AB_PAGES as $p => $path) if ($p !== 'notfound' && $p !== 'world') $locs[] = $path;
    foreach (ab_json(AB_DIR . '/data/experiences.json')['items'] ?? [] as $x) if (($x['status'] ?? '') === 'live' && ($x['page'] ?? '') === 'world') $locs[] = AB_PAGES['world'] . '?w=' . (int)$x['id'];
    foreach ($locs as $path) {
      foreach (AB_LANGS as $l => $_) {
        $xml .= ' <url><loc>' . ab_h($base . '/' . ab_prefix($l) . $path) . '</loc>';
        foreach (AB_LANGS as $l2 => $L) $xml .= '<xhtml:link rel="alternate" hreflang="' . $L[2] . '" href="' . ab_h($base . '/' . ab_prefix($l2) . $path) . '"/>';
        $xml .= '<xhtml:link rel="alternate" hreflang="x-default" href="' . ab_h($base . '/' . $path) . '"/></url>' . "\n";
      }
    }
    ab_write($out . '/sitemap.xml', $xml . "</urlset>\n"); $rep['files']++;
    $basePath = (string)(parse_url($base, PHP_URL_PATH) ?? '');
    $robots = str_replace('Disallow: /', 'Disallow: ' . $basePath . '/', $robots) . "\nSitemap: $base/sitemap.xml\n";
  }
  ab_write($out . '/robots.txt', $robots);
  ab_write_knowledge($out, $base);
  return $rep;
}

/** atomic write: never leaves a half-written page if the disk fills up */
function ab_write(string $file, string $data): void {
  $tmp = $file . '.tmp' . bin2hex(random_bytes(3));
  if (file_put_contents($tmp, $data, LOCK_EX) === false || !rename($tmp, $file)) { @unlink($tmp); throw new RuntimeException("Cannot write $file"); }
}

/**
 * Knowledge base for the future Abidora AI guide (private, never served to the web).
 * Rebuilt on every publish from the experience catalogue + dictionaries, so a world that goes live
 * is known to the assistant automatically. One file per language: _abidora/storage/knowledge/xx.json
 */
function ab_write_knowledge(string $out, string $base): void {
  $dir = $out . '/_abidora/storage/knowledge'; if (!is_dir($dir)) @mkdir($dir, 0755, true); if (!is_dir($dir)) return;
  $xs = ab_json($out . '/_abidora/data/experiences.json'); $site = ab_json($out . '/_abidora/data/site.json');
  foreach (AB_LANGS as $l => $L) {
    $en = ab_dict('en'); $d = ab_dict($l);
    $g = fn(string $k) => html_entity_decode(strip_tags(str_replace(['{brand}', '{owner}'], [$site['brand'] ?? 'Abidora', $site['name'] ?? ''], (string)(($d[$k] ?? '') !== '' ? $d[$k] : ($en[$k] ?? '')))), ENT_QUOTES | ENT_HTML5, "UTF-8");
    $url = fn(string $p) => ($base ? $base . '/' : '/') . ab_prefix($l) . AB_PAGES[$p];
    $items = [];
    foreach ($xs['items'] ?? [] as $x) {
      $live = ($x['status'] ?? '') === 'live' && isset(AB_PAGES[$x['page'] ?? '']);
      $items[] = ['id' => $x['id'], 'name' => $g('x.' . $x['id']), 'category' => $g('cat.' . $x['cat']), 'status' => $live ? 'live' : 'planned', 'url' => $live ? $url($x['page']) . ($x['page'] === 'world' ? '?w=' . (int)$x['id'] : '') : null,
                  'summary' => $live ? ($x['page'] === 'world' ? $g('wd.' . $x['id']) : $g(AB_META[$x['page']] . '.desc')) : null];
    }
    $pages = [];
    foreach (AB_PAGES as $p => $_) if ($p !== 'notfound') $pages[] = ['page' => $p, 'title' => $g(AB_META[$p] . '.title'), 'description' => $g(AB_META[$p] . '.desc'), 'url' => $url($p)];
    $kb = ['lang' => $l, 'generated' => gmdate('c'), 'brand' => $site['brand'] ?? 'Abidora', 'tagline' => $g('meta.title'), 'about' => $g('meta.desc'),
           'founder' => ['name' => $site['name'] ?? '', 'role' => $g('fd.title'), 'identity' => [$g('fd.id1'), $g('fd.id2')], 'tagline' => $g('fd.tagline'), 'about' => array_map($g, ['fd.about.lead', 'fd.about.p1', 'fd.about.p3']), 'philosophy' => array_map($g, ['fd.ph.1', 'fd.ph.2', 'fd.ph.3']), 'vision' => array_map($g, ['fd.vs.1', 'fd.vs.2', 'fd.vs.3', 'fd.vs.4', 'fd.vs.5', 'fd.vs.6']), 'projects_actual' => [['name' => 'Abidora', 'text' => $g('fd.pj.1')], ['name' => 'Boostnix Media', 'text' => $g('fd.pj.2')], ['name' => $g('fd.pj.3.name'), 'text' => $g('fd.pj.3')], ['name' => 'FitAI (concept)', 'text' => $g('fd.pj.4')]], 'interests_not_expertise' => array_map(fn($gk) => ['group' => $g("in.g.$gk"), 'items' => array_map(fn($i) => $g("in.$gk.$i"), range(1, ['ai' => 10, 'web' => 9, 'cr' => 9, 'pr' => 8, 'fu' => 8][$gk]))], ['ai', 'web', 'cr', 'pr', 'fu']), 'note' => 'Only founder-approved public information. Never invent personal details. Interests are areas of exploration, never present them as expertise or professional experience.'],
           'pages' => $pages, 'experiences' => $items, 'languages' => array_map(fn($x) => $x[0], AB_LANGS)];
    ab_write("$dir/$l.json", json_encode($kb, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
  }
}
