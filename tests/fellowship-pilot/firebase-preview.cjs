const { readFileSync } = require('node:fs');
const { createPreviewServer, pagesMount } = require('../../serve-preparedness.cjs');

function loadConfig(file) {
  if (!file) throw new Error('Set FELLOWSHIP_FIREBASE_WEB_CONFIG to the saved Firebase web configuration.');
  const source = readFileSync(file, 'utf8');
  if (/private_key|BEGIN .*PRIVATE KEY|service_account/i.test(source)) {
    throw new Error('Use the Firebase web configuration file.');
  }
  const block = source.match(/\bfirebaseConfig\s*=\s*\{([^{}]+)\}/)?.[1];
  if (!block) throw new Error('The file must contain the firebaseConfig block from Firebase.');
  const fields = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const config = Object.fromEntries(fields.map(field => {
    const value = block.match(new RegExp(`\\b${field}\\s*:\\s*(["'])([^"']+)\\1`))?.[2];
    if (!value) throw new Error(`The web configuration is missing ${field}.`);
    return [field, value];
  }));
  if (config.projectId !== 'homegroups-fellowship' || config.authDomain !== 'homegroups-fellowship.firebaseapp.com') {
    throw new Error('Expected the HomeGroups Fellowship Firebase web configuration.');
  }
  return config;
}

function createFirebasePreview(config, port = 8770) {
  const configRoute = `${pagesMount}/__fellowship-firebase/config`;
  const server = createPreviewServer({ mount: pagesMount, handleRequest(request, response) {
    if (request.url !== configRoute) return false;
    const actualPort = server.address().port;
    if (request.method !== 'GET' || ![`localhost:${actualPort}`, `127.0.0.1:${actualPort}`].includes(request.headers.host)) {
      response.writeHead(403).end();
      return true;
    }
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(config));
    return true;
  } });
  return server.listen(port, '127.0.0.1');
}

if (require.main === module) {
  try {
    const server = createFirebasePreview(loadConfig(process.env.FELLOWSHIP_FIREBASE_WEB_CONFIG), Number(process.env.FELLOWSHIP_FIREBASE_PORT || 8770));
    server.on('listening', () => {
      console.log(`Firebase sign-in preview: http://localhost:${server.address().port}${pagesMount}/?pilot=firebase&face=fellowship&week=7`);
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { loadConfig, createFirebasePreview };
