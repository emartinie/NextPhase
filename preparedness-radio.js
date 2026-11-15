
import { frequencies, gear, radioLinks, radioPoints, radioSource } from './preparedness-resources.js';

function readLocal(key, fallback) {
  try {
    const data = JSON.parse(localStorage.getItem(key));
    return Array.isArray(data) ? data : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key, value, status, success) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    status.textContent = success;
  } catch {
    status.textContent = 'Browser storage is unavailable. Changes apply for this tab.';
  }
}

const gearKey = 'nextphase-preparedness-gear-v1';
const contactKey = 'nextphase-preparedness-contacts-v1';

export function createRadioViews({ node, text, button, cluster, disclosure, link, open }) {
  let packed = readLocal(gearKey, []).filter(item => gear.includes(item));
  let contacts = readLocal(contactKey, []).filter(item => item?.id && typeof item.call === 'string' && typeof item.note === 'string');

  function gearChecklist() {
    const status = text('');
    status.setAttribute('role', 'status');
    const labels = gear.map(item => {
      const field = node('label', item, 'prep-checkbox');
      const input = node('input');
      input.type = 'checkbox';
      input.checked = packed.includes(item);
      input.addEventListener('change', () => {
        packed = input.checked ? [...new Set([...packed, item])] : packed.filter(value => value !== item);
        writeLocal(gearKey, packed, status, 'Checklist saved on this device.');
      });
      field.prepend(input);
      return field;
    });
    return disclosure('Build a loadout', text('Original gear list. Choose equipment that suits the exercise and radio service.'),
      ...labels, status);
  }

  return {
    prepRadio(target, { data }) {
      const refs = radioLinks.map(([name, url, description]) => {
        const entry = node('div', '', 'prep-resource');
        entry.append(link(name + ' ↗', url), text(description));
        return entry;
      });
      const netNotes = radioPoints.filter(item => item.net).map(item => {
        const entry = node('div', '', 'prep-resource');
        entry.append(link(item.label + ' ↗', item.net), text(item.schedule));
        return entry;
      });
      target.append(text('Listen, learn the basics, and practice with your group. In the U.S., amateur transmissions require an appropriately licensed control operator.'),
        cluster(button('Radio Network Map', () => open('prepMap', { zone: data.zone }), 'button primary'),
          button('Open the Wednesday practice', () => open('preparedness', { initial: 'group' })),
          button('Comms library', () => open('prepLibrary', { category: 'comms' }))),
        disclosure('Published net information', text('Club sources and dates vary. Open a club page for changes.'),
          ...netNotes, link('ARRL net directory ↗', 'https://www.arrl.org/arrl-net-directory')),
        disclosure('Quick frequencies',
          text('Preserved from the original reference card.'),
          ...frequencies.map(([frequency, label, detail]) =>
            disclosure(frequency + ' · ' + label, text(detail))),
          text('Tune and Scan in the old card displayed prompts. Use an external receiver directory to find public listening options.'),
          link('Find a public receiver ↗', 'https://websdr.org')),
        disclosure('Licensing, training, and preparedness links', ...refs),
        gearChecklist(),
        cluster(button('Open practice fallback plan', () => open('practicePlan')),
          button('Log a practice contact', () => open('prepContacts')),
          button('Research backlog', () => open('prepResearch'))),
        link('Original Amateur Radio card source ↗', radioSource));
    },

    prepContacts(target) {
      const form = node('form');
      const callLabel = node('label', 'Practice call sign or station label');
      const call = node('input');
      call.maxLength = 40;
      callLabel.append(call);
      const noteLabel = node('label', 'Practice contact notes');
      const note = node('textarea');
      note.maxLength = 360;
      noteLabel.append(note);
      const status = text('');
      status.setAttribute('role', 'status');
      status.tabIndex = -1;
      const results = node('ul', '', 'prep-list');

      function render() {
        results.replaceChildren(...(contacts.length ? contacts.map(item => {
          const entry = node('li', '', 'prep-stack');
          entry.append(node('strong', item.call || 'Practice contact'), text(item.note),
            button('Remove ' + (item.call || 'practice contact'), () => {
              contacts = contacts.filter(contact => contact.id !== item.id);
              writeLocal(contactKey, contacts, status, 'Local practice contact removed.');
              render();
              status.focus();
            }, 'quiet'));
          return entry;
        }) : [node('li', 'No local practice contacts yet.')]));
      }
      form.append(callLabel, noteLabel, node('button', 'Save practice contact', 'button primary'));
      form.addEventListener('submit', event => {
        event.preventDefault();
        if (!call.value.trim() && !note.value.trim()) {
          status.textContent = 'Enter a practice station label or a note.';
          return;
        }
        contacts = [{ id: crypto.randomUUID(), call: call.value.trim(), note: note.value.trim() }, ...contacts];
        writeLocal(contactKey, contacts, status, 'Practice contact saved on this device.');
        form.reset();
        render();
      });
      target.append(text('Record a fictional contact for practice. Entries are separate from the drill, Fellowship conversations, and private messages.'),
        form, status, results);
      render();
    },
  };
}
