// Shared screen geometry for the existing communication and media activities.
export function activityBounds() {
  const viewport = window.visualViewport;
  const left = (viewport?.offsetLeft || 0) + 8;
  let top = (viewport?.offsetTop || 0) + 8;
  const right = left + (viewport?.width || innerWidth) - 16;
  let bottom = top + (viewport?.height || innerHeight) - 16;
  const topBar = document.querySelector('.top')?.getBoundingClientRect();
  const dock = document.querySelector('.dock')?.getBoundingClientRect();
  if (topBar && topBar.bottom > top && topBar.bottom < bottom - 160) top = topBar.bottom + 6;
  if (dock && dock.top > top + 160 && dock.top < bottom) bottom = dock.top - 8;
  return {left, top, right, bottom, width:right-left, height:bottom-top};
}

export function positionEdgeHandle(handle, side, slot = 0) {
  const viewport = window.visualViewport;
  const area = activityBounds();
  const style = getComputedStyle(handle);
  const safeLeft = parseFloat(style.getPropertyValue('--communication-safe-left')) || 0;
  const safeRight = parseFloat(style.getPropertyValue('--communication-safe-right')) || 0;
  const x = (viewport?.offsetLeft || 0) + (side === 'left' ? safeLeft : (viewport?.width || innerWidth) - safeRight - 44);
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
    const viewport = window.visualViewport;
    const rect = element.getBoundingClientRect();
    side = requestedSide || (rect.left + rect.width/2 < (viewport?.offsetLeft || 0) + (viewport?.width || innerWidth)/2 ? 'left' : 'right');
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
  window.visualViewport?.addEventListener('resize', update);
  window.visualViewport?.addEventListener('scroll', update);
  return {
    park, restore,
    get parked() {return parked;},
    destroy() {
      handle.remove();
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    },
  };
}
