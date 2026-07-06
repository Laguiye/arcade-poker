// ─────────────────────────────────────────────────────────────
// data/abilities.js — CAPACITÉS draftables du mode Run (roguelite).
//
// Entre deux paliers, le joueur choisit 1 carte sur 3. Les capacités
// modifient la boucle de survie (vies, streak, jetons, bouclier). La
// plupart sont UNIQUES (retirées du pool une fois prises) ; « Seconde
// chance » est REPEATABLE (toujours proposable). Si le pool s'épuise,
// on complète avec le Magot (jetons directs, pas une capacité gardée).
// ─────────────────────────────────────────────────────────────

export const ABILITIES = [
  { id: "second-life", icon: "♥", name: "Seconde chance", desc: "+1 vie, tout de suite", repeatable: true },
  { id: "cool-head", icon: "🧊", name: "Sang-froid", desc: "L'erreur ne casse plus ton streak" },
  { id: "muscle", icon: "💪", name: "Gros bras", desc: "+50% de jetons gagnés" },
  { id: "momentum", icon: "⚡", name: "Élan", desc: "Multiplicateur plus tôt : ×2 dès 2, ×3 dès 4" },
  { id: "shield", icon: "🛡️", name: "Bouclier", desc: "Encaisse 1 erreur par palier sans perdre de vie" },
];

export const JACKPOT = { id: "jackpot", icon: "💰", name: "Magot", desc: "+1500 jetons direct" };

const ABILITY_BY_ID = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));
export const abilityById = (id) => ABILITY_BY_ID[id] || JACKPOT;

const shuffle = (arr) => {
  const a = [...arr];
  for (let k = a.length - 1; k > 0; k--) {
    const r = Math.floor(Math.random() * (k + 1));
    [a[k], a[r]] = [a[r], a[k]];
  }
  return a;
};

// Tire 3 options de draft selon les capacités déjà possédées.
export const drawDraft = (owned = []) => {
  const available = ABILITIES.filter((a) => a.repeatable || !owned.includes(a.id));
  const pick = shuffle(available).slice(0, 3);
  while (pick.length < 3) pick.push(JACKPOT);
  return pick;
};

// Capacité de départ (boutique « Tête de série ») : une ONGOING au hasard
// (pas « Seconde chance » dont l'effet est immédiat, ni le Magot).
export const randomStartAbility = () => {
  const pool = ABILITIES.filter((a) => !a.repeatable);
  return pool[Math.floor(Math.random() * pool.length)].id;
};

// Multiplicateur de streak — « Élan » avance les paliers.
export const multForStreak = (streak, momentum) =>
  momentum ? (streak >= 4 ? 3 : streak >= 2 ? 2 : 1) : streak >= 6 ? 3 : streak >= 3 ? 2 : 1;

// Gems gagnés à la fin d'un run (méta-progression persistée → futur shop).
export const runGems = (tiersCleared, won) => tiersCleared * 3 + (won ? 6 : 0);
