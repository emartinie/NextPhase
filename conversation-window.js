// One application-level communication surface: list and conversation share it.
export function createConversationWindow({ node, text, button, mountConversation, getShareContext, shareExternally, onChange }) {
  const root = node('section', '', 'conversation-window communication-surface');
  root.hidden = true;
  root.setAttribute('role', 'region');
  root.setAttribute('aria-labelledby', 'active-conversation-name');
  root.setAttribute('data-no-workspace-swipe', '');
  const header = node('header', '', 'conversation-window-header');
  const back = button('‹', () => showList(), 'quiet');
  back.setAttribute('aria-label', 'Back to conversations');
  const grip = node('div', '', 'communication-drag');
  grip.tabIndex = 0;
  grip.setAttribute('role', 'button');
  grip.setAttribute('aria-label', 'Move communication window. Drag to either edge to minimize. Arrow keys move; Alt and left or right arrow dock; Home resets position.');
  const mark = node('span', '⠿', 'communication-grip');
  mark.setAttribute('aria-hidden', 'true');
  const heading = node('h2', 'Conversations');
  heading.id = 'active-conversation-name';
  heading.tabIndex = -1;
  grip.append(mark, heading);
  const minimizeButton = button('−', () => minimize(), 'quiet');
  minimizeButton.setAttribute('aria-label', 'Minimize communications');
  const expand = button('↗', () => setMode(root.dataset.mode === 'expanded' ? 'open' : 'expanded'), 'quiet');
  expand.setAttribute('aria-label', 'Expand communications');
  const closeButton = button('×', () => dismiss(), 'quiet');
  closeButton.setAttribute('aria-label', 'Close communications');
  header.append(back, grip, minimizeButton, expand, closeButton);
  const list = node('div', '', 'communication-list');
  const content = node('div', '', 'conversation-window-content');
  content.hidden = true;
  root.append(header, list, content);
  const launcher = button('', () => show(), 'communication-launcher');
  launcher.setAttribute('aria-label', 'Open communications');
  const icon = node('span', '', 'communication-launcher-icon');
  icon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5A8.5 8.5 0 0 1 10.5 3h2A8.5 8.5 0 0 1 21 11.5Z"/></svg>';
  icon.setAttribute('aria-hidden', 'true');
  const launcherLabel = node('span', 'Conversations');
  const edgeArrow = node('span', '‹', 'communication-edge-arrow');
  edgeArrow.setAttribute('aria-hidden', 'true');
  launcher.append(icon, launcherLabel, edgeArrow);
  const viewportLayer = node('div', '', 'communication-viewport');
  viewportLayer.append(root);
  document.body.append(viewportLayer, launcher);
  let current;
  let discussion;
  let stopped = false;
  let visible = false;
  let view = 'list';
  let position;
  let normalPosition;
  let drag;
  let resumeFocus;
  let dockSide = 'right';

  const activeSelection = () => view === 'conversation' ? current : null;
  function bounds() {
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
  function place(desired = position, moving = false) {
    if (root.hidden) return;
    const area = bounds();
    const expanded = root.dataset.mode === 'expanded';
    const width = Math.min(expanded ? 620 : 352, area.width * (expanded ? 1 : .92));
    const mobile = (window.visualViewport?.width || innerWidth) < 700;
    const height = expanded ? area.height : mobile
      ? Math.min(312, Math.max(Math.min(248, area.height), area.height * .45))
      : Math.min(520, Math.max(Math.min(300, area.height), area.height * .78));
    const x = Math.max(area.left - (moving ? width + 12 : 0), Math.min(desired?.x ?? area.right-width, moving ? area.right + 12 : area.right-width));
    const y = Math.max(area.top, Math.min(desired?.y ?? area.bottom-height, area.bottom-height));
    position = {x, y};
    Object.assign(root.style, {left:x+'px', top:y+'px', right:'auto', width:width+'px', height:height+'px'});
    root.style.setProperty('--window-height',height+'px');
  }
  function refreshContext() {
    const selected = activeSelection();
    const minimized = visible && root.dataset.mode === 'minimized';
    launcher.dataset.docked = String(minimized);
    launcher.dataset.side = dockSide;
    edgeArrow.textContent = dockSide === 'left' ? '›' : '‹';
    launcherLabel.textContent = selected ? selected.title : 'Conversations';
    launcher.setAttribute('aria-label', minimized ? 'Reopen communications' : 'Open communications');
    launcher.title = minimized ? `Reopen ${selected?.title || 'conversations'} from ${dockSide} edge` : 'Open your conversations';
    placeLauncher();
  }
  function placeLauncher() {
    const minimized = visible && root.dataset.mode === 'minimized';
    if (!minimized) {
      for (const property of ['left','right','top','bottom']) launcher.style.removeProperty(property);
      return;
    }
    const viewport = window.visualViewport;
    const area = bounds();
    const style = getComputedStyle(launcher);
    const safeLeft = parseFloat(style.getPropertyValue('--communication-safe-left')) || 0;
    const safeRight = parseFloat(style.getPropertyValue('--communication-safe-right')) || 0;
    const x = (viewport?.offsetLeft || 0) + (dockSide === 'left' ? safeLeft : (viewport?.width || innerWidth) - safeRight - 44);
    const y = Math.max(area.top, area.top + (area.height - 44) / 2);
    Object.assign(launcher.style, {left:x+'px', top:y+'px', right:'auto', bottom:'auto'});
  }
  function notify() { refreshContext(); onChange?.(activeSelection()); }
  function setMode(mode, focus = true) {
    if (stopped) return;
    discussion?.remember?.();
    if (mode === 'expanded' && root.dataset.mode !== 'expanded') normalPosition = position && {...position};
    const reducing = root.dataset.mode === 'expanded' && mode === 'open';
    root.dataset.mode = mode;
    expand.textContent = mode === 'expanded' ? '↙' : '↗';
    expand.setAttribute('aria-label', mode === 'expanded' ? 'Reduce communications' : 'Expand communications');
    root.hidden = mode === 'minimized' || !visible;
    launcher.hidden = !root.hidden;
    if (mode === 'minimized') {
      resumeFocus = root.contains(document.activeElement) ? document.activeElement : null;
      if (root.contains(document.activeElement)) document.activeElement.blur();
      if (focus) launcher.focus({preventScroll:true});
    } else {
      place(reducing ? normalPosition : position);
      requestAnimationFrame(() => {
        discussion?.resume?.();
        if (focus) {
          const focusTarget = resumeFocus?.isConnected && content.contains(resumeFocus) && view === 'conversation' ? resumeFocus : heading;
          focusTarget.focus({preventScroll:true});
        }
        resumeFocus = null;
      });
    }
    notify();
  }
  function show() {
    if (stopped) return;
    visible = true;
    root.hidden = false;
    setMode('open');
  }
  function showList(openSurface = true) {
    discussion?.remember?.();
    if (content.contains(document.activeElement)) document.activeElement.blur();
    view = 'list';
    content.hidden = true;
    content.inert = true;
    list.hidden = false;
    heading.textContent = 'Conversations';
    back.hidden = true;
    root.dataset.view = view;
    if (openSurface) show();
    else notify();
  }
  function dismiss() {
    discussion?.();
    discussion = null;
    current = null;
    content.replaceChildren();
    visible = false;
    root.hidden = true;
    root.dataset.mode = 'closed';
    launcher.hidden = false;
    resumeFocus = null;
    showList(false);
    launcher.focus({preventScroll:true});
  }
  function reset() {
    const wasVisible = visible && !root.hidden;
    discussion?.();
    discussion = null;
    current = null;
    dockSide = 'right';
    content.replaceChildren();
    resumeFocus = null;
    showList(false);
    if (wasVisible) show();
    else { root.hidden = true; launcher.hidden = false; }
  }
  function minimize(focus = true) { if (visible) setMode('minimized', focus); }
  function open(selection) {
    if (stopped) return;
    const same = current && JSON.stringify(current) === JSON.stringify(selection);
    if (!same) {
      discussion?.();
      content.replaceChildren();
      current = {...selection};
      const info = node('details', '', 'communication-members');
      info.append(node('summary', selection.kind === 'private' ? 'Conversation info' : 'Members'));
      discussion = mountConversation(content, selection, {
        compact:true, detailsTarget:info, getShareContext, shareExternally,
      });
      if (!discussion) { current = null; showList(); return; }
      content.querySelector('.conversation-stream')?.prepend(info);
    }
    view = 'conversation';
    root.dataset.view = view;
    content.hidden = false;
    content.inert = false;
    list.hidden = true;
    heading.textContent = selection.title;
    back.hidden = false;
    show();
  }
  function prepare(item) {
    if (!activeSelection() || item?.kind !== 'scripture' || discussion?.stageReference?.(item.ref) !== true) return false;
    show();
    return true;
  }
  function endDrag(event, cancelled = false) {
    if (!drag || event.pointerId !== drag.id) return;
    const moved = drag.moved;
    const area = bounds();
    const rect = root.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportLeft = viewport?.offsetLeft || 0;
    const viewportRight = viewportLeft + (viewport?.width || innerWidth);
    const leftIntent = rect.left < area.left - Math.min(64, rect.width * .22)
      || (event.clientX <= viewportLeft + 24 && rect.left < area.left - 16);
    const rightIntent = rect.right > area.right + Math.min(64, rect.width * .22)
      || (event.clientX >= viewportRight - 24 && rect.right > area.right + 16);
    drag = null;
    root.classList.remove('communication-moving');
    if (grip.hasPointerCapture?.(event.pointerId)) grip.releasePointerCapture(event.pointerId);
    place();
    if (moved && !cancelled && (leftIntent || rightIntent)) {
      dockSide = leftIntent ? 'left' : 'right';
      minimize();
    }
  }
  grip.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.isPrimary === false) return;
    const rect = root.getBoundingClientRect();
    drag = {id:event.pointerId, x:event.clientX, y:event.clientY, origin:{x:rect.left,y:rect.top}, moved:false};
    event.preventDefault();
    try { grip.setPointerCapture(event.pointerId); } catch { /* Synthetic/nonactive pointers cannot be captured. */ }
  });
  grip.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX-drag.x, dy = event.clientY-drag.y;
    if (!drag.moved && Math.hypot(dx,dy)<6) return;
    drag.moved = true;
    root.classList.add('communication-moving');
    place({x:drag.origin.x+dx,y:drag.origin.y+dy}, true);
    event.preventDefault();
  });
  grip.addEventListener('pointerup', event => endDrag(event));
  grip.addEventListener('pointercancel', event => endDrag(event, true));
  grip.addEventListener('lostpointercapture', () => {drag=null;root.classList.remove('communication-moving');place();});
  grip.addEventListener('keydown', event => {
    const moves = {ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]};
    if (event.altKey && ['ArrowLeft','ArrowRight'].includes(event.key)) {
      event.preventDefault();dockSide=event.key === 'ArrowLeft' ? 'left' : 'right';minimize();
    } else if (event.key === 'Home') {event.preventDefault();position=null;place();}
    else if (moves[event.key]) {event.preventDefault();place({x:position.x+moves[event.key][0],y:position.y+moves[event.key][1]});}
  });
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') {event.preventDefault();event.stopPropagation();minimize();}
  });
  const updateViewport = () => { place(); placeLauncher(); };
  window.visualViewport?.addEventListener('resize', updateViewport);
  window.visualViewport?.addEventListener('scroll', updateViewport);
  window.addEventListener('resize', updateViewport);
  back.hidden = true;
  root.dataset.view = 'list';
  return {
    open, show, showList, dismiss, reset, prepare, refreshContext, minimize,
    listTarget:list,
    get active() {return activeSelection();},
    get available() {return visible;},
    close() {dismiss();stopped=true;viewportLayer.remove();launcher.remove();window.visualViewport?.removeEventListener('resize',updateViewport);window.visualViewport?.removeEventListener('scroll',updateViewport);window.removeEventListener('resize',updateViewport);},
  };
}
