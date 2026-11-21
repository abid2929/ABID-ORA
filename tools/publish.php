<?php
/* Build step: move Astro's page templates into dist/_abidora/templates, then render all languages.
   Usage: php tools/publish.php --dist dist [--base https://example.com/abidora] [--export] */
declare(strict_types=1);
$o = getopt('', ['dist:', 'base::', 'export']);
$dist = realpath($o['dist'] ?? 'dist') ?: exit("dist folder not found\n");
define('AB_DIR', "$dist/_abidora"); define('AB_PUB', $dist);
require AB_DIR . '/lib/render.php';
@mkdir(AB_DIR . '/templates', 0755, true);
$moved = 0;
foreach (glob("$dist/tpl/*/index.html") as $f) { rename($f, AB_DIR . '/templates/' . basename(dirname($f)) . '.html'); rmdir(dirname($f)); $moved++; }
if (is_dir("$dist/tpl")) @rmdir("$dist/tpl");
foreach (array_keys(AB_PAGES) as $p) if (!is_file(AB_DIR . "/templates/$p.html")) exit("template missing: $p\n");
$r = ab_publish_all(['base' => $o['base'] ?? '', 'export' => isset($o['export'])]);
echo "templates moved: $moved, files written: {$r['files']}\n";
foreach ($r['missing'] as $l => $n) if ($n) echo "  $l: $n strings fell back to English\n";
