const assert = require('node:assert/strict');
const { chromium, devices } = require(process.env.NEXTPHASE_PLAYWRIGHT || 'playwright');
const { createPreviewServer, pagesMount, startPagesCheck } = require('./serve-preparedness.cjs');
const journey = require('./corpus/learning/journeys/who-was-paul.json');

async function swipeLeft(page) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 285, y: 155 }] });
    for (let step = 1; step <= 6; step++) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 285 - step * 30, y: 155 }] });
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally { await session.detach(); }
}

async function closePanel(page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
}

async function run() {
  const server = createPreviewServer({ mount: pagesMount });
  const url = await startPagesCheck(server);
  let browser;
  const errors = [];
  try {
    browser = await chromium.launch({ executablePath: process.env.NEXTPHASE_CHROME || undefined,
      args: ['--disk-cache-size=1048576', '--media-cache-size=1048576'] });
    async function makePage(options) {
      const page = await browser.newPage(options);
      page.setDefaultTimeout(8000);
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://**/*', route => route.abort());
      return page;
    }
    const phone = await makePage({ ...devices['iPhone 13'], viewport: { width: 390, height: 720 }, reducedMotion: 'reduce' });
    const front = phone.locator('#learning-study');
    const back = phone.locator('#learning-fellowship');
    const dialog = phone.getByRole('dialog');
    await phone.goto(url + '?week=7');
    await phone.locator('#study-title').waitFor();
    const studyTop = await phone.locator('#study').evaluate(element => { element.scrollTop = 90; return element.scrollTop; });
    await swipeLeft(phone);
    await phone.locator('#learning-title').waitFor({ state: 'visible' });
    assert.equal(await front.locator('.rows > .row').count(), 10);
    const frontTop = await front.evaluate(element => { element.scrollTop = 65; return element.scrollTop; });
    await front.getByRole('button', { name: /^Learning Paths / }).click();
    await dialog.getByRole('button', { name: /^Who Was Paul\? / }).click();
    await dialog.getByRole('heading', { name: journey.steps[0].title, exact: true }).waitFor();
    await dialog.getByRole('button', { name: 'Complete & continue', exact: true }).click();
    await dialog.getByRole('heading', { name: journey.steps[1].title, exact: true }).waitFor();
    await dialog.getByText('1 of 10 steps completed', { exact: true }).waitFor();
    await dialog.getByRole('button', { name: 'Open the full teaching', exact: true }).click();
    await dialog.locator('.learning-article').waitFor();
    const articleTitle = await dialog.locator('.learning-article h3').first().innerText();
    const panelTop = await phone.locator('#panel-body').evaluate(element => { element.scrollTop = 350; return element.scrollTop; });
    assert.ok(panelTop > 0);
    await phone.getByRole('button', { name: 'Discuss in Learning Fellowship', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await back.getByRole('heading', { name: articleTitle, exact: true }).waitFor();
    const articleTopic = new URL(phone.url()).searchParams.get('learningTopic');
    const reply = 'What helped you understand Paul’s historical setting?';
    await back.getByLabel('Reply', { exact: true }).fill(reply);
    await back.getByRole('button', { name: 'Post demo reply', exact: true }).click();
    await back.getByText(reply, { exact: true }).waitFor();
    await back.getByRole('button', { name: 'Return to resource', exact: true }).click();
    await dialog.locator('.learning-article').waitFor();
    assert.equal(await phone.locator('#panel-body').evaluate(element => element.scrollTop), panelTop);
    assert.equal(await dialog.getByRole('heading', { name: articleTitle, exact: true }).count(), 1);
    await closePanel(phone);
    await phone.getByRole('button', { name: 'Back to Learning Hub', exact: true }).click();
    assert.equal(await front.evaluate(element => element.scrollTop), frontTop);
    await front.getByRole('button', { name: /^Continue learning / }).waitFor();
    await front.getByRole('button', { name: /^Language Lab / }).click();
    await dialog.getByRole('button', { name: 'Greek', exact: true }).click();
    await dialog.getByRole('button', { name: 'Choose Sigma', exact: true }).click();
    assert.equal(await dialog.locator('.alphabet-glyph').innerText(), 'Σ σ/ς');
    await phone.getByRole('button', { name: 'Discuss in Learning Fellowship', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await back.getByRole('heading', { name: 'Language Lab', exact: true }).waitFor();
    assert.equal(await back.getByText(reply, { exact: true }).count(), 0);
    const languageDraft = 'Can someone help me practice these letters?';
    await back.getByLabel('Reply', { exact: true }).fill(languageDraft);
    await back.getByRole('button', { name: 'Return to resource', exact: true }).click();
    await dialog.getByRole('heading', { name: 'Greek alphabet', exact: true }).waitFor();
    assert.equal(await dialog.locator('.alphabet-glyph').innerText(), 'Σ σ/ς');
    await closePanel(phone);
    assert.equal(await back.getByLabel('Reply', { exact: true }).inputValue(), languageDraft);
    const backTop = await back.evaluate(element => element.scrollTop);
    await phone.getByRole('button', { name: 'Go to Preparedness workspace', exact: true }).click();
    await phone.locator('#preparedness-title').waitFor({ state: 'visible' });
    await phone.getByRole('button', { name: 'Preparedness communications', exact: true }).click();
    await phone.locator('#communications-title').waitFor({ state: 'visible' });
    await phone.getByRole('button', { name: 'Go to Learning Hub workspace', exact: true }).click();
    assert.equal(await back.getByLabel('Reply', { exact: true }).inputValue(), languageDraft);
    assert.equal(await back.evaluate(element => element.scrollTop), backTop);
    await phone.getByRole('button', { name: 'Go to MainStage workspace', exact: true }).click();
    assert.equal(await phone.locator('#study').evaluate(element => element.scrollTop), studyTop);
    await phone.getByRole('button', { name: 'Go to Learning Hub workspace', exact: true }).click();
    await phone.getByRole('button', { name: 'Learning Fellowship actions', exact: true }).click();
    await dialog.getByRole('button', { name: /^Learning conversations / }).click();
    await dialog.getByRole('button', { name: articleTitle, exact: false }).click();
    await dialog.waitFor({ state: 'hidden' });
    await back.getByText(reply, { exact: true }).waitFor();
    const articleUrl = phone.url();
    await phone.reload();
    await back.getByText(reply, { exact: true }).waitFor();
    assert.equal(new URL(phone.url()).searchParams.get('learningTopic'), articleTopic);
    await phone.getByRole('button', { name: 'Learning Fellowship actions', exact: true }).click();
    await dialog.getByRole('button', { name: /^Learning conversations / }).click();
    await dialog.getByRole('button', { name: /^Language Lab / }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await back.getByLabel('Reply', { exact: true }).inputValue(), languageDraft);
    await phone.goBack();
    await back.getByText(reply, { exact: true }).waitFor();
    await phone.goForward();
    assert.equal(await back.getByLabel('Reply', { exact: true }).inputValue(), languageDraft);
    await phone.getByRole('button', { name: 'Back to Learning Hub', exact: true }).click();
    await front.getByRole('button', { name: /^Learning Paths / }).click();
    await dialog.getByRole('button', { name: /^Who Was Paul\? / }).click();
    await dialog.getByRole('heading', { name: journey.steps[1].title, exact: true }).waitFor();
    await dialog.getByText('1 of 10 steps completed', { exact: true }).waitFor();
    await closePanel(phone);
    await front.getByRole('button', { name: /^Teachers & Scholars / }).click();
    await dialog.getByRole('heading', { name: 'Teachers & Scholars', exact: true }).waitFor();
    await dialog.getByRole('button', { name: /Chuck Missler/ }).waitFor();
    await closePanel(phone);
    await phone.getByRole('button', { name: 'Theme Manager', exact: true }).click();
    await dialog.getByRole('radio', { name: 'Olam HaBa', exact: true }).check();
    await dialog.getByRole('button', { name: 'Save theme', exact: true }).click();
    await closePanel(phone);
    assert.equal(await phone.locator('html').getAttribute('data-theme'), 'olam-haba');
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth), 390);
    await phone.goto(articleUrl);
    await back.getByText(reply, { exact: true }).waitFor();
    await phone.close();

    const desktop = await makePage({ viewport: { width: 1440, height: 900 } });
    await desktop.goto(url + '?workspace=learning');
    await desktop.locator('#learning-title').waitFor({ state: 'visible' });
    await desktop.getByRole('button', { name: 'Learning Fellowship', exact: true }).click();
    await desktop.waitForFunction(() => getComputedStyle(document.querySelector('#learning-stage .turn')).transform.startsWith('matrix3d(-1'));
    assert.equal(await desktop.locator('#stage').evaluate(element => element.inert), true);
    assert.equal(await desktop.locator('#preparedness-stage').evaluate(element => element.inert), true);
    await desktop.getByRole('button', { name: 'Go to Preparedness workspace', exact: true }).focus();
    await desktop.keyboard.press('Enter');
    await desktop.locator('#preparedness-title').waitFor({ state: 'visible' });
    await desktop.goto(url + '?workspace=learning&card=ancient-library&book=josephus&work=antiquities&volume=book-2&chapter=1');
    const desktopDialog = desktop.getByRole('dialog');
    await desktopDialog.getByRole('heading', { name: 'Book 2 · Chapter 1', exact: true }).waitFor();
    await desktopDialog.getByRole('button', { name: 'Next chapter', exact: true }).click();
    await desktopDialog.getByRole('heading', { name: 'Book 2 · Chapter 2', exact: true }).waitFor();
    await desktop.getByRole('button', { name: 'Discuss in Learning Fellowship', exact: true }).click();
    await desktopDialog.waitFor({ state: 'hidden' });
    await desktop.locator('#learning-fellowship').getByRole('heading', { name: 'Book 2 · Chapter 2', exact: true }).waitFor();
    await desktop.reload();
    await desktop.locator('#learning-fellowship').getByRole('button', { name: 'Return to resource', exact: true }).click();
    await desktopDialog.getByRole('heading', { name: 'Book 2 · Chapter 2', exact: true }).waitFor();
    assert.equal(await desktopDialog.getByLabel('Volume', { exact: true }).inputValue(), 'book-2');
    assert.equal(new URL(desktop.url()).searchParams.get('workspace'), 'learning');
    await desktop.goto(url + '?workspace=study&card=language-lab&language=greek');
    await desktop.getByRole('dialog').getByRole('heading', { name: 'Greek alphabet', exact: true }).waitFor();
    await closePanel(desktop);
    await desktop.locator('#study-title').waitFor({ state: 'visible' });
    await desktop.close();

    const small = await makePage({ ...devices['iPhone SE'], viewport: { width: 320, height: 568 }, reducedMotion: 'reduce' });
    await small.goto(url + '?card=learning');
    await small.locator('#learning-title').waitFor({ state: 'visible' });
    assert.equal(await small.getByRole('dialog').isVisible(), false);
    assert.equal(await small.evaluate(() => document.documentElement.scrollWidth), 320);
    const lastButton = await small.locator('#workspace-switch').boundingBox();
    assert.ok(lastButton.x + lastButton.width <= 320);
    await small.getByRole('button', { name: 'Learning Fellowship', exact: true }).click();
    await small.getByRole('button', { name: 'Go to Preparedness workspace', exact: true }).click();
    await small.getByRole('button', { name: 'Go to Learning Hub workspace', exact: true }).click();
    assert.equal(await small.getByRole('button', { name: 'Back to Learning Hub', exact: true }).isVisible(), true);
    await small.close();
    assert.deepEqual(errors, []);
    console.log('Learning workspace passed: adjacent touch navigation, resource discussion and exact return, retained alphabet selection, topic isolation, saved replies and drafts, path progress, browser history, themes, 3D flip, contextual Study entry and 320px layout.');
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
