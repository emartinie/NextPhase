import { communicationRect, positionEdgeHandle, layoutDetails, recordCommunicationLayout } from './edge-docking.js';

// The existing list and conversation share two presentations: full screen or sideparked.
export function createConversationWindow({ node, text, button, mountConversation, getShareContext, shareExternally, onChange }) {
  const root = node('section', '', 'conversation-window communication-surface');
  root.hidden = true;
  root.inert = true;
  root.dataset.mode = 'minimized';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-hidden', 'true');
  root.setAttribute('aria-labelledby', 'active-conversation-name');
  root.setAttribute('data-no-workspace-swipe', '');
  const header = node('header', '', 'conversation-window-header');
  const back = button('‹', () => showList(), 'quiet');
  back.setAttribute('aria-label', 'Back to conversations');
  const titles = node('div', '', 'communication-title');
  const kicker = node('span', 'HomeGroups Fellowship', 'communication-kicker');
  const heading = node('h2', 'Conversations');
  heading.id = 'active-conversation-name';
  heading.tabIndex = -1;
  titles.append(kicker, heading);
  const parkButton = button('›', () => minimize(), 'quiet communication-park');
  parkButton.setAttribute('aria-label', 'Sidepark communications');
  parkButton.title = 'Return to HomeGroups';
  header.append(back, titles, parkButton);
  if (new URLSearchParams(location.search).get('layout') === 'check') {
    const copy = button('Copy layout', async () => {
      try { await navigator.clipboard.writeText(JSON.stringify(layoutDetails(),null,2)); copy.textContent = 'Copied'; }
      catch { copy.textContent = 'Copy unavailable'; }
    }, 'quiet communication-layout-copy');
    copy.setAttribute('aria-label','Copy communication layout details');
    header.insertBefore(copy,parkButton);
  }
  const list = node('div', '', 'communication-list');
  const content = node('div', '', 'conversation-window-content');
  content.hidden = true;
  root.append(header, list, content);
  const launcher = button('', () => show(), 'communication-launcher');
  launcher.setAttribute('aria-label', 'Open communications');
  launcher.dataset.docked = 'true';
  const edgeArrow = node('span', '‹', 'communication-edge-arrow');
  edgeArrow.setAttribute('aria-hidden', 'true');
  launcher.append(edgeArrow);
  const viewportLayer = node('div', '', 'communication-viewport');
  viewportLayer.hidden = true;
  viewportLayer.append(root);
  document.body.append(viewportLayer, launcher);
  let current, discussion, resumeFocus, motion;
  let stopped = false, visible = false, view = 'list', dockSide = 'right';
  const covered = new Map();
  const activeSelection = () => view === 'conversation' ? current : null;

  function coverWorkspace(fullscreen) {
    document.body.dataset.communicator = fullscreen ? 'fullscreen' : 'sideparked';
    if (fullscreen) {
      for (const element of document.body.children) {
        if (!(element instanceof HTMLElement) || element === viewportLayer || element === launcher || ['SCRIPT','STYLE','LINK'].includes(element.tagName)) continue;
        if (!covered.has(element)) covered.set(element, element.inert);
        element.inert = true;
        element.setAttribute('data-communication-covered', '');
      }
    } else {
      for (const [element, inert] of covered) {
        element.inert = inert;
        element.removeAttribute('data-communication-covered');
      }
      covered.clear();
    }
  }
  const observer = new MutationObserver(() => {
    if (root.dataset.mode === 'fullscreen') coverWorkspace(true);
  });
  observer.observe(document.body, {childList:true});

  function place() {
    if (root.hidden) return;
    recordCommunicationLayout('before-layout');
    const area = communicationRect();
    if (!area) return;
    Object.assign(viewportLayer.style, {left:area.left+'px', top:area.top+'px', width:area.width+'px', height:area.height+'px'});
    root.style.setProperty('--window-height',area.height+'px');
    recordCommunicationLayout('after-layout');
  }
  function refreshContext() {
    launcher.dataset.docked = 'true';
    launcher.dataset.side = dockSide;
    edgeArrow.textContent = dockSide === 'left' ? '›' : '‹';
    parkButton.textContent = dockSide === 'left' ? '‹' : '›';
    launcher.setAttribute('aria-label', visible ? 'Reopen communications' : 'Open communications');
    launcher.title = 'Open ' + (activeSelection()?.title || 'conversations');
    positionEdgeHandle(launcher, dockSide);
  }
  function notify() { refreshContext(); onChange?.(activeSelection()); }
  function animate(fullscreen) {
    motion?.cancel();
    motion = null;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || typeof root.animate !== 'function') {
      root.hidden = !fullscreen;
      viewportLayer.hidden = !fullscreen;
      return;
    }
    const shift = dockSide === 'left' ? '-18px' : '18px';
    const frames = [{opacity:0,transform:'translateX('+shift+')'},{opacity:1,transform:'translateX(0)'}];
    motion = root.animate(fullscreen ? frames : [...frames].reverse(), {duration:160,easing:'cubic-bezier(.2,.7,.2,1)'});
    if (!fullscreen) motion.onfinish = () => {
      if (root.dataset.mode === 'minimized') { root.hidden = true; viewportLayer.hidden = true; }
    };
  }
  function setMode(mode, focus = true) {
    if (stopped) return;
    const fullscreen = mode === 'fullscreen';
    const changed = root.dataset.mode !== mode;
    discussion?.remember?.();
    if (!fullscreen) {
      resumeFocus = root.contains(document.activeElement) ? document.activeElement : null;
      if (resumeFocus) resumeFocus.blur();
    }
    root.dataset.mode = mode;
    root.inert = !fullscreen;
    root.setAttribute('aria-hidden',String(!fullscreen));
    launcher.hidden = fullscreen;
    coverWorkspace(fullscreen);
    if (fullscreen) {
      viewportLayer.hidden = false;
      root.hidden = false;
      place();
      if (changed) animate(true);
      requestAnimationFrame(() => {
        if (root.dataset.mode !== 'fullscreen') return;
        discussion?.resume?.();
        if (focus) {
          const target = resumeFocus?.isConnected && resumeFocus.getClientRects().length && !resumeFocus.disabled && content.contains(resumeFocus) && view === 'conversation' ? resumeFocus : heading;
          target.focus({preventScroll:true});
        }
        resumeFocus = null;
      });
    } else {
      if (!root.hidden && changed) animate(false);
      else { root.hidden = true; viewportLayer.hidden = true; }
      if (focus) launcher.focus({preventScroll:true});
    }
    notify();
  }
  function show() { if (!stopped) { visible = true; setMode('fullscreen'); } }
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
    if (openSurface) show(); else notify();
  }
  // Retain the caller's cleanup/recipient-clearing contract without a third presentation.
  function dismiss() {
    discussion?.(); discussion = null; current = null;
    content.replaceChildren();
    visible = false; resumeFocus = null;
    showList(false);
    setMode('minimized');
  }
  function reset() {
    const wasFullscreen = root.dataset.mode === 'fullscreen';
    discussion?.(); discussion = null; current = null;
    dockSide = 'right'; resumeFocus = null;
    content.replaceChildren();
    showList(false);
    if (wasFullscreen) show(); else { visible = false; setMode('minimized',false); }
  }
  function minimize(focus = true) { if (visible) setMode('minimized',focus); }
  function open(selection) {
    if (stopped) return;
    const same = current && JSON.stringify(current) === JSON.stringify(selection);
    if (!same) {
      discussion?.(); content.replaceChildren(); current = {...selection};
      const info = node('details', '', 'communication-members');
      info.append(node('summary',selection.kind === 'private' ? 'Conversation info' : 'Members'));
      discussion = mountConversation(content,selection,{compact:true,detailsTarget:info,getShareContext,shareExternally});
      if (!discussion) { current = null; showList(); return; }
      content.querySelector('.conversation-stream')?.prepend(info);
    }
    view = 'conversation'; root.dataset.view = view;
    content.hidden = false; content.inert = false; list.hidden = true;
    heading.textContent = selection.title; back.hidden = false;
    show();
  }
  function prepare(item) {
    if (!activeSelection() || item?.kind !== 'scripture' || discussion?.stageReference?.(item.ref) !== true) return false;
    show(); return true;
  }
  root.addEventListener('keydown',event => {
    if (event.altKey && ['ArrowLeft','ArrowRight'].includes(event.key)) {
      event.preventDefault(); dockSide = event.key === 'ArrowLeft' ? 'left' : 'right'; minimize();
    } else if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation();
      const attachment = content.querySelector('.conversation-attachment[open]');
      if (attachment) { attachment.open = false; attachment.querySelector('summary')?.focus(); }
      else minimize();
    } else if (event.key === 'Tab') {
      const controls = [...root.querySelectorAll('button,input,textarea,select,summary,[tabindex="0"],a[href]')].filter(item=>!item.disabled && !item.closest('[inert]') && item.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === heading)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  const updateViewport = () => { discussion?.remember?.(); place(); refreshContext(); };
  window.visualViewport?.addEventListener('resize',updateViewport);
  window.visualViewport?.addEventListener('scroll',updateViewport);
  window.addEventListener('resize',updateViewport);
  window.addEventListener('workspace:resize',updateViewport);
  window.addEventListener('pageshow',updateViewport);
  root.addEventListener('focusin',updateViewport);
  root.addEventListener('focusout',updateViewport);
  back.hidden = true; root.dataset.view = 'list'; refreshContext();
  return {
    open,show,showList,dismiss,reset,prepare,refreshContext,minimize,listTarget:list,
    get active() { return activeSelection(); },
    get available() { return visible; },
    get fullscreen() { return root.dataset.mode === 'fullscreen'; },
    close() {
      dismiss(); stopped = true; motion?.cancel(); observer.disconnect(); coverWorkspace(false);
      viewportLayer.remove(); launcher.remove();
      window.visualViewport?.removeEventListener('resize',updateViewport);
      window.visualViewport?.removeEventListener('scroll',updateViewport);
      window.removeEventListener('resize',updateViewport); window.removeEventListener('workspace:resize',updateViewport);
      window.removeEventListener('pageshow',updateViewport);
    },
  };
}
