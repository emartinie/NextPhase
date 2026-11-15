const assert = require('node:assert/strict');
const { chromium, devices } = require(process.env.NEXTPHASE_PLAYWRIGHT || 'playwright');

const { createPreviewServer, pagesMount, startPagesCheck } = require('./serve-preparedness.cjs');
const server = createPreviewServer({ mount: pagesMount });

async function run() {
  const url = await startPagesCheck(server);
  const browser = await chromium.launch({ executablePath: process.env.NEXTPHASE_CHROME || undefined });
  try {
    const phone = await browser.newPage({ ...devices['iPhone 13'] });
    phone.setDefaultTimeout(8000);
    const errors = [];
    const embeds = [];
    phone.on('pageerror', (error) => errors.push(error.message));
    await phone.route('https://www.youtube-nocookie.com/**', async (route) => {
      embeds.push(route.request().url());
      await route.fulfill({ contentType: 'text/html', body: '<title>Test player</title>' });
    });
    await phone.goto(url + '?week=6');
    await phone.locator('#study-title').waitFor();
    const tap = (name) => phone.getByRole('button', {name, exact:true}).click();
    await tap('Tools');
    await tap('Teachers & Scholars Profiles, teaching archives and debates');
    await phone.getByText('8 profiles', {exact:true}).waitFor();
    assert.equal(await phone.locator('iframe').count(), 0);
    await tap('Scholars');
    await phone.getByText('5 profiles', {exact:true}).waitFor();
    const search = phone.getByRole('searchbox');
    await search.fill('Emanuel Tov');
    await phone.getByText('1 profile', {exact:true}).waitFor();
    const tov = phone.getByRole('button', {name:/Emanuel Tov/});
    await tov.click();
    await phone.getByRole('heading', {name:'Emanuel Tov',exact:true}).waitFor();
    await phone.locator('summary').filter({hasText:'Background and research'}).click();
    await phone.getByRole('heading', {name:'Limitations and cautions'}).waitFor();
    assert.ok(await phone.getByRole('link', {name:/Emanuel Tov/}).count());
    assert.equal(new URL(phone.url()).searchParams.get('id'),'emanuel-tov');
    await tap('Back');
    await tov.waitFor();
    assert.equal(await search.inputValue(),'Emanuel Tov');
    assert.equal(await phone.getByRole('button', {name:'Scholars',exact:true}).getAttribute('aria-pressed'),'true');
    assert.match(await phone.evaluate(() => document.activeElement.textContent), /Emanuel Tov/);
    await search.fill('');
    await tap('Teachers');
    await phone.getByText('3 profiles', {exact:true}).waitFor();
    await phone.getByRole('button',{name:/Chuck Missler/}).click();
    await phone.getByRole('heading',{name:'Teaching archive',exact:true}).waitFor();
    assert.equal(await phone.locator('#panel-body .people-section').filter({has:phone.getByRole('heading',{name:'Teaching archive',exact:true})}).getByRole('button').count(),24);
    const teaching = phone.getByRole('button', {name:/^Hour 24/});
    const scroll = await teaching.evaluate((element) => {
      const parent = document.querySelector('#panel-body');
      parent.scrollTop += element.getBoundingClientRect().bottom - parent.getBoundingClientRect().bottom + 17;
      return parent.scrollTop;
    });
    await teaching.click();
    await phone.getByRole('heading',{name:'Hour 24',exact:true}).waitFor();
    assert.equal(await phone.locator('iframe').count(),0);
    assert.equal(embeds.length,0);
    const request = phone.waitForRequest('https://www.youtube-nocookie.com/**');
    await tap('Load YouTube player');
    await request;
    assert.match(await phone.locator('iframe').getAttribute('src'), /cM72PmSIURc/);
    assert.match(await phone.getByRole('link',{name:/Watch on YouTube/}).getAttribute('href'), /cM72PmSIURc/);
    await phone.goBack();
    await teaching.waitFor();
    assert.equal(await phone.locator('iframe').count(),0);
    assert.equal(await phone.locator('#panel-body').evaluate((el) => el.scrollTop),scroll);
    await tap('Back');
    await phone.getByRole('button',{name:/Acts 15 and the Law of Moses/}).click();
    await phone.getByRole('heading',{name:'Acts 15 and the Law of Moses',exact:true}).waitFor();
    assert.equal(new URL(phone.url()).searchParams.get('debate'),'acts-15-law-of-moses');
    assert.deepEqual(errors,[]);
    await phone.close();

    const desktop = await browser.newPage({viewport:{width:1440,height:900}});
    desktop.setDefaultTimeout(8000);
    await desktop.goto(url + '?card=scholars&id=craig-s-keener&week=6');
    await desktop.getByRole('heading',{name:'Craig S. Keener',exact:true}).waitFor();
    assert.equal(new URL(desktop.url()).searchParams.get('card'),'people');
    await desktop.keyboard.press('Escape');
    await desktop.locator('dialog').waitFor({state:'hidden'});
    assert.equal(new URL(desktop.url()).searchParams.get('week'),'6');
    await desktop.goto(url + '?card=missler');
    await desktop.getByRole('heading',{name:/Dr. Chuck Missler/}).waitFor();
    await desktop.goto(url + '?card=people&debate=acts-15-law-of-moses');
    await desktop.getByRole('heading',{name:'Acts 15 and the Law of Moses',exact:true}).waitFor();
    await desktop.goto(url + '?card=people&id=jim-staley&video=5');
    await desktop.getByText(/This entry also appears in another archive/).waitFor();
    console.log('Teachers & Scholars passed in phone-sized and desktop Chromium: filters, profiles, archive counts, on-demand embed, fallback link, debates, deep links and exact return.');
  } finally {
    await browser.close();
    server.close();
  }
}
run().catch((error) => { console.error(error); server.close(); process.exitCode = 1; });
