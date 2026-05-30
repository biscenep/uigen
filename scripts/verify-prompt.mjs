import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotDir = path.join(__dirname, '..', 'screenshots');

const browser = await chromium.launch({ headless: false, slowMo: 50 });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

await page.goto('http://localhost:3000');
await page.waitForLoadState('networkidle');

const input = page.locator('textarea, input[type="text"]').first();
await input.fill('Create a user profile card component');
await input.press('Enter');
console.log('Submitted, waiting for generation...');

for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(5000);
  const text = await page.innerText('body');
  if (!text.toLowerCase().includes('generating')) {
    console.log('Generation appears complete at', (i + 1) * 5, 's');
    break;
  }
  console.log(`Still generating... (${(i + 1) * 5}s)`);
}

await page.waitForTimeout(3000);
await page.screenshot({ path: path.join(screenshotDir, '07-profile-card-result.png'), fullPage: true });
console.log('Screenshot 7: profile card result');

const iframeEl = page.locator('iframe').first();
try {
  await iframeEl.screenshot({ path: path.join(screenshotDir, '08-profile-card-preview.png') });
  console.log('Screenshot 8: preview only');
} catch (e) {
  console.log('iframe screenshot failed:', e.message);
}

await browser.close();
