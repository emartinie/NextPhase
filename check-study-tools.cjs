const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium, devices } = require(process.env.NEXTPHASE_PLAYWRIGHT || 'playwright');
const fs = require('node:fs/promises');

const { createPreviewServer, pagesMount, startPagesCheck } = require('./serve-preparedness.cjs');
const root = __dirname;
const server = createPreviewServer({ mount: pagesMount });
const isSefaria = 'https://www.sefaria.org/api/v3/texts/**';

async function run() {
  const url = await startPagesCheck(server);
  const browser = await chromium.launch({ executablePath: process.env.NEXTPHASE_CHROME || undefined });
  try {
    const phone = await browser.newPage({ ...devices['iPhone 13'], defaultTimeout: 8000 });
    const errors = [];
    phone.on('pageerror', (error) => errors.push(error.message));
    let intercepted = '';
    await phone.route(isSefaria, async (route) => {
      const url = new URL(route.request().url());
      intercepted = decodeURIComponent(url.pathname);
      assert.deepEqual(url.searchParams.getAll('version'), ['source', 'english']);
      await route.fulfill({ json: { ref: 'Exodus 20', versions: [
        { language: 'he', versionTitle: 'Sample Hebrew fixture', direction: 'rtl', text: ['אָנֹכִי'] },
        { language: 'en', versionTitle: 'Sample English fixture', text: ['A test-only text.'] },
      ] } });
    });
    await phone.goto(url + '?week=6');
    const tap = (name) => phone.getByRole('button', { name, exact:true }).click();
    await phone.locator('#study-title').waitFor();
    await tap('Tools');
    await tap('Covenants & Commandments Browse covenants and search the commandments');
    const dialog = phone.locator('dialog');
    await dialog.getByRole('heading', {name:'Covenants & Commandments'}).waitFor();
    assert.equal(await dialog.getAttribute('data-workspace'), 'true');
    await phone.getByText('608 of 608 source records').waitFor();
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth), 390);
    await tap('Positive');
    const query = phone.getByRole('searchbox');
    await query.fill('P 1 ');
    await query.fill('To believe in God');
    const record = phone.getByRole('button', {name:/P 1 · To believe in God/});
    const browserPosition = await record.evaluate((element) => {
      const parent = document.querySelector('#panel-body');
      parent.scrollTop += element.getBoundingClientRect().top - parent.getBoundingClientRect().top - 95;
      return parent.scrollTop;
    });
    await record.click();
    await phone.getByRole('heading', {name:'To believe in God', exact:true}).waitFor();
    assert.equal(new URL(phone.url()).searchParams.get('id'), '1');
    const fromNT = phone.getByRole('button', {name:'Hebrews 11:6', exact:true});
    await fromNT.click();
    await phone.getByRole('heading', {name:'Hebrews 11:6', exact:true}).waitFor();
    await phone.getByText(/Having stressed the importance/).waitFor();
    await tap('Back');
    await fromNT.waitFor();
    assert.equal(await phone.evaluate(() => document.activeElement.textContent), 'Hebrews 11:6');
    await tap('John 17:3');
    await phone.getByText(/notes are unavailable for this reference/).waitFor();
    await tap('Read cited Scripture');
    await phone.locator('[data-reference="John 17:3"]').waitFor();
    await tap('Back');
    await tap('Back');
    const sefaria = phone.getByRole('button', {name:'Exodus 20', exact:true});
    await sefaria.click();
    await phone.getByText('Sample Hebrew fixture', {exact:false}).waitFor();
    assert.equal(await phone.locator('[lang="he"]').last().getAttribute('dir'), 'rtl');
    assert.equal(intercepted, '/api/v3/texts/Exodus_20');
    await phone.goBack();
    await sefaria.waitFor();
    assert.equal(await phone.evaluate(() => document.activeElement.textContent), 'Exodus 20');
    await tap('Back');
    await record.waitFor();
    assert.equal(await query.inputValue(), 'To believe in God');
    assert.equal(await phone.getByRole('button', {name:'Positive', exact:true}).getAttribute('aria-pressed'), 'true');
    assert.equal(await phone.locator('#panel-body').evaluate((el) => el.scrollTop), browserPosition);
    assert.match(await phone.evaluate(() => document.activeElement.textContent), /To believe in God/);
    await tap('Close');
    await dialog.waitFor({state:'hidden'});
    assert.equal(await phone.evaluate(() => document.activeElement.id), 'tools-button');
    assert.deepEqual(errors, []);
    await phone.close();

    const desktop = await browser.newPage({viewport:{width:1440,height:900},defaultTimeout:8000});
    await desktop.route(isSefaria, (route) => route.fulfill({status:503, json:{error:'Fixture outage'}}));
    await desktop.goto(url + '?card=commandments&covenant=mosaic&week=6');
    await desktop.getByRole('heading', {name:/Mosaic \/ Sinai Covenant/}).waitFor();
    await desktop.getByText('Passage comparisons', {exact:true}).click();
    await desktop.locator('summary').filter({hasText:/^Exodus 20$/}).click();
    await desktop.locator('summary').filter({hasText:/^Exodus 20$/}).locator('..').getByRole('heading',{name:'Speaker or narrator',exact:true}).waitFor();
    await desktop.getByRole('button', {name:'Exodus 19–24', exact:true}).click();
    await desktop.getByText(/cited text is unavailable in this panel/).waitFor();
    assert.equal(await desktop.getByRole('link', {name:'Open in Sefaria ↗'}).getAttribute('href'), 'https://www.sefaria.org/Exodus.19-24');
    await desktop.keyboard.press('Escape');
    await desktop.getByRole('heading', {name:/Mosaic \/ Sinai Covenant/}).waitFor();
    await desktop.keyboard.press('Escape');
    await desktop.locator('dialog').waitFor({state:'hidden'});
    assert.equal(new URL(desktop.url()).searchParams.get('week'), '6');
    assert.equal(new URL(desktop.url()).searchParams.get('card'), null);
    await desktop.goto(url + '?card=commandments&id=156-2');
    await desktop.getByRole('heading', {name:'On removing leaven before Passover', exact:true}).waitFor();
    const covenantSource = JSON.parse(await fs.readFile(path.join(root, 'corpus/study-tools/covenants/covenants.json')));
    for (const {id, title} of covenantSource) {
      await desktop.goto(url + '?card=commandments&covenant=' + id);
      await desktop.getByRole('heading', {name:title, exact:true}).waitFor();
      await desktop.getByText('Primary covenant passages', {exact:true}).waitFor();
    }
    await desktop.goto(url + '?card=nt&ref=Matthew+1%3A23');
    await desktop.getByText('Hebrew Scripture witnesses', {exact:true}).click();
    await desktop.getByRole('button', {name:/Isaiah 7:14 Hebrew Library/}).first().click();
    await desktop.getByLabel('Sefaria reference').waitFor();
    assert.equal(await desktop.getByLabel('Sefaria reference').inputValue(), 'Isaiah 7:14');
    await desktop.getByRole('button', {name:'Back', exact:true}).click();
    await desktop.getByRole('heading', {name:'Matthew 1:23', exact:true}).waitFor();
    console.log('Passed phone-sized and desktop Chromium: full card, search/filter, duplicate deep link, covenant comparison, real NT notes, missing NT notes, Sefaria success/outage fixtures, scroll/focus and history.');
  } finally {
    await browser.close();
    server.close();
  }
}
run().catch((error) => { console.error(error); server.close(); process.exitCode = 1; });

