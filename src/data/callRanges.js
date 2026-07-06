// ─────────────────────────────────────────────────────────────
// data/callRanges.js — ranges de call GÉNÉRIQUES par profondeur (#3).
//
// Pour le mini-showdown : Villain « call le jam » avec une range standard
// fonction du stack (réutilisée par tous les spots de même profondeur).
// Volontairement approximatif (défauts tunables), suffisant pour un coup
// d'équité d'ambiance. Plus le stack est court, plus le call est large.
// ─────────────────────────────────────────────────────────────

import { range } from "./spots.js";

export const CALL_RANGES = {
  8: range(["22+", "A2s+", "A8o+", "K9s+", "KTo+", "QTs+", "JTs"]),
  10: range(["22+", "A4s+", "A9o+", "KTs+", "KJo+", "QJs"]),
  12: range(["33+", "A7s+", "ATo+", "KJs+", "KQo", "QJs"]),
  15: range(["44+", "A9s+", "AJo+", "KQs"]),
};

const STACKS = Object.keys(CALL_RANGES).map(Number).sort((a, b) => a - b);

// Range de call pour un stack donné → le palier défini le plus proche.
export const callRangeForStack = (bb) => {
  let best = STACKS[0];
  for (const s of STACKS) if (Math.abs(s - bb) < Math.abs(best - bb)) best = s;
  return CALL_RANGES[best];
};
