// ─────────────────────────────────────────────────────────────
// data/villainProfiles.js — PROFILS d'adversaires (brief §4).
//
// 3 profils V1 : 🔵 nit (serré) · 🟢 reg (≈ Nash) · 🟡 fish (station).
// Le profil dévie de la range Nash via un DÉCALAGE DE TAPIS EFFECTIF
// (élégant + réutilise les ranges telles quelles) :
//   • serré  → joue comme s'il avait PLUS de tapis → range plus serrée
//   • station→ joue comme s'il avait MOINS de tapis → range plus large
// `push`/`call` = multiplicateurs appliqués au stack avant lookup Nash.
// ─────────────────────────────────────────────────────────────

// `resteal` = fréquence de re-tapis face à un raise (même astuce de
// décalage) : serré → lâche face aux relances (cible de vol) ; station →
// re-tapis large (« ne lâche pas sa main », traduction Design A du call).
export const PROFILES = {
  nit: { id: "nit", emoji: "🔵", color: "#5b9bff", name: "Le Serré", line: "Push serré · fold large vs tapis et relances", push: 1.5, call: 1.9, resteal: 1.6 },
  reg: { id: "reg", emoji: "🟢", color: "#10b981", name: "L'Équilibré", line: "≈ Nash · ligne prévisible", push: 1.0, call: 1.0, resteal: 1.0 },
  fish: { id: "fish", emoji: "🟡", color: "#f5c84a", name: "La Station", line: "Call large · ne lâche pas · ne bluffe pas", push: 0.6, call: 0.4, resteal: 0.5 },
};

const IDS = ["nit", "reg", "fish"];
export const profileOf = (id) => PROFILES[id] || PROFILES.reg;
export const randomProfileId = () => IDS[Math.floor(Math.random() * IDS.length)];
