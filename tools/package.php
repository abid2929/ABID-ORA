<?php
// Build the upload zip from dist/: everything except templates and any private config/lock files.
$dist = realpath($argv[1] ?? 'dist'); $out = $argv[2] ?? 'abidora.zip';
if (!$dist) { fwrite(STDERR, "dist not found\n"); exit(1); }
@unlink($out);
$z = new ZipArchive(); $z->open($out, ZipArchive::CREATE);
$it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dist, FilesystemIterator::SKIP_DOTS));
$n = 0;
foreach ($it as $f) {
  $rel = str_replace('\\', '/', substr($f->getPathname(), strlen($dist) + 1));
  if (preg_match('#^tpl/|^_abidora/storage/(config\.php|installed\.lock|database\.sqlite|backups/)#', $rel)) continue;
  $z->addFile($f->getPathname(), $rel); $n++;
}
$z->close();
echo "packed $n files into $out (" . round(filesize($out) / 1048576, 2) . " MB)\n";
