// Workspace swipes belong to the card surface. Maps, fields and horizontal readers keep their gestures.
export function bindWorkspaceSwipe(surface, navigate) {
  let gesture;
  const controls = 'a, button, input, textarea, select, summary, audio, video, canvas, svg, [contenteditable], [data-no-workspace-swipe]';

  surface.addEventListener('touchstart', event => {
    gesture = null;
    if (event.touches.length !== 1 || event.target.closest(controls)) return;
    for (let item = event.target; item && item !== surface; item = item.parentElement) {
      if (item.scrollWidth > item.clientWidth + 2 && ['auto', 'scroll'].includes(getComputedStyle(item).overflowX)) return;
    }
    const touch = event.touches[0];
    // Leave the screen edges to Safari's browser-history gestures.
    if (touch.clientX < 24 || touch.clientX > window.innerWidth - 24) return;
    gesture = { x: touch.clientX, y: touch.clientY, started: event.timeStamp, horizontal: false };
  }, { passive: true });

  surface.addEventListener('touchmove', event => {
    if (!gesture) return;
    if (event.touches.length !== 1) {
      gesture = null;
      return;
    }
    const dx = Math.abs(event.touches[0].clientX - gesture.x);
    const dy = Math.abs(event.touches[0].clientY - gesture.y);
    if (!gesture.horizontal && dy > 12 && dy >= dx) {
      gesture = null;
      return;
    }
    if (dx > 16 && dx > dy * 2) gesture.horizontal = true;
    if (gesture.horizontal && event.cancelable) event.preventDefault();
  }, { passive: false });

  surface.addEventListener('touchend', event => {
    const start = gesture;
    gesture = null;
    if (!start || event.touches.length || event.changedTouches.length !== 1) return;
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = Math.abs(event.changedTouches[0].clientY - start.y);
    if (Math.abs(dx) < 64 || Math.abs(dx) < dy * 2 || event.timeStamp - start.started > 900) return;
    navigate(dx < 0 ? 1 : -1);
  }, { passive: true });
  surface.addEventListener('touchcancel', () => { gesture = null; }, { passive: true });
}
