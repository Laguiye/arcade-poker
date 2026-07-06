// ─────────────────────────────────────────────────────────────
// theme/cosmic.js — PALETTES COSMIQUES (maquette « 9 cartes »).
//
// Reskin visuel : 1 palette par CONTEXTE DE BANDE. Les mécaniques
// (HEAT, aides, cascade) ne changent pas — seules l'identité couleur
// du décor, le cadre, le glow et l'en-tête planète sont thématisés.
//
// Chaque thème :
//   name / icon       → en-tête « secteur » de la carte
//   accent            → couleur d'identité de la range (cases in-range,
//                       sélection correcte, frontière OK) — hex 6 chiffres
//   accentText        → texte clair sur fond accent
//   frame / glow      → bord + halo du cadre
//   bgFrom / bgTo     → dégradé de fond de la carte
//   panel             → fond des panneaux internes (grille, stats)
//
// NB : les couleurs SÉMANTIQUES restent fixes hors-thème — erreur rouge,
// HEAT ambre→rouge, proximité (↑ jaune / ⇈ bleu), marqueurs de frontière
// ambre. Elles doivent rester lisibles quel que soit le décor.
// ─────────────────────────────────────────────────────────────

export const THEMES = {
  aube: {
    name: "Aube Galactique", icon: "☀️",
    accent: "#f5a83a", accentText: "#ffd79a", frame: "#e0922e", glow: "#f5a83a",
    bgFrom: "#181206", bgTo: "#0a0a12", panel: "#120f08",
  },
  nebula: {
    name: "Nébuleuse Électrique", icon: "🪐",
    accent: "#d557d0", accentText: "#f3b8ef", frame: "#9d49c0", glow: "#d557d0",
    bgFrom: "#160f20", bgTo: "#0b0a14", panel: "#130d1c",
  },
  orbite: {
    name: "Orbite Verte", icon: "🪐",
    accent: "#7ed957", accentText: "#c4f5a8", frame: "#4e8f3a", glow: "#7ed957",
    bgFrom: "#0f1609", bgTo: "#0a0d0b", panel: "#0e1409",
  },
  stellaire: {
    name: "Commande Stellaire", icon: "🛰️",
    accent: "#5b9bff", accentText: "#bcd6ff", frame: "#3a6bc8", glow: "#5b9bff",
    bgFrom: "#0b1322", bgTo: "#080b14", panel: "#0c1320",
  },
  mercure: {
    name: "Secteur Mercure", icon: "🔴",
    accent: "#ef8b3c", accentText: "#ffcf9e", frame: "#b5662a", glow: "#ef8b3c",
    bgFrom: "#16100a", bgTo: "#0c0a08", panel: "#13100b",
  },
  jardin: {
    name: "Jardin Cosmique", icon: "🌱",
    accent: "#58e0bf", accentText: "#b8f5e4", frame: "#2f9e85", glow: "#58e0bf",
    bgFrom: "#0b1614", bgTo: "#08100e", panel: "#0a1513",
  },
  supernova: {
    name: "Supernova", icon: "💥",
    accent: "#f04a3c", accentText: "#ffb3ab", frame: "#c0392f", glow: "#f04a3c",
    bgFrom: "#170c0a", bgTo: "#0d0807", panel: "#140b09",
  },
  confins: {
    name: "Confins Profonds", icon: "🌙",
    accent: "#4fd6cf", accentText: "#b3f1ed", frame: "#2f9aa0", glow: "#4fd6cf",
    bgFrom: "#0a1517", bgTo: "#070f11", panel: "#0a1416",
  },
  andromede: {
    name: "Horizon Andromède", icon: "🌌",
    accent: "#f06f9e", accentText: "#ffc2d7", frame: "#c04a78", glow: "#f06f9e",
    bgFrom: "#160e14", bgTo: "#0c080c", panel: "#130d11",
  },
};

export const DEFAULT_THEME = THEMES.orbite;

// Résout le décor d'un spot → 1 palette par SECTEUR (cf. la « carte galactique »).
// Les couleurs SUIVENT les secteurs de la carte (cohérence carte ↔ niveau) :
//   tuto            → Orbite Verte (vert d'apprentissage, familier)
//   spin-3max       → Aube Galactique (orange = SECTEUR SPIN / short stack)
//   mtt-6max ≤30bb  → Nébuleuse Électrique (magenta = SECTEUR MTT / mid stack)
//   mtt-6max  >30bb → Confins Profonds (cyan = SECTEUR CASH / deep stack)
export function themeForSpot(spot) {
  if (!spot) return DEFAULT_THEME;
  if (spot.tuto) return THEMES.orbite;
  if (spot.format === "spin-3max") return THEMES.aube;
  if (spot.format === "mtt-6max") return spot.stackBB > 30 ? THEMES.confins : THEMES.nebula;
  return THEMES.stellaire;
}

// Thème d'un SECTEUR de la carte galactique, par identifiant de bande
// (cf. data/quest.js : "spin" | "mtt-short" | "mtt-deep").
export const SECTOR_THEME = {
  spin: THEMES.aube,
  "mtt-short": THEMES.nebula,
  "mtt-deep": THEMES.confins,
};
