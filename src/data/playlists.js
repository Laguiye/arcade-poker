// ─────────────────────────────────────────────────────────────
// data/playlists.js — séquences de spots pour le mode Run (brief §5).
// Bâti sur data/spots.js. Run reste 3-max (Spin) : le stack fond →
// la frontière correcte change à chaque palier.
// ─────────────────────────────────────────────────────────────

import { spotById } from "./spots.js";

export const SPIN_3MAX = {
  id: "spin-3max",
  name: "Spin & Go — 3-max",
  sub: "Le stack fond. Adapte ta frontière.",
  tiers: [
    { bb: 12, label: "12bb BTN", action: "PUSH", hands: spotById["spin-btn-12"].hands, count: 8 },
    { bb: 10, label: "10bb SB", action: "PUSH", hands: spotById["spin-sb-10"].hands, count: 7 },
    { bb: 8, label: "8bb BTN", action: "PUSH", hands: spotById["spin-btn-8"].hands, count: 8 },
  ],
};

export const PLAYLISTS = [SPIN_3MAX];
