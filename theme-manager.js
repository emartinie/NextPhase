const themes = {
  nextphase: 'NextPhase default',
  cosmic: 'Cosmic Glass',
  sapphire: 'Midnight Sapphire',
  parchment: 'Ancient Parchment',
  'olam-haba': 'Olam HaBa',
  diagnostic: 'Diagnostic preview',
};
const defaultTheme = 'cosmic';
const key = 'nextphase:theme';
const root = document.documentElement;
let saved = defaultTheme;

function applyTheme(theme) {
  root.dataset.theme = theme;
  const background = getComputedStyle(root).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
}

export function initAppearance() {
  try {
    const theme = localStorage.getItem(key);
    if (theme !== 'diagnostic' && Object.hasOwn(themes, theme)) saved = theme;
  } catch {}
  applyTheme(saved);
}

export function bindThemeDiagnostic(toggle) {
  let taps = 0;
  let firstTap = 0;
  document.addEventListener('click', event => {
    if (!event.target.closest('#study-title')) return;
    const now = Date.now();
    if (now - firstTap > 3000) {
      taps = 0;
      firstTap = now;
    }
    if (++taps < 5) return;
    taps = 0;
    toggle();
  });
  document.addEventListener('keydown', event => {
    if (event.repeat || !event.ctrlKey || !event.altKey || !event.shiftKey || event.key.toLowerCase() !== 'd') return;
    event.preventDefault();
    toggle();
  });
}

export function createThemeView({ node, text, button, cluster }) {
  return function themeManager(target, frame) {
    let preview = saved;
    const options = node('fieldset', '', 'theme-options');
    options.append(node('legend', 'App theme'));
    const status = text('');
    status.setAttribute('role', 'status');
    const save = button('Save theme', () => {
      saved = preview;
      try {
        localStorage.setItem(key, saved);
        update(`${themes[saved]} is saved on this device.`);
      } catch {
        update(`${themes[saved]} is active for this session. Browser storage is unavailable.`);
      }
    }, 'button primary');
    const controls = Object.entries(themes).map(([id, title]) => {
      const label = node('label', title, 'theme-choice');
      const radio = node('input');
      Object.assign(radio, { type: 'radio', name: 'nextphase-theme', value: id });
      radio.addEventListener('change', () => {
        preview = id;
        update();
      });
      label.prepend(radio);
      options.append(label);
      return radio;
    });
    function update(message) {
      applyTheme(preview);
      for (const control of controls) control.checked = control.value === preview;
      save.disabled = preview === saved || preview === 'diagnostic';
      status.textContent = message ?? (preview === 'diagnostic'
        ? 'Diagnostic colors are temporary.'
        : preview === saved ? `${themes[saved]} is active.` : `Previewing ${themes[preview]}.`);
    }
    frame.onLeave = () => {
      preview = saved;
      update();
    };
    if (frame.data.diagnostic) preview = 'diagnostic';
    target.append(text('Preview a palette across the app. Save it to keep it on this device.'), options, cluster(save), status);
    update();
  };
}
