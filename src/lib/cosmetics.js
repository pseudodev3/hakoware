import catalog from '../../server/config/cosmetics.json';
export const COSMETIC_PACKS = catalog.packs;
export const CARD_FINISHES = catalog.finishes;
export const COSMETIC_FRAMES = catalog.frames;
export const PROFILE_DECORATIONS = catalog.decorations;
export const collectionFor = pack => pack?.bundle ? COSMETIC_PACKS.filter(item => !item.bundle) : [pack].filter(Boolean);
