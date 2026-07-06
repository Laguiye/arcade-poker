// ─────────────────────────────────────────────────────────────
// engine/scoring.js — scoring pur du moteur. Aucun état React.
//
// MODÈLE FRÉQUENCES : chaque main porte f∈[0,1]. Cœur = f:1, frontière
// = 0<f<1. Le mètre couvre la MASSE in-range (Σ combos×f) → une main
// frontière à f:0.5 donne un demi-crédit : impossible d'avoir
// totalement tort sur une frontière (crédit partiel, spec §2).
//
//   recall : masse couverte / masse totale (jamais baissée par erreur).
//   dice   : 2·masse / (combos sélectionnés + masse) → punit le surplus.
// ─────────────────────────────────────────────────────────────

import { combosOf, cascadeReveal, STRENGTH_ORDER } from "./poker.js";

export const TOTAL_COMBOS = 1326;

export const LEVELS = {
  beginner: { label: "Débutant", mode: "recall", winAt: 0.9, k: 0.5 },
  intermediate: { label: "Intermédiaire", mode: "dice", winAt: 1.0, k: 0.25 },
};

// freqs : objet { hand: f }. `selected` : Set des mains cliquées.
export const meterOf = (selected, freqs, mode = "recall") => {
  let inSel = 0, tot = 0, selCombos = 0;
  for (const h in freqs) {
    const w = combosOf(h) * freqs[h];
    tot += w;
    if (selected.has(h)) inSel += w;
  }
  selected.forEach((h) => { selCombos += combosOf(h); });
  if (mode === "dice") {
    const denom = selCombos + tot;
    return denom ? (2 * inSel) / denom : 0;
  }
  return tot ? inSel / tot : 0; // recall
};

// Clics optimaux = bas de segments de cascade sur l'ensemble in-range.
export const optimalClicks = (rangeHands, cascade = true) => {
  if (!cascade) return rangeHands.length;
  const set = new Set(rangeHands);
  const covered = new Set();
  rangeHands.forEach((b) => {
    cascadeReveal(b, set).forEach((h) => { if (h !== b) covered.add(h); });
  });
  return rangeHands.filter((h) => !covered.has(h)).length;
};

// % d'une range binaire (Lab random, pas de freqs).
export const rangePct = (hands) =>
  Math.round((hands.reduce((s, h) => s + combosOf(h), 0) / TOTAL_COMBOS) * 100);

// % d'une range à fréquences (Σ combos×f / 1326).
export const rangePctFreqs = (freqs) =>
  Math.round((Object.keys(freqs).reduce((s, h) => s + combosOf(h) * freqs[h], 0) / TOTAL_COMBOS) * 100);

// Étoiles d'efficacité (compte TOUTES les erreurs → anti brute-force).
// INDÉPENDANT du guess (spec §0 : étoiles ≠ estimation).
export const efficiency = (errors, rangeHands, k) => {
  const quota = Math.max(1, Math.round(rangeHands.length * k));
  const stars = errors <= quota ? 3 : errors <= quota * 2 ? 2 : 1;
  return { quota, stars };
};

// ── Phase d'estimation (%) ───────────────────────────────────

// Aperçu LINÉAIRE top-down par force pour une largeur cible (en %).
// Renvoie les mains du haut de STRENGTH_ORDER jusqu'à ~pct de la masse.
// Volontairement ≠ vraie range (calibration d'intuition, spec §4).
export const linearRangeForPct = (pct) => {
  const budget = (pct / 100) * TOTAL_COMBOS;
  const out = [];
  let acc = 0;
  for (const h of STRENGTH_ORDER) {
    const c = combosOf(h);
    if (acc + c / 2 > budget && out.length) break; // arrondi au plus proche
    out.push(h);
    acc += c;
    if (acc >= budget) break;
  }
  return out;
};

export const TIER_META = {
  perfect: { label: "PERFECT", c: "#10b981" },
  sharp: { label: "SHARP", c: "#7ee2b8" },
  loose: { label: "LOOSE", c: "#eab308" },
  miss: { label: "MISS", c: "#ef4444" },
};

// Récompense de proximité = COURBE CONTINUE (correctif spec, supersède les
// paliers bucketisés). Être pile exact rapporte toujours plus que le bord de
// bande → pas de plateau. Les labels sont une couche FEEDBACK dérivée de la
// même `frac` (jamais des seuils indépendants → sinon label/payout se
// contredisent).
export const CURVE_DEFAULTS = { tolerance: 15, k: 0.7 }; // k = knob de difficulté unique
export const GUESS_BONUS_MAX = 250; // jetons à frac=1
export const PITY_FLOOR = 1;

export const tierFromFrac = (frac) =>
  frac >= 0.9 ? "perfect" : frac >= 0.6 ? "sharp" : frac >= 0.3 ? "loose" : "miss";
export const payoutOf = (frac) => Math.round(frac * GUESS_BONUS_MAX);

// Cœur de la courbe (pur, sans données) — pratique pour la sonde du Labo.
//   error : |guess − %réel| (pts)   tolerance = maxErr
//   frac = (1 − e/maxErr)^k, borné à 0 au-delà de maxErr
//   seeds = max(pity, round(frac × coreSize))   ← quantifié en mains entières
export const proximityCurve = (error, tolerance, k, coreSize) => {
  const frac = error >= tolerance ? 0 : Math.pow(1 - error / tolerance, k);
  const seeds = Math.max(PITY_FLOOR, Math.round(frac * coreSize));
  return { frac, tier: tierFromFrac(frac), seeds };
};

// Ancres du cœur = bas de segments DANS le cœur (cliquer une ancre cascade
// tout son segment), triées par FORCE DÉCROISSANTE (on sème le haut d'abord).
export const coreAnchors = (coreHands) => {
  const set = new Set(coreHands);
  const covered = new Set();
  coreHands.forEach((b) => {
    cascadeReveal(b, set).forEach((h) => { if (h !== b) covered.add(h); });
  });
  return coreHands.filter((h) => !covered.has(h))
    .sort((a, b) => STRENGTH_ORDER.indexOf(a) - STRENGTH_ORDER.indexOf(b));
};

// Sème des ancres-cœur selon la proximité (courbe continue). La FRONTIÈRE
// n'est JAMAIS semée (finie à la main). Pity seed garanti → jamais de grille
// morte. Le guess ne touche que jetons + jus, jamais les étoiles.
//   → { tier, error, frac, sign, prefill:[ancres], seeds, payout }
export const seedFromGuess = (spot, guessPct, tolerance = CURVE_DEFAULTS.tolerance, k = CURVE_DEFAULTS.k) => {
  const error = Math.abs(guessPct - spot.pct);
  const anchors = coreAnchors(spot.core);
  const { frac, tier, seeds } = proximityCurve(error, tolerance, k, anchors.length);
  return {
    tier, error, frac, seeds,
    sign: guessPct > spot.pct ? "large" : "serré",
    prefill: anchors.slice(0, seeds),
    payout: payoutOf(frac),
  };
};
