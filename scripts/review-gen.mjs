import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotDir = path.join(__dirname, '..', 'screenshots');

const { mkdirSync } = await import('fs');
mkdirSync(screenshotDir, { recursive: true });

const browser = await chromium.launch({ headless: false, slowMo: 50 });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

await page.goto('http://localhost:3000');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: path.join(screenshotDir, '01-initial.png'), fullPage: true });
console.log('Screenshot 1: initial page');

// Find the chat input and submit a component request
const input = page.locator('textarea, input[type="text"]').first();
await input.fill('Create a dashboard card showing monthly revenue stats with a chart sparkline');
await page.screenshot({ path: path.join(screenshotDir, '02-typed.png'), fullPage: true });
console.log('Screenshot 2: typed prompt');

await input.press('Enter');
console.log('Submitted prompt, waiting for generation...');

// Wait for streaming to begin
await page.waitForTimeout(3000);
await page.screenshot({ path: path.join(screenshotDir, '03-generating.png'), fullPage: true });
console.log('Screenshot 3: generating...');

// Wait up to 90s for the preview to settle
let settled = false;
for (let i = 0; i < 18; i++) {
  await page.waitForTimeout(5000);
  const text = await page.innerText('body');
  if (!text.includes('Generating') && !text.includes('...')) {
    settled = true;
    break;
  }
  console.log(`Still generating... (${(i + 1) * 5}s)`);
}

await page.waitForTimeout(4000);
await page.screenshot({ path: path.join(screenshotDir, '04-result.png'), fullPage: true });
console.log('Screenshot 4: final result');

// Try to screenshot just the preview iframe area
const iframe = page.frameLocator('iframe').first();
try {
  const iframeEl = page.locator('iframe').first();
  await iframeEl.screenshot({ path: path.join(screenshotDir, '05-preview-only.png') });
  console.log('Screenshot 5: preview frame only');
} catch (e) {
  console.log('Could not screenshot iframe separately:', e.message);
}

await browser.close();
console.log('Done. Screenshots saved to', screenshotDir);
