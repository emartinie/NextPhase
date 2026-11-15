
const original = 'https://github.com/emartinie/HGBibleApp/blob/1e31cc4dd984adc638db2aa87571618fee1f3e31/';
export const catalogSource = 'https://github.com/emartinie/MainStage/blob/5766768580e6252f81a49df18f1218d94a645052/2-prepper/flat_index.json';
export const legacyLibrary = 'https://emartinie.github.io/MainStage/2-prepper/index.html';
export const radioSource = original + 'cards/amateurradio.html';
export const mapSource = original + 'js/radiomap.js';
export const prayerSource = original + 'js/prayermap.js';
export const researchSource = original + 'investigations/topic%20list%20for%20writing.md';

export const featured = [
  ['Water', 'Water Storage & Purification', 'water', 'https://www.ready.gov/water'],
  ['Medical', 'Field First Aid Manual', 'medical', 'https://www.redcross.org/take-a-class/first-aid'],
  ['Heating', 'Off-Grid Heating & Cooking', 'heating', 'https://www.usfa.fema.gov/prevention/home-fires/prevent-fires/heating/'],
  ['Comms', 'Emergency Communications', 'comms', 'https://www.ready.gov/plan'],
];

export const radioLinks = [
  ['ARRL · Licensing and guides', 'https://www.arrl.org', 'Original radio and licensing reference'],
  ['Get licensed', 'https://www.arrl.org/getting-licensed', 'ARRL’s licensing guide'],
  ['Find an exam', 'https://www.arrl.org/find-an-amateur-radio-license-exam-session', 'ARRL examination calendar'],
  ['RepeaterBook', 'https://repeaterbook.com', 'Directory listings. Check with the sponsoring club.'],
  ['RadioReference', 'https://www.radioreference.com', 'Frequency directory'],
  ['WebSDR', 'https://websdr.org', 'Public receiver directory. A repeater listing does not include an audio stream.'],
  ['NOAA Weather Radio', 'https://www.weather.gov/nwr/station_listing', 'Public weather broadcast station listing'],
  ['FCC amateur rules', 'https://www.ecfr.gov/current/title-47/chapter-I/subchapter-D/part-97', 'U.S. amateur service, including control operators'],
  ['Build an emergency kit', 'https://www.ready.gov/kit', 'Ready.gov checklist'],
  ['Homeland Security', 'https://www.dhs.gov', 'Original preparedness link'],
  ['Red Cross', 'https://www.redcross.org', 'Original preparedness and first aid link'],
  ['FEMA family communication plan', 'https://www.ready.gov/sites/default/files/2020-03/family-emergency-communication-planning-document.pdf', 'Printable plan'],
];
export const frequencies = [
  ['146.520 MHz', 'National Simplex', 'Amateur VHF simplex calling frequency.'],
  ['446.000 MHz', 'UHF Simplex', 'Amateur UHF simplex calling frequency.'],
  ['462.5625 MHz', 'GMRS Channel 1', 'Shared U.S. FRS and GMRS channel 1. Separate equipment and licensing rules apply.'],
  ['121.500 MHz', 'Emergency', 'Aviation emergency frequency. Outside the amateur service.'],
];
export const gear = ['Handheld radio', 'Extra batteries', 'Solar charger', 'Long wire antenna'];

export const zones = {
  dickson: 'Dickson', bardstown: 'Bardstown', winchester: 'Winchester', field: 'Field', admin: 'Admin',
};
export const countyIds = { dickson: '47043', bardstown: '21179', winchester: '21049' };
export const places = {
  dickson: [-87.36, 36.13], bardstown: [-85.47, 37.81], winchester: [-84.17, 37.99],
};
export const radioPoints = [
  { id: 'legacy-dickson', label: 'Dickson Repeater', lat: 36.1, lng: -87.4, zone: 'dickson', type: 'repeater', status: 'active', source: mapSource },
  { id: 'legacy-field', label: 'Field Node', lat: 36.3, lng: -86.8, zone: 'field', type: 'simplex', status: 'planned', source: mapSource },
  { id: 'kg4hdz', label: 'KG4HDZ · White Bluff', lat: 36.145, lng: -87.22, zone: 'dickson', type: 'repeater',
    frequency: '147.375 MHz', offset: '+0.600 MHz', tone: '146.2 Hz', mode: 'FM',
    source: 'https://wc4dc.org/radio-programming/', net: 'https://wc4dc.org/nets/',
    schedule: 'Dickson County ARC publishes its schedule and changes on the club nets page.' },
  { id: 'kb4ky', label: 'KB4KY · Bardstown', lat: 37.81, lng: -85.47, zone: 'bardstown', type: 'repeater',
    frequency: '145.470 MHz', tone: '151.4 Hz', source: 'https://kb4ky.org/wp-content/uploads/2020/04/NetPreamble2020.pdf',
    net: 'https://kb4ky.org/', schedule: 'The 2020 net preamble is historical. Confirm current details with the club.', historical: true },
  { id: 'garc', label: 'Gateway ARC · Mount Sterling', lat: 38.055, lng: -83.945, zone: 'winchester', type: 'repeater',
    frequency: '147.315 MHz', offset: '+ (club listing)', tone: '100 Hz',
    source: 'https://www.garc-ky.org/', net: 'https://www.garc-ky.org/',
    schedule: 'Club schedule lists Tuesdays at 7:30 p.m. Eastern. Confirm before joining.',
    location: 'Mount Sterling, near Winchester' },
];

export const prayerPoints = [
  { id: 'prayer-dickson', label: 'Neighbors recovering after storms', zone: 'dickson', layer: 'prayer' },
  { id: 'group-dickson', label: 'Wednesday HomeGroup', zone: 'dickson', layer: 'group' },
  { id: 'group-winchester', label: 'Winchester HomeGroup', zone: 'winchester', layer: 'group' },
  { id: 'feast-bardstown', label: 'Regional Feast gathering', zone: 'bardstown', layer: 'feast' },
];

export const researchGroups = [
  [1824, 1831, 'Prayer and community'],
  [1832, 1848, 'Radio and local coverage'],
  [1849, 1855, 'Plans and preparedness'],
  [1856, 1859, 'Faith and mutual aid'],
];

const assets = new Map();
export function getPreparednessAsset(name) {
  if (!assets.has(name)) {
    const url = new URL('./corpus/preparedness/' + name, import.meta.url);
    assets.set(name, fetch(url).then(response => {
      if (!response.ok) throw new Error('Missing asset ' + name);
      return response.json();
    }).catch(error => {
      assets.delete(name);
      throw error;
    }));
  }
  return assets.get(name);
}

const categories = {
  water: /\b(water|purif\w*|sanitat\w*)\b/i,
  medical: /\b(medic\w*|first[ -]aid|trauma|health|herbal|surg\w*)\b/i,
  heating: /\b(heat\w*|stove\w*|fuel|shelter\w*|off[ -]grid|energy|cook\w*)\b/i,
  comms: /(^9-Comms\b|\b(radio|repeater|antenna\w*|transceiver\w*|comms|communicat\w*|chirp)\b)/i,
};
const searchable = file => [file.name, file.path, file.category, file.pdfTitle, file.pdfAuthor].filter(Boolean).join(' ');
export function searchCatalog(files, { query = '', folder = '', category = '' } = {}) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const test = categories[category];
  return files.filter(file => {
    if (folder && folder !== '.' && !file.path.startsWith(folder + '\\')) return false;
    if (folder === '.' && file.path.includes('\\')) return false;
    const haystack = searchable(file).toLowerCase();
    return (!test || test.test(haystack)) && words.every(word => haystack.includes(word));
  });
}

export function catalogLocation(file, sources) {
  let folder = file.path.split('\\').slice(0, -1).join('\\');
  while (folder) {
    if (sources.folderUrls[folder]) return {
      folder, url: sources.folderUrls[folder], archives: sources.archiveLinks[folder] ?? [],
    };
    folder = folder.split('\\').slice(0, -1).join('\\');
  }
  return { url: sources.root, archives: [] };
}

export const publicEditions = {
  '8-Home Canning and More\\A Treatise on Food Conservation and the Art of Canning 1917.pdf': {
    url: 'https://archive.org/details/treatiseonfoodco00snyd',
    note: 'A public scan matches the title, author, year and page count. This is a historical work. Follow current USDA guidance for food safety.',
  },
};
