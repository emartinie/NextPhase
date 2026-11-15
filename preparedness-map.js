
import { countyIds, zones, places, radioPoints, prayerPoints, mapSource, prayerSource, getPreparednessAsset } from './preparedness-resources.js';

const ns = 'http://www.w3.org/2000/svg';
const overview = { center: [-85.85, 36.95], width: 860 };
const layers = { group: 'HomeGroups', prayer: 'Prayer', feast: 'Feasts' };
const sourceNames = { sample: 'Legacy sample', published: 'Club-published reference', historical: 'Historical club reference' };
const prayerKey = 'nextphase-prayer-map-private-v1';
const kindLabels = { repeater: 'Repeater', simplex: 'Simplex', family: 'Family' };

function svgNode(tag, attributes) {
  const element = document.createElementNS(ns, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

function polygonGroups(feature) {
  return feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
}

function ringContains(ring, longitude, latitude) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x, y] = ring[i];
    const [px, py] = ring[j];
    if ((y > latitude) !== (py > latitude) && longitude < (px - x) * (latitude - y) / (py - y) + x) inside = !inside;
  }
  return inside;
}

function countyContains(feature, longitude, latitude) {
  return polygonGroups(feature).some(([outline, ...holes]) => ringContains(outline, longitude, latitude) &&
    !holes.some(hole => ringContains(hole, longitude, latitude)));
}

function project([lon, lat]) {
  return [lon * 100, -lat * 125];
}

function boundaryPath(feature) {
  return polygonGroups(feature).flatMap(polygon => polygon.map(ring => 'M' + ring.map(point =>
    project(point).map(value => value.toFixed(1)).join(',')).join('L') + 'Z')).join('');
}

function readPrayerNotes() {
  try {
    const notes = JSON.parse(localStorage.getItem(prayerKey) ?? '[]');
    if (Array.isArray(notes)) return notes.filter(item => item?.id && typeof item.label === 'string' &&
      Object.hasOwn(places, item.zone) && item.layer === 'prayer');
  } catch {
    // The map remains usable with sample points when storage is unavailable.
  }
  return [];
}

function writePrayerNotes(notes) {
  try {
    localStorage.setItem(prayerKey, JSON.stringify(notes));
    return true;
  } catch {
    return false;
  }
}

export function createMapViews({ node, text, button, cluster, disclosure, link, open }) {
  const loadCounties = () => getPreparednessAsset('tn-ky-counties.geojson').then(data => data.features);
  let notes = readPrayerNotes();

  function optionFilter(label, choices, value, change) {
    const field = node('label', label);
    const select = node('select');
    select.setAttribute('aria-label', label);
    for (const [key, name] of Object.entries(choices)) select.append(new Option(name, key));
    select.value = value;
    select.addEventListener('change', () => change(select.value));
    field.append(select);
    return [field, select];
  }

  async function renderMap(target, { data }, mode) {
    const radio = mode === 'radio';
    const initialZone = Object.hasOwn(zones, data.zone) ? data.zone : '';
    const filters = { zone: initialZone, type: '', status: '', source: '', query: '' };
    const selectedLayers = new Set(Object.keys(layers));
    let points = [];
    let active = data.id ?? '';
    let viewport = initialZone in places ? { center: places[initialZone], width: 255 } : overview;
    let counties = [];
    const results = node('ul', '', 'prep-list');
    const count = text('', 'source-copy');
    count.setAttribute('role', 'status');
    const notice = text('Loading county boundaries…');
    notice.setAttribute('role', 'status');
    const detail = node('div', '', 'prep-stack');
    const map = svgNode('svg', { class: 'prep-map', tabindex: '0', role: 'group',
      'aria-label': radio ? 'Radio map. Arrow keys pan. Plus and minus zoom.' : 'Prayer map. Arrow keys pan. Plus and minus zoom.' });
    const outlines = svgNode('g', { 'aria-hidden': 'true', class: 'prep-boundaries' });
    const markers = svgNode('g', { class: 'prep-markers' });
    const labels = svgNode('g', { 'aria-hidden': 'true' });
    map.append(outlines, labels, markers);
    const pan = (x, y) => {
      const step = viewport.width / 340;
      viewport = { ...viewport, center: [
        Math.max(-91, Math.min(-80, viewport.center[0] + step * x)),
        Math.max(34, Math.min(40, viewport.center[1] + step * y)),
      ] };
      draw();
    };
    function zoom(factor) {
      viewport = { ...viewport, width: Math.max(65, Math.min(1250, viewport.width * factor)) };
      draw();
    }
    map.addEventListener('keydown', event => {
      if (event.target !== map) return;
      const movement = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
      if (Object.hasOwn(movement, event.key)) pan(...movement[event.key]);
      else if (event.key === '+' || event.key === '=') zoom(.67);
      else if (event.key === '-' || event.key === '_') zoom(1.5);
      else return;
      event.preventDefault();
    });

    function choose(item, center = true) {
      active = item.id;
      if (center) viewport = { center: item.lat == null ? places[item.zone] : [item.lng, item.lat], width: Math.min(viewport.width, 250) };
      draw();
      renderDetails();
      detail.querySelector('h3')?.focus({ preventScroll: true });
    }

    function draw() {
      const [x, y] = project(viewport.center);
      const w = viewport.width;
      const h = w * .55;
      map.setAttribute('viewBox', [x - w / 2, y - h / 2, w, h].join(' '));
      labels.replaceChildren(...Object.entries(places).map(([key, location]) => {
        const [lx, ly] = project(location);
        const label = svgNode('text', { x: lx, y: ly - w * .05, 'font-size': w * .036, 'text-anchor': 'middle' });
        label.textContent = zones[key];
        return label;
      }));
      markers.replaceChildren(...points.map((item, index) => {
        let [mx, my] = project(item.lat == null ? places[item.zone] : [item.lng, item.lat]);
        // Group and prayer fixtures can share a county. Offset their symbols visually.
        if (!radio && points.slice(0, index).some(other => other.zone === item.zone)) mx += w * .055;
        const shape = svgNode('circle', {
          cx: mx, cy: my, r: w * .023, tabindex: '0', role: 'button',
          'aria-label': item.label, 'aria-pressed': String(active === item.id),
          class: 'prep-marker ' + (radio ? item.status ? 'sample' : 'reference' : item.layer),
        });
        const title = svgNode('title', {});
        title.textContent = item.label;
        shape.append(title);
        shape.addEventListener('click', () => choose(item));
        shape.addEventListener('keydown', event => {
          if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            choose(item);
          }
        });
        return shape;
      }));
    }

    function renderDetails() {
      const item = points.find(candidate => candidate.id === active);
      detail.replaceChildren();
      if (!item) return;
      const heading = node('h3', item.label);
      heading.tabIndex = -1;
      detail.append(heading);
      if (!radio) {
        detail.append(text(zones[item.zone] + ' area · ' + (item.local ? 'Private note on this device' : 'Fictional ' + layers[item.layer].toLowerCase() + ' marker')));
        if (item.local) detail.append(button('Remove private prayer note', () => {
          const remaining = notes.filter(note => note.id !== item.id);
          const saved = writePrayerNotes(remaining);
          notes = remaining;
          active = '';
          notice.textContent = saved ? 'Private prayer note removed.' : 'Removed for this tab. Browser storage is unavailable.';
          update();
          notice.focus();
        }));
        if (item.id === 'group-dickson') detail.append(button('Open the Wednesday practice', () => open('preparedness', { initial: 'group' })));
        return;
      }
      detail.append(text((item.location ?? zones[item.zone]) + ' · ' + kindLabels[item.type] +
        ' · ' + sourceNames[item.status ? 'sample' : item.historical ? 'historical' : 'published']));
      if (item.status) {
        detail.append(text('Original fixture status · ' + item.status + '. Frequency, offset, tone and operating status are unknown.'));
      } else {
        const list = node('dl', '', 'prep-plan');
        for (const [label, value] of [['Output', item.frequency], ['Offset', item.offset], ['Tone', item.tone], ['Mode', item.mode]]) {
          list.append(node('dt', label), node('dd', value || 'Not listed in this source'));
        }
        detail.append(list, text(item.schedule), text('Approximate place marker. Reception, operating status, and public audio are unverified.'));
      }
      detail.append(cluster(link('Open source ↗', item.source),
        ...(item.net ? [link('Open club net information ↗', item.net)] : [])));
    }

    const search = node('input');
    search.type = 'search';
    const searchField = node('label', radio ? 'Search radio points' : 'Search the prayer map');
    searchField.append(search);
    search.addEventListener('input', () => { filters.query = search.value.trim().toLowerCase(); update(); });
    const [zoneField, zoneSelect] = optionFilter(radio ? 'Zone' : 'Area',
      { '': 'All areas', ...(radio ? zones : Object.fromEntries(Object.keys(places).map(key => [key, zones[key]]))) },
      filters.zone, zone => {
        filters.zone = zone;
        viewport = Object.hasOwn(places, zone) ? { center: places[zone], width: 250 } : overview;
        update();
      });
    const inputs = { zone: zoneSelect };

    function update() {
      const all = radio ? radioPoints : [...prayerPoints, ...notes];
      points = all.filter(item => {
        if (filters.zone && item.zone !== filters.zone) return false;
        const source = item.status ? 'sample' : item.historical ? 'historical' : 'published';
        if (radio && ((filters.type && item.type !== filters.type) || (filters.status && item.status !== filters.status) ||
          (filters.source && source !== filters.source))) return false;
        if (!radio && !selectedLayers.has(item.layer)) return false;
        return [item.label, zones[item.zone], item.location, item.frequency].filter(Boolean).join(' ').toLowerCase().includes(filters.query);
      });
      count.textContent = points.length ? points.length + (points.length === 1 ? ' map result' : ' map results') : 'No map results for these filters.';
      results.replaceChildren(...points.map(item => {
        const li = node('li');
        const control = button(item.label, () => choose(item), 'prep-row');
        control.append(node('small', radio ? sourceNames[item.status ? 'sample' : item.historical ? 'historical' : 'published'] :
          (item.local ? 'On this device' : 'Fictional') + ' · ' + layers[item.layer]));
        li.append(control);
        return li;
      }));
      draw();
      renderDetails();
    }

    const filtersRow = node('div', '', 'prep-filters');
    filtersRow.append(zoneField);
    if (radio) {
      const extra = [
        ['type', 'Type', { '': 'All types', ...kindLabels }],
        ['status', 'Original fixture status', { '': 'All statuses', active: 'Active (sample)', planned: 'Planned (sample)' }],
        ['source', 'Source', { '': 'All sources', ...sourceNames }],
      ];
      for (const [key, name, options] of extra) {
        const [field, select] = optionFilter(name, options, '', value => { filters[key] = value; update(); });
        inputs[key] = select;
        filtersRow.append(field);
      }
    } else {
      const layerControls = node('fieldset', '', 'prep-filters');
      layerControls.append(node('legend', 'Map layers'));
      for (const [key, name] of Object.entries(layers)) {
        const field = node('label', name, 'prep-checkbox');
        const toggle = node('input');
        toggle.type = 'checkbox';
        toggle.checked = true;
        toggle.dataset.layer = key;
        toggle.addEventListener('change', () => {
          if (toggle.checked) selectedLayers.add(key);
          else selectedLayers.delete(key);
          update();
        });
        field.prepend(toggle);
        layerControls.append(field);
      }
      filtersRow.append(layerControls);
    }
    const reset = button('Reset filters', () => {
      for (const [name, input] of Object.entries(inputs)) filters[name] = input.value = '';
      filters.query = search.value = '';
      active = '';
      viewport = overview;
      if (!radio) {
        for (const key of Object.keys(layers)) selectedLayers.add(key);
        for (const input of filtersRow.querySelectorAll('[type="checkbox"]')) input.checked = true;
      }
      update();
    });
    const controls = cluster(button('Zoom in', () => zoom(.67)), button('Zoom out', () => zoom(1.5)),
      button('Center on results', () => {
        const selected = points.find(item => item.id === active);
        const place = selected ? selected.lat == null ? places[selected.zone] : [selected.lng, selected.lat] : places[filters.zone];
        viewport = place ? { center: place, width: 250 } : overview;
        draw();
      }));
    const move = disclosure('Pan the map', cluster(button('West', () => pan(-1, 0)), button('East', () => pan(1, 0)),
      button('North', () => pan(0, 1)), button('South', () => pan(0, -1))));
    notice.tabIndex = -1;
    target.append(text(radio ? 'Original sample points and published references are shown separately. Dots show approximate places.' :
      'Explore fictional HomeGroups, prayers, and feast locations. New practice notes stay private on this device.'),
      searchField, filtersRow, reset, controls, move, map, notice, count, detail, results,
      text('County boundaries · U.S. Census Bureau TIGERweb, 2026 vintage.'),
      link(radio ? 'Original Radio Network Map source ↗' : 'Original Prayer Map source ↗', radio ? mapSource : prayerSource));

    if (radio) {
      target.append(cluster(button('Amateur radio resources', () => open('prepRadio')),
        button('Open the Prayer Map', () => open('prepPrayer', { zone: filters.zone }))));
    } else {
      const locate = button('Use my approximate area', () => {
        if (!counties.length || !navigator.geolocation) {
          notice.textContent = 'Location is unavailable. Choose an area manually.';
          return;
        }
        notice.textContent = 'Waiting for browser location permission…';
        navigator.geolocation.getCurrentPosition(position => {
          const { longitude, latitude } = position.coords;
          const county = counties.find(item => countyContains(item, longitude, latitude));
          const area = Object.keys(countyIds).find(key => countyIds[key] === county?.properties.GEOID);
          if (!area) {
            notice.textContent = 'Your location is outside the three example areas. Choose one manually.';
            return;
          }
          filters.zone = zoneSelect.value = area;
          viewport = { center: places[area], width: 250 };
          notice.textContent = 'Showing the ' + zones[area] + ' area. Your coordinates were not saved.';
          update();
        }, () => { notice.textContent = 'Location was unavailable or declined. Choose an area manually.'; },
        { enableHighAccuracy: false, maximumAge: 300_000, timeout: 8000 });
      });
      target.insertBefore(locate, controls);
      target.append(prayerForm(note => {
        notes = [...notes, note];
        const saved = writePrayerNotes(notes);
        filters.query = search.value = '';
        filters.zone = zoneSelect.value = note.zone;
        selectedLayers.add('prayer');
        filtersRow.querySelector('[type="checkbox"][data-layer="prayer"]').checked = true;
        viewport = { center: places[note.zone], width: 250 };
        active = note.id;
        notice.textContent = saved ? 'Private prayer note saved on this device.' : 'Prayer note added for this tab. Browser storage is unavailable.';
        update();
        return saved;
      }));
    }
    update();
    try {
      counties = await loadCounties();
      outlines.replaceChildren(...counties.map(feature => svgNode('path', {
        d: boundaryPath(feature), 'fill-rule': 'evenodd', 'vector-effect': 'non-scaling-stroke',
        class: feature.properties.STATE === '47' ? 'tn' : 'ky',
      })));
      notice.textContent = '';
    } catch {
      notice.textContent = 'County boundaries could not load. Markers and the result list are available.';
    }
  }

  function prayerForm(save) {
    const form = node('form', '', 'prep-stack');
    const [area, select] = optionFilter('Prayer area', Object.fromEntries(Object.keys(places).map(id => [id, zones[id]])), 'dickson', () => {});
    const field = node('label', 'Private practice prayer note');
    const input = node('textarea');
    input.required = true;
    input.maxLength = 180;
    const consent = node('input');
    consent.type = 'checkbox';
    consent.required = true;
    const check = node('label', 'Show an approximate area marker in this browser', 'prep-checkbox');
    check.prepend(consent);
    field.append(input);
    const result = text('');
    result.setAttribute('role', 'status');
    form.append(text('Use a fictional or general note. Choose an area freely and leave out addresses and personal details.'),
      area, field, check, node('button', 'Save private prayer note', 'button primary'), result);
    form.addEventListener('submit', event => {
      event.preventDefault();
      const title = input.value.trim();
      if (!title || !consent.checked) {
        result.textContent = 'Enter a note and confirm the approximate area.';
        return;
      }
      const saved = save({ id: 'local-' + Date.now(), zone: select.value, label: title, layer: 'prayer', local: true });
      form.reset();
      result.textContent = saved ? 'Saved locally.' : 'Available for this tab.';
    });
    return disclosure('Add a private prayer note', form);
  }

  return {
    prepMap: (target, frame) => renderMap(target, frame, 'radio'),
    prepPrayer: (target, frame) => renderMap(target, frame, 'prayer'),
  };
}
