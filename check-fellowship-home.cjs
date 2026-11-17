const assert = require('node:assert/strict');
const { chromium, devices } = require(process.env.NEXTPHASE_PLAYWRIGHT || 'playwright');
const { createPreviewServer, pagesMount, startPagesCheck } = require('./serve-preparedness.cjs');
const { publicMembers } = require('./collect-fellowship-map.cjs');
const data = require('./corpus/fellowship/community-map.json');
const sampleTile = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVisAAAAASUVORK5CYII=', 'base64');
const markerCanvas = '.fellowship-map-markers';

function checkExport() {
  assert.deepEqual(Object.keys(data).sort(), ['members', 'outline', 'snapshot']);
  assert.match(data.snapshot, /^[a-f0-9]{64}$/);
  assert.equal(data.members.length, 2000);
  for (const [lon, lat, profile, ...extra] of data.members) {
    assert.ok(Number.isFinite(lon) && Math.abs(lon) <= 180 && Number(lon.toFixed(2)) === lon);
    assert.ok(Number.isFinite(lat) && Math.abs(lat) <= 90 && Number(lat.toFixed(2)) === lat);
    for (const [field, value] of Object.entries(profile ?? {})) {
      assert.ok(['name', 'area', 'description', 'website'].includes(field));
      assert.equal(typeof value, 'string');
      assert.doesNotMatch(value, /(?:[^\s@]+@[^\s@]+|mailto:|tel:)/i);
      if (field === 'website') assert.match(value, /^https?:\/\//i);
    }
    assert.equal(extra.length, 0);
  }
  const publish = (Name, visibility = '-1', Coordinates = '-95.14766,29.52427', description = '') => ({
    properties: { Name, visibility, Coordinates, description, uid: 'private-id' },
  });
  const sourceNote = 'Address: 9 Main Street<br>Email: person@example.com<br>Phone: 817-555-0100<br>City: Exampletown<br>State/Province: Texas<br>Country: USA<br>Zip Code: 75800<br>Website: example.org/study?email=person@example.com<br>Comments: We study Genesis 1:1.<br>Reach me at person&#64;example.com or (312) 555-0101.<br>Meet at 11 Elm Road near 31.1234, -87.5432.';
  const rows = publicMembers({ features: [publish('Jane Smith', '-1', '-95.14766,29.52427', sourceNote), publish('phone@example.com'),
    publish('9 Main Street'), publish('Unlisted Person', '0'), publish('Bad Location', '-1', ',30'),
    publish('Public Member', '-1', '-95,29', 'Website: https://wa.me/16155550100<br>Comments: Send a note at c [at] example [dot] com.')] });
  const [lon, lat, restored] = rows[0];
  assert.deepEqual([lon, lat], [-95.15, 29.52]);
  assert.equal(restored.name, 'Jane Smith');
  assert.equal(restored.area, 'Exampletown, Texas, USA');
  assert.equal(restored.website, 'https://example.org/study');
  assert.match(restored.description, /^We study Genesis 1:1\./);
  assert.match(restored.description, /\[contact detail hidden\]/);
  assert.doesNotMatch(JSON.stringify(rows), /example\.com|555-010[01]|Main Street|Elm Road|75800|31\.1234|87\.5432|wa\.me|private-id|Unlisted Person/);
  assert.deepEqual(rows.slice(1, 3), [[-95.15, 29.52], [-95.15, 29.52]]);
  assert.equal(rows.length, 4);
}

function pixel([lon, lat], view, width, height, { projectMap, mapBaseScale }) {
  const [x, y] = projectMap([lon, lat]);
  const base = mapBaseScale(width, height);
  const scale = base * view.zoom;
  const halfHeight = Math.min(0.5, height / (2 * scale));
  const centerY = Math.max(halfHeight, Math.min(view.y, 1 - halfHeight));
  const dx = x - view.x;
  return { x: width / 2 + (dx - Math.round(dx)) * scale, y: height / 2 + (y - centerY) * scale };
}

const canvasReady = selector => {
  const canvas = document.querySelector(selector);
  return canvas && canvas.width === Math.round(canvas.clientWidth * Math.min(devicePixelRatio || 1, 2));
};

async function run() {
  checkExport();
  const { fitNearby } = await import('./fellowship-map.js');
  const tileMath = await import('./fellowship-street-map.js');
  const [tileX, tileY] = tileMath.projectMap([-0.09, 51.5]);
  assert.ok(Math.floor(tileX * 256) === 127 && Math.floor(tileY * 256) === 85);
  const edgeTiles = tileMath.viewportTiles({ x: 0.99, y: 0.5, scale: 1024, width: 270, height: 220 });
  assert.ok(edgeTiles.some(tile => tile.key.startsWith('2/4/') && tile.url.includes('/2/0/')));
  const location = [-87.4, 36.1];
  const eastern = fitNearby(data.members, location, 330, 215);
  assert.equal(eastern.indices.length, 100);
  assert.ok(eastern.view.zoom > 1);
  const dateLine = fitNearby([[179, -41], [-179, -42], [-178, -42]], [179, -41], 330, 215);
  assert.ok(dateLine.view.zoom > 50);

  const server = createPreviewServer({ mount: pagesMount });
  const url = await startPagesCheck(server);
  const origin = new URL(url).origin;
  const errors = [];
  const external = [];
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.NEXTPHASE_CHROME || undefined,
      args: ['--disk-cache-size=1048576', '--media-cache-size=1048576'] });
    const open = async (options, direct) => {
      const page = await browser.newPage(options);
      page.setDefaultTimeout(9000);
      let requests = 0;
      let streetTiles = !direct;
      const tileRequests = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => {
        const request = new URL(route.request().url());
        if (request.origin === 'https://tile.openstreetmap.org') {
          tileRequests.push(request.href);
          return streetTiles ? route.fulfill({ contentType: 'image/png', body: sampleTile }) : route.abort();
        }
        if (request.origin !== origin) { external.push(request.origin); return route.abort(); }
        if (request.pathname.endsWith('/community-map.json') && ++requests === 1 && direct) return route.abort();
        return route.continue();
      });
      return { page, mapRequests: () => requests, tileRequests, enableTiles: () => { streetTiles = true; } };
    };
    const { page: phone, mapRequests, tileRequests } = await open({ ...devices['iPhone 13'],
      viewport: { ...devices['iPhone 13'].viewport, height: 570 }, permissions: ['geolocation'],
      geolocation: { longitude: location[0], latitude: location[1] } }, false);
    await phone.goto(url + '?week=7');
    await phone.locator('#study-title').waitFor();
    const studyScroll = await phone.locator('#study').evaluate(element => { element.scrollTop = 145; return element.scrollTop; });
    assert.equal(mapRequests(), 0);
    assert.deepEqual(tileRequests, []);
    await phone.getByRole('button', { name: 'Study discussion' }).click();
    const home = phone.getByRole('region', { name: 'HomeGroups around the world' });
    await home.getByText('2,000 legacy map listings.', { exact: false }).waitFor();
    const canvas = home.locator(markerCanvas);
    await phone.waitForFunction(canvasReady, markerCanvas);
    const image = () => canvas.evaluate(element => element.toDataURL());
    const world = await image();
    await home.locator('.fellowship-map-streets img:visible').first().waitFor();
    assert.equal(await home.getByRole('link', { name: '© OpenStreetMap contributors' }).getAttribute('href'), 'https://www.openstreetmap.org/copyright');
    await home.getByText('Regionalizing…', { exact: true }).waitFor();
    await home.getByText('Showing the 100 closest map listings.').waitFor();
    const focused = await image();
    assert.notEqual(focused, world);

    const { width, height } = await canvas.evaluate(element => ({ width: element.clientWidth, height: element.clientHeight }));
    const nearby = fitNearby(data.members, location, width, height);
    const chosen = nearby.indices.find(index => {
      const point = data.members[index];
      const { x, y } = pixel(point, nearby.view, width, height, tileMath);
      return point[2]?.name && point[2].description && x > 12 && y > 55 && x < width - 12 && y < height - 24
        && nearby.indices.every(other => other === index || Math.hypot(data.members[other][0] - point[0], data.members[other][1] - point[1]) > 0.025);
    });
    assert.ok(Number.isInteger(chosen));
    await canvas.tap({ position: pixel(data.members[chosen], nearby.view, width, height, tileMath) });
    await home.locator('.fellowship-map-streets img[src*="/6/"]:visible, .fellowship-map-streets img[src*="/5/"]:visible').first().waitFor();
    const profile = home.locator('.fellowship-map-profile');
    const details = data.members[chosen][2];
    await profile.getByText(details.name, { exact: true }).waitFor();
    assert.ok(await profile.evaluate(element => {
      const popup = element.getBoundingClientRect();
      const map = element.parentElement.getBoundingClientRect();
      const face = element.closest('#fellowship').getBoundingClientRect();
      const close = element.querySelector('button').getBoundingClientRect();
      return popup.top >= Math.max(map.top, face.top) && popup.bottom <= Math.min(map.bottom, face.bottom)
        && popup.bottom <= innerHeight && element.contains(document.elementFromPoint(close.x + close.width / 2, close.y + close.height / 2));
    }), 'A marker tap should keep the popup and its close control visible above the map and inside the reading area.');
    assert.equal(await profile.locator('.fellowship-profile-description').textContent(), details.description);
    if (details.area) await profile.getByText(details.area, { exact: true }).waitFor();
    if (details.website) assert.equal(await profile.getByRole('link', { name: 'Visit public website' }).getAttribute('href'), details.website);
    await profile.getByText('Legacy map listing · Approximate location').waitFor();
    const invite = profile.getByRole('button', { name: 'Invite to conversation' });
    const route = phone.url();
    const mapScroll = await home.evaluate(element => element.closest('#fellowship').scrollTop);
    await invite.click();
    const invitation = phone.getByRole('dialog', { name: 'Invite to conversation' });
    await invitation.getByText('Use the signed-in Fellowship preview to email an invitation.').waitFor();
    assert.equal(phone.url(), route);
    await invitation.getByRole('button', { name: 'Close', exact: true }).click();
    await profile.getByText(details.name, { exact: true }).waitFor();
    assert.equal(await home.evaluate(element => element.closest('#fellowship').scrollTop), mapScroll);
    assert.ok(await invite.evaluate(element => element === document.activeElement));
    await profile.getByRole('button', { name: 'Close' }).click();
    await home.getByRole('button', { name: 'View World' }).click();
    await phone.waitForFunction(value => document.querySelector('.fellowship-map-markers').toDataURL() === value, world);
    await canvas.scrollIntoViewIfNeeded();
    const touchBounds = await canvas.boundingBox();
    const touchX = touchBounds.x + touchBounds.width / 2;
    const touchY = touchBounds.y + touchBounds.height / 2;
    const touches = spread => [{ x: touchX - spread, y: touchY, id: 1 }, { x: touchX + spread, y: touchY, id: 2 }];
    const touch = await phone.context().newCDPSession(phone);
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touches(16) });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touches(48) });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.notEqual(await image(), world);
    await home.getByRole('button', { name: 'View World' }).click();
    await phone.waitForFunction(value => document.querySelector('.fellowship-map-markers').toDataURL() === value, world);
    await home.getByRole('button', { name: 'Find members' }).click();
    const member = home.locator('.fellowship-map-list').getByRole('button').first();
    const label = await member.innerText();
    await member.focus();
    await member.press('Enter');
    await profile.getByText(label, { exact: true }).waitFor();
    await profile.press('Escape');
    await profile.waitFor({ state: 'hidden' });
    assert.equal(await member.evaluate(element => element === document.activeElement), true);
    await phone.getByRole('button', { name: 'Back to study' }).click();
    assert.equal(await phone.locator('#study').evaluate(element => element.scrollTop), studyScroll);
    assert.ok(tileRequests.every(url => /^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/.test(url)));
    const modules = {
      'firebase-app.js': 'export const getApps = () => []; export const initializeApp = () => ({});',
      'firebase-auth.js': `export const getAuth = () => ({}); export const setPersistence = async () => {};
        export const browserSessionPersistence = {}; export class GoogleAuthProvider { setCustomParameters() {} }
        export function onAuthStateChanged(_auth, change) {
          void change({ uid: 'member', displayName: 'Test Sender', getIdToken: async () => 'test-member-token' });
          return () => {};
        }`,
      'firebase-firestore.js': `export const getFirestore = () => ({}); export const doc = () => ({});
        export const collection = () => ({}); export const getDocFromServer = async () => ({ exists: () => true, data: () => ({ open: true }) });
        export const query = () => ({}); export const orderBy = () => ({}); export const limit = () => ({});
        export function onSnapshot(_query, _options, next) {
          next({ metadata: { fromCache: false }, docs: [{ metadata: { hasPendingWrites: false },
            data: () => ({ authorId: 'member', body: 'A reply from the Firestore test fixture.' }) }] });
          return () => {};
        }`,
    };
    await phone.route('https://www.gstatic.com/firebasejs/13.3.0/**', route => route.fulfill({
      body: modules[new URL(route.request().url()).pathname.split('/').at(-1)], contentType: 'text/javascript',
      headers: { 'Access-Control-Allow-Origin': '*' },
    }));
    await phone.route('**/__fellowship-firebase/config', route => route.fulfill({ json: { projectId: 'homegroups-fellowship' } }));
    const sent = [];
    await phone.route('**/__fellowship-email/invite', route => {
      const request = route.request();
      sent.push({ method: request.method(), auth: request.headers().authorization, payload: request.postDataJSON() });
      return route.fulfill({ status: 202, json: { code: 'accepted' } });
    });
    await phone.goto(url + '?face=fellowship&pilot=firebase&week=7');
    await phone.getByText('Signed in as Test Sender.', { exact: true }).waitFor();
    await phone.getByRole('region', { name: 'Weekly conversation' }).getByText('A reply from the Firestore test fixture.').waitFor();
    await home.getByRole('button', { name: 'View World' }).click();
    await home.getByRole('button', { name: 'Find members' }).click();
    await member.click();
    await invite.click();
    await invitation.getByText('The email service accepted your invitation.', { exact: false }).waitFor();
    assert.equal(sent.length, 1);
    assert.equal(sent[0].method, 'POST');
    assert.equal(sent[0].auth, 'Bearer test-member-token');
    assert.deepEqual(Object.keys(sent[0].payload).sort(), ['marker', 'snapshot', 'week']);
    assert.equal(sent[0].payload.snapshot, data.snapshot);
    assert.equal(sent[0].payload.week, 7);
    await phone.close();

    const { page, enableTiles } = await open({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }, true);
    await page.addInitScript(() => {
      window.locationRequests = 0;
      navigator.geolocation.getCurrentPosition = (found, unavailable) => {
        window.locationRequests++;
        window.resolveFellowshipLocation = () => found({ coords: { longitude: -87.4, latitude: 36.1 } });
        window.denyFellowshipLocation = unavailable;
      };
    });
    await page.goto(url + '?face=fellowship&week=7');
    await page.getByRole('button', { name: 'Try map again' }).click();
    const map = page.locator(markerCanvas);
    await page.waitForFunction(canvasReady, markerCanvas);
    await page.getByText('Street detail is unavailable.', { exact: false }).waitFor();
    const backdrop = page.locator('.fellowship-map-backdrop');
    assert.ok(await backdrop.evaluate(canvas => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some((value, index) => index % 4 === 3 && value > 0)));
    const baseImage = await map.evaluate(element => element.toDataURL());
    await page.getByText('Regionalizing…', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'View World' }).click();
    await page.evaluate(() => window.resolveFellowshipLocation());
    assert.equal(await map.evaluate(element => element.toDataURL()), baseImage);
    assert.equal(await page.getByText('Showing the 100 closest map listings.').count(), 0);
    await page.getByRole('button', { name: 'Zoom in' }).click();
    const zoomed = await map.evaluate(element => element.toDataURL());
    assert.notEqual(zoomed, baseImage);
    const bounds = await map.boundingBox();
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width / 2 + 80, bounds.y + bounds.height / 2, { steps: 4 });
    await page.mouse.up();
    assert.notEqual(await map.evaluate(element => element.toDataURL()), zoomed);
    await page.getByRole('button', { name: 'Back to study' }).click();
    await page.getByRole('button', { name: 'Study discussion' }).click();
    assert.equal(await page.evaluate(() => window.locationRequests), 1);
    await page.getByRole('button', { name: 'Find nearby' }).click();
    await page.evaluate(() => window.denyFellowshipLocation());
    await page.getByText('Location is unavailable. You can still explore the map.').waitFor();
    await page.getByRole('button', { name: 'Retry streets' }).waitFor();
    enableTiles();
    await page.getByRole('button', { name: 'Retry streets' }).click();
    await page.locator('.fellowship-map-streets img:visible').first().waitFor();
    await page.getByRole('button', { name: 'Retry streets' }).waitFor({ state: 'hidden' });
    const weekly = page.getByRole('region', { name: 'Weekly conversation' });
    await weekly.getByRole('heading', { name: /discussion/ }).first().waitFor();
    assert.equal(await weekly.getByText('Fellowship demo', { exact: true }).isVisible(), false);
    assert.equal(await page.getByText('Browse visible members', { exact: true }).count(), 0);
    await weekly.getByRole('link', { name: 'Open weekly conversation' }).waitFor();
    await weekly.getByText('Try the local discussion demo', { exact: true }).click();
    await weekly.getByRole('button', { name: 'Post demo reply' }).waitFor();
    assert.equal(await page.getByRole('button', { name: /^Invite to Game/ }).count(), 0);
    await page.getByRole('button', { name: 'Fellowship actions' }).click();
    await page.getByRole('button', { name: /^Invite to Game/ }).click();
    await page.getByRole('dialog', { name: 'Invite to Game' }).getByRole('heading', { name: 'Invite someone' }).waitFor();
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Invitations', exact: true }).click();
    await page.getByRole('button', { name: 'Try a sample invitation' }).click();
    const review = page.getByRole('dialog', { name: 'Conversation invitation' });
    await review.getByRole('button', { name: 'Decline', exact: true }).click();
    await review.getByText('Invitation declined.', { exact: true }).waitFor();
    assert.equal(await review.getByRole('button', { name: 'Open demo conversation' }).count(), 0);
    await review.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Try a sample invitation' }).click();
    await review.getByRole('button', { name: 'Accept', exact: true }).click();
    await review.getByRole('button', { name: 'Open demo conversation' }).click();
    await page.getByRole('dialog', { name: 'Private conversation' }).waitFor();
    const decisions = [];
    await page.route('**/__fellowship-email/respond', route => {
      const { token, decision } = route.request().postDataJSON();
      assert.equal(token, '1'.repeat(64));
      decisions.push(decision);
      return route.fulfill({ json: decision ? { code: 'accepted' }
        : { code: 'pending', sender: 'Test Sender', week: 7, reading: 'Genesis 28:10-32:3' } });
    });
    await page.goto(url + '?face=fellowship&week=7&review-test=1#conversation-invite=' + '1'.repeat(64));
    await review.getByText(/Test Sender invited you/).waitFor();
    assert.equal(new URL(page.url()).hash, '');
    await review.getByRole('button', { name: 'Accept', exact: true }).click();
    await review.getByText('Invitation accepted. Private messaging is still being set up.').waitFor();
    assert.deepEqual(decisions, [undefined, 'accept']);
    await page.close();

    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log('Fellowship home passed: compact map and game controls, genuine discussion entry, opt-in demos, sign-in gate, and invitation accept and decline.');
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
