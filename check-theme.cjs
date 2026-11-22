const assert = require('node:assert/strict');
const { chromium, devices } = require(process.env.NEXTPHASE_PLAYWRIGHT || 'playwright');
const { createPreviewServer, pagesMount, startPagesCheck } = require('./serve-preparedness.cjs');

const server = createPreviewServer({ mount: pagesMount });
const themes = {
  nextphase: '#111712',
  cosmic: '#06070b',
  sapphire: '#060f24',
  parchment: '#e8dcc0',
  diagnostic: '#fa00ed',
};

async function checkAppearance(page, url) {
  page.setDefaultTimeout(10_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const dialog = page.locator('dialog');
  const manager = page.getByRole('button', { name: 'Theme Manager', exact: true });
  const tap = name => page.getByRole('button', { name, exact: true }).click();
  const choose = name => dialog.getByRole('radio', { name, exact: true }).check();
  const save = dialog.getByRole('button', { name: 'Save theme' });
  const color = element => page.locator(element).evaluate(el => getComputedStyle(el).backgroundColor);
  async function active(id) {
    await page.waitForFunction(id => document.documentElement.dataset.theme === id, id);
    assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'), themes[id]);
  }

  await page.goto(url + '?week=6');
  await page.locator('#study-title').waitFor();
  await active('cosmic');
  const top = await color('.top');
  const dock = await color('.dock');
  await manager.click();
  await choose('Midnight Sapphire');
  await active('sapphire');
  assert.notEqual(await color('.top'), top);
  assert.notEqual(await color('.dock'), dock);
  await page.goBack();
  await dialog.waitFor({ state: 'hidden' });
  await active('cosmic');

  await manager.click();
  await choose('Ancient Parchment');
  await active('parchment');
  assert.equal(await page.locator('html').evaluate(el => getComputedStyle(el).colorScheme), 'light');
  assert.equal(await color('dialog'), 'rgb(255, 250, 237)');
  await save.click();
  await dialog.getByRole('status').getByText('Ancient Parchment is saved on this device.').waitFor();
  await tap('Close');
  await tap('Study discussion');
  await active('parchment');
  await manager.click();
  await choose('Midnight Sapphire');
  await active('sapphire');
  await tap('Close');
  await active('parchment');
  assert.equal(await page.locator('#stage').getAttribute('data-face'), 'fellowship');
  await page.reload();
  await page.locator('#fellowship-title').waitFor();
  await active('parchment');

  await page.keyboard.press('Control+Alt+Shift+D');
  await active('diagnostic');
  assert.ok(await save.isDisabled());
  await page.keyboard.press('Control+Alt+Shift+D');
  await dialog.waitFor({ state: 'hidden' });
  await active('parchment');
  await tap('Back to study');
  for (let count = 0; count < 5; count++) await page.locator('#study-title').click();
  await active('diagnostic');
  await tap('Close');
  await active('parchment');

  await page.goto(url + '?week=6&card=theme');
  await choose('NextPhase default');
  await save.click();
  await active('nextphase');
  await page.reload();
  await dialog.getByRole('heading', { name: 'Theme Manager' }).waitFor();
  await active('nextphase');
  assert.deepEqual(errors, []);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), page.viewportSize().width);
}

async function run() {
  const url = await startPagesCheck(server);
  const browser = await chromium.launch({ executablePath: process.env.NEXTPHASE_CHROME || undefined,
    args: ['--disable-gpu', '--disk-cache-size=1048576', '--media-cache-size=1048576'] });
  try {
    for (const profile of [devices['iPhone 13'], { viewport: { width: 1440, height: 900 } }]) {
      const page = await browser.newPage(profile);
      await checkAppearance(page, url);
      await page.close();
    }
    console.log('Theme Manager passed on phone-sized and desktop Chromium.');
  } finally {
    await browser.close();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
