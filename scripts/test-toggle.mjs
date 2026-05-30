import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotDir = path.join(__dirname, '..', 'screenshots');

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

page.on('console', msg => { if (msg.type() === 'error') console.log('JS ERROR:', msg.text()); });

await page.goto('http://localhost:3000');
await page.waitForLoadState('networkidle');

// Check initial state: Preview should be active
const previewTab = page.locator('[role="tab"]').filter({ hasText: 'Preview' });
const codeTab = page.locator('[role="tab"]').filter({ hasText: 'Code' });

const previewState = await previewTab.getAttribute('data-state');
const codeState = await codeTab.getAttribute('data-state');
console.log('Initial: Preview=' + previewState + ', Code=' + codeState);

if (previewState !== 'active') console.log('FAIL: Expected Preview to be active initially, got: ' + previewState);
if (codeState !== 'inactive') console.log('FAIL: Expected Code to be inactive initially, got: ' + codeState);

await page.screenshot({ path: path.join(screenshotDir, 'toggle-01-preview-active.png') });
console.log('Screenshot: toggle-01-preview-active.png');

// Check content: preview iframe should be visible
const previewContent = page.locator('iframe');
const previewVisible = await previewContent.isVisible().catch(() => false);
console.log('Preview iframe visible: ' + previewVisible);
if (!previewVisible) console.log('FAIL: Preview iframe should be visible in preview mode');

// Click Code tab
console.log('\nClicking Code tab...');
await codeTab.click();
await page.waitForTimeout(500);

const previewState2 = await previewTab.getAttribute('data-state');
const codeState2 = await codeTab.getAttribute('data-state');
console.log('After clicking Code: Preview=' + previewState2 + ', Code=' + codeState2);
if (codeState2 !== 'active') console.log('FAIL: Expected Code to be active, got: ' + codeState2);
if (previewState2 !== 'inactive') console.log('FAIL: Expected Preview to be inactive, got: ' + previewState2);

// Check iframe is gone
const previewVisibleAfter = await previewContent.isVisible().catch(() => false);
console.log('Preview iframe visible after switching to Code: ' + previewVisibleAfter);
if (previewVisibleAfter) console.log('FAIL: Preview iframe should NOT be visible in code mode');

await page.screenshot({ path: path.join(screenshotDir, 'toggle-02-code-active.png') });
console.log('Screenshot: toggle-02-code-active.png');

// Click back to Preview tab
console.log('\nClicking Preview tab...');
await previewTab.click();
await page.waitForTimeout(500);

const previewState3 = await previewTab.getAttribute('data-state');
const codeState3 = await codeTab.getAttribute('data-state');
console.log('After clicking Preview: Preview=' + previewState3 + ', Code=' + codeState3);
if (previewState3 !== 'active') console.log('FAIL: Expected Preview to be active again, got: ' + previewState3);
if (codeState3 !== 'inactive') console.log('FAIL: Expected Code to be inactive, got: ' + codeState3);

// Check iframe is back
const previewVisibleBack = await previewContent.isVisible().catch(() => false);
console.log('Preview iframe visible after switching back to Preview: ' + previewVisibleBack);
if (!previewVisibleBack) console.log('FAIL: Preview iframe should be visible again in preview mode');

await page.screenshot({ path: path.join(screenshotDir, 'toggle-03-back-to-preview.png') });
console.log('Screenshot: toggle-03-back-to-preview.png');

// Rapid toggle test for intermittent issues
console.log('\nRapid toggle test (5x)...');
let rapidFails = 0;
for (let i = 0; i < 5; i++) {
  await codeTab.click();
  await page.waitForTimeout(100);
  const st = await codeTab.getAttribute('data-state');
  if (st !== 'active') { console.log('FAIL rapid #' + i + ' Code not active: ' + st); rapidFails++; }

  await previewTab.click();
  await page.waitForTimeout(100);
  const sp = await previewTab.getAttribute('data-state');
  if (sp !== 'active') { console.log('FAIL rapid #' + i + ' Preview not active: ' + sp); rapidFails++; }
}
if (rapidFails === 0) console.log('Rapid toggle: all passed');

await browser.close();
console.log('\nAll toggle tests done!');
