// ─────────────────────────────────────────────────────────────
// data/shop.js — BOUTIQUE (sink des gems). Méta-upgrades PERMANENTS
// qui modifient le départ de chaque Run (roguelite meta-progression).
//
// État : state.shop.upgrades = { [id]: niveau } (0 = non possédé). Les
// items REPEATABLES montent jusqu'à `max` (coût escaladant) ; les autres
// sont 0/1. Le STORE ne dépend PAS de ce fichier : le coût voyage dans
// l'action BUY_UPGRADE (pas d'import circulaire) ; le store garde juste
// l'intégrité (assez de gems).
// ─────────────────────────────────────────────────────────────

export const SHOP_ITEMS = [
  { id: "extra-life", icon: "♥", name: "Vie de base", desc: "+1 vie au départ de chaque Run", max: 3, cost: (lvl) => 20 + lvl * 20 }, // 20 · 40 · 60
  { id: "nest-egg", icon: "💰", name: "Magot de départ", desc: "Chaque Run démarre avec +2000 jetons", max: 1, cost: () => 25 },
  { id: "head-start", icon: "🎴", name: "Tête de série", desc: "Chaque Run démarre avec 1 capacité au hasard", max: 1, cost: () => 40 },
];

export const ownedLevel = (shop, id) => (shop && shop.upgrades ? shop.upgrades[id] || 0 : 0);
export const isMaxed = (item, shop) => ownedLevel(shop, item.id) >= item.max;
export const nextCost = (item, shop) => item.cost(ownedLevel(shop, item.id));
