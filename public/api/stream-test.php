<?php
/* Streaming check for the owner: open /api/stream-test.php. If the lines appear one by one (about every half second),
   streaming works on this server. If all 8 appear together after about 4 seconds, the host is buffering answers. */
declare(strict_types=1);
@ini_set('zlib.output_compression', '0'); @ini_set('output_buffering', '0');
while (ob_get_level() > 0) @ob_end_flush();
if (function_exists('apache_setenv')) @apache_setenv('no-gzip', '1');
header('Content-Type: text/plain; charset=utf-8'); header('Cache-Control: no-cache, no-transform'); header('X-Accel-Buffering: no'); header('X-Robots-Tag: noindex');
echo str_repeat(' ', 2048) . "\n"; @flush();
$t0 = microtime(true);
for ($i = 1; $i <= 8; $i++) { echo 'line ' . $i . ' at ' . number_format(microtime(true) - $t0, 1) . " s\n"; @flush(); usleep(500000); }
echo "done\n";
