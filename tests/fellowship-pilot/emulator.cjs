const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { existsSync } = require('node:fs');
const { createServer } = require('node:net');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

const project = 'demo-homegroups-fellowship-pilot';
const host = '127.0.0.1';
const group = 'groups/pilot-group';
const pilotYear = new Date().getFullYear();
const pilotWeek = 7;
const studyPeriod = `week-${String(pilotWeek).padStart(2, '0')}`;
const thread = `${group}/studyThreads/${pilotYear}-${studyPeriod}`;
const archive = `${group}/studyThreads/${pilotYear - 1}-${studyPeriod}`;
const messages = current => `${current}/messages`;
const documentRoot = `projects/${project}/databases/(default)/documents`;

// The loopback Firestore emulator accepts this unsigned test identity.
function testToken(uid) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'none', typ: 'JWT' };
  const claims = {
    iss: `https://securetoken.google.com/${project}`, aud: project,
    iat: now, exp: now + 3600, auth_time: now, sub: uid, user_id: uid,
    firebase: { sign_in_provider: 'custom', identities: {} },
  };
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode(header)}.${encode(claims)}.`;
}

function store(port) {
  const root = `http://${host}:${port}/v1/${documentRoot}`;
  async function request(suffix, token, method = 'GET', data) {
    const response = await fetch(root + suffix, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
      body: data && JSON.stringify(data),
      signal: AbortSignal.timeout(8000),
    });
    return { status: response.status, data: await response.json() };
  }
  async function seed(document, fields = {}) {
    const result = await request('/' + document, 'owner', 'PATCH', { fields });
    assert.equal(result.status, 200, JSON.stringify(result.data));
  }
  async function seedPilot() {
    await seed(thread, { open: { booleanValue: true } });
    await seed(archive, { open: { booleanValue: false } });
    await seed(`${group}/members/miriam`, { role: { stringValue: 'leader' } });
    await seed(`${group}/members/daniel`, { role: { stringValue: 'member' } });
  }
  const read = (current, token, limit = 50, direction = 'ASCENDING') => request(`/${current}:runQuery`, token, 'POST', {
    structuredQuery: {
      from: [{ collectionId: 'messages' }],
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction }],
      limit,
    },
  });
  const commit = (token, writes) => request(':commit', token, 'POST', { writes });
  const send = (current, id, token, authorId, body) => commit(token, [{
    update: { name: `${documentRoot}/${messages(current)}/${id}`,
      fields: { authorId: { stringValue: authorId }, body: { stringValue: body } } },
    currentDocument: { exists: false },
    updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
  }]);
  const inviteWrite = (id, creatorId, recipientId, expiresAt) => ({
    update: { name: `${documentRoot}/${group}/invites/${id}`, fields: {
      creatorId: { stringValue: creatorId }, recipientId: { stringValue: recipientId },
      expiresAt: { timestampValue: expiresAt }, redeemed: { booleanValue: false },
    } },
    currentDocument: { exists: false },
    updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
  });
  const redemptionWrites = (id, uid) => [{
    update: { name: `${documentRoot}/${group}/invites/${id}`, fields: { redeemed: { booleanValue: true } } },
    updateMask: { fieldPaths: ['redeemed'] },
    currentDocument: { exists: true },
  }, {
    update: { name: `${documentRoot}/${group}/members/${uid}`, fields: {
      role: { stringValue: 'member' }, inviteId: { stringValue: id },
    } },
    currentDocument: { exists: false },
    updateTransforms: [{ fieldPath: 'joinedAt', setToServerValue: 'REQUEST_TIME' }],
  }];
  return { request, seedPilot, read, send, commit, inviteWrite, redemptionWrites };
}

async function startEmulator() {
  const jar = process.env.FIRESTORE_EMULATOR_JAR;
  assert.ok(jar && existsSync(jar), 'Set FIRESTORE_EMULATOR_JAR to a local Firestore emulator JAR.');
  const reservation = createServer().listen(0, host);
  await once(reservation, 'listening');
  const { port } = reservation.address();
  await new Promise(resolve => reservation.close(resolve));

  const emulator = spawn(process.env.JAVA_BIN || 'java', [
    '-Xmx256m', '-jar', path.resolve(jar), '--host', host, '--port', String(port),
    '--project_id', project, '--single_project_mode', 'true', '--rules', path.join(__dirname, 'firestore.rules'),
  ], { windowsHide: true });
  let output = '';
  emulator.stdout.on('data', chunk => { output = (output + chunk).slice(-16000); });
  emulator.stderr.on('data', chunk => { output = (output + chunk).slice(-16000); });
  const ready = async () => {
    for (let attempt = 0; attempt < 150; attempt++) {
      if (output.includes('Dev App Server is now running')) return;
      if (emulator.exitCode !== null || emulator.killed) break;
      await delay(200);
    }
    throw new Error(`Firestore emulator did not become ready.\n${output}`);
  };
  try {
    await Promise.race([ready(), once(emulator, 'error').then(([error]) => { throw error; })]);
    return { db: store(port), close: () => emulator.kill() };
  } catch (error) {
    emulator.kill();
    throw error;
  }
}

module.exports = { startEmulator, testToken, host, group, thread, archive, messages, pilotYear, pilotWeek };
