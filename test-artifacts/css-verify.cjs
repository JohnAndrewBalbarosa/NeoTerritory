const { chromium } = require('C:/Users/Drew/Desktop/NeoTerritory/Codebase/Frontend/node_modules/playwright');
const { writeFileSync } = require('fs');

const CPP_SAMPLE = `#include <iostream>
#include <memory>

// Singleton pattern
class DatabaseConnection {
private:
    static DatabaseConnection* instance;
    DatabaseConnection() {}
public:
    static DatabaseConnection* getInstance() {
        if (!instance) instance = new DatabaseConnection();
        return instance;
    }
    void query(const std::string& sql) {}
};
DatabaseConnection* DatabaseConnection::instance = nullptr;

// Factory pattern
class Shape {
public:
    virtual void draw() = 0;
    virtual ~Shape() {}
};

class Circle : public Shape {
public:
    void draw() override { std::cout << "Circle" << std::endl; }
};

class Square : public Shape {
public:
    void draw() override { std::cout << "Square" << std::endl; }
};

class ShapeFactory {
public:
    static Shape* createShape(const std::string& type) {
        if (type == "circle") return new Circle();
        if (type == "square") return new Square();
        return nullptr;
    }
};

int main() {
    DatabaseConnection* db = DatabaseConnection::getInstance();
    Shape* s = ShapeFactory::createShape("circle");
    s->draw();
    delete s;
    return 0;
}`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });

  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(800);

  // 1. Pick first available seat
  const availableSeat = page.locator('.tester-chip[data-claimed="false"]:not([disabled])');
  const seatText = await availableSeat.first().textContent();
  console.log('Claiming seat:', seatText);
  await availableSeat.first().click();
  await page.waitForTimeout(800);

  // 2. Handle consent: check checkbox then click Continue
  const checkbox = page.locator('.consent-check input[type="checkbox"], input[type="checkbox"]').first();
  if (await checkbox.count() > 0) {
    console.log('Checking consent checkbox...');
    await checkbox.check();
    await page.waitForTimeout(300);
    const continueBtn = page.locator('button:has-text("Continue")');
    console.log('Clicking Continue...');
    await continueBtn.click();
    await page.waitForTimeout(1000);
  }

  // 3. Wait for main app textarea / code editor
  console.log('Waiting for code input...');
  await page.screenshot({ path: 'C:/Users/Drew/Desktop/NeoTerritory/test-artifacts/06-step2-postlogin.png', fullPage: true });

  const domSnap = await page.evaluate(() => document.body.innerHTML.slice(0, 3000));
  console.log('Post-consent DOM:\n', domSnap.slice(0, 2000));

  // Find the code input area
  const codeInput = page.locator('textarea, [contenteditable="true"], .cm-content, .CodeMirror-code').first();
  await codeInput.waitFor({ state: 'visible', timeout: 15000 });
  console.log('Filling code input...');
  await codeInput.click();
  await page.keyboard.press('Control+a');

  // Fill textarea directly
  await page.locator('#code-input').fill(CPP_SAMPLE);
  await page.waitForTimeout(300);

  // 4. Click Analyze / Submit
  console.log('Clicking analyze...');
  const analyzeBtn = page.locator('#analyze-btn, button:has-text("Run analysis"), button:has-text("Analyze"), button[type="submit"]');
  await analyzeBtn.first().waitFor({ state: 'visible', timeout: 5000 });
  await analyzeBtn.first().click();

  // 5. Wait for annotation lines
  console.log('Waiting for annotation lines...');
  await page.waitForSelector('.src-line', { timeout: 40000 });
  await page.waitForTimeout(2000);

  // 6. Click Annotated Source tab if visible
  try {
    const annotatedTab = page.locator('[role="tab"]:has-text("Annotated"), [role="tab"]:has-text("Source"), button:has-text("Annotated Source")');
    if (await annotatedTab.count() > 0) {
      console.log('Clicking annotated source tab...');
      await annotatedTab.first().click();
      await page.waitForTimeout(800);
    }
  } catch(e) {}

  // 7. Screenshot
  const screenshotPath = 'C:/Users/Drew/Desktop/NeoTerritory/test-artifacts/06-after-css-fix.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('Screenshot:', screenshotPath);

  // 8. Inspect computed styles
  const results = await page.evaluate(() => {
    const lines = document.querySelectorAll('.src-line.has-annotation, .class-scope-start');
    const out = [];
    for (const el of lines) {
      const cs = window.getComputedStyle(el);
      out.push({
        classes: el.className,
        backgroundColor: cs.backgroundColor,
        borderLeftColor: cs.borderLeftColor,
        boxShadow: cs.boxShadow,
        text: (el.textContent || '').slice(0, 80).trim()
      });
      if (out.length >= 12) break;
    }
    return out;
  });

  console.log('\n=== Computed Styles ===');
  console.log(JSON.stringify(results, null, 2));

  writeFileSync(
    'C:/Users/Drew/Desktop/NeoTerritory/test-artifacts/css-results.json',
    JSON.stringify(results, null, 2)
  );

  // 9. Analysis
  const colorMixFound = results.some(r =>
    (r.backgroundColor + r.borderLeftColor + r.boxShadow).includes('color-mix')
  );
  const nonTransparent = results.filter(r =>
    r.backgroundColor && r.backgroundColor !== 'rgba(0, 0, 0, 0)' && r.backgroundColor !== 'transparent'
  );
  const withInsetShadow = results.filter(r => r.boxShadow && r.boxShadow.includes('inset'));
  const singletonLines = results.filter(r =>
    r.backgroundColor.includes('59, 130, 246') || r.boxShadow.includes('59, 130, 246')
  );
  const factoryLines = results.filter(r =>
    r.backgroundColor.includes('239, 68, 68') || r.boxShadow.includes('239, 68, 68')
  );

  console.log('\n=== SUMMARY ===');
  console.log('Total annotated lines found:', results.length);
  console.log('color-mix in computed styles:', colorMixFound ? 'YES -> FAIL' : 'NO -> PASS');
  console.log('Non-transparent backgrounds:', `${nonTransparent.length}/${results.length}`);
  console.log('Lines with inset box-shadow:', `${withInsetShadow.length}/${results.length}`);
  console.log('Singleton (blue #3b82f6) lines:', singletonLines.length);
  console.log('Factory (red #ef4444) lines:', factoryLines.length);

  if (singletonLines.length > 0) {
    const s = singletonLines[0];
    console.log('\nSingleton sample:');
    console.log('  backgroundColor:', s.backgroundColor);
    console.log('  borderLeftColor:', s.borderLeftColor);
    console.log('  boxShadow:', s.boxShadow.slice(0, 120));
  }
  if (factoryLines.length > 0) {
    const f = factoryLines[0];
    console.log('\nFactory sample:');
    console.log('  backgroundColor:', f.backgroundColor);
    console.log('  borderLeftColor:', f.borderLeftColor);
    console.log('  boxShadow:', f.boxShadow.slice(0, 120));
  }

  console.log('\nOVERALL:', (!colorMixFound && results.length > 0) ? 'PASS' : 'FAIL');

  await browser.close();
})();
