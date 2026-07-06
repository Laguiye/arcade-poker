// ─────────────────────────────────────────────────────────────
// data/spots.js — DONNÉE PURE : spots PLEINEMENT spécifiés.
// Chaque spot porte tout son contexte → la range attendue est sans
// ambiguïté (format · position · profondeur · action).
//
// On se limite arbitrairement à DEUX familles :
//   • spin-3max  (Spin & Go, 3 joueurs, short, push/fold)
//   • mtt-6max   (tournoi, 6 joueurs)
// Les niveaux tirent un spot AU HASARD dans le pool de leur bande
// (cf. data/quest.js).
//
// Ranges saisies en notation courte ("A2s+", "55+", "KTs+", "98s")
// et développées par `expand()` → liste de mains de la matrice 13×13.
// ─────────────────────────────────────────────────────────────

import { strengthScore, combosOf, posOf } from "../engine/poker.js";
import { rangePctFreqs } from "../engine/scoring.js";

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
const ri = Object.fromEntries(RANKS.map((r, i) => [r, i]));

// Développe un token de range en liste de mains.
//   "77"      → ["77"]
//   "55+"     → 55,66,…,AA
//   "ATs"     → ["ATs"]            "ATs+" → ATs,AJs,AQs,AKs
//   "AJo"     → ["AJo"]            "A5o+" → A5o,…,AKo
const expand = (tok) => {
  // paire simple
  if (tok.length === 2 && tok[0] === tok[1]) return [tok];
  // paire "+"
  if (tok.length === 3 && tok[0] === tok[1] && tok[2] === "+") {
    const out = [];
    for (let i = ri[tok[0]]; i >= 0; i--) out.push(RANKS[i] + RANKS[i]);
    return out;
  }
  const m = tok.match(/^([AKQJT2-9])([AKQJT2-9])([so])(\+)?$/);
  if (!m) throw new Error("token de range invalide : " + tok);
  const [, a, b, suit, plus] = m;
  const hi = ri[a], lo = ri[b];
  const mk = (x, y) => RANKS[x] + RANKS[y] + suit;
  if (!plus) return [mk(hi, lo)];
  const out = [];
  for (let k = lo; k > hi; k--) out.push(mk(hi, k)); // kicker → vers le haut
  return out;
};

export const range = (tokens) => [...new Set(tokens.flatMap(expand))];

// Concept produit : SHORT vs DEEP (plus de branding spin/mtt). On ne garde
// que la taille de table dans le contexte du spot.
export const FORMAT_LABEL = { "spin-3max": "3-max", "mtt-6max": "6-max" };

// Ranges push/fold SOURCÉES (Nash, format SANS ante — cf. pokercoaching.com
// push-fold charts ; cohérent avec l'Expresso sans ante). RFI 6-max = standards.
// Chaque entrée : tokens développés en `hands` au chargement.
const RAW = [
  // ── Tuto (Niveau 1) — volontairement MINUSCULE pour sentir la cascade.
  //    Labellisé honnêtement : ce n'est PAS un vrai spot 8bb (qui serait ~50%).
  {
    id: "tuto-premium", tuto: true,
    name: "Tuto", sub: "Sens la cascade", context: "TUTO · mains premium",
    tokens: ["99+", "AJs+", "AKo", "AQo"],
  },

  // ── SHORT · 6-max (push/fold Nash, no ante) ─────────────────
  // (Le SECTEUR SPIN 3-max est entièrement GÉNÉRÉ à partir des largeurs
  //  Nash ci-dessous, cf. genSpin — plus de spots 3-max sourcés ici.)
  // BTN 15bb ≈ 28.2%
  {
    id: "mtt-btn-15", format: "mtt-6max", pos: "BTN", stackBB: 15, action: "PUSH",
    tokens: ["22+", "A2s+", "A5o+", "K7s+", "KTo+", "Q8s+", "QTo+", "J8s+", "JTo", "T8s+", "98s", "87s"],
  },

  // ── DEEP · 6-max (RFI opens standards) ──────────────────────
  // UTG ≈ 15%
  {
    id: "mtt-utg-40", format: "mtt-6max", pos: "UTG", stackBB: 40, action: "OPEN",
    tokens: ["22+", "A2s+", "KTs+", "QTs+", "JTs", "T9s", "98s", "AJo+", "KQo"],
  },
  // CO ≈ 27%
  {
    id: "mtt-co-40", format: "mtt-6max", pos: "CO", stackBB: 40, action: "OPEN",
    tokens: ["22+", "A2s+", "K6s+", "Q8s+", "J8s+", "T8s+", "98s", "87s", "76s", "65s", "A8o+", "KTo+", "QTo+", "JTo"],
  },
  // BTN ≈ 45%
  {
    id: "mtt-btn-40", format: "mtt-6max", pos: "BTN", stackBB: 40, action: "OPEN",
    tokens: ["22+", "A2s+", "K2s+", "Q4s+", "J6s+", "T6s+", "96s+", "86s+", "75s+", "65s", "54s", "A2o+", "K8o+", "Q9o+", "J9o+", "T9o"],
  },
];

// Synthèse de la bande FRONTIÈRE (choix produit) : cœur = f:1 ; les mains
// les plus marginales du spot passent en f:0.5.
//   • RFI/open (action OPEN)      → frontière LARGE (~18%) : beaucoup de mixte.
//   • push/fold SOLVÉ (PUSH/CALL) → frontière MINCE (~8%) : l'équilibre Nash est
//     quasi pur (seuil), donc le % AFFICHÉ colle à la vraie largeur Nash.
// Pas de frontière sur le tuto ni les très petits spots (reconstruction nette).
const synthFreqs = (hands, spot) => {
  const freqs = {};
  hands.forEach((h) => { freqs[h] = 1; });
  if (spot.tuto || hands.length < 10) return freqs;
  const solved = spot.action === "PUSH" || spot.action === "CALL";
  const frac = solved ? 0.08 : 0.18;
  const weakestFirst = [...hands].sort((a, b) => strengthScore(a) - strengthScore(b));
  const n = Math.max(2, Math.round(hands.length * frac));
  for (let k = 0; k < n; k++) freqs[weakestFirst[k]] = 0.5;
  return freqs;
};

// ── Générateur de spots push/fold (matrice de test bien fournie) ──
// Ordre PUSH-FOLD (≠ RFI : on valorise la hauteur de carte + l'as ; la couleur
// compte peu, les paires dominent). Approximatif mais MONOTONE et cohérent —
// suffisant pour étoffer le pool de test. Les spots SOURCÉS à la main (RAW)
// restent prioritaires : on ne génère que les (pos × stack) absents.
const ALL_HANDS = Object.keys(posOf);
const pushScore = (h) => {
  const [i, j] = posOf[h];
  const hi = Math.min(i, j), lo = Math.max(i, j);
  const vHi = 13 - hi, vLo = 13 - lo; // A=13 … 2=1
  if (i === j) return 1000 + vHi * 12; // paires au-dessus, ordonnées
  return vHi * 12 + vLo * 4 + (hi === 0 ? 18 : 0) + (i < j ? 8 : 0) - (lo - hi - 1) * 0.5;
};
const PUSH_ORDER = [...ALL_HANDS].sort((a, b) => pushScore(b) - pushScore(a));
const pushRange = (pct) => {
  const budget = (pct / 100) * 1326;
  const out = [];
  let acc = 0;
  for (const h of PUSH_ORDER) {
    const c = combosOf(h);
    if (acc + c / 2 > budget && out.length) break; // arrondi au plus proche
    out.push(h);
    acc += c;
    if (acc >= budget) break;
  }
  return out;
};

// ── SPIN 3-max : 3 QUÊTES par position, crescendo du plus court à 25bb ──
// L'échelle de tapis commune. Chaque position monte ce crescendo (nœud =
// tapis fixe, dans l'ordre). Cibles % = Nash push/fold SANS ante (approx,
// monotones). Plus le tapis est court, plus la range est large.
// ÉCHELLES de difficulté = nb de MARCHES du crescendo (toujours 3→25bb, mais
// de plus en plus fin). 1ʳᵉ fois = échelle 6 (facile, gros sauts) → 8 → 10.
export const SPIN_ECHELLES = {
  6: [3, 5, 8, 12, 18, 25],
  8: [3, 5, 8, 10, 12, 15, 20, 25],
  10: [3, 4, 6, 8, 10, 12, 15, 18, 21, 25],
};
// Union de tous les tapis utilisés (→ spots à générer).
const SPIN_STACKS_ALL = [...new Set(Object.values(SPIN_ECHELLES).flat())].sort((a, b) => a - b);

// LARGEURS NASH (% des mains), push/fold SANS ante — cas RÉSOLUS :
//   • SB open-jam (BTN couché → heads-up vs BB) = Nash HU SB push
//     (HoldemResources HUNE / PokerStars Spin&Go) : 3bb≈83% … 25bb≈23%.
//   • BTN open-jam (3-handed, 2 joueurs derrière) = plus SERRÉ que le SB HU.
//   • BB call (défense) vs un jam : Nash HU BB call vs SB ; vs BTN (range plus
//     serrée) ⇒ call encore plus serré.
// (Sources : holdemresources.net/hune · pokerstars.com .../spin-go-nash-push-fold)
const SPIN_BTN_JAM = { 3: 70, 4: 60, 5: 52, 6: 46, 8: 40, 10: 35, 12: 31, 15: 27, 18: 24, 20: 22, 21: 21, 25: 18 };
const SPIN_SB_JAM = { 3: 83, 4: 74, 5: 66, 6: 60, 8: 52, 10: 45, 12: 39, 15: 33, 18: 29, 20: 27, 21: 26, 25: 23 };
const SPIN_BB_VBTN = { 3: 52, 4: 47, 5: 42, 6: 37, 8: 32, 10: 28, 12: 24, 15: 20, 18: 18, 20: 16, 21: 15, 25: 14 };
const SPIN_BB_VSB = { 3: 65, 4: 58, 5: 52, 6: 46, 8: 40, 10: 35, 12: 31, 15: 27, 18: 24, 20: 22, 21: 21, 25: 19 };

// Génère les spots Spin pour les 3 positions × l'échelle de tapis.
// BTN/SB = PUSH (open-jam). BB = CALL, deux variantes (vs BTN, vs SB).
// NB : la SÉLECTION de mains réutilise l'ordre push/fold (pushRange) — la
// LARGEUR est calée sur Nash, la forme reste approximative (à affiner main par
// main si besoin pour coller au seuil exact par main).
const genSpin = () => {
  const out = [];
  for (const bb of SPIN_STACKS_ALL) {
    out.push({ id: `spin-btn-${bb}`, format: "spin-3max", pos: "BTN", stackBB: bb, action: "PUSH", hands: pushRange(SPIN_BTN_JAM[bb]) });
    out.push({ id: `spin-sb-${bb}`, format: "spin-3max", pos: "SB", stackBB: bb, action: "PUSH", hands: pushRange(SPIN_SB_JAM[bb]) });
    // BB call vs BTN.
    out.push({
      id: `spin-bb-vbtn-${bb}`, format: "spin-3max", pos: "BB", stackBB: bb, action: "CALL", vs: "BTN",
      name: `BB vs BTN ${bb}bb`, context: `3-max · BB vs BTN · ${bb}bb · CALL`,
      hands: pushRange(SPIN_BB_VBTN[bb]),
    });
    // BB call vs SB.
    out.push({
      id: `spin-bb-vsb-${bb}`, format: "spin-3max", pos: "BB", stackBB: bb, action: "CALL", vs: "SB",
      name: `BB vs SB ${bb}bb`, context: `3-max · BB vs SB · ${bb}bb · CALL`,
      hands: pushRange(SPIN_BB_VSB[bb]),
    });
  }
  return out;
};

// ── MTT 6-max : cibles % (Nash push-fold approx, no ante) ────
const PUSH_6MAX = {
  UTG: { 8: 15, 10: 13, 12: 12, 15: 11 },
  HJ: { 8: 18, 10: 16, 12: 14, 15: 13 },
  CO: { 8: 23, 10: 20, 12: 18, 15: 16 },
  BTN: { 8: 36, 10: 33, 12: 31, 15: 28 },
  SB: { 8: 52, 10: 48, 12: 45, 15: 42 },
};
const genSpots = (format, table) =>
  Object.entries(table).flatMap(([pos, byStack]) =>
    Object.entries(byStack).map(([bb, pct]) => ({
      id: `gen-${format}-${pos}-${bb}`.toLowerCase(),
      format, pos, stackBB: Number(bb), action: "PUSH",
      hands: pushRange(pct),
    }))
  );
// On ne génère que les combos (format·pos·stack) absents des spots sourcés.
const rawKey = (s) => `${s.format}|${s.pos}|${s.stackBB}`;
const rawKeys = new Set(RAW.filter((s) => s.format).map(rawKey));
const GEN = [...genSpin(), ...genSpots("mtt-6max", PUSH_6MAX)]
  .filter((s) => s.format !== "mtt-6max" || !rawKeys.has(rawKey(s)));

export const SPOTS = [...RAW, ...GEN].map((s) => {
  const hands = s.hands || range(s.tokens);
  const freqs = synthFreqs(hands, s);
  const core = hands.filter((h) => freqs[h] === 1);
  const frontier = hands.filter((h) => freqs[h] > 0 && freqs[h] < 1);
  const pct = rangePctFreqs(freqs);
  return {
    ...s,
    name: s.name || `${s.pos} ${s.stackBB}bb`,
    sub: s.sub || `${FORMAT_LABEL[s.format]} · ${s.action.toLowerCase()}`,
    context: s.context || `${FORMAT_LABEL[s.format]} · ${s.pos} · ${s.stackBB}bb · ${s.action}`,
    formatLabel: s.format ? FORMAT_LABEL[s.format] : null,
    hands, freqs, core, frontier, pct,
    // La phase d'estimation ne s'active que sur les spots quasi-linéaires
    // (push/fold propre où l'ordre de force tient ≈ l'aperçu du slider).
    estimateOk: !s.tuto && s.action === "PUSH",
  };
});

export const spotById = Object.fromEntries(SPOTS.map((s) => [s.id, s]));
export const TUTO_SPOT = SPOTS.find((s) => s.tuto);

// Spots correspondant à un filtre (format, position, plage de stack).
export const spotsWhere = (pred) => SPOTS.filter(pred);

// Tire un spot au hasard parmi un sous-ensemble (en évitant `exceptId` si possible).
export const pickRandom = (pool, exceptId) => {
  const choices = pool.length > 1 && exceptId ? pool.filter((s) => s.id !== exceptId) : pool;
  return choices[Math.floor(Math.random() * choices.length)];
};
