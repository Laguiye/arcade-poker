// ─────────────────────────────────────────────────────────────
// data/missions.js — OBJECTIFS (contrats) dérivés de l'état persisté.
//
// Chaque mission lit les compteurs déjà suivis (progressions/economy) via
// `progress(state)` → un nombre comparé à `goal`. Récompense = gems (monnaie
// de maîtrise). Le STORE ne dépend PAS de ce fichier : la récompense voyage
// dans l'action CLAIM_MISSION (pas d'import circulaire). Une mission est
// « réclamable » quand progress ≥ goal et qu'elle n'est pas déjà réclamée.
// ─────────────────────────────────────────────────────────────

import { levelFromXp } from "../state/store.jsx";

const progs = (s) => Object.values(s.progressions);
const sumCleared = (s) => progs(s).reduce((n, p) => n + p.totalCleared, 0);
const perfectCount = (s) =>
  progs(s).reduce((n, p) => n + Object.values(p.stars || {}).filter((v) => v >= 3).length, 0);
const seatsUnlocked = (s) =>
  (s.progressions["spin-btn"].maxBandReached >= 1 ? 1 : 0) +
  (s.progressions["spin-sb"].maxBandReached >= 1 ? 1 : 0);

export const MISSIONS = [
  { id: "first-steps", icon: "🎯", label: "Premiers pas", desc: "Valide 3 paliers", goal: 3, gems: 3, progress: sumCleared },
  { id: "sharp-read", icon: "✦", label: "Lecture parfaite", desc: "5 clears en 3★", goal: 5, gems: 5, progress: perfectCount },
  { id: "btn-master", icon: "🔵", label: "Maîtrise BTN", desc: "Finis l'échelle 6 au BTN", goal: 1, gems: 5, progress: (s) => Math.min(1, s.progressions["spin-btn"].maxBandReached) },
  { id: "all-seats", icon: "🪑", label: "Tous les sièges", desc: "Débloque SB et BB", goal: 2, gems: 10, progress: seatsUnlocked },
  { id: "climber", icon: "🚀", label: "Grimpeur", desc: "Atteins le niveau 5", goal: 5, gems: 8, progress: (s) => levelFromXp(s.economy.xp) },
];

// État d'une mission pour l'UI : valeur courante (capée), complète, réclamable.
export const missionState = (m, state) => {
  const value = Math.min(m.progress(state), m.goal);
  const claimed = state.claimedMissions.includes(m.id);
  const complete = value >= m.goal;
  return { value, claimed, complete, claimable: complete && !claimed };
};

// Combien de missions réclamables ? (pastille de nav)
export const claimableCount = (state) =>
  MISSIONS.reduce((n, m) => n + (missionState(m, state).claimable ? 1 : 0), 0);
