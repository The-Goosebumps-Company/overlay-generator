// Event libraries: each event has its own palette, gradients and templates.
// Colours come from each event's artwork and style guide in the G&G Drive
// (LMC from its official ASE swatches). Fonts are the closest free Google
// Fonts; drop the real brand font in with "Add" next to the font picker.
// No logos or artist imagery here: the repo is public.

export const EVENTS = [
  {
    id: 'gg', name: 'G&G', accent: '#FB690C',
    colors: [['Pyro Amber', '#FB690C'], ['Crimson Surge', '#790000'], ['Aqua Beam', '#044E61'], ['Backline Blue', '#071A26']],
    card: [['Pyro', ['#FB690C', '#790000']], ['Frequency', ['#0B6F88', '#044E61', '#071A26']], ['Pyro → Aqua', ['#FB690C', '#044E61']]],
    blobs: [['Pyro', ['#FB690C', '#FFB36B']], ['Aqua', ['#0B6F88', '#3FB6CF']], ['Mixed', ['#FB690C', '#0B6F88']]],
  },
  {
    id: 'big-week', name: 'Big Week', accent: '#E9B44C',
    colors: [['Gold', '#E9B44C'], ['Pale gold', '#F5D58A'], ['Copper', '#B5651D'], ['Dusk plum', '#3A2340'], ['Night', '#1A1020'], ['Cream', '#FFF6E6']],
    card: [['Chrome gold', ['#F5D58A', '#E9B44C', '#B5651D']], ['Dusk', ['#E9B44C', '#B5651D', '#3A2340']], ['Night sky', ['#6B4A6E', '#3A2340', '#1A1020']]],
    blobs: [['Gold', ['#F5D58A', '#E9B44C']], ['Sunset', ['#E9B44C', '#D9764A']], ['Dusk', ['#B5651D', '#6B4A6E']]],
  },
  {
    id: 'rage', name: 'Rage Festival', accent: '#FF2E88',
    colors: [['Hot pink', '#FF2E88'], ['Magenta', '#C2187A'], ['Purple', '#6A3CB5'], ['Lime', '#7ED957'], ['Yellow', '#FFD60A'], ['Sky', '#7FD3FF']],
    card: [['Pink party', ['#FF2E88', '#C2187A', '#6A3CB5']], ['Purple haze', ['#9B6BE0', '#6A3CB5']], ['Lime', ['#B6F06A', '#3FA34D']], ['Sunny', ['#FFE45C', '#FFB000']]],
    blobs: [['Pink', ['#FF2E88', '#FF8AC4']], ['Party', ['#FF2E88', '#7FD3FF', '#FFD60A']], ['Lime', ['#7ED957', '#FFD60A']]],
  },
  {
    id: 'lmc', name: 'Luxurious Marble Circus', short: 'LMC', accent: '#EB7602',
    colors: [['Red', '#E00700'], ['Blue', '#204CA5'], ['Orange', '#EB7602'], ['Crimson', '#970201'], ['Olive', '#808000'], ['Cream', '#F1EAB5'], ['Yellow', '#EBCC2A'], ['Hot pink', '#FF7ABC']],
    card: [['Big top', ['#EBCC2A', '#EB7602', '#E00700']], ['Marble blue', ['#204CA5', '#970201']], ['Crimson', ['#E00700', '#970201']], ['Pantry olive', ['#E1DD99', '#808000']]],
    blobs: [['Gold', ['#EBCC2A', '#EB7602']], ['Pink', ['#FF7ABC', '#FFD0D9']], ['Blue', ['#204CA5', '#C5D6FD']]],
  },
  {
    id: 'shimza-friends', name: 'Shimza & Friends', short: 'S&F', accent: '#FDB75B',
    colors: [['Amber', '#FDB75B'], ['Flame', '#D9432B'], ['Navy', '#0B2A40'], ['Deep navy', '#071C2C'], ['Sunset orange', '#F07C2F']],
    card: [['Flame', ['#FDB75B', '#F07C2F', '#D9432B']], ['Navy', ['#1D4E70', '#0B2A40', '#071C2C']], ['Navy → flame', ['#0B2A40', '#D9432B']]],
    blobs: [['Amber', ['#FDB75B', '#F07C2F']], ['Flame', ['#D9432B', '#FDB75B']], ['Sky', ['#3E7FA8', '#FDB75B']]],
  },
];

export const GENERAL = { id: 'general', name: 'General', accent: '#9fb3c0' };
export const eventById = (id) => EVENTS.find((e) => e.id === id) || null;
export const eventLabel = (e) => (e ? e.short || e.name : '');
const NEUTRALS = [['White', '#FFFFFF'], ['Black', '#000000']];

// Swatches/gradients to offer: the chosen event's, or G&G's when none is chosen
export function palette(id) {
  const e = eventById(id) || EVENTS[0];
  return { colors: [...e.colors, ...NEUTRALS], card: e.card, blobs: e.blobs, badge: e.card };
}
