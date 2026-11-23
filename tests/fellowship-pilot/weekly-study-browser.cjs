// Public-host weekly study regression. Every network request is local or aborted.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.NEXTPHASE_PLAYWRIGHT || 'playwright');
const { createPreviewServer, startPagesCheck, pagesMount } = require('../../serve-preparedness.cjs');

async function main() {
  const server = createPreviewServer({ mount: pagesMount });
  const local = await startPagesCheck(server);
  const origin = 'https://emartinie.github.io';
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.NEXTPHASE_CHROME || undefined,
      args: ['--disable-gpu', '--renderer-process-limit=2', '--disk-cache-size=1048576'] });
    const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
    // Match the reported default Week 8 without depending on the execution date.
    await context.addInitScript(() => {
      const OriginalDate = Date;
      window.Date = class extends OriginalDate {
        constructor(...args) { super(...(args.length ? args : ['2026-11-23T12:00:00Z'])); }
        static now() { return +new OriginalDate('2026-11-23T12:00:00Z'); }
      };
    });
    const page = await context.newPage();
    page.setDefaultTimeout(25000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let failNextWeek = false;
    let loadedWeek = 0;
    await context.route('**/*', async route => {
      const address = new URL(route.request().url());
      if (address.origin !== origin) return route.abort();
      if (address.pathname.endsWith('/data/week8.json') && failNextWeek) {
        failNextWeek = false;
        return route.fulfill({ status: 503, body: 'Temporarily unavailable' });
      }
      const response = await fetch(new URL(address.pathname + address.search, new URL(local).origin));
      if (address.pathname.endsWith('/data/week8.json') && response.ok) loadedWeek++;
      return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers),
        body: Buffer.from(await response.arrayBuffer()) });
    });
    await page.goto(origin + '/NextPhase/');
    await page.locator('#study .today').waitFor();
    assert.equal(await page.locator('#study h1').innerText(), 'He Sent');
    assert.ok(loadedWeek > 0);
    assert.equal(await page.getByText('The weekly study could not load.', { exact: true }).count(), 0);
    // Exercise the second non-Firebase branch formerly using the removed flag.
    await page.locator('#flip').click();
    await page.getByRole('button', { name: 'Conversations', exact: true }).click();
    await page.locator('#panel-body').getByText('Live community conversations are not enabled on this address yet.', { exact: true }).waitFor();
    await page.locator('#close').click();
    await page.locator('#flip').click();
    for (const [number, title] of [[7, 'He Went Out'], [8, 'He Sent']]) {
      await page.locator('#week-button').click();
      await page.locator('#dialog').getByRole('button', { name: new RegExp('^' + number + ' · ') }).click();
      await page.waitForFunction(title => document.querySelector('#study h1')?.textContent === title, title);
    }
    await page.getByRole('button', { name: 'Read passage', exact: true }).click();
    await page.locator('#dialog .verse').first().waitFor();
    assert.ok((await page.locator('#dialog .verse-text').first().innerText()).trim());
    await page.locator('#close').click();
    // A failed download must remain retryable.
    failNextWeek = true;
    await page.goto(origin + '/NextPhase/?week=8');
    await page.getByRole('button', { name: 'Try again', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.locator('#study .today').waitFor();
    assert.equal(await page.locator('#study h1').innerText(), 'He Sent');
    // A rendering failure after a successful download must not poison the memo.
    const renderPage = await context.newPage();
    renderPage.setDefaultTimeout(25000);
    renderPage.on('pageerror', error => errors.push(error.message));
    await renderPage.addInitScript(() => {
      const setAttribute = Element.prototype.setAttribute;
      let fail = true;
      Element.prototype.setAttribute = function(name, value) {
        if (fail && name === 'aria-label' && value === 'Weekly conversation') {
          fail = false;
          throw new Error('Synthetic one-time rendering failure');
        }
        return setAttribute.call(this, name, value);
      };
    });
    await renderPage.goto(origin + '/NextPhase/?week=8');
    await renderPage.getByRole('button', { name: 'Try again', exact: true }).waitFor();
    await renderPage.getByRole('button', { name: 'Try again', exact: true }).click();
    await renderPage.locator('#study .today').waitFor();
    assert.equal(await renderPage.locator('#study h1').innerText(), 'He Sent');
    assert.equal(await renderPage.getByRole('button', { name: 'Try again', exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    console.log('Passed public GitHub Pages origin: default Week 8, Week 7/8 navigation, Fellowship conversation links, bundled reader, and recovery after download or render failure. All requests intercepted; no live sign-in, data or Firebase changes.');
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
