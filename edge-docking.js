// Shared screen geometry for the existing communication and media activities.
export function workspaceRect() {
  const viewport = window.visualViewport;
  const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
  const right = left + (viewport?.width || innerWidth);
  const bottom = top + (viewport?.height || innerHeight);
  const app = document.querySelector('.app')?.getBoundingClientRect();
  const rect = {left:Math.max(left, app?.left ?? left), top:Math.max(top, app?.top ?? top),
    right:Math.min(right, app?.right ?? right), bottom:Math.min(bottom, app?.bottom ?? bottom)};
  return {...rect, width:Math.max(0,rect.right-rect.left), height:Math.max(0,rect.bottom-rect.top)};
}

export function initWorkspaceViewport() {
  const root = document.documentElement, viewport = window.visualViewport;
  let frame;
  function update() {
    frame = null;
    // Preserve native pinch zoom/panning rather than reflowing the page under it.
    if (!viewport || Math.abs(viewport.scale-1) < .01) {
      root.style.setProperty('--workspace-left', (viewport?.offsetLeft || 0)+'px');
      root.style.setProperty('--workspace-top', (viewport?.offsetTop || 0)+'px');
      root.style.setProperty('--workspace-width', (viewport?.width || innerWidth)+'px');
      root.style.setProperty('--workspace-visible-height', (viewport?.height || innerHeight)+'px');
    }
    root.style.setProperty('--workspace-dock-height', (document.querySelector('.dock')?.getBoundingClientRect().height || 68)+'px');
    window.dispatchEvent(new Event('workspace:resize'));
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  viewport?.addEventListener('resize', schedule);
  viewport?.addEventListener('scroll', schedule);
  for (const event of ['resize','pageshow','orientationchange']) window.addEventListener(event, schedule);
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
  for (const item of document.querySelectorAll('.top,.dock')) observer?.observe(item);
  update();
  return () => {
    if (frame) cancelAnimationFrame(frame);
    observer?.disconnect();
    viewport?.removeEventListener('resize',schedule);viewport?.removeEventListener('scroll',schedule);
    for (const event of ['resize','pageshow','orientationchange']) window.removeEventListener(event,schedule);
  };
}

export function activityBounds() {
  const workspace = workspaceRect();
  const left = workspace.left + 8;
  let top = workspace.top + 8;
  const right = workspace.right - 8;
  let bottom = workspace.bottom - 8;
  const topBar = document.querySelector('.top')?.getBoundingClientRect();
  const dock = document.querySelector('.dock')?.getBoundingClientRect();
  if (topBar && topBar.bottom > top && topBar.bottom < bottom - 160) top = topBar.bottom + 6;
  if (dock && dock.top > top + 160 && dock.top < bottom) bottom = dock.top - 8;
  return {left, top, right, bottom, width:right-left, height:bottom-top};
}

export function positionEdgeHandle(handle, side, slot = 0) {
  const workspace = workspaceRect();
  const area = activityBounds();
  const style = getComputedStyle(handle);
  const safeLeft = parseFloat(style.getPropertyValue('--communication-safe-left')) || 0;
  const safeRight = parseFloat(style.getPropertyValue('--communication-safe-right')) || 0;
  const x = side === 'left' ? workspace.left + safeLeft : workspace.right - safeRight - 44;
  const y = Math.max(area.top, Math.min(area.bottom - 44, area.top + (area.height - 44) / 2 + slot * 52));
  Object.assign(handle.style, {left:x+'px', top:y+'px', right:'auto', bottom:'auto'});
}

export function createEdgeParking(element, {label, slot = 1, onRestore} = {}) {
  const handle = document.createElement('button');
  handle.type = 'button';
  handle.className = 'communication-launcher orbit-edge-handle';
  handle.setAttribute('aria-label', 'Restore ' + label);
  handle.setAttribute('data-no-workspace-swipe', '');
  handle.dataset.docked = 'true';
  handle.hidden = true;
  const arrow = document.createElement('span');
  arrow.className = 'communication-edge-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  handle.append(arrow);
  document.body.append(handle);
  let parked = false;
  let side = 'right';
  let previousFocus;
  const update = () => { if (parked) positionEdgeHandle(handle, side, slot); };
  function park(requestedSide) {
    if (parked || !element.isConnected) return;
    const workspace = workspaceRect();
    const rect = element.getBoundingClientRect();
    side = requestedSide || (rect.left + rect.width/2 < workspace.left + workspace.width/2 ? 'left' : 'right');
    previousFocus = element.contains(document.activeElement) ? document.activeElement : null;
    parked = true;
    element.dataset.mode = 'minimized';
    element.hidden = true;
    handle.dataset.side = side;
    handle.title = 'Restore ' + label + ' from ' + side + ' edge';
    arrow.textContent = side === 'left' ? '›' : '‹';
    handle.hidden = false;
    update();
    handle.focus({preventScroll:true});
  }
  function restore() {
    if (!parked || !element.isConnected) return;
    parked = false;
    element.hidden = false;
    element.dataset.mode = 'open';
    handle.hidden = true;
    onRestore?.();
    previousFocus?.isConnected && previousFocus.focus({preventScroll:true});
  }
  handle.addEventListener('click', restore);
  window.addEventListener('resize', update);
  window.addEventListener('workspace:resize', update);
  window.visualViewport?.addEventListener('resize', update);
  window.visualViewport?.addEventListener('scroll', update);
  return {
    park, restore,
    get parked() {return parked;},
    destroy() {
      handle.remove();
      window.removeEventListener('resize', update);
      window.removeEventListener('workspace:resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    },
  };
}
