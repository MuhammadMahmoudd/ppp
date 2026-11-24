const { chromium } = require('playwright');
// Two browsers play the couple against `wrangler dev`. Run via: npm run test:e2e
const path = require('path');
const URL = process.env.E2E_URL || 'http://127.0.0.1:8787/';
const OUT = process.env.E2E_OUT || path.join(__dirname, 'screenshots');
require('fs').mkdirSync(OUT, { recursive: true });
const T = 20000;
const TAP_TO_OPEN = 'دەستی لێبدە بۆ کردنەوە';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function user(browser, name) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['camera', 'microphone'] });
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', (e) => p.errs.push('pageerror: ' + e.message));
  p.on('console', (m) => m.type() === 'error' && p.errs.push('console: ' + m.text()));
  p.on('dialog', (d) => d.accept());
  await p.goto(URL, { waitUntil: 'networkidle' });
  p.uname = name;
  return p;
}
const shot = (p, n) => p.screenshot({ path: path.join(OUT, `${p.uname}-${n}.png`) });

async function signUp(p, email) {
  await p.getByText('هەژمارت نییە؟ دروستی بکە').click();
  await p.locator('input').nth(0).fill(email);
  await p.locator('input').nth(1).fill('correct horse 1');
  await p.getByText('هەژمار دروستکردن', { exact: true }).click();
  await p.getByText('دواتر', { exact: true }).waitFor({ timeout: T }); // key backup step
  await shot(p, '1-keys');
  await p.getByText('دواتر', { exact: true }).click();
  await p.getByText('من تەمەنم ١٨ ساڵ', { exact: false }).waitFor({ timeout: T });
  await p.getByText('من تەمەنم ١٨ ساڵ', { exact: false }).click();
}

async function profile(p, name) {
  await p.getByText('خۆت بناسێنە').waitFor({ timeout: T });
  await p.locator('input').nth(0).fill(name);
  await shot(p, '3-profile');
  await p.getByText('تەواو', { exact: true }).click();
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const A = await user(browser, 'A');
  const B = await user(browser, 'B');
  try {
    await signUp(A, 'ari@x.test');
    log('A signed up');
    await A.getByText('من کۆدەکە دروست دەکەم').click();
    const codeText = await A.getByText(/^\d{3} \d{3}$/).textContent({ timeout: T });
    const code = codeText.replace(/\s/g, '');
    log('A code', code);
    await shot(A, '2-code');

    await signUp(B, 'bahar@x.test');
    log('B signed up');
    await B.getByText('کۆدم هەیە').click();
    await B.locator('input').last().fill(code);
    await B.getByText('پەیوەستبوون', { exact: true }).last().click();
    log('B redeemed');

    await profile(B, 'Bahar');
    await profile(A, 'Ari');
    log('profiles set');
    await A.waitForTimeout(2500);
    await shot(A, '4-home');
    await shot(B, '4-home');

    // A opens chat and sends a message
    await A.locator('[aria-label="چات"]').last().click();
    await B.locator('[aria-label="چات"]').last().click();
    const box = A.getByPlaceholder('نامەیەک بنووسە…');
    await box.waitFor({ timeout: T });
    await box.fill('سڵاو گیانەکەم ❤️');
    await box.press('Enter');
    log('A sent');
    await B.getByText('سڵاو گیانەکەم ❤️').waitFor({ timeout: T });
    log('B RECEIVED the message');
    // B replies with the send button; A sees it live
    const boxB = B.getByPlaceholder('نامەیەک بنووسە…');
    await boxB.fill('منیش بیرت دەکەم 🌙');
    await B.getByLabel('ناردن').first().click();
    await A.getByText('منیش بیرت دەکەم 🌙').waitFor({ timeout: T });
    log('A RECEIVED the reply');
    await A.getByText('بینرا').first().waitFor({ timeout: T }).then(() => log('A sees "seen" receipt'), () => log('no seen receipt shown'));
    await A.waitForTimeout(1500);
    await shot(A, '5-chat');
    await shot(B, '5-chat');

    // ── live game: A starts Truth or Dare, B joins from the invite banner ──
    await A.locator('[aria-label="یاری"]').last().click();
    await A.getByText('ڕاستی یان بوێری').first().click();
    await A.waitForURL(/\/games\//, { timeout: T });
    log('A is in the room', A.url().split('/').pop().slice(0, 8));
    await B.getByText('بەشداربوون', { exact: true }).waitFor({ timeout: T });
    log('B got the game invite banner');
    await B.getByText('بەشداربوون', { exact: true }).click();
    await B.waitForURL(/\/games\//, { timeout: T });
    log('B joined the room');
    await A.waitForTimeout(1500);
    await shot(A, '6-room');
    await shot(B, '6-room');
    const before = new Set((await A.innerText('body')).split('\n'));
    await A.getByText('ڕاستی', { exact: true }).first().click();
    await A.waitForTimeout(1200);
    const fresh = (await A.innerText('body')).split('\n').filter((l) => l.trim().length > 12 && !before.has(l));
    log('A drew:', fresh[0]);
    const bText = await B.innerText('body');
    log(fresh.some((l) => bText.includes(l)) ? 'B sees the SAME card' : 'B does NOT show the card');
    await shot(A, '7-card');
    await shot(B, '7-card');
    await A.getByLabel('گەڕانەوە').first().click();
    await B.getByLabel('گەڕانەوە').first().click();
    await A.waitForURL((u) => !/\/games\//.test(u.toString()), { timeout: T });
    await B.waitForURL((u) => !/\/games\//.test(u.toString()), { timeout: T });

    // ── snap: A takes a photo and sends it, B opens it once ──
    await A.locator('[aria-label="کامێرا"]').last().click();
    await A.getByLabel('وێنە بگرە — ڕایبگرە بۆ ڤیدیۆ').first().click({ timeout: T });
    await A.locator('[aria-label*="Bahar"]').first().click({ timeout: T });
    log('A sent a snap');
    await B.locator('[aria-label="کامێرا"]').last().click();
    const stack = B.getByLabel(TAP_TO_OPEN).first();
    await stack.waitFor({ timeout: T });
    log('B sees the incoming snap');
    await stack.click();
    await B.waitForTimeout(2500);
    await shot(B, '8-snap-view');
    await B.waitForTimeout(6000); // 5 s timer → auto-close
    await shot(B, '9-after-snap');
    log((await B.getByLabel(TAP_TO_OPEN).count()) === 0 ? 'snap is gone after viewing' : 'snap still listed');
  } catch (e) {
    log('FAILED:', e.message.split('\n')[0]);
    process.exitCode = 1;
    await shot(A, 'fail');
    await shot(B, 'fail');
  }
  for (const p of [A, B]) if (p.errs.length) process.exitCode = 1;
  for (const p of [A, B]) log(p.uname, 'errors:', p.errs.length ? '\n  ' + p.errs.slice(0, 8).join('\n  ') : 'none');
  await browser.close();
})();
