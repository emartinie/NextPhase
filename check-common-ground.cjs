const assert = require('node:assert/strict');
const { chromium, devices } = require(process.env.NEXTPHASE_PLAYWRIGHT || 'playwright');
const { createPreviewServer, pagesMount, startPagesCheck } = require('./serve-preparedness.cjs');
const { schemaVersion, briefings } = require('./corpus/preparedness/common-ground.json');

function checkSources() {
  assert.equal(schemaVersion, 1);
  assert.ok(briefings.length > 0);
  assert.equal(new Set(briefings.map(item => item.id)).size, briefings.length);
  for (const item of briefings) {
    assert.equal(item.editorial.status, 'sample');
    assert.equal(item.editorial.approval, null);
    assert.ok(Date.parse(item.editorial.updatedAt) >= Date.parse(item.editorial.createdAt));
    assert.ok(item.revisions.length > 0);
    const sources = new Set(item.sources.map(source => source.id));
    for (const source of item.sources) assert.equal(new URL(source.url).protocol, 'https:');
    const statements = [...item.claims, ...item.implications];
    assert.ok(statements.every(({ sourceIds }) => sourceIds.length > 0 && sourceIds.every(id => sources.has(id))));
    assert.ok(statements.map(({ text }) => text).join(' ').split(/\s+/).length <= 420);
  }
}

async function run() {
  checkSources();
  const server = createPreviewServer({ mount: pagesMount });
  const url = await startPagesCheck(server);
  const origin = new URL(url).origin;
  let browser;
  const external = [];
  const errors = [];
  try {
    browser = await chromium.launch({ executablePath: process.env.NEXTPHASE_CHROME || undefined,
      args: ['--disk-cache-size=1048576', '--media-cache-size=1048576'] });
    async function pageWith(options) {
      const page = await browser.newPage(options);
      page.setDefaultTimeout(9000);
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => {
        const request = new URL(route.request().url());
        if (request.origin === origin) return route.continue();
        if (request.hostname !== 'tile.openstreetmap.org') external.push(request.href);
        return route.abort();
      });
      return page;
    }
    const phone = await pageWith({ ...devices['iPhone 13'], viewport: { width: 390, height: 620 }, reducedMotion: 'reduce' });
    const dialog = phone.getByRole('dialog');
    const choose = name => dialog.getByRole('button', { name }).click();
    const study = phone.locator('#study');
    await phone.goto(url + '?week=7');
    await phone.locator('#study-title').waitFor();
    const studyTop = await study.evaluate(element => { element.scrollTop = 120; return element.scrollTop; });
    await phone.getByRole('button', { name: 'Go to Learning Hub workspace' }).click();
    await phone.getByRole('button', { name: 'Go to Preparedness workspace' }).click();
    const front = phone.locator('#preparedness-study');
    for (const label of [/^Be Ready library/, /^Amateur radio resources/, /^Radio Network Map/]) await front.getByRole('button', { name: label }).waitFor();
    await front.getByRole('button', { name: /^The Common Ground / }).click();
    await dialog.getByText('Facts First. Conclusions Yours.', { exact: true }).waitFor();
    await choose(/^A Falcon update/);
    for (const label of ['Confirmed facts', 'Attributed estimates', 'What remains unclear', 'Practical implications']) {
      await dialog.getByRole('heading', { name: label, exact: true }).waitFor();
    }
    await dialog.getByText('Sources and further reading', { exact: true }).click();
    const item = briefings[0];
    for (const source of item.sources) {
      const sourceLink = dialog.getByRole('link', { name: source.title, exact: true });
      assert.equal(await sourceLink.getAttribute('href'), source.url);
    }
    await dialog.getByText('Updates and corrections', { exact: true }).click();
    await dialog.getByText('Sample for review · Pending editorial approval.').waitFor();
    const discuss = dialog.getByRole('button', { name: 'Discuss in Fellowship' });
    await discuss.scrollIntoViewIfNeeded();
    const panel = phone.locator('#panel-body');
    const before = await panel.evaluate(element => element.scrollTop);
    assert.ok(before > 0);
    await discuss.click();
    await dialog.getByRole('heading', { name: 'Fellowship discussion' }).waitFor();
    assert.equal(await dialog.getByRole('heading', { name: 'Confirmed facts' }).count(), 0);
    const message = 'Keep a copy of the group contact plan.';
    await dialog.getByLabel('Reply', { exact: true }).fill(message);
    await choose('Post demo reply');
    await dialog.getByText(message, { exact: true }).waitFor();
    await phone.goBack();
    await discuss.waitFor();
    assert.equal(await panel.evaluate(element => element.scrollTop), before);
    assert.equal(await discuss.evaluate(element => element === document.activeElement), true);
    assert.equal(await dialog.getByText(message, { exact: true }).count(), 0);
    await choose('Close');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await study.evaluate(element => element.scrollTop), studyTop);
    await phone.getByRole('button', { name: 'Preparedness communications', exact: true }).click();
    await phone.locator('#preparedness-fellowship').getByRole('heading', { name: /Storm outreach/ }).waitFor();
    await phone.getByRole('button', { name: 'Communications actions' }).click();
    await choose(/^The Common Ground /);
    await choose(/^A Falcon update/);
    await choose('Discuss in Fellowship');
    await dialog.getByText(message, { exact: true }).waitFor();
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth), 390);
    await phone.close();

    const desktop = await pageWith({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const desktopDialog = desktop.getByRole('dialog');
    await desktop.goto(url + '?card=beready');
    await desktopDialog.getByText('1,061 records · Showing 1–24', { exact: true }).waitFor();
    await desktop.goto(url + '?card=amateurradio');
    await desktopDialog.getByText('Quick frequencies', { exact: true }).click();
    await desktopDialog.getByRole('link', { name: /Find a public receiver/ }).waitFor();
    await desktop.goto(url + '?card=radiomap');
    await desktopDialog.getByRole('heading', { name: 'Radio Network Map' }).waitFor();
    await desktopDialog.locator('.prep-list').getByRole('button', { name: /KG4HDZ/ }).waitFor();
    await desktop.goto(url + `?card=preparedness&section=briefing&id=${item.id}`);
    await desktopDialog.getByRole('heading', { name: item.headline }).waitFor();
    await desktop.goto(url + '?card=preparedness&section=briefing&id=unknown');
    await desktopDialog.getByText('This briefing is unavailable.', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log('Preparedness and Common Ground passed on phone-sized and desktop Chromium, including sources, editorial status, discussion isolation, exact return position, and legacy Radio Map entry.');
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
