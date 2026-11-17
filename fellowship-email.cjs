const { createHash, randomBytes } = require('node:crypto');
const { readFileSync, realpathSync } = require('node:fs');
const path = require('node:path');
const { publicMembers, snapshotId, emailOnFile, validMailbox } = require('./collect-fellowship-map.cjs');

const emailRoute = '/__fellowship-email/invite';
const reviewRoute = '/__fellowship-email/respond';
const firebaseProject = 'homegroups-fellowship';
const dailyLimit = 3;

function reply(response, status, code, details = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify({ code, ...details }));
}

async function readRequest(request) {
  const parts = [];
  let bytes = 0;
  for await (const part of request) {
    bytes += part.length;
    if (bytes > 1024) return null;
    parts.push(part);
  }
  try { return JSON.parse(Buffer.concat(parts)); } catch { return null; }
}

function createConversationEmail({ snapshot, recipients, studies, authorize, deliver, reviewUrl }) {
  const requested = new Map();
  const byToken = new Map();
  const dailyTotals = new Map();
  let sendingDay;

  function review(response, data) {
    const { token, decision } = data ?? {};
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)
      || (decision !== undefined && !['accept', 'decline'].includes(decision))) return reply(response, 400, 'invalid');
    const invite = byToken.get(token);
    if (!invite || invite.expires <= Date.now() || invite.delivery !== 'sent') return reply(response, 410, 'unavailable');
    if (invite.decision !== 'pending') return reply(response, 200, invite.decision);
    if (decision) invite.decision = decision === 'accept' ? 'accepted' : 'declined';
    return reply(response, 200, invite.decision, { sender: invite.sender, week: invite.week, reading: invite.reading });
  }

  return async (request, response) => {
    const origin = request.headers.origin;
    if (request.method !== 'POST') return reply(response, 405, 'method');
    if (!origin || origin !== `http://${request.headers.host}`
      || !/^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(origin)) return reply(response, 403, 'forbidden');
    if (!request.headers['content-type']?.startsWith('application/json')) return reply(response, 400, 'invalid');
    const data = await readRequest(request);
    if (request.url.endsWith(reviewRoute)) return review(response, data);
    const token = /^Bearer (\S{1,8192})$/.exec(request.headers.authorization ?? '')?.[1];
    if (!token) return reply(response, 401, 'sign-in');
    if (!data || Object.keys(data).length !== 3 || !Number.isInteger(data.marker) || !Number.isInteger(data.week)
      || !studies.has(data.week) || typeof data.snapshot !== 'string') return reply(response, 400, 'invalid');

    const sender = await authorize(token);
    if (!sender || !validMailbox(sender.email)) return reply(response, 403, 'forbidden');
    if (data.snapshot !== snapshot) return reply(response, 409, 'refresh-map');
    const recipient = recipients[data.marker];
    if (!recipient) return reply(response, 404, 'no-address');

    const day = new Date().toISOString().slice(0, 10);
    if (day !== sendingDay) {
      requested.clear();
      dailyTotals.clear();
      sendingDay = day;
      for (const [id, invite] of byToken) if (invite.expires <= Date.now()) byToken.delete(id);
    }
    const key = createHash('sha256').update(JSON.stringify([day, sender.uid, recipient.toLowerCase()])).digest('hex');
    let invite = requested.get(key);
    if (invite && invite.delivery !== 'retry') return reply(response, 409, 'already-requested');
    const count = dailyTotals.get(sender.uid) ?? 0;
    if (count >= dailyLimit) return reply(response, 429, 'daily-limit');
    if (!invite) {
      const id = randomBytes(32).toString('hex');
      invite = {
        id, expires: Date.now() + 86_400_000, decision: 'pending', week: data.week,
        sender: sender.name?.replace(/\s+/g, ' ').trim().slice(0, 80) || 'A HomeGroups Fellowship member',
        reading: studies.get(data.week).reading.replace(/\s+/g, ' '),
      };
      requested.set(key, invite);
      byToken.set(id, invite);
    }
    invite.delivery = 'sending';
    dailyTotals.set(sender.uid, count + 1);

    const link = new URL(reviewUrl);
    link.searchParams.set('face', 'fellowship');
    link.searchParams.set('week', invite.week);
    link.hash = `conversation-invite=${invite.id}`;
    try {
      await deliver({
        to: recipient,
        key,
        subject: `HomeGroups Fellowship invitation · Week ${invite.week}`,
        text: `${invite.sender} invited you to read ${invite.reading} and discuss it together.\n\nReview this invitation and choose Accept or Decline:\n${link.href}`,
      });
      invite.delivery = 'sent';
      return reply(response, 202, 'accepted');
    } catch {
      invite.delivery = 'retry';
      if (sendingDay === day) dailyTotals.set(sender.uid, (dailyTotals.get(sender.uid) ?? 1) - 1);
      return reply(response, 502, 'mail-unavailable');
    }
  };
}

function readRecipients(file) {
  const resolved = realpathSync(file);
  const relative = path.relative(realpathSync(__dirname), resolved);
  if (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
    throw new Error('Keep the original member map outside the preview’s public folder.');
  }
  const source = readFileSync(resolved, 'utf8').replace(/^\uFEFF/, '');
  const published = JSON.parse(readFileSync(path.join(__dirname, 'corpus/fellowship/community-map.json'), 'utf8'));
  const snapshot = snapshotId(source);
  const recipients = [];
  const rows = publicMembers(JSON.parse(source), (properties, index) => { recipients[index] = emailOnFile(properties); });
  if (snapshot !== published.snapshot || JSON.stringify(rows) !== JSON.stringify(published.members)) {
    throw new Error('The original member map and the published map snapshot must match.');
  }
  return { snapshot, recipients };
}

function createFirebaseAuthorizer(apiKey, accessThread, request = fetch) {
  const lookup = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`;
  const thread = `https://firestore.googleapis.com/v1/projects/${firebaseProject}/databases/(default)/documents/groups/pilot-group/studyThreads/${accessThread}`;
  return async token => {
    const identity = await request(lookup, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }),
      signal: AbortSignal.timeout(8000),
    });
    if (!identity.ok) return null;
    const user = (await identity.json()).users?.[0];
    if (!user?.localId || user.disabled || !user.emailVerified || !validMailbox(user.email)) return null;
    // Read an existing private discussion with the sender's own token. Firestore checks group membership.
    const access = await request(thread, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
    if (!access.ok) return null;
    return { uid: user.localId, name: user.displayName, email: user.email };
  };
}

function createResendDelivery(apiKey, from, request = fetch) {
  return async ({ to, key, subject, text }) => {
    const result = await request('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify({ from: `HomeGroups Fellowship <${from}>`, to: [to], subject, text }),
    });
    if (!result.ok || !(await result.json()).id) throw new Error('Mail provider did not accept the invitation.');
  };
}

async function configureConversationEmail(config, env = process.env) {
  const file = env.FELLOWSHIP_INVITE_MAP_SOURCE;
  const from = env.FELLOWSHIP_INVITE_FROM;
  const apiKey = env.FELLOWSHIP_INVITE_RESEND_KEY;
  const accessThread = env.FELLOWSHIP_INVITE_ACCESS_THREAD;
  const reviewUrl = URL.parse(env.FELLOWSHIP_INVITE_REVIEW_URL ?? '');
  if (!file && !from && !apiKey && !accessThread && !reviewUrl) return null;
  if (config.projectId !== firebaseProject || !file || !apiKey || !validMailbox(from) || !/^\d{4}-week-07$/.test(accessThread ?? '')
    || !reviewUrl || reviewUrl.protocol !== 'https:' || reviewUrl.username || reviewUrl.password) {
    throw new Error('Email invitations need a private map file, verified sender, provider key, existing pilot thread, and HTTPS review URL.');
  }
  const privateMap = readRecipients(file);
  const { readCsv, WEEK_COUNT } = await import('./corpus.js');
  const weekly = readCsv(readFileSync(path.join(__dirname, 'corpus/homegroups_weekly_reading_schedule.csv'), 'utf8'));
  const studies = new Map(weekly.filter(row => +row.week >= 1 && +row.week <= WEEK_COUNT && row.torah_reading)
    .map(row => [+row.week, { reading: row.torah_reading }]));
  return createConversationEmail({ ...privateMap, studies, reviewUrl,
    authorize: createFirebaseAuthorizer(config.apiKey, accessThread), deliver: createResendDelivery(apiKey, from),
  });
}

module.exports = { emailRoute, reviewRoute, reply, createConversationEmail, createFirebaseAuthorizer, createResendDelivery, configureConversationEmail };
