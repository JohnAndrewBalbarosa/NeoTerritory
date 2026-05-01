// E2E smoke test: verify Singleton blue + Factory red computed styles
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

  const results = {};

  try {
    // Step 1: Navigate to app
    console.log('Step 1: Navigating to http://localhost:5173');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(ARTIFACTS, '07-step1-landing.png') });

    // Step 2: Log in as Devcon10
    console.log('Step 2: Logging in as Devcon10');
    // Try to find login form fields
    const usernameField = page.locator('input[name="username"], input[placeholder*="user" i], input[type="text"]').first();
    const passwordField = page.locator('input[type="password"]').first();

    if (await usernameField.isVisible({ timeout: 5000 }).catch(() => false)) {
      await usernameField.fill('Devcon10');
      await passwordField.fill('Devcon10');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
    } else {
      console.log('  No login form visible, may already be on dashboard');
    }
    await page.screenshot({ path: path.join(ARTIFACTS, '07-step2-postlogin.png') });

    // Step 3: Accept any consent/modal
    console.log('Step 3: Accepting consent if present');
    const consentBtn = page.locator('button:has-text("Accept"), button:has-text("agree"), button:has-text("Continue"), button:has-text("OK")').first();
    if (await consentBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await consentBtn.click();
      await page.waitForTimeout(1000);
    }

    // Step 4: Find textarea or file input to submit source
    console.log('Step 4: Submitting C++ source');

    // Try textarea first
    let submitted = false;
    const textarea = page.locator('textarea').first();
    if (await textarea.isVisible({ timeout: 5000 }).catch(() => false)) {
      await textarea.fill(CPP_SOURCE);
      await page.screenshot({ path: path.join(ARTIFACTS, '07-step3-filled.png') });

      // Look for analyze/submit button
      const analyzeBtn = page.locator('button:has-text("Analyze"), button:has-text("Submit"), button:has-text("Run"), button[type="submit"]').first();
      if (await analyzeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await analyzeBtn.click();
        submitted = true;
        console.log('  Clicked analyze button');
      }
    }

    if (!submitted) {
      console.log('  No textarea found, trying file upload approach');
      const fileInput = page.locator('input[type="file"]').first();
      if (await fileInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Write temp file
        const tmpFile = path.join(ARTIFACTS, 'tmp_source.cpp');
        fs.writeFileSync(tmpFile, CPP_SOURCE);
        await fileInput.setInputFiles(tmpFile);
        await page.waitForTimeout(1000);
        const analyzeBtn = page.locator('button:has-text("Analyze"), button:has-text("Submit"), button:has-text("Run"), button[type="submit"]').first();
        if (await analyzeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await analyzeBtn.click();
          submitted = true;
        }
      }
    }

    // Step 5: Wait for Annotated Source tab to appear and switch to it
    console.log('Step 5: Waiting for Annotated Source tab');
    await page.waitForTimeout(5000); // allow AI processing

    // Try clicking annotated source tab
    const annotatedTab = page.locator('[role="tab"]:has-text("Annotated"), [role="tab"]:has-text("Source"), button:has-text("Annotated"), button:has-text("Source View")').first();
    if (await annotatedTab.isVisible({ timeout: 10000 }).catch(() => false)) {
      await annotatedTab.click();
      await page.waitForTimeout(2000);
      console.log('  Switched to Annotated Source tab');
    } else {
      console.log('  No explicit tab found, checking current state');
    }

    await page.screenshot({ path: path.join(ARTIFACTS, '07-final.png') });
    console.log('  Screenshot saved: 07-final.png');

    // Step 6: Inspect computed styles
    console.log('Step 6: Inspecting computed styles');

    const styleData = await page.evaluate(() => {
      const results = {
        singletonLines: [],
        factoryLines: [],
        colorMixFound: false,
        allSrcLines: [],
      };

      const allSrcLines = document.querySelectorAll('.src-line');
      results.totalSrcLines = allSrcLines.length;

      // Check all computed styles for color-mix
      allSrcLines.forEach((el) => {
        const cs = window.getComputedStyle(el);
        const bg = cs.backgroundColor;
        const shadow = cs.boxShadow;
        const borderLeft = cs.borderLeftColor;
        if (bg.includes('color-mix') || shadow.includes('color-mix') || borderLeft.includes('color-mix')) {
          results.colorMixFound = true;
        }
        results.allSrcLines.push({ bg, shadow, borderLeft, classes: el.className });
      });

      // Find lines inside Singleton scope
      const singletonScoped = document.querySelectorAll('.src-line.singleton, .src-line[data-pattern*="singleton" i], .src-line[class*="singleton" i]');
      singletonScoped.forEach(el => {
        const cs = window.getComputedStyle(el);
        results.singletonLines.push({
          classes: el.className,
          backgroundColor: cs.backgroundColor,
          boxShadow: cs.boxShadow,
          borderLeftColor: cs.borderLeftColor,
        });
      });

      // Find lines inside Factory scope
      const factoryScoped = document.querySelectorAll('.src-line.factory, .src-line[data-pattern*="factory" i], .src-line[class*="factory" i]');
      factoryScoped.forEach(el => {
        const cs = window.getComputedStyle(el);
        results.factoryLines.push({
          classes: el.className,
          backgroundColor: cs.backgroundColor,
          boxShadow: cs.boxShadow,
          borderLeftColor: cs.borderLeftColor,
        });
      });

      // Also check scope-start chips
      const scopeStarts = document.querySelectorAll('.src-line.class-scope-start');
      results.scopeStartChips = [];
      scopeStarts.forEach(el => {
        const cs = window.getComputedStyle(el);
        // Can't get ::before pseudo-element bg via JS, but check element itself
        results.scopeStartChips.push({
          classes: el.className,
          backgroundColor: cs.backgroundColor,
          borderLeftColor: cs.borderLeftColor,
          boxShadow: cs.boxShadow,
          textContent: el.textContent.trim().substring(0, 60),
        });
      });

      // Check inline styles for color-mix
      const allElements = document.querySelectorAll('.src-line, .src-line.has-annotation, .src-line.class-scope-start');
      allElements.forEach(el => {
        const inlineStyle = el.getAttribute('style') || '';
        if (inlineStyle.includes('color-mix')) {
          results.colorMixFound = true;
        }
      });

      // Get style tag content to check for color-mix usage
      const stylesheets = Array.from(document.styleSheets);
      let cssText = '';
      stylesheets.forEach(sheet => {
        try {
          const rules = Array.from(sheet.cssRules || []);
          rules.forEach(rule => { cssText += rule.cssText; });
        } catch(e) {}
      });
      results.colorMixInCSS = cssText.includes('color-mix(');

      return results;
    });

    console.log('\n=== STYLE INSPECTION RESULTS ===');
    console.log('Total .src-line elements:', styleData.totalSrcLines);
    console.log('color-mix found in computed/inline styles:', styleData.colorMixFound);
    console.log('color-mix found in CSS rules:', styleData.colorMixInCSS);
    console.log('\nSingleton-scoped lines:', styleData.singletonLines.length);
    styleData.singletonLines.slice(0, 3).forEach((l, i) => {
      console.log(`  [${i}] bg=${l.backgroundColor} shadow=${l.boxShadow} borderLeft=${l.borderLeftColor}`);
    });
    console.log('\nFactory-scoped lines:', styleData.factoryLines.length);
    styleData.factoryLines.slice(0, 3).forEach((l, i) => {
      console.log(`  [${i}] bg=${l.backgroundColor} shadow=${l.shadow} borderLeft=${l.borderLeftColor}`);
    });
    console.log('\nScope-start chips:', styleData.scopeStartChips.length);
    styleData.scopeStartChips.forEach((c, i) => {
      console.log(`  [${i}] classes=${c.classes} bg=${c.backgroundColor} borderLeft=${c.borderLeftColor}`);
    });

    // Sample first few src-line styles regardless
    console.log('\nFirst 5 .src-line computed styles:');
    styleData.allSrcLines.slice(0, 5).forEach((l, i) => {
      console.log(`  [${i}] classes="${l.classes}" bg=${l.bg} borderLeft=${l.borderLeft}`);
    });

    // Save results JSON
    fs.writeFileSync(path.join(ARTIFACTS, '07-css-results.json'), JSON.stringify(styleData, null, 2));
    console.log('\nFull results saved to 07-css-results.json');

    // PASS/FAIL evaluation
    console.log('\n=== PASS/FAIL EVALUATION ===');

    const blueRgb = 'rgb(59, 130, 246)';
    const redRgb = 'rgb(239, 68, 68)';

    let singletonPass = styleData.singletonLines.some(l =>
      l.backgroundColor.includes('59, 130, 246') ||
      l.boxShadow.includes('59, 130, 246') ||
      l.borderLeftColor.includes('59, 130, 246')
    );

    let factoryPass = styleData.factoryLines.some(l =>
      l.backgroundColor.includes('239, 68, 68') ||
      (l.boxShadow && l.boxShadow.includes('239, 68, 68')) ||
      l.borderLeftColor.includes('239, 68, 68')
    );

    // If no scoped classes found, check scope-start chips at minimum
    if (styleData.singletonLines.length === 0) {
      singletonPass = styleData.scopeStartChips.some(c =>
        c.backgroundColor.includes('59, 130, 246') ||
        c.borderLeftColor.includes('59, 130, 246') ||
        c.boxShadow.includes('59, 130, 246')
      );
      console.log('Singleton check via scope-start chips (no direct singleton lines found)');
    }

    const noColorMixPass = !styleData.colorMixFound;

    console.log(`Singleton blue tint: ${singletonPass ? 'PASS' : 'FAIL'}`);
    console.log(`Factory red tint: ${factoryPass ? 'PASS' : 'FAIL'}`);
    console.log(`No color-mix in computed styles: ${noColorMixPass ? 'PASS' : 'FAIL'}`);
    console.log(`color-mix in CSS rules (expected if old rules linger): ${styleData.colorMixInCSS}`);

    results.singletonPass = singletonPass;
    results.factoryPass = factoryPass;
    results.noColorMixPass = noColorMixPass;
    results.styleData = styleData;

  } catch (err) {
    console.error('Test error:', err.message);
    await page.screenshot({ path: path.join(ARTIFACTS, '07-error.png') });
    results.error = err.message;
  }

  await browser.close();
  return results;
})();
