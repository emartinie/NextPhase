
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

async function checkData() {
  const resources = await import('./preparedness-resources.js');
  const asset = name => path.resolve(__dirname, 'corpus/preparedness', name);
  const raw = await fs.readFile(asset('be-ready-catalog.json'));
  const hash = crypto.createHash('sha1').update('blob ' + raw.length + '\0').update(raw).digest('hex');
  assert.equal(hash, '21813837b36cd1546a23be533e7f0182a3d272a1');
  const catalog = JSON.parse(raw);
  assert.equal(catalog.files.length, 1061);
  assert.equal(new Set(catalog.files.map(file => file.id)).size, 1061);
  assert.equal(Object.keys(catalog.folderMap).length, 70);
  assert.equal(catalog.skippedPDFs.length, 20);
  assert.equal(resources.searchCatalog(catalog.files, { query: 'field antenna handbook' }).length, 1);
  assert.equal(resources.searchCatalog(catalog.files, { folder: '9-Comms' }).length, 0);
  const sources = JSON.parse(await fs.readFile(asset('be-ready-source-links.json')));
  assert.equal(Object.keys(sources.folderUrls).length, 8);
  assert.equal(Object.keys(sources.archiveLinks).length, 8);
  assert.equal(resources.catalogLocation(catalog.files[0], sources).archives[0].title, 'Home Canning and More.rar');
  assert.equal(resources.catalogLocation(catalog.files.find(file => file.path.startsWith('General\\')), sources).url, sources.root);
  const research = JSON.parse(await fs.readFile(asset('research-backlog.json')));
  assert.deepEqual(research.map(topic => topic.id), Array.from({ length: 36 }, (_, i) => 1824 + i));
  const geography = JSON.parse(await fs.readFile(asset('tn-ky-counties.geojson')));
  assert.equal(geography.features.length, 215);
  assert.ok(Object.values(resources.countyIds).every(id => geography.features.some(feature => feature.properties.GEOID === id)));
  assert.deepEqual(resources.radioPoints.filter(point => point.status).map(point => [point.label, point.lat, point.lng, point.status]), [
    ['Dickson Repeater', 36.1, -87.4, 'active'], ['Field Node', 36.3, -86.8, 'planned'],
  ]);
}

async function checkMigration(browser, url, phoneProfile) {
  const mobile = await browser.newContext({
    ...phoneProfile, permissions: ['geolocation'], geolocation: { longitude: -87.36, latitude: 36.13 },
  });
  const page = await mobile.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  const externalRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.url().startsWith('https://')) externalRequests.push(request.url());
  });
  const dialog = page.locator('dialog');
  const button = name => dialog.getByRole('button', { name, exact: typeof name === 'string' });
  const field = name => dialog.getByLabel(name, { exact: true });
  const exactText = value => dialog.getByText(value, { exact: true });
  const heading = name => dialog.getByRole('heading', { name, exact: true }).waitFor();
  const back = () => button('Back').click();
  try {
    await page.goto(url + '?card=beready');
    await heading('Be Ready library');
    await exactText('1,061 records · Showing 1–24').waitFor();
    await button('Next records').click();
    await exactText('1,061 records · Showing 25–48').waitFor();
    await button('Previous records').click();
    await field('Search the catalog').fill('470 crock pot');
    await exactText('1 record · Showing 1–1').waitFor();
    await button(/470 crock pot/).click();
    await heading('470 crock pot recipes.pdf');
    assert.match(await dialog.getByRole('link', { name: /Open matched source folder/ }).getAttribute('href'), /^https:\/\/drive\.google\.com\/drive\/folders\//);
    assert.match(await dialog.getByRole('link', { name: /Home Canning and More.rar/ }).getAttribute('href'), /^https:\/\/drive\.google\.com\/file\/d\//);
    assert.equal(await dialog.getByRole('link', { name: /Open matching source file/ }).count(), 0);
    await back();
    assert.equal(await field('Search the catalog').inputValue(), '470 crock pot');
    await field('Search the catalog').fill('treatise on food conservation');
    await button(/A Treatise on Food Conservation/).click();
    assert.equal(await dialog.getByRole('link', { name: /Read the public edition/ }).getAttribute('href'), 'https://archive.org/details/treatiseonfoodco00snyd');
    await back();
    await field('Search the catalog').fill('');
    await field('Browse by folder').selectOption('9-Comms\\Handheld\\Baofang');
    await exactText('This folder is listed but has no indexed PDFs.').waitFor();
    await field('Browse by folder').selectOption('');
    await button('Comms').click();
    assert.ok(await dialog.locator('.prep-list .prep-row').count() > 0);
    await field('Search the catalog').fill('no-record-should-match');
    await exactText('No matching records.').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);

    await page.goto(url + '?card=radiomap');
    await heading('Radio Network Map');
    await exactText('5 map results').waitFor();
    await page.waitForFunction(() => document.querySelectorAll('.prep-boundaries path').length === 215);
    await field('Zone').selectOption('dickson');
    await exactText('2 map results').waitFor();
    await field('Original fixture status').selectOption('active');
    await exactText('1 map result').waitFor();
    await dialog.locator('.prep-markers').getByRole('button', { name: 'Dickson Repeater' }).focus();
    await page.keyboard.press('Enter');
    await heading('Dickson Repeater');
    await exactText('Original fixture status · active. Frequency, offset, tone and operating status are unknown.').waitFor();
    await button('Reset filters').click();
    await field('Source').selectOption('published');
    await exactText('2 map results').waitFor();
    const initialBounds = await dialog.locator('svg.prep-map').getAttribute('viewBox');
    await button('Zoom in').click();
    assert.notEqual(await dialog.locator('svg.prep-map').getAttribute('viewBox'), initialBounds);
    await field('Search radio points').fill('147.375');
    await dialog.locator('.prep-list').getByRole('button', { name: /KG4HDZ/ }).click();
    await exactText('146.2 Hz').waitFor();
    await exactText('+0.600 MHz').waitFor();
    await button('Amateur radio resources').click();
    await heading('Amateur radio resources');
    await exactText('Quick frequencies').click();
    await exactText('462.5625 MHz · GMRS Channel 1').click();
    await exactText('Shared U.S. FRS and GMRS channel 1. Separate equipment and licensing rules apply.').waitFor();
    await exactText('Build a loadout').click();
    await field('Extra batteries').check();
    await button('Log a practice contact').click();
    await field('Practice call sign or station label').fill('EXERCISE 01');
    await field('Practice contact notes').fill('<b>Fictional contact</b>');
    await button('Save practice contact').click();
    await exactText('<b>Fictional contact</b>').waitFor();
    await page.reload();
    await exactText('<b>Fictional contact</b>').waitFor();
    await button('Remove EXERCISE 01').click();
    await exactText('No local practice contacts yet.').waitFor();

    await page.goto(url + '?card=prayermap');
    await heading('Prayer Map');
    await page.waitForFunction(() => document.querySelectorAll('.prep-boundaries path').length === 215);
    await button('Use my approximate area').click();
    await exactText('Showing the Dickson area. Your coordinates were not saved.').waitFor();
    await exactText('2 map results').waitFor();
    await field('HomeGroups').uncheck();
    await exactText('1 map result').waitFor();
    await exactText('Add a private prayer note').click();
    await field('Prayer area').selectOption('winchester');
    await field('Private practice prayer note').fill('Fictional prayer for neighbors');
    await field('Show an approximate area marker in this browser').check();
    await button('Save private prayer note').click();
    await exactText('Private prayer note saved on this device.').waitFor();
    await page.reload();
    await field('Search the prayer map').fill('Fictional prayer for neighbors');
    await exactText('1 map result').waitFor();
    await dialog.locator('.prep-list').getByRole('button', { name: /Fictional prayer for neighbors/ }).click();
    const savedPrayer = await page.evaluate(() => JSON.parse(localStorage.getItem('nextphase-prayer-map-private-v1')));
    assert.equal(savedPrayer[0].zone, 'winchester');
    assert.deepEqual(Object.keys(savedPrayer[0]).sort(), ['id', 'label', 'layer', 'local', 'zone']);
    await button('Remove private prayer note').click();
    await exactText('No map results for these filters.').waitFor();
    await page.goto(url + '?card=preparedness&section=research');
    await exactText('36 of 36 research topics').waitFor();
    await field('Find a research topic').fill('1846');
    await exactText('1 of 36 research topics').waitFor();
    assert.match(await dialog.getByRole('link', { name: /CHIRP Programming Standards/ }).getAttribute('href'), /#L1931$/);
    assert.deepEqual(errors, []);
    assert.deepEqual(externalRequests, []);
  } finally {
    await mobile.close();
  }

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await desktop.goto(url + '?face=fellowship');
    await desktop.getByLabel('Reply', { exact: true }).fill('Preserve this draft.');
    await desktop.getByRole('button', { name: 'Preparedness', exact: true }).click();
    await desktop.getByRole('button', { name: 'Plan & learn', exact: true }).click();
    await desktop.getByRole('button', { name: /Radio Network Map Find legacy/ }).click();
    await desktop.getByText('5 map results', { exact: true }).waitFor();
    await desktop.getByRole('button', { name: 'Open the Prayer Map', exact: true }).click();
    await desktop.getByRole('heading', { name: 'Prayer Map', exact: true }).waitFor();
    await desktop.getByRole('button', { name: 'Back', exact: true }).click();
    await desktop.getByRole('heading', { name: 'Radio Network Map', exact: true }).waitFor();
    await desktop.getByRole('button', { name: 'Close', exact: true }).click();
    await desktop.locator('dialog').waitFor({ state: 'hidden' });
    assert.equal(await desktop.getByLabel('Reply', { exact: true }).inputValue(), 'Preserve this draft.');
    assert.equal(await desktop.evaluate(() => document.activeElement.textContent), 'Preparedness');
  } finally {
    await desktop.close();
  }
  console.log('Migration passed on mobile and desktop: pinned catalog, browse/search/filter/source fallback, county map/zoom/keyboard, radio source classes and credits, kit/log persistence, private approximate Prayer Map, research links, and Fellowship draft/focus return.');
}

module.exports = { checkData, checkMigration };
