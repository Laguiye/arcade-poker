// ─────────────────────────────────────────────────────────────
// data/avatars.js — AVATARS + modificateurs de run (persos roguelite).
//
// Le perso n'est plus cosmétique : chaque avatar tilte le Run via `mod`
// (mêmes leviers que la boutique : vies / jetons de départ / capacité
// de base). Appliqué dans Run.startRun() et GridRun (mod.lives universel).
//   lives     → +/- vies au départ
//   chips     → jetons de départ (mode Run action/fold)
//   abilities → capacités de base (mode Run)
// ─────────────────────────────────────────────────────────────

export const AVATARS = {
  spade: { id: "spade", glyph: "♠", tint: "#e7e9f0", name: "Tacticien", perk: "+1 vie au départ", mod: { lives: 1 } },
  heart: { id: "heart", glyph: "♥", tint: "#ef4444", name: "Flambeur", perk: "💪 Gros bras de base · −1 vie", mod: { lives: -1, abilities: ["muscle"] } },
  diamond: { id: "diamond", glyph: "♦", tint: "#3b82f6", name: "Prospecteur", perk: "+3000 jetons au départ", mod: { chips: 3000 } },
  club: { id: "club", glyph: "♣", tint: "#10b981", name: "Stoïque", perk: "🧊 Sang-froid de base", mod: { abilities: ["cool-head"] } },
};

export const AVATAR_LIST = Object.values(AVATARS);
export const avatarMod = (id) => (AVATARS[id] && AVATARS[id].mod) || {};
export const avatarOf = (id) => AVATARS[id] || AVATARS.spade;
