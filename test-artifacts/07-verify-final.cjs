const { chromium } = require('C:/Users/Drew/Desktop/NeoTerritory/Codebase/Frontend/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACTS = 'C:/Users/Drew/Desktop/NeoTerritory/test-artifacts';

const CPP_SOURCE = `#include <string>

class ConfigSingleton {
public:
    static ConfigSingleton& getInstance() {
        static ConfigSingleton instance;
        return instance;
    }
    ConfigSingleton(const ConfigSingleton&) = delete;
    ConfigSingleton& operator=(const ConfigSingleton&) = delete;
private:
    ConfigSingleton() = default;
};

class ShapeFactory {
public:
    void* make(const std::string& kind) {
        if (kind == "car") return nullptr;
        return nullptr;
    }
};
`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  try {
    console.log('Step 1: Navigate and pick available user');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

    const btn = page.locator('button:not([disabled])[data-claimed="false"]').first();
    const userName = await btn.textContent();
    console.log('  Using user:', userName.trim());
    await btn.click();
    await page.waitForTimeout(2000);

    // Accept consent: check checkbox then click Continue
    const checkbox = page.locator('input[type="checkbox"]').first();
    if (await checkbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await checkbox.check();
      await page.waitForTimeout(300);
    }
    const continueBtn = page.locator('button:has-text("Continue")').first();
    if (await continueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await continueBtn.click();
      await page.waitForTimeout(2000);
      console.log('  Accepted consent');
    }

    // Click Submit tab
    console.log('Step 2: Click Submit tab');
    await page.locator('[role="tab"]:has-text("Submit")').click();
    await page.waitForTimeout(500);

    // Fill textarea
    console.log('Step 3: Fill C++ source');
    const textarea = page.locator('textarea').first();
    await textarea.fill(CPP_SOURCE);

    // Click Run analysis
    console.log('Step 4: Click Run analysis');
    await page.locator('button:has-text("Run analysis")').click();

    // Wait for .src-line to appear (analysis complete)
    console.log('Step 5: Waiting for annotated source (up to 30s)...');
    await page.waitForSelector('.src-line', { timeout: 30000 });
    await page.waitForTimeout(2000);

    // Switch to Annotated Source tab
    const annotatedTab = page.locator('[role="tab"]:has-text("Annotated Source")');
    if (await annotatedTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await annotatedTab.click();
      await page.waitForTimeout(1500);
    }

    // Screenshot
    await page.screenshot({ path: path.join(ARTIFACTS, '07-final.png'), fullPage: true });
    console.log('  Screenshot: 07-final.png');

    // Query computed styles
    console.log('Step 6: Querying computed styles');
    const styleData = await page.evaluate(() => {
      const getStyles = (selector) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const cs = window.getComputedStyle(el);
        return {
          backgroundColor: cs.backgroundColor,
          borderLeftColor: cs.borderLeftColor,
          boxShadow: cs.boxShadow,
          classes: el.className,
          dataLine: el.getAttribute('data-line'),
        };
      };

      const allLines = document.querySelectorAll('.src-line');
      const colorMixOccurrences = [];
      allLines.forEach(el => {
        const cs = window.getComputedStyle(el);
        const vals = [
          cs.backgroundColor, cs.borderLeftColor, cs.boxShadow,
          cs.backgroundImage, cs.border, cs.outline
        ];
        vals.forEach(v => {
          if (v && v.includes('color-mix')) {
            colorMixOccurrences.push({ value: v, classes: el.className });
          }
        });
        const inline = el.getAttribute('style') || '';
        if (inline.includes('color-mix')) {
          colorMixOccurrences.push({ value: 'INLINE: ' + inline, classes: el.className });
        }
      });

      const dataLines = Array.from(allLines).map(el => {
        const cs = window.getComputedStyle(el);
        return {
          line: el.getAttribute('data-line'),
          classes: el.className,
          bg: cs.backgroundColor,
          shadow: cs.boxShadow,
          borderLeft: cs.borderLeftColor,
        };
      });

      return {
        line5: getStyles('.src-line[data-line="5"]'),
        line17: getStyles('.src-line[data-line="17"]'),
        line18: getStyles('.src-line[data-line="18"]'),
        line19: getStyles('.src-line[data-line="19"]'),
        colorMixOccurrences,
        dataLines,
        totalLines: allLines.length,
      };
    });

    console.log('\n=== STYLE RESULTS ===');
    console.log('Total .src-line elements:', styleData.totalLines);
    console.log('\nLine 5 (Singleton getInstance):');
    console.log(JSON.stringify(styleData.line5, null, 2));
    console.log('\nLine 17 (Factory make body):');
    console.log(JSON.stringify(styleData.line17, null, 2));
    console.log('\nLine 18:');
    console.log(JSON.stringify(styleData.line18, null, 2));
    console.log('\ncolor-mix occurrences:', styleData.colorMixOccurrences.length);
    styleData.colorMixOccurrences.forEach(o => console.log('  ', JSON.stringify(o)));

    console.log('\nAll data-line computed styles:');
    styleData.dataLines.forEach(l => {
      const shadow = (l.shadow || '').substring(0, 80);
      console.log(`  line=${l.line} bg=${l.bg} borderLeft=${l.borderLeft} shadow=${shadow}`);
    });

    fs.writeFileSync(path.join(ARTIFACTS, '07-css-results.json'), JSON.stringify(styleData, null, 2));

    // PASS/FAIL
    const blue = '59, 130, 246';
    const red = '239, 68, 68';

    const l5 = styleData.line5;
    const singletonBlue = l5 && (
      (l5.backgroundColor || '').includes(blue) ||
      (l5.borderLeftColor || '').includes(blue) ||
      (l5.boxShadow || '').includes(blue)
    );

    const lf = styleData.line17 || styleData.line18 || styleData.line19;
    const factoryRed = lf && (
      (lf.backgroundColor || '').includes(red) ||
      (lf.borderLeftColor || '').includes(red) ||
      (lf.boxShadow || '').includes(red)
    );

    const noColorMix = styleData.colorMixOccurrences.length === 0;

    console.log('\n=== PASS/FAIL ===');
    console.log(`Singleton blue (line 5): ${singletonBlue ? 'PASS' : 'FAIL'}`);
    console.log(`Factory red (line 17/18/19): ${factoryRed ? 'PASS' : 'FAIL'}`);
    console.log(`No color-mix in computed styles: ${noColorMix ? 'PASS' : 'FAIL'}`);
    console.log(`OVERALL: ${singletonBlue && factoryRed && noColorMix ? 'PASS' : 'FAIL'}`);

  } catch (err) {
    console.error('ERROR:', err.message);
    await page.screenshot({ path: path.join(ARTIFACTS, '07-error-final.png') });
  }

  await browser.close();
})();
