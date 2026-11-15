
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium, devices } = require(process.env.NEXTPHASE_PLAYWRIGHT || 'playwright');

const { createPreviewServer, pagesMount, startPagesCheck } = require('./serve-preparedness.cjs');
const root = __dirname;
const server = createPreviewServer({ mount: pagesMount });

async function checkCalendar(page, url) {
  const { countDay, nextSabbath } = await import('./calendar.js');
  assert.equal(countDay(new Date(2026, 3, 1, 19, 29), '2026-04-02'), 0);
  assert.equal(countDay(new Date(2026, 3, 1, 19, 30), '2026-04-02'), 1);
  assert.equal(countDay(new Date(2026, 4, 20, 19, 29), '2026-04-02'), 49);
  assert.equal(countDay(new Date(2026, 4, 20, 19, 30), '2026-04-02'), 50);
  assert.equal(countDay(new Date(2026, 9, 1, 19, 30), '2026-09-25'), 8);
  assert.equal(nextSabbath(new Date(2026, 8, 25, 17, 59)).getDate(), 25);
  assert.equal(nextSabbath(new Date(2026, 8, 25, 18)).getDate(), 2);
  const calendar = JSON.parse(await fs.readFile(path.join(root, 'corpus/calendar.json'), 'utf8'));
  assert.deepEqual(Object.keys(calendar.models), ['Hillel', 'Enochian', 'Zedokian']);
  assert.equal(calendar.eventDetails.unleavened_bread.scripture, 'Exodus 12:15–20; Leviticus 23:6–8');
  assert.deepEqual([calendar.fall.dates.SUKKOT, calendar.sukkot.start, calendar.modelDates.Hillel[6][0]],
    ['2026-09-25', '2026-09-25', '2026-09-26T19:00:00']);

  await page.clock.setFixedTime(new Date(2026, 10, 15, 9));
  const dialog = page.locator('dialog');
  const tap = name => dialog.getByRole('button', { name, exact: typeof name === 'string' }).click();
  const heading = name => dialog.getByRole('heading', { name, exact: true }).waitFor();
  const copy = name => dialog.getByText(name, { exact: typeof name === 'string' }).waitFor();

  await page.goto(url);
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  await heading('Calendar studies');
  await heading('2026 reference cycle complete');
  await tap('Enochian');
  assert.match(page.url(), /model=Enochian/);
  await tap(/^Passover March 29, 2026/);
  await heading('Passover');
  assert.match(page.url(), /event=passover&date=2026-03-29/);
  await tap('Exodus 12:1–14');
  await heading('Passage reader');
  await dialog.getByText(/And the Lord spake unto Moses and Aaron in the land of Egypt/).waitFor();
  await tap('Back');
  await heading('Passover');
  await page.goBack();
  assert.equal(await dialog.getByRole('button', { name: 'Enochian', exact: true }).getAttribute('aria-pressed'), 'true');
  await tap('Zedokian');
  await dialog.getByRole('button', { name: /^Passover April 3, 2026/ }).waitFor();

  await tap(/^Fall Feasts Review/);
  await heading('Completion');
  await tap(/^Sukkot September 25, 2026/);
  await heading('Dwelling');
  await page.reload();
  await heading('Dwelling');
  await tap(/^Sukkot Count Explore/);
  const day = dialog.getByLabel('Review the count');
  await day.selectOption('7');
  await heading('Day 7 of Sukkot');
  await copy('Prayer: Teach me joy.');
  assert.equal(await dialog.locator('.count-star').count(), 7);
  await day.selectOption('0');
  await heading('Prepare the Heart');

  await page.goto(url + '?card=omercount');
  await copy('The 2026 count is complete.');
  await day.selectOption('8');
  await heading('Day 8 of 49');
  await copy(/Week 2, Day 1/);
  await page.reload();
  await heading('Day 8 of 49');
  assert.equal(await dialog.locator('.count-star').count(), 49);
  await tap(/^Day 49 · Malchut within Malchut$/);
  await heading('Day 49 of 49');
  const width = await page.evaluate(() => {
    const panel = document.querySelector('#panel-body');
    return panel.scrollWidth - panel.clientWidth;
  });
  assert.equal(width, 0, 'The constellation must fit the panel');

  await page.goto(url + '?card=calendar&model=Hillel&date=2026-09-26');
  await heading('Tabernacles / Sukkot');
  await copy('Hillel · September 26, 2026');
  await tap('Back');
  await copy(/The calculated Jewish calendar used for shared observance today/);
  await dialog.getByText('Supplemental studies', { exact: true }).click();
  await dialog.getByText('Listen', { exact: true }).click();
  await tap(/^Deuteronomy.*Supplemental schedule reference/);
  await heading('Passage reader');
  await tap('Back');
  assert.equal(await dialog.getByText('Supplemental studies', { exact: true }).evaluate(el => el.parentElement.open), true);

  await tap(/^Sacred Time and Biblical History Explore/);
  await copy('30 of 30 entries');
  await tap('List');
  assert.equal(await dialog.locator('.calendar-timeline').count(), 0);
  await dialog.getByLabel('Certainty', { exact: true }).selectOption('explicit_biblical_date');
  assert.ok((await dialog.locator('.calendar-results details').count()) < 30);
  await tap('Clear filters');
  await dialog.getByLabel('Search Sacred Time').fill('creation week');
  await dialog.getByText('Creation Week', { exact: false }).first().click();
  await copy('Sources and viewpoints');
  await tap('Exodus 20:8-11');
  await heading('Passage reader');
  await tap('Back');
  assert.equal(await dialog.getByLabel('Search Sacred Time').inputValue(), 'creation week');
  await copy('Sources and viewpoints');
}


async function run() {
  const url = await startPagesCheck(server);
  const browser = await chromium.launch({ executablePath: process.env.NEXTPHASE_CHROME || undefined,
    args: ['--disable-gpu', '--disk-cache-size=1048576', '--media-cache-size=1048576'] });
  try {
    for (const config of [devices['iPhone 13'], { viewport: { width: 1440, height: 900 } }]) {
      const page = await browser.newPage(config);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.setDefaultTimeout(8000);
      await checkCalendar(page, url);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally {
    await browser.close();
  }
  console.log('Calendar passed on phone-sized and desktop Chromium: date boundaries, three models, bookmarked events, reading and Back, seasonal phases, counters, supplemental readings, and Sacred Time filters.');
}

run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
