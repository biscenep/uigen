import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotDir = path.join(__dirname, '..', 'screenshots');

const browser = await chromium.launch({ headless: false, slowMo: 50 });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

await page.goto('http://localhost:3000');
await page.waitForLoadState('networkidle');

// Click the Code tab
const codeTab = page.locator('button, [role="tab"]').filter({ hasText: 'Code' }).first();
await codeTab.click();
await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(screenshotDir, '06-code-view.png'), fullPage: true });
console.log('Screenshot 6: code view');

await browser.close();
console.log('Done');
