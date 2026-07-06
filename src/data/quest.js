// ─────────────────────────────────────────────────────────────
// data/quest.js — QUÊTES = mondes/voies. Chacune jouable dans les 3
// difficultés (cf. store).
//
// SECTEUR SPIN (3-max) = 3 QUÊTES par POSITION (BTN/SB/BB). Chaque position
// a 3 BANDES = 3 ÉCHELLES (nb de marches du crescendo 3→25bb) :
//   échelle 6 (facile) → 8 (interm.) → 10 (avancé).
// La graduation de bande (store) gère le passage 6→8→10 DANS une position.
//
// DÉBLOCAGE PROGRESSIF :
//   • spin-btn ouvert d'emblée ; on commence par 3bb (1er nœud) puis le
//     crescendo s'ouvre nœud par nœud.
//   • Finir l'ÉCHELLE 6 d'une position (maxBandReached ≥ 1) débloque la
//     position SUIVANTE (`requires`). Les échelles 8/10 = rejeu plus dur.
//   • spin-btn → spin-sb → spin-bb.
//
// SECTEUR MTT (6-max) = 1 quête, 2 bandes (Short → Deep), tirage ALÉATOIRE
// dans la bande + tuto en 1er spot. (Non gated.)
//
// Une bande porte SOIT `spotIds` (liste ORDONNÉE → crescendo), SOIT `filter`
// (pool ALÉATOIRE). `clears` = nb de paliers à valider. `echelle` = nb de marches.
// ─────────────────────────────────────────────────────────────

import { spotsWhere, pickRandom, SPIN_ECHELLES } from "./spots.js";

// Construit les 3 bandes-échelles d'une position Spin.
// `mk(bb)` → liste d'ids de spots pour un tapis (1 pour BTN/SB, 2 pour BB).
const spinBands = (questId, mk) =>
  [6, 8, 10].map((n) => {
    const spotIds = SPIN_ECHELLES[n].flatMap(mk);
    return { id: `${questId}-e${n}`, label: `Échelle ${n}`, sub: `${n} marches`, echelle: n, spotIds, clears: spotIds.length };
  });

const btnMk = (bb) => [`spin-btn-${bb}`];
const sbMk = (bb) => [`spin-sb-${bb}`];
const bbMk = (bb) => [`spin-bb-vbtn-${bb}`, `spin-bb-vsb-${bb}`];

export const QUESTS = {
  "spin-btn": {
    id: "spin-btn", sector: "spin", label: "BTN", sub: "open-jam · 3→25bb", icon: "🔵",
    bands: spinBands("spin-btn", btnMk),
  },
  "spin-sb": {
    id: "spin-sb", sector: "spin", label: "SB", sub: "open-jam · 3→25bb", icon: "🟡", requires: "spin-btn",
    bands: spinBands("spin-sb", sbMk),
  },
  "spin-bb": {
    id: "spin-bb", sector: "spin", label: "BB", sub: "call vs BTN & SB · 3→25bb", icon: "🟣", requires: "spin-sb",
    bands: spinBands("spin-bb", bbMk),
  },
  mtt: {
    id: "mtt", sector: "mtt", label: "MTT", sub: "6-max · short → deep", icon: "🏆", tutoFirst: true,
    bands: [
      { id: "mtt-short", label: "Short", sub: "6-max ≤30bb", icon: "⚡",
        filter: (s) => !s.tuto && s.format === "mtt-6max" && s.stackBB <= 30, clears: 4 },
      { id: "mtt-deep", label: "Deep", sub: "6-max · 30bb+", icon: "🌊",
        filter: (s) => !s.tuto && s.format === "mtt-6max" && s.stackBB > 30, clears: 3 },
    ],
  },
};

export const QUEST_LIST = Object.values(QUESTS);
export const bandsFor = (quest) => QUESTS[quest].bands;

// Une quête est-elle débloquée ? `requires` = quête prérequise dont l'ÉCHELLE 6
// (1ʳᵉ bande) doit être franchie (maxBandReached ≥ 1).
export const questUnlocked = (state, quest) => {
  const req = QUESTS[quest].requires;
  if (!req) return true;
  return state.progressions[req].maxBandReached >= 1;
};

// Tire un spot au hasard dans le pool ALÉATOIRE de la bande courante (MTT).
export const pickSpotForBand = (quest, bandIdx, exceptId) => {
  const bands = bandsFor(quest);
  const band = bands[Math.min(bandIdx, bands.length - 1)];
  if (!band.filter) return null; // bande ordonnée : géré par le store (spotIds)
  return pickRandom(spotsWhere(band.filter), exceptId);
};
