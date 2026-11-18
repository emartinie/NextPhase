const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium, devices } = require(process.env.NEXTPHASE_PLAYWRIGHT || 'playwright');

const { createPreviewServer, pagesMount, startPagesCheck } = require('./serve-preparedness.cjs');
const server = createPreviewServer({ mount: pagesMount });

async function run() {
  const url = await startPagesCheck(server);
  const browser = await chromium.launch({ executablePath: process.env.NEXTPHASE_CHROME || undefined });
  try {
    const phone = await browser.newPage({ ...devices['iPhone 13'], defaultTimeout: 7000 });
    const errors = [];
    phone.on('pageerror', (error) => errors.push(error.message));
    await phone.goto(url);
    await phone.locator('#study-title').waitFor();
    assert.match(await phone.locator('#study .eyebrow').first().innerText(), /^THIS WEEK/i);
    const scheduleChecks = await phone.evaluate(async () => {
      const corpus = await import(new URL('./corpus.js', location.href));
      const data = await corpus.schedules();
      const failed = [];
      const news = [];
      const corpusFailures = [];
      const weeks = [];
      for (const item of data.weekly) {
        try {
          const [week, ...languages] = await Promise.all([corpus.getWeek(+item.week),
            ...Object.keys(corpus.LANGUAGES).map((language) => corpus.getWeeklyText(item, language))]);
          if (week && languages.every((entry) => entry?.html)) weeks.push(item.week);
        } catch (error) {
          corpusFailures.push(error.message);
        }
      }
      for (const item of data.daily.filter((row) => +row.week <= 52)) {
        try { await corpus.readPassage(item.torah_daily_reading); }
        catch (error) { failed.push(item.week + '/' + item.day_number + ' ' + item.torah_daily_reading + ' · ' + error.message); }
      }
      for (const item of data.weekly) {
        for (const ref of [item.torah_reading, item.haftarah_prophets_writings, item.new_testament].filter(Boolean)) {
          try { await corpus.readPassage(ref); }
          catch (error) { news.push(item.week + ' ' + ref + ' · ' + error.message); }
        }
      }
      return { regular: data.weekly.length, daily: data.daily.filter((row) => +row.week <= 52).length,
        extra: data.extra.length, content: weeks.filter(Boolean).length, failed, news, corpusFailures,
        rollover: ['2024-10-18T23:59:59Z', '2024-10-19T00:00:00Z', '2025-10-03T23:59:59Z', '2025-10-04T00:00:00Z'].map((date) => corpus.currentWeek(new Date(date))) };
    });
    console.log('Corpus', JSON.stringify(scheduleChecks));
    assert.equal(scheduleChecks.regular, 52);
    assert.equal(scheduleChecks.daily, 364);
    assert.equal(scheduleChecks.content, 52);
    assert.deepEqual(scheduleChecks.rollover, [1, 3, 52, 1]);
    const tap = async (name) => phone.getByRole('button', { name, exact: true }).click();
    const read = async (ref) => {
      await phone.getByLabel('Scripture reference').fill(ref);
      await tap('Open passage');
    };
    const close = async () => {
      await tap('Close');
      await phone.locator('dialog').waitFor({ state: 'hidden' });
    };

    if (process.env.NEXTPHASE_SCREENSHOTS) await phone.screenshot({ path: path.join(process.env.NEXTPHASE_SCREENSHOTS, 'nextphase-mainstage-phone.png') });
    await tap('Read passage');
    await phone.locator('[data-reference]').first().waitFor();
    await read('Genesis 1');
    await phone.locator('[data-reference="Genesis 1:15"]').waitFor();
    const target = phone.getByRole('button', { name: 'Passage tools for Genesis 1:15', exact: true });
    const scroll = await target.evaluate((el) => {
      const parent = document.querySelector('#panel-body');
      parent.scrollTop += el.getBoundingClientRect().top - parent.getBoundingClientRect().top - 95;
      return parent.scrollTop;
    });
    assert.ok(scroll > 0);
    await target.click();
    await tap('Open nearby chapter Read the wider passage');
    await phone.locator('[data-reference="Genesis 1:15"]').waitFor();
    await phone.goBack();
    await phone.getByRole('heading', { name: 'Passage tools' }).waitFor();
    await tap('Back');
    await phone.getByRole('heading', { name: 'Passage reader' }).waitFor();
    assert.equal(await phone.locator('#panel-body').evaluate((el) => el.scrollTop), scroll);
    assert.equal(await phone.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Passage tools for Genesis 1:15');
    await tap('Expand');
    assert.equal(await phone.locator('dialog').getAttribute('data-expanded'), 'true');
    if (process.env.NEXTPHASE_SCREENSHOTS) await phone.screenshot({ path: path.join(process.env.NEXTPHASE_SCREENSHOTS, 'nextphase-mainstage-reader.png') });
    await close();

    await tap('Notes');
    await phone.getByRole('textbox').fill('Review note');
    await tap('Save note');
    assert.equal(await phone.getByText('Review note', { exact: true }).count(), 1);
    await close();

    await tap('Tools');
    await tap('Investigations Search published HomeGroups research');
    await phone.getByRole('searchbox').fill('sabbath');
    await phone.getByRole('button', { name: /Where Did the Sabbath Go/ }).click();
    await phone.locator('.legacy-text').waitFor();
    assert.ok((await phone.locator('.legacy-text').innerText()).length > 400);
    await close();

    const studyY = await phone.locator('#study').evaluate((el) => {
      el.scrollTop = 145;
      return el.scrollTop;
    });
    await tap('Study discussion');
    await phone.locator('#fellowship-title').waitFor()
    await phone.waitForFunction(() => getComputedStyle(document.querySelector('#turn')).transform === 'matrix3d(-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1)');
    assert.equal(await phone.locator('#stage').getAttribute('data-face'), 'fellowship');
    assert.equal(await phone.locator('#study').getAttribute('aria-hidden'), 'true');
    if (process.env.NEXTPHASE_SCREENSHOTS) await phone.screenshot({ path: path.join(process.env.NEXTPHASE_SCREENSHOTS, 'nextphase-mainstage-discussion.png') });
    await phone.getByText('Try the local discussion demo', { exact: true }).click();
    await phone.locator('#fellowship').getByLabel('Reply', { exact: true }).fill('Keep my unfinished reply');
    await tap('Attach Scripture');
    await phone.getByLabel('Passage to attach').fill('John 1:1');
    await phone.locator('dialog').getByRole('button', { name: 'Attach Scripture', exact: true }).click();
    await phone.getByText('Attached · John 1:1').waitFor();
    await tap('Back to study');
    assert.equal(await phone.locator('#study').evaluate((el) => el.scrollTop), studyY);
    await tap('Study discussion');
    assert.equal(await phone.locator('#fellowship').getByLabel('Reply', { exact: true }).inputValue(), 'Keep my unfinished reply');
    await tap('Post demo reply');
    const saved = phone.getByRole('article').filter({ hasText: 'Keep my unfinished reply' });
    assert.ok(await saved.count());
    await phone.getByRole('button', { name: 'John 1:1', exact: true }).click();
    await phone.locator('[data-reference="John 1:1"]').waitFor();
    await close();
    await tap('Fellowship actions');
    await phone.getByRole('button', { name: /^Private conversations/ }).click();
    await tap('Miriam Ellis Wednesday HomeGroup');
    await phone.getByLabel('Message', { exact: true }).fill('Private fixture message');
    await tap('Save demo message');
    assert.equal(await phone.getByText('Private fixture message', { exact: true }).count(), 1);
    await close();
    assert.equal(await phone.locator('#fellowship').getByText('Private fixture message', { exact: true }).count(), 0);
    await tap('Fellowship actions');
    await phone.getByRole('button', { name: /^Discussion archives/ }).click();
    const last = new Date().getFullYear() - 1;
    await tap(last + ' Year archive');
    await phone.getByText('View sample archive', { exact: true }).click();
    await phone.getByText('Archive · Read only').waitFor();
    assert.equal(await phone.getByText('Keep my unfinished reply', { exact: true }).count(), 0);
    await tap('Return to ' + (last + 1));
    await phone.getByText('Try the local discussion demo', { exact: true }).click();
    await phone.getByText('Keep my unfinished reply', { exact: true }).waitFor();
    await phone.reload();
    await phone.getByText('Try the local discussion demo', { exact: true }).click();
    await phone.getByText('Keep my unfinished reply', { exact: true }).waitFor();
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth), 390);
    assert.deepEqual(errors, []);
    console.log('Phone passed: current week, nested Back, exact scroll/focus, expansion, notes, research, flip, drafts, attachments, direct messages, archive isolation, reload.');

    await phone.close();
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 950 }, reducedMotion: 'reduce', defaultTimeout: 7000 });
    await desktop.goto(url + '?week=52');
    await desktop.locator('#study-title').waitFor();
    await desktop.getByRole('button', { name: /Week 52/ }).click();
    assert.ok(await desktop.getByRole('button', { name: 'Next week' }).isDisabled());
    await desktop.keyboard.press('Escape');
    await desktop.locator('dialog').waitFor({ state: 'hidden' });
    await desktop.getByText('Weekly Scripture', { exact: true }).click();
    await desktop.getByRole('button', { name: 'Hebrew', exact: true }).click();
    await desktop.locator('.legacy-text').waitFor();
    assert.match(await desktop.locator('.legacy-text').innerText(), /[\u0590-\u05ff]/);
    await desktop.keyboard.press('Escape');
    await desktop.locator('dialog').waitFor({ state: 'hidden' });
    await desktop.getByRole('button', { name: 'Study discussion' }).click();
    assert.equal(await desktop.locator('#turn').evaluate((el) => getComputedStyle(el).transform), 'none');
    await desktop.goBack();
    await desktop.locator('#stage[data-face="study"]').waitFor();
    await desktop.goto(url + '?week=32');
    await desktop.locator('#study-title').waitFor();
    if (process.env.NEXTPHASE_SCREENSHOTS) await desktop.screenshot({ path: path.join(process.env.NEXTPHASE_SCREENSHOTS, 'nextphase-mainstage-desktop.png') });
    console.log('Desktop passed: explicit week, range bounds, Hebrew, keyboard Escape, history and reduced motion.');
  } finally {
    await browser.close();
    server.close();
  }
}
run().catch((error) => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});


