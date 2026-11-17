const { createHash } = require('node:crypto');

// This is the visibility value shared by the audited legacy map feed. Leave unknown values private.
const publicMapVisibility = '-1';
const displayName = /^[\p{L}][\p{L}\p{M} .,'’&()\u2011/-]{0,99}$/u;
const placeName = /^[\p{L}][\p{L}\p{M} .,'’()\u2011-]{0,59}$/u;
const privateField = /^(?:e-?mail(?: address)?|phone(?: number)?|(?:cell|mobile|home|work)(?: phone)?|telephone|fax|contact(?: info| information)?|(?:home |street |mailing |physical )?address(?: line [12])?|zip(?: code)?|postal(?: code)?|post ?code|latitude|longitude|coordinates)$/i;
const locationFields = new Map([['city', 'city'], ['state', 'state'], ['province', 'state'], ['state/province', 'state'], ['country', 'country']]);
const commentFields = new Set(['comments', 'comment', 'notes', 'about', 'bio', 'description']);
const webFields = new Set(['website', 'website address', 'web site']);
const email = /[\p{L}\p{N}.!#$%&'*+/=?^_`{|}~-]+\s*(?:@|\[at\]|\(at\))\s*[\p{L}\p{N}.-]+(?:\s*(?:\[dot\]|\(dot\))\s*[\p{L}\p{N}.-]+)*/giu;
const telephone = /(?<![\p{L}\p{N}])(?:\+?\(?\d(?:[ \t().-]*\d){6,24})(?:\)?[ \t]*(?:x|ext\.?|extension)\s*\d+)?(?![\p{L}\p{N}])/giu;
const street = /(?<![\p{L}\p{N}])\d{1,6}[ \t]+(?:[\p{L}\p{N}.'’-]+[ \t]+){1,6}(?:street|avenue|road|drive|lane|boulevard|court|circle|highway|parkway|terrace|place|trail|way|loop|st|ave|rd|dr|ln|blvd|ct|cir|hwy|pkwy|ter|pl|trl)\b\.?/giu;
const coordinatePair = /[+-]?\b\d{1,3}\.\d{2,}\s*[,;]\s*[+-]?\d{1,3}\.\d{2,}\b/g;
const directHost = /(?:^|\.)(?:wa\.me|whatsapp\.com|m\.me|messenger\.com|t\.me|telegram\.me|signal\.me)$/i;
const hidden = '[contact detail hidden]';

function plainText(value) {
  const entities = { nbsp: ' ', amp: '&', apos: "'", quot: '"', lt: '<', gt: '>' };
  return String(value ?? '').replace(/&(#x[\da-f]+|#\d+|nbsp|amp|apos|quot|lt|gt);/gi, (match, code) => {
    if (!code.startsWith('#')) return entities[code.toLowerCase()];
    const point = Number(code.slice(1).replace(/^x/i, '0x'));
    return point >= 32 && point <= 0x10ffff ? String.fromCodePoint(point) : ' ';
  }).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').replace(/\r\n?/g, '\n').trim();
}

function redactContact(text, knownContact = []) {
  for (const value of knownContact) {
    if (value.length < 6) continue;
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(escaped, 'giu'), hidden);
  }
  return text.replace(/\b(?:mailto|tel|sms|callto|skype):[^\s]+/gi, hidden)
    .replace(/\b(?:e-?mail(?: address)?|phone(?: number)?|telephone|mobile|fax|contact info(?:rmation)?|(?:street |home |mailing )?address|zip(?: code)?|postal code|coordinates)\s*:\s*[^\n]+/gi, hidden)
    .replace(coordinatePair, hidden)
    .replace(/\bP\.?\s*O\.?\s*Box\s*\d+\b/gi, hidden)
    .replace(street, hidden)
    .replace(email, hidden)
    .replace(telephone, hidden);
}

function publicWebsite(value, knownContact) {
  const text = value.trim().replace(/[.,;]+$/, '');
  if (!text || /\s|^\/|^\w+:(?!\/\/)/.test(text)) return '';
  try {
    const url = new URL(/^[a-z][\w+.-]*:\/\//i.test(text) ? text : `https://${text}`);
    const hostname = url.hostname;
    const path = decodeURIComponent(url.pathname);
    const publicGroup = /(?:^|\.)(?:facebook|fb)\.com$/i.test(hostname) && /^\/groups\/\d{1,24}\/?$/.test(path);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port
      || !/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(hostname) || directHost.test(hostname)
      || /\/(?:dm|direct|messages?)(?:\/|$)/i.test(path) || (!publicGroup && redactContact(path, knownContact) !== path)) return '';
    // Drop query and fragment data. Keep a valid YouTube video ID when the original links to a watch page.
    const video = /(?:^|\.)youtube\.com$/i.test(hostname) && path === '/watch' && url.searchParams.get('v');
    url.search = /^[A-Za-z0-9_-]{11}$/.test(video || '') ? `?v=${video}` : '';
    url.hash = '';
    return url.href;
  } catch {
    return '';
  }
}

function publicProfile(properties) {
  const places = new Map();
  const knownContact = [];
  const comments = [];
  let website = '';
  let collectingComment = false;
  for (const raw of plainText(properties.description || properties.Description).split('\n')) {
    const line = raw.trim();
    const field = /^([a-z][a-z /-]{0,30})\s*:\s*(.*)$/i.exec(line);
    const key = field?.[1].trim().toLowerCase();
    if (privateField.test(key || '')) {
      knownContact.push(field[2]);
      collectingComment = false;
    } else if (locationFields.has(key)) {
      if (placeName.test(field[2])) places.set(locationFields.get(key), field[2]);
      collectingComment = false;
    } else if (webFields.has(key)) {
      website = field[2];
      collectingComment = false;
    } else if (commentFields.has(key)) {
      comments.push(field[2]);
      collectingComment = true;
    } else if (collectingComment) {
      comments.push(line);
    }
  }

  const name = plainText(properties.Name || properties.name || properties.Title || properties.title).replace(/\s+/g, ' ');
  const area = [...new Set(['city', 'state', 'country'].map(key => places.get(key)).filter(Boolean))].join(', ');
  const note = comments.join('\n').replace(/\b(?:https?:\/\/|www\.)[^\s<>]+/gi, value => publicWebsite(value, knownContact) || '[link hidden]');
  const description = redactContact(note, knownContact).trim();
  const url = publicWebsite(website, knownContact);
  const profile = {};
  if (displayName.test(name) && !/\b[\w-]+\.[a-z]{2,}\b/i.test(name) && redactContact(name, knownContact) === name) profile.name = name;
  if (area && redactContact(area, knownContact) === area) profile.area = area;
  if (description && description !== hidden) profile.description = description;
  if (url) profile.website = url;
  return profile;
}

function publicMembers(legacy, record) {
  const members = [];
  for (const { properties } of legacy.features) {
    if (String(properties?.visibility) !== publicMapVisibility) continue;
    const raw = properties.Coordinates;
    const parts = typeof raw === 'string' ? raw.split(',') : raw;
    if (!Array.isArray(parts) || parts.length < 2 || !parts.slice(0, 2).every(part => String(part ?? '').trim())) continue;
    const lon = Number(parts[0]);
    const lat = Number(parts[1]);
    if (!Number.isFinite(lon) || Math.abs(lon) > 180 || !Number.isFinite(lat) || Math.abs(lat) > 90) continue;

    // The legacy marker placement rounds to two decimals. Only the filtered profile goes with it.
    const marker = [Number(lon.toFixed(2)), Number(lat.toFixed(2))];
    const profile = publicProfile(properties);
    if (Object.keys(profile).length) marker.push(profile);
    record?.(properties, members.length);
    members.push(marker);
  }
  return members;
}

function snapshotId(source) {
  return createHash('sha256').update(source.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')).digest('hex');
}

function emailOnFile(properties) {
  const fields = [...plainText(properties.description || properties.Description).matchAll(/^\s*e-?mail(?: address)?\s*:\s*([^\n]*)/gim)];
  const address = fields.length === 1 ? fields[0][1].trim() : '';
  return validMailbox(address) ? address : '';
}

function validMailbox(address) {
  return typeof address === 'string' && address.length <= 254
    && /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[A-Z0-9-]+\.)+[A-Z]{2,}$/i.test(address);
}

function buildCommunityMap(legacy, land) {
  const polygons = land.features.flatMap(({ geometry }) => geometry.type === 'Polygon'
    ? [geometry.coordinates] : geometry.coordinates);
  const outline = polygons.map(([outer]) => outer.map(point => point.map(number => Math.round(number * 10) / 10)));
  return { members: publicMembers(legacy), outline };
}

if (require.main === module) {
  const { readFileSync, writeFileSync } = require('node:fs');
  const [legacyPath, landPath, outputPath] = process.argv.slice(2);
  if (!outputPath) throw new Error('Provide the legacy GeoJSON, Natural Earth land file, and output path.');
  const read = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
  const source = readFileSync(legacyPath, 'utf8').replace(/^\uFEFF/, '');
  const { members, outline } = buildCommunityMap(JSON.parse(source), read(landPath));
  const rows = list => list.map(row => `    ${JSON.stringify(row)}`).join(',\n');
  writeFileSync(outputPath, `{\n  "snapshot": "${snapshotId(source)}",\n  "members": [\n${rows(members)}\n  ],\n  "outline": [\n${rows(outline)}\n  ]\n}\n`);
}

module.exports = { publicMembers, snapshotId, emailOnFile, validMailbox };
