export const DUO_PALETTES = {
  citron: { name: 'Citron', color: '#d9f779', ink: '#38451b' },
  clay: { name: 'Clay', color: '#eca17e', ink: '#673724' },
  iris: { name: 'Iris', color: '#bbacf4', ink: '#493775' },
  sky: { name: 'Sky', color: '#94cde0', ink: '#285163' },
  rose: { name: 'Rose', color: '#e7a6bb', ink: '#713e50' },
  sand: { name: 'Sand', color: '#e8c57e', ink: '#635021' }
};
export const DUO_COVERS = { orbits: 'Orbits', waves: 'Waves', rays: 'Rays' };
export const duoPalette = friendship => DUO_PALETTES[friendship?.identity?.palette] || DUO_PALETTES.citron;
export const duoLabel = (friendship, fallback = 'Your Duo') => friendship?.identity?.name || fallback;
export const duoStyle = friendship => { const palette = duoPalette(friendship); return { '--duo-accent': palette.color, '--duo-ink': palette.ink }; };
