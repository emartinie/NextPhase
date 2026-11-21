// One modeless activity, independent of workspace routes and reader panels.
export function createConversationWindow({ node, text, button, mountConversation, getShareContext, shareExternally, onChange }) {
  const root = node('section', '', 'conversation-window');
  root.hidden = true;
  root.setAttribute('role', 'region');
  root.setAttribute('aria-labelledby', 'active-conversation-name');
  root.setAttribute('data-no-workspace-swipe', '');
  const header = node('header', '', 'conversation-window-header');
  const heading = node('h2');
  heading.id = 'active-conversation-name';
  heading.tabIndex = -1;
  const minimize = button('−', () => setMode('minimized'), 'quiet');
  minimize.setAttribute('aria-label', 'Minimize conversation and explore HomeGroups');
  const expand = button('↗', () => setMode(root.dataset.mode === 'expanded' ? 'open' : 'expanded'), 'quiet');
  expand.setAttribute('aria-label', 'Expand conversation');
  const menu = node('details', '', 'conversation-menu');
  const menuToggle = node('summary', '⋯');
  menuToggle.setAttribute('aria-label', 'Conversation details');
  const details = node('div', '', 'conversation-menu-content');
  menu.append(menuToggle, details);
  header.append(heading, minimize, expand, menu);
  const content = node('div', '', 'conversation-window-content');
  const tray = node('div', '', 'conversation-tray');
  const reopen = button('', () => setMode('open'), 'quiet');
  const contextAction = button('+', () => {
    const item = getShareContext();
    if (item) prepare(item);
  }, 'quiet');
  contextAction.setAttribute('aria-label', 'Prepare current Scripture for this conversation');
  tray.append(reopen, contextAction);
  root.append(header, content, tray);
  document.body.append(root);
  let current;
  let discussion;
  let stopped = false;
  let lastFocus;

  function syncViewport() {
    if (root.hidden) return;
    root.style.setProperty('--activity-height', `${window.visualViewport?.height || innerHeight}px`);
    root.style.setProperty('--activity-top', `${window.visualViewport?.offsetTop || 0}px`);
  }
  function setMode(mode, focus = true) {
    if (!current || stopped) return;
    discussion?.remember?.();
    menu.open = false;
    root.dataset.mode = mode;
    expand.textContent = mode === 'expanded' ? '↙' : '↗';
    expand.setAttribute('aria-label', mode === 'expanded' ? 'Reduce conversation window' : 'Expand conversation');
    if (mode === 'minimized') {
      if (content.contains(document.activeElement)) document.activeElement.blur();
      content.inert = true;
      if (focus) reopen.focus({ preventScroll: true });
    } else {
      content.inert = false;
      requestAnimationFrame(() => { discussion?.resume?.(); if (focus) heading.focus({ preventScroll: true }); });
    }
    syncViewport();
    onChange?.(current);
  }
  function refreshContext() {
    const item = current && getShareContext();
    contextAction.hidden = !item;
    contextAction.title = item ? `Prepare ${item.label} for ${current.title}` : '';
  }
  function dismiss() {
    if (!current) return;
    discussion?.();
    discussion = null;
    current = null;
    content.replaceChildren();
    details.replaceChildren();
    heading.textContent = reopen.textContent = '';
    root.hidden = true;
    onChange?.(null);
    if (lastFocus?.isConnected && !lastFocus.closest('[inert]')) lastFocus.focus({ preventScroll: true });
  }
  function open(selection) {
    if (stopped) return;
    const same = current && JSON.stringify(current) === JSON.stringify(selection);
    if (!same) {
      discussion?.();
      content.replaceChildren();
      details.replaceChildren();
      current = { ...selection };
      lastFocus = document.activeElement;
      heading.textContent = selection.title;
      reopen.textContent = `Conversation · ${selection.title}`;
      reopen.setAttribute('aria-label', `Reopen conversation with ${selection.title}`);
      details.append(text(selection.kind === 'private' ? 'Private conversation' : 'Private community', 'eyebrow'));
      const identityDetails = node('div');
      details.append(identityDetails, button('Close conversation', dismiss, 'quiet'));
      discussion = mountConversation(content, selection, {
        compact: true, detailsTarget: identityDetails,
        getShareContext, shareExternally,
        onReadPassage(ref) { setMode('minimized', false); },
      });
      if (!discussion) { dismiss(); return; }
    }
    root.hidden = false;
    setMode('open');
    refreshContext();
  }
  function prepare(item) {
    if (!current || item?.kind !== 'scripture' || !discussion?.stageReference) return false;
    if (discussion.stageReference(item.ref) === false) return false;
    setMode('open');
    return true;
  }
  const viewport = window.visualViewport;
  viewport?.addEventListener('resize', syncViewport);
  viewport?.addEventListener('scroll', syncViewport);
  window.addEventListener('resize', syncViewport);
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (menu.open) menu.open = false; else setMode('minimized'); }
  });
  return {
    open, dismiss, prepare, refreshContext,
    minimize() { if (current && root.dataset.mode !== 'minimized') setMode('minimized', false); },
    get active() { return current; },
    close() { dismiss(); stopped = true; root.remove(); viewport?.removeEventListener('resize', syncViewport); viewport?.removeEventListener('scroll', syncViewport); window.removeEventListener('resize', syncViewport); },
  };
}
