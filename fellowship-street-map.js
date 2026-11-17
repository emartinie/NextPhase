const provider = 'https://tile.openstreetmap.org';
const tileSize = 256;
const limit = (number, min, max) => Math.max(min, Math.min(max, number));
const latitudeLimit = 85.05112878;

export function projectMap([longitude, latitude]) {
  const angle = limit(latitude, -latitudeLimit, latitudeLimit) * Math.PI / 180;
  return [(longitude + 180) / 360, limit((1 - Math.asinh(Math.tan(angle)) / Math.PI) / 2, 0, 1)];
}

export const mapBaseScale = (width, height) => Math.min(width, height * 1.35);

// Fetch just the tiles that intersect the settled, visible viewport. The browser handles HTTP caching.
export function viewportTiles({ x, y, scale, width, height }) {
  const zoom = limit(Math.round(Math.log2(scale / tileSize)), 0, 18);
  const columns = 2 ** zoom;
  const size = scale / columns;
  const left = x * columns - width / (2 * size);
  const top = y * columns - height / (2 * size);
  const right = left + width / size;
  const bottom = top + height / size;
  const tiles = [];
  for (let row = Math.max(0, Math.floor(top)); row < Math.min(columns, Math.ceil(bottom)); row++) {
    for (let column = Math.floor(left); column < Math.ceil(right); column++) {
      const wrapped = (column % columns + columns) % columns;
      tiles.push({ key: `${zoom}/${column}/${row}`, url: `${provider}/${zoom}/${wrapped}/${row}.png`, columns, column, row });
    }
  }
  return tiles;
}

export function mountStreetTiles(layer, reportUnavailable) {
  let viewport;
  let current = new Map();
  let previous = new Map();
  let timer;
  let coverageTimer;
  let closed = false;

  function place({ image, columns, column, row }) {
    const { x, y, scale, width, height } = viewport;
    const size = scale / columns;
    const left = width / 2 + (column / columns - x) * scale;
    const top = height / 2 + (row / columns - y) * scale;
    // Snap both edges to pixels to cover the seams between adjacent rasters.
    const leftEdge = Math.round(left);
    const topEdge = Math.round(top);
    image.style.transform = `translate(${leftEdge}px, ${topEdge}px)`;
    image.style.width = `${Math.round(left + size) - leftEdge}px`;
    image.style.height = `${Math.round(top + size) - topEdge}px`;
  }

  function updateCoverage() {
    if ([...current.values()].some(tile => tile.state === 'loading')) return;
    clearTimeout(coverageTimer);
    reportUnavailable([...current.values()].some(tile => tile.state === 'failed'));
    for (const tile of previous.values()) tile.image.remove();
    previous.clear();
  }

  function loadVisible(retry = false) {
    if (closed || !viewport || layer.closest('[inert]')) return;
    const next = new Map();
    for (const tile of viewportTiles(viewport)) {
      const existing = current.get(tile.key) ?? previous.get(tile.key);
      if (existing && !(retry && existing.state === 'failed')) {
        next.set(tile.key, existing);
        continue;
      }
      existing?.image.remove();
      const image = document.createElement('img');
      image.alt = '';
      image.draggable = false;
      image.hidden = true;
      image.referrerPolicy = 'strict-origin-when-cross-origin';
      const entry = { ...tile, image, state: 'loading' };
      function finish(state) {
        entry.state = state;
        image.hidden = state !== 'loaded';
        if (closed || current.get(tile.key) !== entry) return;
        updateCoverage();
      }
      image.onload = () => finish('loaded');
      image.onerror = () => finish('failed');
      image.src = tile.url;
      next.set(tile.key, entry);
    }

    const retiring = new Map();
    for (const records of [previous, current]) {
      for (const [key, tile] of records) {
        if (next.get(key) === tile) continue;
        if (records === current && tile.state === 'loaded' && !next.has(key)) retiring.set(key, tile);
        else tile.image.remove();
      }
    }
    previous = retiring;
    current = next;
    for (const tile of current.values()) {
      place(tile);
      layer.append(tile.image);
    }
    clearTimeout(coverageTimer);
    coverageTimer = setTimeout(() => {
      for (const tile of current.values()) if (tile.state === 'loading') tile.state = 'failed';
      updateCoverage();
    }, 8000);
    updateCoverage();
  }

  return {
    position(view) {
      viewport = view;
      for (const records of [previous, current]) for (const tile of records.values()) place(tile);
    },
    settle() {
      clearTimeout(timer);
      timer = setTimeout(loadVisible, 160);
    },
    close() {
      closed = true;
      clearTimeout(timer);
      clearTimeout(coverageTimer);
      layer.replaceChildren();
    },
    retry() { loadVisible(true); },
  };
}
