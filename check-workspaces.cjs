const assert = require('node:assert/strict');
const { chromium, devices } = require(process.env.NEXTPHASE_PLAYWRIGHT || 'playwright');
const { createPreviewServer, pagesMount, startPagesCheck } = require('./serve-preparedness.cjs');

async function swipe(page, direction, y = 180, x = 285) {
  const session = await page.context().newCDPSession(page);
  const end = direction === 'left' ? x - 180 : x + 180;
  try {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let step = 1; step <= 6; step++) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove', touchPoints: [{ x: x + (end - x) * step / 6, y }],
      });
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await session.detach();
  }
}

async function assertWorkspace(page, name, side = 'study') {
  await page.waitForFunction(({ name, side }) => {
    const stage = document.getElementById(name === 'study' ? 'stage' : 'preparedness-stage');
    return document.getElementById('workspace-track').dataset.workspace === name
      && stage.dataset.face === side && !stage.inert;
  }, { name, side });
  const hidden = page.locator(name === 'study' ? '#preparedness-stage' : '#stage');
  assert.equal(await hidden.evaluate(element => element.inert), true);
}

async function goToWorkspace(page, destination) {
  const order = ['study', 'learning', 'preparedness'];
  const titles = { study: 'MainStage', learning: 'Learning Hub', preparedness: 'Preparedness' };
  for (let steps = 0; steps < 2; steps++) {
    const current = await page.locator('#workspace-track').getAttribute('data-workspace');
    if (current === destination) return;
    const next = order[order.indexOf(current) + Math.sign(order.indexOf(destination) - order.indexOf(current))];
    await page.getByRole('button', { name: 'Go to ' + titles[next] + ' workspace', exact: true }).click();
  }
}

async function closeDialog(page) {
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
    async function pageWith(options) {
      const page = await browser.newPage(options);
      page.setDefaultTimeout(8000);
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://**/*', route => route.abort());
      return page;
    }

    const phone = await pageWith({ ...devices['iPhone 13'], viewport: { width: 390, height: 720 }, reducedMotion: 'reduce' });
    const study = phone.locator('#study');
    const front = phone.locator('#preparedness-study');
    const back = phone.locator('#preparedness-fellowship');
    const dialog = phone.getByRole('dialog');
    await phone.goto(url + '?week=7');
    await phone.locator('#study-title').waitFor();
    await study.getByText('Weekly Scripture', { exact: true }).click();
    const studyTop = await study.evaluate(element => { element.scrollTop = 115; return element.scrollTop; });
    assert.ok(studyTop > 0);
    await phone.getByRole('button', { name: 'Tools', exact: true }).click();
    assert.equal(await dialog.getByRole('button', { name: /^Preparedness / }).count(), 0);
    await dialog.getByRole('button', { name: /^Passage reader / }).click();
    await dialog.locator('.verse').first().waitFor();
    const verse = dialog.locator('.verse').nth(Math.min(6, await dialog.locator('.verse').count() - 1)).getByRole('button');
    await verse.scrollIntoViewIfNeeded();
    const readerTop = await phone.locator('#panel-body').evaluate(element => element.scrollTop);
    await verse.click();
    await dialog.getByRole('heading', { name: 'Passage tools', exact: true }).waitFor();
    await phone.goBack();
    await dialog.getByRole('heading', { name: 'Passage reader', exact: true }).waitFor();
    assert.equal(await phone.locator('#panel-body').evaluate(element => element.scrollTop), readerTop);
    assert.equal(await verse.evaluate(element => element === document.activeElement), true);
    await closeDialog(phone);

    // Native touch input exercises the same gesture handlers used on the card surface.
    await swipe(phone, 'left');
    await swipe(phone, 'left');
    await assertWorkspace(phone, 'preparedness');
    assert.equal(await phone.locator('#week-button').isVisible(), false);
    assert.equal(await phone.locator('.workspace-track > .stage').count(), 3);
    const frontTop = await front.evaluate(element => { element.scrollTop = 90; return element.scrollTop; });
    await front.getByRole('button', { name: /^Be Ready library/ }).click();
    await dialog.getByText('1,061 records · Showing 1–24', { exact: true }).waitFor();
    await dialog.getByLabel('Search the catalog', { exact: true }).fill('field antenna');
    await dialog.getByRole('button', { name: /Field Antenna/ }).first().waitFor();
    await closeDialog(phone);
    assert.equal(await front.evaluate(element => element.scrollTop), frontTop);

    await phone.getByRole('button', { name: 'Preparedness communications', exact: true }).click();
    await assertWorkspace(phone, 'preparedness', 'fellowship');
    await back.getByRole('button', { name: 'Join practice', exact: true }).click();
    await back.getByRole('button', { name: 'Check in for this drill', exact: true }).click();
    await back.getByText('6 checked in · 10 awaiting a check-in', { exact: true }).waitFor();
    await back.getByLabel('Try a role', { exact: true }).selectOption('operator');
    await back.getByLabel('Practice report for', { exact: true }).selectOption('Caleb Hill');
    const draft = back.getByLabel('Reply', { exact: true });
    await draft.fill('Keep this preparedness conversation draft.');
    const backTop = await back.evaluate(element => { element.scrollTop = 100; return element.scrollTop; });
    await swipe(phone, 'right', 180, 95);
    await swipe(phone, 'right', 180, 95);
    await assertWorkspace(phone, 'study');
    assert.equal(await study.evaluate(element => element.scrollTop), studyTop);
    assert.equal(await study.locator('details[open]').count(), 1);
    await swipe(phone, 'left');
    await swipe(phone, 'left');
    await assertWorkspace(phone, 'preparedness', 'fellowship');
    assert.equal(await back.evaluate(element => element.scrollTop), backTop);
    assert.equal(await back.getByLabel('Try a role', { exact: true }).inputValue(), 'operator');
    assert.equal(await back.getByLabel('Practice report for', { exact: true }).inputValue(), 'Caleb Hill');
    assert.equal(await draft.inputValue(), 'Keep this preparedness conversation draft.');

    // Forms retain horizontal gestures and text editing.
    // Isolate app ownership from Chromium's native back gesture inside text fields.
    await draft.evaluate(element => {
      const start = new Touch({ identifier: 1, target: element, clientX: 95, clientY: 200 });
      const end = new Touch({ identifier: 1, target: element, clientX: 275, clientY: 200 });
      element.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [start], changedTouches: [start] }));
      element.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [end], changedTouches: [end] }));
      element.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [end] }));
    });
    await assertWorkspace(phone, 'preparedness', 'fellowship');

    await phone.getByRole('button', { name: 'Communications actions', exact: true }).click();
    await dialog.getByRole('button', { name: /^Practice plan / }).click();
    await dialog.getByRole('heading', { name: 'Practice plan', exact: true }).waitFor();
    await phone.goBack();
    await dialog.getByRole('heading', { name: 'Communications actions', exact: true }).waitFor();
    await closeDialog(phone);
    assert.equal(await draft.inputValue(), 'Keep this preparedness conversation draft.');
    await phone.getByRole('button', { name: 'Communications actions', exact: true }).click();
    await dialog.getByRole('button', { name: /^Practice a read-back / }).click();
    await dialog.getByLabel('Message ID', { exact: true }).fill('04');
    await dialog.getByLabel('Recipient', { exact: true }).fill('Miriam');
    await dialog.getByLabel('Pickup window and time zone', { exact: true }).fill('7–8 PM Central');
    await dialog.getByRole('button', { name: 'Check my read-back', exact: true }).click();
    await dialog.getByText('Your read-back matches the source.', { exact: true }).waitFor();
    await closeDialog(phone);
    assert.equal(await back.getByLabel('Practice report for', { exact: true }).inputValue(), 'Caleb Hill');
    await back.getByText(/^Exercise log/).click();
    await back.getByText('Matched the source during a practice read-back.', { exact: true }).waitFor();
    await back.getByRole('button', { name: 'Post demo reply', exact: true }).click();
    await back.getByText('Keep this preparedness conversation draft.', { exact: true }).waitFor();

    await phone.getByRole('button', { name: 'Back to preparedness', exact: true }).click();
    await assertWorkspace(phone, 'preparedness');
    await phone.goBack();
    await assertWorkspace(phone, 'preparedness', 'fellowship');
    await phone.goForward();
    await assertWorkspace(phone, 'preparedness');
    assert.equal(await front.evaluate(element => element.scrollTop), frontTop);

    await goToWorkspace(phone, 'study');
    await phone.getByRole('button', { name: 'Study discussion', exact: true }).click();
    const mainFellowship = phone.locator('#fellowship');
    await mainFellowship.locator('.fellowship-map-markers').waitFor();
    const memberMap = mainFellowship.locator('.fellowship-map-markers');
    await memberMap.scrollIntoViewIfNeeded();
    const memberMapBox = await memberMap.boundingBox();
    await swipe(phone, 'right', memberMapBox.y + 75, 95);
    await assertWorkspace(phone, 'study', 'fellowship');
    await mainFellowship.getByText('Try the local discussion demo', { exact: true }).click();
    await mainFellowship.getByLabel('Reply', { exact: true }).fill('Keep this weekly discussion draft.');
    const fellowshipTop = await mainFellowship.evaluate(element => element.scrollTop);
    await goToWorkspace(phone, 'preparedness');
    await assertWorkspace(phone, 'preparedness');
    await goToWorkspace(phone, 'study');
    await assertWorkspace(phone, 'study', 'fellowship');
    assert.equal(await mainFellowship.evaluate(element => element.scrollTop), fellowshipTop);
    assert.equal(await mainFellowship.getByLabel('Reply', { exact: true }).inputValue(), 'Keep this weekly discussion draft.');
    assert.equal(await mainFellowship.getByText('Keep this preparedness conversation draft.', { exact: true }).count(), 0);

    // Opening an excursion leaves the current card in place, including theme previews.
    await goToWorkspace(phone, 'preparedness');
    await phone.getByRole('button', { name: 'Resources', exact: true }).click();
    await dialog.getByRole('button', { name: /^Radio Network Map / }).click();
    await dialog.getByLabel('Zone', { exact: true }).selectOption('dickson');
    await dialog.getByText('2 map results', { exact: true }).waitFor();
    await dialog.locator('.prep-map').focus();
    await phone.keyboard.press('ArrowLeft');
    await assertWorkspace(phone, 'preparedness');
    await phone.goBack();
    await dialog.getByRole('heading', { name: 'Preparedness resources', exact: true }).waitFor();
    await phone.goForward();
    await dialog.getByRole('heading', { name: 'Radio Network Map', exact: true }).waitFor();
    assert.equal(await dialog.getByLabel('Zone', { exact: true }).inputValue(), 'dickson');
    await closeDialog(phone);
    await phone.getByRole('button', { name: 'Theme Manager', exact: true }).click();
    await dialog.getByLabel('Olam HaBa', { exact: true }).check();
    await dialog.getByRole('button', { name: 'Save theme', exact: true }).click();
    await closeDialog(phone);
    assert.equal(await phone.locator('html').getAttribute('data-theme'), 'olam-haba');
    await phone.reload();
    await phone.locator('#preparedness-title').waitFor({ state: 'visible' });
    assert.equal(await phone.locator('html').getAttribute('data-theme'), 'olam-haba');
    await phone.getByRole('button', { name: 'Preparedness communications', exact: true }).click();
    await back.getByText('Keep this preparedness conversation draft.', { exact: true }).waitFor();
    await back.getByText('6 checked in · 10 awaiting a check-in', { exact: true }).waitFor();
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth), 390);
    await phone.close();

    const desktop = await pageWith({ viewport: { width: 1440, height: 900 } });
    await desktop.goto(url + '?workspace=preparedness&preparednessFace=communications&week=7');
    await desktop.locator('#communications-title').waitFor({ state: 'visible' });
    // Both workspaces use the original genuine rotateY animation.
    await desktop.waitForFunction(() => getComputedStyle(document.querySelector('#preparedness-stage .turn')).transform.startsWith('matrix3d(-1'));
    await goToWorkspace(desktop, 'learning');
    await desktop.getByRole('button', { name: 'Go to MainStage workspace' }).focus();
    await desktop.keyboard.press('Enter');
    await assertWorkspace(desktop, 'study');
    await desktop.getByRole('button', { name: 'Study discussion', exact: true }).click();
    await desktop.waitForFunction(() => getComputedStyle(document.querySelector('#turn')).transform.startsWith('matrix3d(-1'));
    await goToWorkspace(desktop, 'preparedness');
    await assertWorkspace(desktop, 'preparedness', 'fellowship');
    await desktop.close();

    const small = await pageWith({ ...devices['iPhone SE'], viewport: { width: 320, height: 568 }, reducedMotion: 'reduce' });
    await small.goto(url + '?week=7');
    await small.locator('#study-title').waitFor();
    assert.equal(await small.evaluate(() => document.documentElement.scrollWidth), 320);
    const dock = await small.locator('.dock nav').boundingBox();
    const next = await small.locator('#workspace-switch').boundingBox();
    assert.ok(next.x + next.width <= dock.x + dock.width + 1);
    await small.goto(url + '?card=radiomap');
    await small.getByRole('dialog').getByRole('heading', { name: 'Radio Network Map', exact: true }).waitFor();
    await assertWorkspace(small, 'preparedness');
    await closeDialog(small);
    await small.locator('#preparedness-title').waitFor({ state: 'visible' });
    assert.equal(await small.evaluate(() => document.documentElement.scrollWidth), 320);
    await small.goto(url + '?card=preparedness&view=listen');
    await small.locator('#preparedness-study').getByRole('heading', { name: 'Listen and find local resources', exact: true }).waitFor();
    await assertWorkspace(small, 'preparedness');
    await small.goto(url + '?card=preparedness&view=group');
    await small.locator('#communications-title').waitFor({ state: 'visible' });
    await assertWorkspace(small, 'preparedness', 'fellowship');
    await small.close();
    assert.deepEqual(errors, []);
    console.log('Three-workspace checks passed: native touch swipes, independent sides and exact scroll positions, drafts, map/filter excursions, browser Back/Forward, keyboard controls, 3D rotations, shared themes, local progress and 320px layout.');
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
