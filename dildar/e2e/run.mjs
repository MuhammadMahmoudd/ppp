// Full end-to-end check on Cloudflare's local runtime:
// build the web app → fresh local D1 → `wrangler dev` → two browsers pair, chat, play, snap.
// Needs Playwright with Chromium (npx playwright install chromium).
import { execSync, spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const env = { ...process.env, EXPO_NO_TELEMETRY: '1', CI: '1', WRANGLER_SEND_METRICS: 'false', EXPO_PUBLIC_API_URL: '' };
const sh = (cmd) => execSync(cmd, { stdio: 'inherit', env });

sh('npx expo export --platform web --output-dir dist');
rmSync('.wrangler/state', { recursive: true, force: true });
sh('npx wrangler d1 migrations apply dildar --local');
const dev = spawn('npx', ['wrangler', 'dev', '--port', '8787', '--ip', '127.0.0.1'], { env, stdio: 'ignore', detached: true });
try {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch('http://127.0.0.1:8787/api/health');
      if (r.ok) break;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  sh('node e2e/flow.cjs');
} finally {
  try {
    process.kill(-dev.pid);
  } catch {
    // already stopped
  }
}
