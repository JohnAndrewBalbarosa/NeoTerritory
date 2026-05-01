const { chromium } = require('C:/Users/Drew/Desktop/NeoTerritory/Codebase/Frontend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });

  console.log('Navigating...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);

  // Snapshot the DOM structure
  const bodyHtml = await page.evaluate(() => document.body.innerHTML.slice(0, 4000));
  console.log('=== Body HTML (first 4000 chars) ===');
  console.log(bodyHtml);

  await page.screenshot({ path: 'C:/Users/Drew/Desktop/NeoTerritory/test-artifacts/dom-inspect-01.png', fullPage: true });

  await browser.close();
})();
