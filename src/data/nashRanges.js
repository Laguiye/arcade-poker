// ─────────────────────────────────────────────────────────────
// data/nashRanges.js — lookup des ranges Nash 3-max push/fold.
//
// Source : nash3max.js (= nash_3max_ranges.json du brief Spin & Go,
// converti en module ES). Indexé par [stack][scenario]. Pour un stack
// non listé → on arrondit au PALIER INFÉRIEUR (cf. brief).
// Scénarios : BTN_push · SB_push · SB_call_vs_BTN · BB_call_vs_BTN ·
// BB_call_vs_SB.
// ─────────────────────────────────────────────────────────────

import DATA from "./nash3max.js";

const STACKS = Object.keys(DATA.ranges).map(Number).sort((a, b) => a - b);
const MIN = STACKS[0];

// Palier inférieur (≥ plus petit stack couvert).
export function nashBucket(bb) {
  let best = MIN;
  for (const s of STACKS) if (s <= bb) best = s;
  return best;
}

const cache = {};
export function nashRange(bb, scenario) {
  if (!scenario) return new Set();
  const b = nashBucket(bb);
  const key = b + "|" + scenario;
  if (cache[key]) return cache[key];
  const arr = (DATA.ranges[b] && DATA.ranges[b][scenario]) || [];
  const set = new Set(arr);
  cache[key] = set;
  return set;
}

export const inNash = (hand, bb, scenario) => nashRange(bb, scenario).has(hand);

// Messages de zone + heuristique ICM (réutilisables par le coach).
export const COACH_ZONE = DATA.coach_zone_messages;
export const VARIANCE = DATA.variance_popup_system;
