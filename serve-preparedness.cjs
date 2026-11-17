
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const root = __dirname;
const pagesMount = '/NextPhase';
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.geojson': 'application/geo+json',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
};
function createPreviewServer({ mount = '', handleRequest } = {}) {
  return http.createServer((request, response) => {
    if (handleRequest?.(request, response)) return;
    if (request.method !== 'HEAD' && request.method !== 'GET') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }

    let requestPath;
    try {
      requestPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (requestPath.includes('\0')) throw new Error('Invalid request path');
    } catch {
      response.writeHead(400).end();
      return;
    }
    if (!requestPath.startsWith(mount + '/')) {
      response.writeHead(404).end();
      return;
    }
    const relative = requestPath.slice(mount.length);
    if (relative.split('/').some(part => part.startsWith('.'))) {
      response.writeHead(404).end();
      return;
    }
    const file = path.resolve(root, '.' + (relative === '/' ? '/index.html' : relative));
    const info = file.startsWith(root + path.sep) ? fs.statSync(file, { throwIfNoEntry: false }) : undefined;
    if (!info?.isFile()) {
      response.writeHead(404).end();
      return;
    }

    const headers = {
      'Content-Type': contentTypes[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Accept-Ranges': 'bytes',
      'Content-Length': info.size,
    };
    let status = 200;
    let bounds;
    const requested = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range ?? '');
    if (requested && info.size) {
      const [, first, last] = requested;
      const start = first ? Number(first) : Math.max(0, info.size - Number(last));
      const end = first && last ? Math.min(Number(last), info.size - 1) : info.size - 1;
      if (start > end) {
        response.writeHead(416, { 'Content-Range': 'bytes */' + info.size }).end();
        return;
      }
      bounds = { start, end };
      status = 206;
      headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + info.size;
      headers['Content-Length'] = end - start + 1;
    }
    response.writeHead(status, headers);
    if (request.method === 'HEAD') response.end();
    else fs.createReadStream(file, bounds).on('error', () => response.destroy()).pipe(response);
  });
}

async function startPagesCheck(server) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return 'http://127.0.0.1:' + server.address().port + pagesMount + '/';
}

if (require.main === module) {
  const port = Number(process.env.NEXTPHASE_PREVIEW_PORT || 8767);
  createPreviewServer().listen(port, '127.0.0.1', () => console.log('NextPhase preview on http://127.0.0.1:' + port + '/'));
}
module.exports = { createPreviewServer, pagesMount, startPagesCheck };
