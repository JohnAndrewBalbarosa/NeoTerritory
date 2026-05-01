import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

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

  // Navigate to app
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

  // Handle consent/landing
  const consentBtn = page.locator('button:has-text("I Agree"), button:has-text("Agree"), button:has-text("Accept"), button:has-text("Continue")');
  if (await consentBtn.count() > 0) {
    await consentBtn.first().click();
    await page.waitForTimeout(500);
  }

  // Look for token/API key input
  const tokenInput = page.locator('input[type="password"], input[placeholder*="key" i], input[placeholder*="token" i], input[placeholder*="api" i]');
  if (await tokenInput.count() > 0) {
    await tokenInput.first().fill('Devcon10');
    const tokenBtn = page.locator('button:has-text("Submit"), button:has-text("Set"), button:has-text("Save"), button[type="submit"]');
    if (await tokenBtn.count() > 0) await tokenBtn.first().click();
    await page.waitForTimeout(500);
  }

  // Find the code textarea
  const codeArea = page.locator('textarea').first();
  await codeArea.waitFor({ state: 'visible', timeout: 10000 });
  await codeArea.fill(CPP_SAMPLE);

  // Submit / Analyze
  const analyzeBtn = page.locator('button:has-text("Analyze"), button:has-text("Submit"), button:has-text("Run")');
  await analyzeBtn.first().click();

  // Wait for annotated source tab to appear and be active
  await page.waitForSelector('.src-line, [class*="src-line"]', { timeout: 30000 });
  await page.waitForTimeout(1000);

  // Screenshot
  await page.screenshot({ path: 'test-artifacts/06-after-css-fix.png', fullPage: true });

  // Inspect annotation lines
  const results = await page.evaluate(() => {
    const lines = document.querySelectorAll('.src-line.has-annotation, .class-scope-start');
    const out = [];
    for (const el of lines) {
      const cs = getComputedStyle(el);
      out.push({
        classes: el.className,
        backgroundColor: cs.backgroundColor,
        borderLeftColor: cs.borderLeftColor,
        boxShadow: cs.boxShadow,
        text: el.textContent?.slice(0, 60).trim()
      });
      if (out.length >= 6) break;
    }
    return out;
  });

  writeFileSync('test-artifacts/css-results.json', JSON.stringify(results, null, 2));
  console.log('Computed styles for annotated lines:');
  console.log(JSON.stringify(results, null, 2));

  // Check for color-mix in computed styles
  const colorMixFound = results.some(r =>
    (r.backgroundColor + r.borderLeftColor + r.boxShadow).includes('color-mix')
  );
  console.log('\ncolor-mix in computed styles:', colorMixFound ? 'YES (FAIL)' : 'NO (PASS)');

  // Validate non-transparent backgrounds
  const singletonLines = results.filter(r => r.classes.includes('singleton') || r.backgroundColor.includes('59, 130, 246') || r.backgroundColor.includes('59,130,246'));
  const factoryLines = results.filter(r => r.classes.includes('factory') || r.backgroundColor.includes('239, 68, 68') || r.backgroundColor.includes('239,68,68'));

  console.log('\nSingleton lines found:', singletonLines.length);
  console.log('Factory lines found:', factoryLines.length);

  // Check all annotated lines have non-transparent backgrounds
  const nonTransparentCount = results.filter(r => r.backgroundColor && r.backgroundColor !== 'rgba(0, 0, 0, 0)' && r.backgroundColor !== 'transparent').length;
  console.log('\nLines with non-transparent background:', nonTransparentCount, '/', results.length);

  const insetShadowCount = results.filter(r => r.boxShadow && r.boxShadow.includes('inset')).length;
  console.log('Lines with inset box-shadow:', insetShadowCount, '/', results.length);

  await browser.close();
})();
