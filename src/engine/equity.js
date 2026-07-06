// ─────────────────────────────────────────────────────────────
// engine/equity.js — équité préflop main-vs-main (#3, DORMANT).
//
// Logique PURE (zéro React). Sert au mini-showdown bonus : on tire un
// board au hasard (Monte Carlo) et on compare les deux mains avec un
// évaluateur 7 cartes. Résultat mis en CACHE par matchup → instantané
// aux appels suivants. Présenté en « flip » (le board n'est pas montré).
//
// Une « classe » de main = la notation de la grille : "AKs", "AKo", "77".
// On randomise les couleurs à chaque tirage → moyenne sur les combos
// (effets de blockers inclus), équité juste sans table géante embarquée.
// ─────────────────────────────────────────────────────────────

import { RANKS } from "./poker.js";

const ri = Object.fromEntries(RANKS.map((r, i) => [r, i])); // 'A'→0 … '2'→12
const rand = (n) => Math.floor(Math.random() * n);
// id de carte = idx*4 + suit (idx 0..12 = A..2, suit 0..3)

// Détecte la plus haute quinte d'un ensemble de valeurs (A=14 ; roue A-5).
function straightHigh(vals) {
  const set = new Set(vals);
  if (set.has(14)) set.add(1); // l'As complète la roue
  let run = 0;
  for (let v = 14; v >= 1; v--) {
    if (set.has(v)) {
      run++;
      if (run >= 5) return v + 4; // la plus haute (on descend)
    } else run = 0;
  }
  return 0;
}

const mk = (cat, tb) => {
  let s = cat;
  for (let i = 0; i < 5; i++) s = s * 15 + (tb[i] || 0);
  return s;
};

// Score comparable d'une main de 7 cartes [{idx,suit}].
//   catégories 9=quinte flush … 1=hauteur
export function score7(cards) {
  const vals = cards.map((c) => 14 - c.idx); // idx0=A→14 … idx12=2→2
  const cnt = {};
  vals.forEach((v) => (cnt[v] = (cnt[v] || 0) + 1));
  const suitCnt = [0, 0, 0, 0];
  cards.forEach((c) => suitCnt[c.suit]++);

  let flushSuit = -1;
  for (let s = 0; s < 4; s++) if (suitCnt[s] >= 5) flushSuit = s;

  if (flushSuit >= 0) {
    const fv = cards.filter((c) => c.suit === flushSuit).map((c) => 14 - c.idx);
    const sf = straightHigh(fv);
    if (sf) return mk(9, [sf]); // quinte flush
  }

  const byCount = { 1: [], 2: [], 3: [], 4: [] };
  Object.keys(cnt).forEach((v) => byCount[cnt[v]].push(+v));
  Object.values(byCount).forEach((a) => a.sort((x, y) => y - x));

  if (byCount[4].length) {
    const q = byCount[4][0];
    const kick = Math.max(...vals.filter((v) => v !== q));
    return mk(8, [q, kick]); // carré
  }
  if (byCount[3].length >= 1 && (byCount[2].length >= 1 || byCount[3].length >= 2)) {
    const trips = byCount[3][0];
    const pair = byCount[3].length >= 2 ? byCount[3][1] : byCount[2][0];
    return mk(7, [trips, pair]); // full
  }
  if (flushSuit >= 0) {
    const fv = cards.filter((c) => c.suit === flushSuit).map((c) => 14 - c.idx).sort((a, b) => b - a).slice(0, 5);
    return mk(6, fv); // couleur
  }
  const st = straightHigh(vals);
  if (st) return mk(5, [st]); // quinte
  if (byCount[3].length) {
    const t = byCount[3][0];
    const ks = vals.filter((v) => v !== t).sort((a, b) => b - a).slice(0, 2);
    return mk(4, [t, ...ks]); // brelan
  }
  if (byCount[2].length >= 2) {
    const [p1, p2] = byCount[2];
    const kick = Math.max(...vals.filter((v) => v !== p1 && v !== p2));
    return mk(3, [p1, p2, kick]); // deux paires
  }
  if (byCount[2].length === 1) {
    const p = byCount[2][0];
    const ks = vals.filter((v) => v !== p).sort((a, b) => b - a).slice(0, 3);
    return mk(2, [p, ...ks]); // paire
  }
  return mk(1, [...vals].sort((a, b) => b - a).slice(0, 5)); // hauteur
}

// Tire deux cartes concrètes pour une classe, en évitant les cartes `used`
// (qu'on marque). Renvoie [{idx,suit},{idx,suit}] ou null si impossible.
function classToCards(cls, used) {
  const r1 = ri[cls[0]], r2 = ri[cls[1]];
  const isPair = cls.length === 2;
  const suited = cls[2] === "s";
  for (let attempt = 0; attempt < 25; attempt++) {
    const s1 = rand(4);
    let s2;
    if (suited && !isPair) s2 = s1;
    else {
      s2 = rand(4);
      if (s2 === s1) continue; // paire & offsuit → couleurs différentes
    }
    const c1 = r1 * 4 + s1, c2 = r2 * 4 + s2;
    if (c1 === c2 || used.has(c1) || used.has(c2)) continue;
    used.add(c1);
    used.add(c2);
    return [{ idx: r1, suit: s1 }, { idx: r2, suit: s2 }];
  }
  return null;
}

function dealBoard(used, n) {
  const out = [];
  while (out.length < n) {
    const c = rand(52);
    if (used.has(c)) continue;
    used.add(c);
    out.push({ idx: Math.floor(c / 4), suit: c % 4 });
  }
  return out;
}

const cache = new Map();

// Équité de `heroCls` contre `villainCls` (0..1). Monte Carlo + cache.
export function equity(heroCls, villainCls, N = 2000) {
  const key = heroCls + "|" + villainCls;
  if (cache.has(key)) return cache.get(key);
  let win = 0, tie = 0, played = 0;
  for (let n = 0; n < N; n++) {
    const used = new Set();
    const hero = classToCards(heroCls, used);
    const vil = classToCards(villainCls, used);
    if (!hero || !vil) continue; // collision rare (mêmes rangs) → on saute
    const board = dealBoard(used, 5);
    const hs = score7([...hero, ...board]);
    const vs = score7([...vil, ...board]);
    if (hs > vs) win++;
    else if (hs === vs) tie++;
    played++;
  }
  const eq = played ? (win + tie / 2) / played : 0.5;
  cache.set(key, eq);
  return eq;
}

// Tire une main de villain au hasard dans une range (liste de classes).
export const pickVillain = (range) => range[rand(range.length)];
