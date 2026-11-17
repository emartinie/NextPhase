import { mountMemberMap } from './fellowship-map.js';

const memberMap = 'https://homegroups.org/?card=prayermap';
const number = new Intl.NumberFormat();
let mapRequest;
let automaticAttempted = false;

function communityMap() {
  const read = async file => {
    const response = await fetch(new URL(`./corpus/fellowship/${file}.json`, import.meta.url));
    if (!response.ok) throw new Error('Community map unavailable');
    return response.json();
  };
  mapRequest ??= Promise.all([read('community-map'), read('map-geography')]).then(([data, geography]) => ({ ...data, geography })).catch(error => {
    mapRequest = undefined;
    throw error;
  });
  return mapRequest;
}

export function mountFellowshipHome(target, { node, text, button, link, cluster, inviteConversation }) {
  const home = node('section', '', 'fellowship-home');
  home.setAttribute('aria-labelledby', 'community-map-title');
  const heading = node('h2', 'HomeGroups around the world');
  heading.id = 'community-map-title';
  const intro = text('Loading the community map…');
  intro.setAttribute('role', 'status');
  const mapSlot = node('div');
  home.append(heading, intro, mapSlot);
  target.append(home);

  let map;
  let loading = false;
  let closed = false;
  let timer;
  let locateRequest = 0;
  let scheduleNearby;

  function showMap(data) {
    const { members } = data;
    intro.textContent = `${number.format(members.length)} legacy map listings. Tap a marker to open its profile.`;
    const notice = text('', 'form-caption fellowship-map-notice');
    notice.setAttribute('role', 'status');
    const surface = node('div', '', 'fellowship-map');
    const backdrop = node('canvas', '', 'fellowship-map-backdrop');
    const tiles = node('div', '', 'fellowship-map-streets');
    const canvas = node('canvas', '', 'fellowship-map-markers');
    backdrop.setAttribute('aria-hidden', 'true');
    tiles.setAttribute('aria-hidden', 'true');
    const credit = link('© OpenStreetMap contributors', 'https://www.openstreetmap.org/copyright');
    credit.className = 'fellowship-map-attribution';
    const streetNotice = node('div', '', 'actions');
    const streetMessage = text('Street detail is unavailable. The overview map is still usable.', 'form-caption');
    streetMessage.setAttribute('role', 'status');
    streetNotice.append(streetMessage, button('Retry streets', () => map.retryTiles(), 'quiet'));
    streetNotice.hidden = true;
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'Member world map. Use the arrow keys to pan and plus or minus to zoom. Find members opens an accessible list.');
    const profile = node('section', '', 'fellowship-map-profile');
    profile.hidden = true;
    profile.tabIndex = -1;
    profile.setAttribute('aria-label', 'Member profile');
    const name = node('strong');
    const area = text('');
    const description = text('', 'fellowship-profile-description');
    const website = node('div');
    const identity = node('div', '', 'fellowship-profile-identity');
    identity.setAttribute('aria-live', 'polite');
    identity.append(name, text('Legacy map listing · Approximate location', 'form-caption'));
    const profileHeader = node('div', '', 'fellowship-profile-header');
    const profileBody = node('div', '', 'fellowship-profile-body');
    profileBody.tabIndex = 0;
    profileBody.setAttribute('role', 'group');
    profileBody.setAttribute('aria-label', 'Public profile details');
    profileBody.append(area, description, website);
    const profileActions = node('div', '', 'actions');
    let shared = [];
    let record = 0;
    let returnFocus;
    const label = index => members[index][2]?.name || 'HomeGroups member';

    function showProfile() {
      const index = shared[record];
      const details = members[index][2] ?? {};
      name.textContent = label(index);
      area.textContent = details.area ?? '';
      area.hidden = !details.area;
      description.textContent = details.description ?? '';
      description.hidden = !details.description;
      website.replaceChildren(...(details.website ? [link('Visit public website', details.website)] : []));
      website.hidden = !details.website;
      profileBody.hidden = !details.area && !details.description && !details.website;
      profileBody.scrollTop = 0;
      map.highlight(index);
      previousMember.hidden = nextMember.hidden = shared.length === 1;
    }
    const previousMember = button('‹', () => {
      record = (record + shared.length - 1) % shared.length;
      showProfile();
    }, 'quiet fellowship-profile-step');
    previousMember.setAttribute('aria-label', 'Previous member at this location');
    const nextMember = button('›', () => {
      record = (record + 1) % shared.length;
      showProfile();
    }, 'quiet fellowship-profile-step');
    nextMember.setAttribute('aria-label', 'Next member at this location');
    const invite = button('Invite to conversation', () => {
      invite.focus({ preventScroll: true });
      inviteConversation(shared[record], data.snapshot);
    });
    invite.setAttribute('aria-haspopup', 'dialog');
    profileActions.append(invite, previousMember, nextMember);
    function closeProfile(restoreFocus = false) {
      if (profile.hidden) return;
      profile.hidden = true;
      browse.inert = false;
      map.highlight(-1);
      if (restoreFocus) {
        const target = returnFocus?.isConnected ? returnFocus : canvas;
        target.focus({ preventScroll: target === canvas });
      }
    }
    const close = button('Close', () => closeProfile(true), 'quiet');
    profileHeader.append(identity, close);
    profile.append(profileHeader, profileBody, profileActions);
    profile.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      closeProfile(true);
    });
    function select(indices, trigger = canvas) {
      if (!indices.length) { closeProfile(); return; }
      cancelRegionalization();
      map.stopAnimation();
      returnFocus = trigger;
      shared = indices;
      record = 0;
      profile.hidden = false;
      browse.inert = true;
      showProfile();
      profile.focus({ preventScroll: true });
      profile.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    const browse = node('section', '', 'fellowship-map-picker');
    browse.id = 'fellowship-map-people';
    browse.setAttribute('aria-label', 'Members in this map view');
    browse.hidden = true;
    browse.tabIndex = -1;
    const list = node('div', '', 'fellowship-map-list');
    const pageSize = 12;
    let offset = 0;
    const prev = button('Previous members', () => { offset -= pageSize; updateList(prev); });
    const next = button('More members', () => { offset += pageSize; updateList(next); });
    const pagination = cluster(prev, next);
    const pickerHeading = node('div', '', 'fellowship-profile-header');
    pickerHeading.append(node('strong', 'Members in this view'), button('Close', () => toggleMembers(false), 'quiet'));
    browse.append(pickerHeading, list, pagination, link('Original member map', memberMap));
    function updateList(trigger) {
      if (browse.hidden) return;
      const visible = map.visible();
      const buttons = visible.slice(offset, offset + pageSize).map(index => button(label(index), event => select([index], event.currentTarget), 'row'));
      list.replaceChildren(...(buttons.length ? buttons : [text('No members in this view. Zoom out or move the map.')]));
      prev.hidden = offset === 0;
      next.hidden = offset + pageSize >= visible.length;
      if (trigger?.hidden) buttons[0]?.focus({ preventScroll: true });
    }
    function refreshList() { offset = 0; updateList(); }
    function moved() { closeProfile(); refreshList(); }
    function toggleMembers(show) {
      closeProfile();
      browse.hidden = !show;
      people.setAttribute('aria-expanded', String(show));
      if (show) {
        cancelRegionalization();
        map.stopAnimation();
        refreshList();
        browse.focus({ preventScroll: true });
      } else people.focus({ preventScroll: true });
    }
    browse.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.stopPropagation(); toggleMembers(false); }
    });

    function cancelRegionalization() {
      clearTimeout(timer);
      timer = undefined;
      automaticAttempted = true;
      locateRequest++;
      notice.textContent = '';
    }
    function regionalize() {
      cancelRegionalization();
      closeProfile();
      map.stopAnimation();
      const request = locateRequest;
      if (!navigator.geolocation) {
        notice.textContent = 'Location is unavailable. You can still explore the map.';
        return;
      }
      notice.textContent = 'Regionalizing…';
      navigator.geolocation.getCurrentPosition(({ coords }) => {
        if (closed || request !== locateRequest) return;
        // Round before ranking locally. Street tiles only use the resulting map viewport.
        const nearby = [coords.longitude, coords.latitude].map(value => Math.round(value * 10) / 10);
        map.nearby(nearby, count => { notice.textContent = `Showing the ${count} closest map listings.`; });
      }, () => {
        if (!closed && request === locateRequest) notice.textContent = 'Location is unavailable. You can still explore the map.';
      }, { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 });
    }

    const zoomIn = button('+', () => map.zoom(1.6));
    zoomIn.setAttribute('aria-label', 'Zoom in');
    const zoomOut = button('−', () => map.zoom(1 / 1.6));
    zoomOut.setAttribute('aria-label', 'Zoom out');
    const world = button('World', () => {
      cancelRegionalization();
      map.world();
    });
    world.setAttribute('aria-label', 'View World');
    const nearby = button('Nearby', regionalize);
    nearby.setAttribute('aria-label', 'Find nearby');
    const people = button('People', () => toggleMembers(browse.hidden));
    people.setAttribute('aria-label', 'Find members');
    people.setAttribute('aria-controls', browse.id);
    people.setAttribute('aria-expanded', 'false');
    const toolbar = cluster(world, nearby, zoomIn, zoomOut, people);
    toolbar.classList.add('fellowship-map-toolbar');
    surface.append(backdrop, tiles, canvas, credit, toolbar, browse, profile);
    mapSlot.replaceChildren(surface, notice, streetNotice);
    map = mountMemberMap({ canvas, backdrop, tiles }, data, {
      select, manual: cancelRegionalization, moved, streetStatus: unavailable => { streetNotice.hidden = !unavailable; },
    });
    scheduleNearby = () => {
      if (automaticAttempted || timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        if (!home.closest('[inert]') && !document.hidden && !document.querySelector('dialog[open]')) regionalize();
      }, 1200);
    };
    scheduleNearby();
  }

  async function load() {
    if (loading || closed) return;
    if (map) { map.refreshTiles(); scheduleNearby(); return; }
    loading = true;
    mapSlot.replaceChildren();
    intro.textContent = 'Loading the community map…';
    try {
      const data = await communityMap();
      if (!closed && home.isConnected) showMap(data);
    } catch {
      if (!closed && home.isConnected) {
        intro.textContent = 'The community map could not load.';
        mapSlot.replaceChildren(button('Try map again', load));
      }
    } finally {
      loading = false;
    }
  }

  return { load, close() { closed = true; clearTimeout(timer); map?.close(); } };
}
