// ─────────────────────────────────────────────────────────────
// engine/frontier.js — dérivation des mains-FRONTIÈRE (brief §5).
// Déplacé de run/ vers engine/ : c'est de la logique de matrice pure,
// donc elle vit dans le moteur (spec §0). 100% dérivé des helpers de
// poker.js — aucune donnée nouvelle.
//
// Une main est "frontière" si sa décision (in/out de range) DIFFÈRE
// d'au moins une voisine sur l'un des 3 axes :
//   (a) kicker            — A8o ↔ A7o
//   (b) suited / offsuit  — A5s ↔ A5o
//   (c) paires            — 55 ↔ 44
// Les DEUX côtés sortent (juste-dedans = action, juste-dehors = FOLD).
// Indispensable anti-brute-force : sans le côté fold, "tout push" gagne.
// ─────────────────────────────────────────────────────────────

import { handAt, combosOf, neighborsOf } from "./poker.js";

// Voisinage des mains (3 axes) : source unique dans poker.js.

// Retourne les mains-frontière d'une range donnée.
// item = { hand, inRange, combos } ; bonne réponse = action si inRange, sinon FOLD.
export const computeFrontier = (rangeHands) => {
  const target = new Set(rangeHands);
  const result = [];
  for (let i = 0; i < 13; i++) {
    for (let j = 0; j < 13; j++) {
      const hand = handAt(i, j);
      const mine = target.has(hand);
      const isFrontier = neighborsOf(hand).some((n) => target.has(n) !== mine);
      if (isFrontier) {
        result.push({ hand, inRange: mine, combos: combosOf(hand) });
      }
    }
  }
  return result;
};
