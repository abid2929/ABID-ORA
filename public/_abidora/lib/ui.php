<?php
/* Minimal shared look for owner-facing pages (installer + admin). English only, by design: owner tools. */
function ab_page_head(string $title): void {
  ab_security_headers(); header('Content-Type: text/html; charset=utf-8'); header('Cache-Control: no-store');
  echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>' . ab_h($title) . '</title><style>
:root{--ink:#0d0c0b;--ink2:#171614;--bone:#ece6dc;--mute:#8d877d;--line:rgba(236,230,220,.14);--sig:#e8b46a;--ok:#7cc49a;--bad:#ff8a7a;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:var(--ink);color:var(--bone);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:var(--sig)}h1{font:400 34px/1.1 Georgia,serif;margin:0 0 6px}h2{font:400 22px/1.2 Georgia,serif;margin:28px 0 10px}
.w{max-width:1100px;margin:0 auto;padding:28px 18px 80px}.mono{font:11px/1.4 ui-monospace,Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--mute)}
.card{background:var(--ink2);border:1px solid var(--line);border-radius:14px;padding:18px;margin:14px 0}
label{display:block;margin:12px 0 4px;color:var(--mute);font-size:13px}input,select,textarea{width:100%;background:var(--ink);color:var(--bone);border:1px solid var(--line);border-radius:9px;padding:10px;font:inherit}
textarea{min-height:64px;resize:vertical}input:focus,select:focus,textarea:focus{outline:1px solid var(--sig)}
button,.btn{display:inline-block;background:var(--bone);color:var(--ink);border:0;border-radius:999px;padding:10px 18px;font:600 14px system-ui;cursor:pointer;text-decoration:none}
.btn2{background:transparent;color:var(--bone);border:1px solid var(--line)}button.danger{background:var(--bad)}
table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{font-weight:500;color:var(--mute);font-size:13px}
.ok{color:var(--ok)}.bad{color:var(--bad)}.warn{color:var(--sig)}.note{color:var(--mute);font-size:13px}
.flash{padding:12px 14px;border-radius:10px;margin:12px 0;border:1px solid var(--line)}.flash.ok{border-color:var(--ok)}.flash.bad{border-color:var(--bad)}
nav.tabs{display:flex;flex-wrap:wrap;gap:6px;margin:16px 0}nav.tabs a{color:var(--bone);text-decoration:none;border:1px solid var(--line);border-radius:999px;padding:7px 13px;font-size:14px}nav.tabs a.on{background:var(--bone);color:var(--ink)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}.stat b{display:block;font:400 34px Georgia,serif}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.k{font:12px ui-monospace,Menlo,monospace;color:var(--mute);word-break:break-all}
.en{color:#cfc8bc;font-size:14px}.miss{background:rgba(255,138,122,.07)}
@media(max-width:700px){.tt td{display:block;border:0;padding:4px 0}.tt tr{display:block;border-bottom:1px solid var(--line);padding:10px 0}.tt thead{display:none}}
</style></head><body><div class="w">';
}
function ab_page_foot(): void { echo '</div></body></html>'; }
