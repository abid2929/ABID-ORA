const { chromium } = require('playwright');
const fs = require('fs');
const U = 'http://127.0.0.1:8790/ai/', OUT = process.argv[2], LOG = __dirname + '/fake.log';
const streams = () => fs.readFileSync(LOG, 'utf8').split('\n').filter((l) => l.includes('"stream"')).length;
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const bodies = []; p.on('request', (r) => { if (r.url().includes('api/ai.php') && r.method() === 'POST') bodies.push(JSON.parse(r.postData())); });
  p.on('dialog', (d) => d.accept());
  await p.goto(U); await p.waitForFunction(() => navigator.serviceWorker.ready.then(() => true)); await p.waitForTimeout(3500);
  const cdp = await ctx.newCDPSession(p);
  const man = await cdp.send('Page.getAppManifest');
  ok(!man.errors.length, 'manifest parses: ' + JSON.stringify(man.errors));
  const inst = await cdp.send('Page.getInstallabilityErrors').catch((e) => ({ err: e.message }));
  ok(inst.installabilityErrors && !inst.installabilityErrors.length, 'installable: ' + JSON.stringify(inst));
  const keys = await p.evaluate(async () => (await (await caches.open('abidora-ai-shell')).keys()).map((r) => r.url.replace(location.origin, '')));
  ok(keys.includes('/ai/') && keys.some((k) => k.startsWith('/_astro/')), 'offline copy saved: ' + keys.length + ' files');
  /* online message */
  await p.fill('#aiin', 'hello online'); await p.keyboard.press('Enter');
  await p.waitForSelector('.aim.a .aibody:has-text("done")'); ok(true, 'online answer arrives');
  /* offline: reload from the saved copy */
  await ctx.setOffline(true);
  await p.reload(); await p.waitForSelector('#aimsgs');
  await p.evaluate(() => { const b = [...document.querySelectorAll('.aic')][0]; b && b.click(); });
  ok(await p.isVisible('#aioff'), 'offline bar shows after offline reload');
  ok((await p.locator('.aim.u').count()) === 1, 'old chat opens offline');
  await p.fill('#aiin', 'first offline question'); await p.keyboard.press('Enter');
  await p.fill('#aiin', 'second offline question'); await p.keyboard.press('Enter');
  ok((await p.locator('.aim.u.wait').count()) === 2, 'two messages wait with status');
  await p.screenshot({ path: OUT + '/pwa-offline-phone.png' });
  await p.reload(); await p.evaluate(() => { const b = [...document.querySelectorAll('.aic')][0]; b && b.click(); });
  ok((await p.locator('.aim.u.wait').count()) === 2, 'waiting messages survive refresh while offline');
  ok((await p.textContent('#aioff')).includes('2'), 'offline bar counts waiting: ' + (await p.textContent('#aioff')));
  /* reconnect */
  const s0 = streams();
  await ctx.setOffline(false);
  await p.waitForFunction(() => document.querySelectorAll('.aim.a').length === 3 && !document.querySelector('.aim.u.wait'), null, { timeout: 20000 });
  const order = await p.evaluate(() => JSON.parse(localStorage.getItem('abidora.ai.chats'))[0].msgs.map((m) => m.role[0] + ':' + m.content.slice(0, 22)));
  ok(order.join('|').startsWith('u:hello online|a:') && order[2] === 'u:first offline question' && order[3][0] === 'a' && order[4] === 'u:second offline questio' && order[5][0] === 'a', 'sent in order: ' + order.join(' | '));
  ok(streams() - s0 === 4, 'each waiting message answered once (model calls: ' + (streams() - s0) + ', the free-model race uses 2 per answer)');
  await p.screenshot({ path: OUT + '/pwa-synced-phone.png' });
  /* duplicate prevention: a message that was "sending" when the page closed, already answered on the server */
  const cid = bodies[bodies.length - 1].cid;
  await p.evaluate((cid) => { const cs = JSON.parse(localStorage.getItem('abidora.ai.chats')); const m = cs[0].msgs; m.pop(); m[m.length - 1].q = 's'; m[m.length - 1].qt = Date.now(); m[m.length - 1].cid = cid; localStorage.setItem('abidora.ai.chats', JSON.stringify(cs)); }, cid);
  const s1 = streams();
  await p.reload(); await p.waitForFunction(() => { const m = JSON.parse(localStorage.getItem('abidora.ai.chats'))[0].msgs; return m.length === 6 && !m.some((x) => x.q); }, null, { timeout: 15000 });
  ok(streams() === s1, 'repeat of an answered message is replayed, not answered again (model calls: ' + (streams() - s1) + ')');
  /* two tabs, one waiting message: sent once */
  await ctx.setOffline(true);
  await p.fill('#aiin', 'third offline question'); await p.keyboard.press('Enter');
  const p2 = await ctx.newPage(); await p2.goto(U).catch(() => {}); await p2.waitForTimeout(800);
  const s2 = streams(); await ctx.setOffline(false);
  await p.waitForFunction(() => { const m = JSON.parse(localStorage.getItem('abidora.ai.chats'))[0].msgs; return m.length === 2 && !m.some((x) => x.q); }, null, { timeout: 20000 }).catch(async (e) => {
    for (const q of [p, p2]) console.log('DBG', q.url(), await q.evaluate(() => ({ on: navigator.onLine, ls: JSON.parse(localStorage.getItem('abidora.ai.chats'))[0].msgs.map((m) => m.role + (m.q || '') + ':' + m.content.slice(0, 14)), bar: document.querySelector('#aioff').textContent, hid: document.querySelector('#aioff').hidden })));
    throw e; });
  await p.waitForTimeout(2500);
  const n8 = await p.evaluate(() => JSON.parse(localStorage.getItem('abidora.ai.chats'))[0].msgs.length);
  const p2n = await p2.evaluate(() => document.querySelectorAll('.aic').length);
  ok(streams() - s2 === 2 && n8 === 2 && p2n === 2, 'two open tabs: sent once (model calls ' + (streams() - s2) + ', messages ' + n8 + ')');
  await p2.close();
  /* Data Saver */
  await p.click('#aimenu'); await p.waitForTimeout(700); await p.screenshot({ path: OUT + '/pwa-side-phone.png' });
  await p.click('.aisb [data-panel="aiappp"]', { timeout: 5000 }).catch(async (e) => { console.log('FAIL side button click: ' + e.message.split('\n')[0]); await p.evaluate(() => document.querySelector('.aisb [data-panel="aiappp"]').click()); });
  await p.check('#ailite'); await p.click('#aiappp .aiclose');
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.documentElement.classList.contains('lite')), 'Data Saver on');
  ok(!(await p.isVisible('#aicallb')) && await p.isVisible('#ailitep'), 'call hidden, Data Saver pill shown');
  await p.fill('#aiin', 'make a picture of a red car'); await p.keyboard.press('Enter');
  await p.waitForSelector('.aim.a.err');
  ok(bodies[bodies.length - 1].lite === 1 && !('previmg' in bodies[bodies.length - 1]), 'request marked lite');
  ok((await p.textContent('.aim.a.err')).includes('Data Saver'), 'picture refused with a clear note');
  const lr = await p.evaluate(async () => { const r = await (await caches.open('abidora-ai-flags')).match(new URL('../', location.href).href + '__lite'); return r && r.text(); });
  ok(lr === '1', 'service worker told about Data Saver');
  await p.reload(); ok(await p.evaluate(() => document.documentElement.classList.contains('lite')), 'Data Saver remembered after reload');
  await p.click('[data-panel="aiappp"] >> nth=1'); await p.waitForTimeout(500);
  await p.screenshot({ path: OUT + '/pwa-panel-phone.png' });
  ok(/\d/.test(await p.textContent('#aiuse')), 'storage line: ' + (await p.textContent('#aiuse')));
  /* delete everything */
  await p.click('#aiwipe'); await p.waitForLoadState('load'); await p.waitForTimeout(800);
  const left = await p.evaluate(async () => ({ ls: Object.keys(localStorage).filter((k) => k.startsWith('abidora.ai.')), c: (await caches.keys()).filter((k) => k.startsWith('abidora-ai-')) }));
  ok(!left.ls.length, 'wipe: chats/settings gone ' + JSON.stringify(left));
  ok(errs.length === 0, 'no page errors ' + JSON.stringify(errs));
  await b.close();
})().catch((e) => { console.log('CRASH', e); process.exit(1); });
