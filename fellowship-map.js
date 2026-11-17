import { mountStreetTiles, projectMap as project, mapBaseScale as baseScale } from './fellowship-street-map.js';

const world = { x: 0.5, y: 0.5, zoom: 1 };
const maxZoom = 2 ** 15;
const clamp = (number, lower, upper) => Math.max(lower, Math.min(upper, number));
const wrap = x => x - Math.floor(x);
const delta = x => x - Math.round(x);
const radians = degrees => degrees * Math.PI / 180;

export function fitNearby(members, [lon, lat], width, height) {
  // Haversine distance is monotonic in this value, and handles the date line without a special case.
  const distance = ([lng, latitude]) => Math.sin(radians(latitude - lat) / 2) ** 2
    + Math.cos(radians(lat)) * Math.cos(radians(latitude)) * Math.sin(radians(lng - lon) / 2) ** 2;
  const nearest = members.map((member, index) => ({ member, index, distance: distance(member) }))
    .sort((a, b) => a.distance - b.distance).slice(0, 100);
  const indices = nearest.map(item => item.index);
  if (!nearest.length) return { view: world, indices };
  const [origin] = project([lon, lat]);
  const points = nearest.map(({ member }) => {
    const [x, y] = project(member);
    return [origin + delta(x - origin), y];
  });
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const west = Math.min(...xs), east = Math.max(...xs), north = Math.min(...ys), south = Math.max(...ys);
  const base = baseScale(width, height);
  const zoom = clamp(Math.min((width - 40) / (east - west) / base, (height - 40) / (south - north) / base), 1, maxZoom);
  const view = zoom === 1 ? world : { x: wrap((west + east) / 2), y: (north + south) / 2, zoom };
  return { view, indices };
}

function makeOutline(rings, close = false) {
  const path = new Path2D();
  for (const ring of rings) {
    const [first, ...rest] = ring;
    path.moveTo(...project(first));
    for (const point of rest) path.lineTo(...project(point));
    if (close) path.closePath();
  }
  return path;
}

export function mountMemberMap({ canvas, backdrop, tiles }, { members, outline, geography }, { select, manual, moved, streetStatus }) {
  const context = canvas.getContext('2d');
  const guide = backdrop.getContext('2d');
  const streetMap = mountStreetTiles(tiles, streetStatus);
  const land = makeOutline(outline, true);
  const boundaries = makeOutline(geography.borders);
  const divisions = makeOutline(geography.subdivisions);
  const places = geography.places.map(([lon, lat, name, zoom]) => ({ point: project([lon, lat]), name, zoom }));
  const locations = new Map();
  members.forEach((member, index) => {
    const key = `${member[0]},${member[1]}`;
    if (!locations.has(key)) locations.set(key, { point: project(member), indices: [] });
    locations.get(key).indices.push(index);
  });
  const controller = new AbortController();
  const pointers = new Map();
  const prefersStill = matchMedia('(prefers-reduced-motion: reduce)');
  let camera = { ...world };
  let width = 0;
  let height = 0;
  let projected = [];
  let nearbyMembers;
  let selected = -1;
  let painting = 0;
  let animation = 0;
  let dragged = false;
  const scale = () => baseScale(width, height) * camera.zoom;

  function screen([x, y], factor) {
    return [width / 2 + delta(x - camera.x) * factor, height / 2 + (y - camera.y) * factor];
  }

  function paintGeography(colors, factor, ratio) {
    const center = Math.floor(camera.x);
    const detail = Math.log2(factor / 256);
    guide.setTransform(ratio, 0, 0, ratio, 0, 0);
    guide.clearRect(0, 0, width, height);
    for (const copy of [center - 1, center, center + 1]) {
      guide.save();
      guide.translate(width / 2 + (copy - camera.x) * factor, height / 2 - camera.y * factor);
      guide.scale(factor, factor);
      guide.fillStyle = colors.getPropertyValue('--muted').trim();
      guide.globalAlpha = 0.32;
      guide.fill(land);
      guide.strokeStyle = guide.fillStyle;
      guide.lineWidth = 1 / factor;
      guide.globalAlpha = 0.75;
      guide.stroke(land);
      guide.stroke(boundaries);
      if (detail >= 2.5) {
        guide.globalAlpha = 0.5;
        guide.stroke(divisions);
      }
      guide.restore();
    }
    guide.font = '600 11px system-ui, sans-serif';
    guide.textAlign = 'center';
    guide.strokeStyle = colors.getPropertyValue('--bg').trim();
    guide.fillStyle = colors.getPropertyValue('--ink').trim();
    guide.lineWidth = 2.5;
    guide.lineJoin = 'round';
    const used = [];
    for (const { point, name, zoom } of places) {
      if (zoom > detail + 2.2 || used.length >= 16) break;
      const [x, y] = screen(point, factor);
      const half = guide.measureText(name).width / 2;
      if (x - half < 5 || x + half > width - 5 || y < 15 || y > height - 19) continue;
      if (used.some(label => Math.abs(label.x - x) < half + label.half + 9 && Math.abs(label.y - y) < 16)) continue;
      guide.strokeText(name, x, y);
      guide.fillText(name, x, y);
      used.push({ x, y, half });
    }
  }

  function paint() {
    cancelAnimationFrame(painting);
    painting = 0;
    if (!width || !height) return;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const factor = scale();
    const colors = getComputedStyle(canvas);
    paintGeography(colors, factor, ratio);
    streetMap.position({ x: camera.x, y: camera.y, scale: factor, width, height });
    const marker = colors.getPropertyValue('--map-pin').trim();
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const radius = clamp(1.55 + Math.log2(camera.zoom), 1.55, 4.1);
    projected = [];
    context.fillStyle = marker;
    context.beginPath();
    let highlight;
    for (const { point: [x, y], indices } of locations.values()) {
      const visible = nearbyMembers ? indices.filter(index => nearbyMembers.has(index)) : indices;
      if (!visible.length) continue;
      const [left, top] = screen([x, y], factor);
      if (left < 0 || left > width || top < 0 || top > height) continue;
      const dot = visible.length > 1 && camera.zoom > 3 ? radius + 1 : radius;
      context.moveTo(left + dot, top);
      context.arc(left, top, dot, 0, 2 * Math.PI);
      projected.push({ left, top, indices: visible });
      if (visible.includes(selected)) highlight = [left, top];
    }
    context.strokeStyle = colors.getPropertyValue('--map-pin-halo').trim();
    context.lineWidth = 1.15;
    context.stroke();
    context.fill();
    if (highlight) {
      context.beginPath();
      context.strokeStyle = colors.getPropertyValue('--amber').trim();
      context.lineWidth = 2;
      context.arc(...highlight, radius + 4, 0, 2 * Math.PI);
      context.stroke();
    }
  }

  function queuePaint() {
    if (!painting) painting = requestAnimationFrame(paint);
  }

  function constrain() {
    const halfHeight = Math.min(0.5, height / (2 * scale()));
    camera.y = clamp(camera.y, halfHeight, 1 - halfHeight);
  }

  function settle() {
    streetMap.settle();
    moved();
  }

  const resize = new ResizeObserver(() => {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = backdrop.width = Math.round(width * ratio);
    canvas.height = backdrop.height = Math.round(height * ratio);
    constrain();
    paint();
    settle();
  });
  const appearance = new MutationObserver(queuePaint);
  resize.observe(canvas);
  appearance.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  function stopAnimation() {
    cancelAnimationFrame(animation);
    animation = 0;
  }

  function visit(to, nearby, done) {
    stopAnimation();
    const from = { ...camera };
    const targetX = from.x + delta(to.x - from.x);
    function finish() {
      camera = { ...to, x: targetX };
      nearbyMembers = nearby;
      constrain();
      paint();
      settle();
      done?.();
    }
    if (prefersStill.matches) { finish(); return; }
    const start = performance.now();
    function step(time) {
      const progress = Math.min(1, (time - start) / 700);
      if (progress === 1) { animation = 0; finish(); return; }
      const ease = 1 - (1 - progress) ** 3;
      camera = {
        x: from.x + (targetX - from.x) * ease,
        y: from.y + (to.y - from.y) * ease,
        zoom: from.zoom * (to.zoom / from.zoom) ** ease,
      };
      constrain();
      paint();
      animation = requestAnimationFrame(step);
    }
    animation = requestAnimationFrame(step);
  }

  function takeControl() {
    stopAnimation();
    manual();
  }

  function move(oldX, oldY, nextX, nextY, factor = 1) {
    nearbyMembers = undefined;
    const before = scale();
    camera.zoom = clamp(camera.zoom * factor, 1, maxZoom);
    camera.x += (oldX - width / 2) / before - (nextX - width / 2) / scale();
    camera.y += (oldY - height / 2) / before - (nextY - height / 2) / scale();
    constrain();
    queuePaint();
  }

  function local(event) {
    const box = canvas.getBoundingClientRect();
    return [(event.clientX - box.left) * width / box.width, (event.clientY - box.top) * height / box.height];
  }

  function hitMarker(event) {
    const [x, y] = local(event);
    let best = 20;
    let found;
    for (const dot of projected) {
      const distance = Math.hypot(x - dot.left, y - dot.top);
      if (distance < best) { best = distance; found = dot; }
    }
    return found;
  }

  const on = (type, callback) => canvas.addEventListener(type, callback, { signal: controller.signal, passive: false });
  on('pointerdown', event => {
    if (event.button !== 0 || pointers.size >= 2) return;
    takeControl();
    if (!pointers.size) dragged = false;
    pointers.set(event.pointerId, { previous: local(event), start: local(event) });
    canvas.setPointerCapture(event.pointerId);
    if (pointers.size > 1) dragged = true;
  });
  on('pointermove', event => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) {
      if (event.pointerType === 'mouse') canvas.classList.toggle('over-marker', Boolean(hitMarker(event)));
      return;
    }
    const [x, y] = local(event), [px, py] = pointer.previous;
    if (!dragged && Math.hypot(x - pointer.start[0], y - pointer.start[1]) < 5) return;
    pointer.previous = [x, y];
    dragged = true;
    const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)?.[1];
    if (!other) { move(px, py, x, y); return; }
    const [ox, oy] = other.previous;
    const magnification = Math.hypot(x - ox, y - oy) / Math.max(1, Math.hypot(px - ox, py - oy));
    move((px + ox) / 2, (py + oy) / 2, (x + ox) / 2, (y + oy) / 2, magnification);
  });
  function release(event) {
    if (!pointers.delete(event.pointerId) || pointers.size) return;
    if (dragged || event.type !== 'pointerup') { paint(); settle(); return; }
    select(hitMarker(event)?.indices ?? []);
  }
  on('pointerup', release);
  on('pointercancel', release);
  on('lostpointercapture', release);
  on('wheel', event => {
    if (document.activeElement !== canvas && !event.ctrlKey) return;
    event.preventDefault();
    takeControl();
    const [x, y] = local(event);
    move(x, y, x, y, Math.exp(-clamp(event.deltaY, -200, 200) * 0.005));
    paint();
    settle();
  });
  on('keydown', event => {
    const shifts = { ArrowLeft: [48, 0], ArrowRight: [-48, 0], ArrowUp: [0, 48], ArrowDown: [0, -48] };
    const shift = shifts[event.key];
    const factor = event.key === '+' || event.key === '=' ? 1.6 : event.key === '-' ? 1 / 1.6 : 1;
    if (!shift && factor === 1) return;
    event.preventDefault();
    takeControl();
    move(width / 2, height / 2, width / 2 + (shift?.[0] ?? 0), height / 2 + (shift?.[1] ?? 0), factor);
    paint();
    settle();
  });

  return {
    world() { visit(world); },
    nearby(point, done) {
      const { view, indices } = fitNearby(members, point, width, height);
      visit(view, new Set(indices), () => done(indices.length));
    },
    highlight(index) { selected = index; queuePaint(); },
    visible() {
      return [...projected].sort((a, b) => Math.hypot(a.left - width / 2, a.top - height / 2)
        - Math.hypot(b.left - width / 2, b.top - height / 2)).flatMap(dot => dot.indices);
    },
    zoom(factor) {
      takeControl();
      move(width / 2, height / 2, width / 2, height / 2, factor);
      paint();
      settle();
    },
    stopAnimation,
    refreshTiles() { streetMap.settle(); },
    retryTiles() { streetMap.retry(); },
    close() {
      controller.abort();
      resize.disconnect();
      appearance.disconnect();
      streetMap.close();
      stopAnimation();
      cancelAnimationFrame(painting);
    },
  };
}
