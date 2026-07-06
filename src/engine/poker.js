// ─────────────────────────────────────────────────────────────
// engine/poker.js — logique pure de la matrice 13×13 (spec §3).
// Extrait de l'ancien data/ranges.js : RANKS, combos, coords,
// classification de ligne et cascade "démineur".
// AUCUN état React ici. Réutilisé par tous les formats + le Labo.
// (Brief §3 / §0 — moteur unique, ne pas dupliquer hors de engine/.)
// ─────────────────────────────────────────────────────────────

export const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];

// combos par type de main : paire = 6, suited = 4, offsuit = 12
export const combosOf = (hand) => {
  if (hand.length === 2) return 6;
  return hand.endsWith("s") ? 4 : 12;
};

// hand string à partir des coords matrice (i = ligne, j = colonne)
export const handAt = (i, j) => {
  if (i === j) return RANKS[i] + RANKS[i];
  if (i < j) return RANKS[i] + RANKS[j] + "s"; // triangle haut = suited
  return RANKS[j] + RANKS[i] + "o"; // triangle bas = offsuit
};

// position (i,j) d'une main pour le calcul de distance / voisinage
export const posOf = (() => {
  const map = {};
  for (let i = 0; i < 13; i++)
    for (let j = 0; j < 13; j++) map[handAt(i, j)] = [i, j];
  return map;
})();

// ── Cascade "démineur" : bas → haut, s'arrête au premier trou ──
export const classify = (i, j) =>
  i === j ? "pair" : j === i + 1 ? "conn" : i < j ? "suited" : "off";

// pas de remontée par type de ligne sémantique
export const STEP = { pair: [-1, -1], conn: [-1, -1], suited: [0, -1], off: [-1, 0] };

// remonte la ligne de la main, ne garde que les mains in-range CONTIGUËS
export const cascadeReveal = (hand, target) => {
  const [i, j] = posOf[hand];
  const cls = classify(i, j);
  const [di, dj] = STEP[cls];
  const out = [hand];
  let ci = i, cj = j;
  while (true) {
    const ni = ci + di, nj = cj + dj;
    if (ni < 0 || nj < 0 || ni > 12 || nj > 12) break;
    if (cls === "suited" && nj <= ni) break; // sortie du triangle suited
    if (cls === "off" && ni <= nj) break; // sortie du triangle offsuit
    const nh = handAt(ni, nj);
    if (!target.has(nh)) break; // trou → stop
    out.push(nh);
    ci = ni;
    cj = nj;
  }
  return out;
};

// distance Manhattan d'une main à la range cible (température / chaud-froid)
export const distToRange = (hand, target) => {
  const [i, j] = posOf[hand];
  let best = 99;
  target.forEach((h) => {
    const [ti, tj] = posOf[h];
    best = Math.min(best, Math.abs(ti - i) + Math.abs(tj - j));
  });
  return best;
};

// ── Force heuristique d'une main (ordre top-down APPROXIMATIF) ──
// Sert à l'aperçu linéaire du slider d'estimation et à la synthèse de la
// bande frontière. Volontairement approximatif (≠ vraie range), c'est le
// principe du slider : calibrer « % = combien de mains », pas révéler le fil.
export const strengthScore = (hand) => {
  const [i, j] = posOf[hand];
  const hi = Math.min(i, j), lo = Math.max(i, j);
  const vHi = 13 - hi, vLo = 13 - lo; // A=13 … 2=1
  if (i === j) return 100 + vHi * 7; // paires au-dessus
  const suited = i < j;
  const gap = lo - hi - 1;
  return vHi * 8 + vLo * 1.5 + (suited ? 10 : 0) - gap * 0.6;
};

// Toutes les mains triées de la plus forte à la plus faible.
export const STRENGTH_ORDER = Object.keys(posOf).sort(
  (a, b) => strengthScore(b) - strengthScore(a)
);

const inBounds = (a, b) => a >= 0 && b >= 0 && a <= 12 && b <= 12;

// Voisines d'une main sur les 3 axes (kicker, suited↔offsuit miroir, paires).
// Triangle haut (i<j) = suited ; diagonale (i==j) = paires ; bas (i>j) = offsuit.
// Source unique : frontier.js et la cascade boostée s'en servent.
export const neighborsOf = (hand) => {
  const [i, j] = posOf[hand];
  const out = [];
  const add = (a, b) => { if (inBounds(a, b)) out.push(handAt(a, b)); };
  if (i === j) {
    add(i - 1, i - 1);
    add(i + 1, i + 1);
  } else if (i < j) {
    if (j - 1 > i) add(i, j - 1);
    add(i, j + 1);
    add(j, i); // miroir diagonal
  } else {
    if (i - 1 > j) add(i - 1, j);
    add(i + 1, j);
    add(j, i); // miroir diagonal
  }
  return out;
};

// ── Cascade BOOSTÉE (Heat haute) : "flood de domination" ──────
// À partir d'une main in-range, révèle toutes les mains in-range qui la
// DOMINENT (= évidemment aussi dans la range) : meilleur kicker, paire
// supérieure, et le miroir suité d'une offsuit (suited ≥ offsuit).
// Ex. clic A2o → A2s (miroir) + A3o,A4o… (kickers) + leurs propres
// dominants, tant qu'ils sont dans la cible. Le joueur clique le bas du
// bloc et tout le plus fort se valide d'un coup.
// ── Éclatement RADIAL 1 anneau (Heat haute + clic au CŒUR) ────
// À partir d'une main INTÉRIEURE (toutes ses voisines in-range), révèle la
// main + ses voisines directes sur les 3 axes. NON-directionnel (≠ domination,
// qui ne monte que vers le plus fort) : récompense le clic au milieu du bloc.
// On filtre quand même par la cible (robuste si la case n'est pas strictement
// intérieure — l'appelant décide du déclenchement).
export const radialReveal = (hand, target) => {
  if (!target.has(hand)) return [hand];
  return [hand, ...neighborsOf(hand).filter((n) => target.has(n))];
};

export const dominationReveal = (hand, target) => {
  if (!target.has(hand)) return [hand];
  const seen = new Set([hand]);
  const stack = [hand];
  while (stack.length) {
    const h = stack.pop();
    const [i, j] = posOf[h];
    const cands = [];
    if (i === j) {
      cands.push([i - 1, i - 1]); // paire supérieure
    } else if (i < j) {
      if (j - 1 > i) cands.push([i, j - 1]); // suited : meilleur kicker
    } else {
      if (i - 1 > j) cands.push([i - 1, j]); // offsuit : meilleur kicker
      cands.push([j, i]); // miroir suité (domine l'offsuit)
    }
    for (const [ni, nj] of cands) {
      if (!inBounds(ni, nj)) continue;
      const nh = handAt(ni, nj);
      if (target.has(nh) && !seen.has(nh)) {
        seen.add(nh);
        stack.push(nh);
      }
    }
  }
  return [...seen];
};
