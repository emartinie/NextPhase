const { randomBytes, randomUUID } = require('node:crypto');
const { once } = require('node:events');
const { createPreviewServer, pagesMount } = require('../../serve-preparedness.cjs');
const { startEmulator, testToken, host, group, thread, pilotYear, pilotWeek } = require('./emulator.cjs');

const base = `${pagesMount}/__fellowship-pilot/`;
const identities = new Map([['miriam', 'Miriam Ellis'], ['daniel', 'Daniel Brooks'], ['outsider', 'Outside Tester']]);

function respond(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}

async function readBody(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 8192) return null;
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return null; }
}

async function startPilot(port = 0) {
  const emulator = await startEmulator();
  try {
    await emulator.db.seedPilot();
    const sessions = new Map();
    let origin;
    function handleRequest(request, response) {
      if (!request.url.startsWith(base)) return false;
      (async () => {
        if (request.headers.host !== new URL(origin).host ||
          (request.method === 'POST' && request.headers.origin !== origin)) {
          return respond(response, 403, { error: 'The pilot runs on this computer only.' });
        }
        const route = request.url.slice(base.length);
        const session = request.headers.authorization?.replace(/^Bearer /, '');
        const uid = sessions.get(session);
        if (route === 'session' && request.method === 'POST') {
          const data = await readBody(request);
          if (!identities.has(data?.member)) return respond(response, 400, { error: 'Choose a test identity.' });
          sessions.delete(session);
          const key = randomUUID();
          sessions.set(key, data.member);
          return respond(response, 200, { key });
        }
        if (route === 'session' && request.method === 'GET') {
          let role = null;
          if (uid) {
            const member = await emulator.db.request(`/${group}/members/${uid}`, testToken(uid));
            if (member.status === 200) role = member.data.fields?.role?.stringValue ?? null;
            else if (member.status !== 404) throw new Error('Could not read pilot membership.');
          }
          return respond(response, 200, {
            name: identities.get(uid) ?? null, year: pilotYear, week: pilotWeek, role,
          });
        }
        if (route === 'session/end' && request.method === 'POST') {
          sessions.delete(session);
          return respond(response, 200, {});
        }
        if (!uid) return respond(response, 401, { error: 'Choose a test identity first.' });
        const token = testToken(uid);
        if (request.method === 'POST' && route === 'invites') {
          const { recipient } = await readBody(request) ?? {};
          if (!identities.has(recipient)) return respond(response, 400, { error: 'Choose a test recipient.' });
          const id = randomBytes(16).toString('hex');
          const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
          const result = await emulator.db.commit(token, [emulator.db.inviteWrite(id, uid, recipient, expiresAt)]);
          if (result.status === 403) {
            return respond(response, 403, { error: 'A group leader can invite a test account that has yet to join.' });
          }
          if (result.status !== 200) throw new Error('Could not save pilot invitation.');
          return respond(response, 200, { id });
        }
        if (request.method === 'POST' && route === 'invites/accept') {
          const { id } = await readBody(request) ?? {};
          if (typeof id !== 'string' || !/^[a-f0-9]{32}$/.test(id)) {
            return respond(response, 400, { error: 'This invitation link is incomplete.' });
          }
          const result = await emulator.db.commit(token, emulator.db.redemptionWrites(id, uid));
          if (result.status >= 400 && result.status < 500) {
            return respond(response, 403, { error: 'This account can’t accept the invitation. Check the account, or ask for a fresh link if it expired or was used.' });
          }
          if (result.status !== 200) throw new Error('Could not accept pilot invitation.');
          return respond(response, 200, {});
        }
        if (route !== 'messages') return respond(response, 404, { error: 'This pilot action is unavailable.' });
        if (request.method === 'GET') {
          const result = await emulator.db.read(thread, token, 50, 'DESCENDING');
          if (result.status === 403) return respond(response, 403, { error: 'This weekly discussion is for group members only.' });
          if (result.status !== 200) throw new Error('Could not read pilot messages.');
          const messages = result.data.filter(item => item.document).reverse().map(({ document }) => ({
            name: identities.get(document.fields.authorId.stringValue), body: document.fields.body.stringValue,
          }));
          return respond(response, 200, { messages });
        }
        if (request.method !== 'POST') return respond(response, 405, { error: 'Use the Fellowship reply form.' });
        const data = await readBody(request);
        const body = typeof data?.body === 'string' ? data.body.trim() : '';
        if (!body || body.length > 1600) return respond(response, 400, { error: 'Enter a reply of up to 1,600 characters.' });
        const result = await emulator.db.send(thread, randomUUID(), token, uid, body);
        if (result.status === 403) return respond(response, 403, { error: 'This weekly discussion is for group members only.' });
        if (result.status !== 200) throw new Error('Could not save pilot reply.');
        return respond(response, 200, {});
      })().catch(error => {
        if (response.destroyed) return;
        console.error(error.message);
        respond(response, 502, { error: 'The local database is unavailable. Try again.' });
      });
      return true;
    }
    const server = createPreviewServer({ mount: pagesMount, handleRequest });
    server.listen(port, host);
    await once(server, 'listening');
    origin = `http://${host}:${server.address().port}`;
    return {
      url: `${origin}${pagesMount}/?pilot=fellowship&face=fellowship&week=${pilotWeek}`,
      async close() {
        await new Promise(resolve => server.close(resolve));
        emulator.close();
      },
    };
  } catch (error) {
    emulator.close();
    throw error;
  }
}

if (require.main === module) {
  startPilot(Number(process.env.FELLOWSHIP_PILOT_PORT || 8769)).then(pilot => {
    console.log(`HomeGroups Fellowship local pilot: ${pilot.url}`);
    process.once('SIGINT', () => { void pilot.close(); });
    process.once('SIGTERM', () => { void pilot.close(); });
  }).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { startPilot };
