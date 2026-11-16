const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium, devices } = require(process.env.NEXTPHASE_PLAYWRIGHT || 'playwright');
const { createPreviewServer, pagesMount, startPagesCheck } = require('./serve-preparedness.cjs');

const server = createPreviewServer({ mount: pagesMount });

async function checkContrast(page) {
  const minimum = await page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    function luminance(token) {
      const hex = css.getPropertyValue(token).trim();
      const [r, g, b] = hex.slice(1).match(/../g).map(channel => {
        const value = parseInt(channel, 16) / 255;
        return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
      });
      return r * .2126 + g * .7152 + b * .0722;
    }
    function contrast(ink, surface) {
      const numbers = [luminance(ink), luminance(surface)];
      return (Math.max(...numbers) + .05) / (Math.min(...numbers) + .05);
    }
    const colors = ['--ink', '--muted', '--leaf', '--amber'];
    const surfaces = ['--bg', '--card', '--layer', '--glass-surface', '--glass-raised',
      '--field-surface', '--reading-start', '--reading-end', '--selected-surface'];
    return Math.min(...colors.flatMap(color => surfaces.map(surface => contrast(color, surface))),
      contrast('--ink', '--primary'), contrast('--ink', '--secondary'));
  });
  assert.ok(minimum >= 4.5, 'Expected at least 4.5:1 for the checked pairs, got ' + minimum);
  return minimum.toFixed(2);
}

async function checkGlass(page) {
  const { supported, top, dialog, expanded, fallback } = await page.evaluate(() => {
    const sheet = [...document.styleSheets].find(item => item.href?.endsWith('/theme.css'));
    const index = [...sheet.cssRules].findIndex(rule => rule.conditionText?.includes('backdrop-filter'));
    const rule = sheet.cssRules[index].cssText;
    const modal = document.querySelector('dialog');
    const blur = selector => getComputedStyle(document.querySelector(selector)).backdropFilter;
    const paint = selector => {
      const style = getComputedStyle(document.querySelector(selector));
      return { background: style.backgroundColor, reflection: style.backgroundImage, blur: style.backdropFilter };
    };
    const top = paint('.top');
    const dialog = paint('dialog');
    const former = modal.dataset.expanded;
    modal.dataset.expanded = 'true';
    const expanded = blur('dialog');
    modal.dataset.expanded = former;
    sheet.deleteRule(index);
    const fallback = { top: paint('.top'), dialog: paint('dialog') };
    sheet.insertRule(rule, index);
    return {
      supported: CSS.supports('backdrop-filter', 'blur(1px)'),
      top, dialog, expanded, fallback,
    };
  });
  assert.equal(expanded, 'none');
  assert.equal(fallback.top.background, 'rgb(16, 36, 58)');
  assert.equal(fallback.dialog.background, 'rgb(16, 34, 55)');
  for (const mode of [top, dialog, fallback.top, fallback.dialog]) assert.match(mode.reflection, /gradient/);
  assert.equal(fallback.top.blur, 'none');
  assert.equal(fallback.dialog.blur, 'none');
  if (supported) {
    assert.equal(top.blur, 'blur(12px)');
    assert.equal(dialog.blur, 'blur(12px)');
    assert.notEqual(top.background, fallback.top.background);
    assert.notEqual(dialog.background, fallback.dialog.background);
  }
}

async function checkOlam(page, url, label) {
  page.setDefaultTimeout(10_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const dialog = page.locator('dialog');
  const tap = name => page.getByRole('button', { name, exact: typeof name === 'string' }).click();
  const heading = name => dialog.getByRole('heading', { name, exact: true }).waitFor();
  const pick = name => dialog.getByRole('radio', { name, exact: true }).check();
  const active = id => page.waitForFunction(id => document.documentElement.dataset.theme === id, id);
  const close = async () => {
    await tap('Close');
    await dialog.waitFor({ state: 'hidden' });
  };
  async function fit(selector) {
    assert.ok(await page.locator(selector).evaluate(el => el.scrollWidth - el.clientWidth < 2), selector);
  }
  async function snapshot(name) {
    if (!process.env.NEXTPHASE_SCREENSHOTS) return;
    await page.screenshot({ path: path.join(process.env.NEXTPHASE_SCREENSHOTS, `olam-${label}-${name}.jpg`), quality: 82 });
  }

  await page.goto(url + '?week=6');
  await page.locator('#study-title').waitFor();
  await tap('Theme Manager');
  await heading('Theme Manager');
  for (const [name, id, color] of [
    ['Cosmic Glass', 'cosmic', '#06070b'],
    ['Midnight Sapphire', 'sapphire', '#060f24'],
    ['Ancient Parchment', 'parchment', '#e8dcc0'],
  ]) {
    await pick(name);
    await active(id);
    assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'), color);
    assert.equal(await page.locator('.top').evaluate(el => getComputedStyle(el).backdropFilter), 'none');
  }
  await pick('Olam HaBa');
  await active('olam-haba');
  assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'), '#060e1c');
  assert.match(await page.locator('html').evaluate(el => getComputedStyle(el).backgroundImage), /radial-gradient/);
  const minimum = await checkContrast(page);
  await checkGlass(page);
  await tap('Save theme');
  await close();
  await fit('#study');
  const action = await page.locator('.today .primary').evaluate(el => {
    const style = getComputedStyle(el);
    return { ink: style.color, surface: style.backgroundImage };
  });
  assert.equal(action.ink, 'rgb(238, 246, 250)');
  assert.match(action.surface, /linear-gradient\(/);
  await snapshot('study');

  await tap('Read passage');
  await heading('Passage reader');
  const reference = dialog.getByRole('textbox', { name: 'Scripture reference' });
  await reference.fill('Genesis 24');
  await tap('Open passage');
  await dialog.locator('[data-reference="Genesis 24:1"]').waitFor();
  await fit('#panel-body');
  const scrolled = await dialog.locator('#panel-body').evaluate(el => {
    el.scrollTop = el.clientHeight;
    return el.scrollTop;
  });
  assert.ok(scrolled > 0);
  await snapshot('reader');
  await close();

  await tap('Tools');
  await heading('Study tools');
  await fit('#panel-body');
  await tap(/^Calendar studies/);
  await heading('Calendar studies');
  await tap('Zedokian');
  await tap(/^Sacred Time and Biblical History/);
  await heading('Sacred Time and Biblical History');
  await dialog.getByLabel('Search Sacred Time').fill('Creation');
  await fit('#panel-body');
  await close();

  assert.equal(await page.locator('#turn').evaluate(el => getComputedStyle(el).transitionDuration), '0s');
  await tap('Study discussion');
  await page.locator('#fellowship-title').waitFor();
  const reply = page.getByRole('textbox', { name: 'Reply', exact: true });
  await reply.fill('Olam HaBa preview draft');
  await fit('#fellowship');
  await snapshot('fellowship');
  await page.reload();
  await page.locator('#fellowship-title').waitFor();
  await active('olam-haba');
  assert.equal(await reply.inputValue(), 'Olam HaBa preview draft');
  await page.keyboard.press('Control+Alt+Shift+D');
  await active('diagnostic');
  assert.ok(await dialog.getByRole('button', { name: 'Save theme' }).isDisabled());
  await close();
  await active('olam-haba');
  assert.deepEqual(errors, []);
  console.log(`${label} passed. Minimum sampled contrast ${minimum}:1.`);
}

async function run() {
  const url = await startPagesCheck(server);
  for (const [label, profile] of [
    ['phone', devices['iPhone 13']],
    ['desktop', { viewport: { width: 1440, height: 900 } }],
  ]) {
    const browser = await chromium.launch({ executablePath: process.env.NEXTPHASE_CHROME || undefined,
      args: ['--disable-gpu', '--disk-cache-size=1048576', '--media-cache-size=1048576'] });
    try {
      await checkOlam(await browser.newPage({ ...profile, reducedMotion: 'reduce' }), url, label);
    } finally {
      await browser.close();
    }
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
