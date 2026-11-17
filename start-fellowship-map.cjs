const { spawn } = require('node:child_process');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

async function isReady(base) {
  try {
    const signal = AbortSignal.timeout(1200);
    const [page, source, data] = await Promise.all([
      fetch(`${base}?face=fellowship`, { signal }),
      fetch(`${base}fellowship-home.js`, { signal }),
      fetch(`${base}corpus/fellowship/community-map.json`, { signal }),
    ]);
    return page.ok && source.ok && data.ok
      && (await page.text()).includes('id="fellowship"')
      && Array.isArray((await data.json()).members);
  } catch {
    return false;
  }
}

async function start(port) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('The preview port is invalid.');
  const base = `http://127.0.0.1:${port}/`;
  if (await isReady(base)) {
    console.log(`The Fellowship map preview is already running at ${base}?face=fellowship`);
    return;
  }

  const child = spawn(process.execPath, [path.join(__dirname, 'serve-preparedness.cjs')], {
    cwd: __dirname,
    env: { ...process.env, NEXTPHASE_PREVIEW_PORT: String(port) },
    windowsHide: true,
    detached: true,
    stdio: 'ignore',
  });
  let launchError;
  child.on('error', error => { launchError = error; });
  child.unref();

  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (await isReady(base)) {
      console.log(`Fellowship map preview ready at ${base}?face=fellowship`);
      return;
    }
    if (launchError) throw launchError;
    if (child.exitCode !== null) break;
    await delay(250);
  }

  if (child.exitCode === null) child.kill();
  throw new Error(`The Fellowship map did not start on port ${port}. Check whether another program is using the port and that the project contains the map files.`);
}

start(Number(process.argv[2] || 8772)).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
