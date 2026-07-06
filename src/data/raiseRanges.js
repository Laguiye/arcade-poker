// ─────────────────────────────────────────────────────────────
// data/raiseRanges.js — RANGES DU RAISE PRÉFLOP (Design A, 2026-07).
//
// Étend le modèle jam/fold du Spin au min-raise 2bb, en résolution
// ALL-IN ONLY : face à un raise on ne peut que FOLD ou RE-TAPIS
// (jamais de flat-call ni de limp → aucune branche postflop).
//
// Structure clé : chaque main first-in appartient à UNE classe de PLAN
//   JAM        → tapis direct
//   RAISE_CALL → raise 2bb, committé (call si re-tapis derrière)
//   RAISE_FOLD → raise 2bb en vol (fold si re-tapis)
//   FOLD       → (implicite : tout le reste)
// La décision "raiser face au re-tapis" est IMPLIQUÉE par la classe :
// pas de ranges call-vs-rejam séparées.
//
// ⚠️ APPROXIMATIONS MAISON (comme nash3max.js : "à valider contre
// HoldemResources") — cohérentes avec la littérature spin, pensées pour
// le coaching. Format volontairement REMPLAÇABLE par un export solveur :
// il suffit de re-remplir les listes ci-dessous, notation identique.
//
// Paliers : 15/20/25/30 (palier INFÉRIEUR, comme nashRanges). Le raise
// n'existe qu'à ≥ RAISE_MIN_BB ; en dessous → jam/fold pur inchangé.
// Notation compacte développée par range() de spots.js ("88+","ATs+"…).
// ─────────────────────────────────────────────────────────────

import { range } from "./spots.js";

export const RAISE_MIN_BB = 15; // tapis effectif mini pour proposer le raise
export const RAISE_TO_BB = 2; // min-raise : relance À 2bb (taille fixe)

// ── Partitions first-in {jam, raise_call, raise_fold} ────────
// Tendances : le JAM rétrécit avec la profondeur (vide à 25bb+ — le
// leak n°1 du débutant est l'open-jam 25bb) ; le RAISE_CALL se resserre ;
// le RAISE_FOLD (vol) s'élargit.
const FIRST_IN = {
  15: {
    BTN: {
      raise_call: ["88+", "ATs+", "ATo+", "KQs", "KJs", "KQo", "QJs"],
      jam: [
        "77", "66", "55", "44", "33", "22",
        "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
        "A9o", "A8o", "A7o", "A6o", "A5o", "A4o", "A3o", "A2o",
        "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "KJo", "KTo", "K9o", "K8o",
      ],
      raise_fold: [
        "QTs", "Q9s", "Q8s", "QJo", "QTo", "JTs", "J9s", "J8s", "JTo", "J9o",
        "T9s", "T8s", "T7s", "T9o", "98s", "97s", "98o", "87s", "86s",
        "76s", "75s", "65s", "64s", "54s", "43s",
      ],
    },
    SB: {
      raise_call: ["77+", "A9s+", "ATo+", "KQs", "KJs", "KTs", "KQo", "KJo", "QJs", "JTs"],
      jam: [
        "66", "55", "44", "33", "22",
        "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
        "A9o", "A8o", "A7o", "A6o", "A5o", "A4o", "A3o", "A2o",
        "K9s", "K8s", "K7s", "K6s", "K5s", "K4s", "K3s", "K2s",
        "KTo", "K9o", "K8o", "K7o", "K6o",
        "Q8s", "Q7s", "Q6s", "Q5s", "Q9o", "Q8o",
        "J8s", "J7s", "J6s", "J9o", "T7s", "T6s",
        "96s", "95s", "86s", "85s", "75s", "74s", "64s", "63s", "53s", "43s",
      ],
      raise_fold: [
        "QTs", "Q9s", "QJo", "QTo", "J9s", "JTo", "T9s", "T8s", "T9o",
        "98s", "97s", "98o", "87s", "87o", "76s", "76o", "65s", "65o", "54s",
      ],
    },
  },

  20: {
    BTN: {
      raise_call: ["99+", "ATs+", "AQo+", "KQs"],
      jam: [
        "88", "77", "66", "55", "44", "33", "22",
        "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
        "A9o", "A8o", "A7o", "A6o",
      ],
      raise_fold: [
        "AJo", "ATo", "KJs", "KTs", "K9s", "KQo", "KJo", "KTo", "K9o",
        "QJs", "QTs", "Q9s", "Q8s", "QJo", "QTo", "JTs", "J9s", "J8s", "JTo",
        "T9s", "T8s", "T7s", "98s", "97s", "87s", "86s", "76s", "65s", "54s",
      ],
    },
    SB: {
      raise_call: ["88+", "ATs+", "ATo+", "KQs", "KJs", "KQo", "QJs"],
      jam: [
        "77", "66", "55", "44", "33", "22",
        "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
        "A9o", "A8o", "A7o", "A6o", "A5o",
        "K9s", "K8s", "K7s", "K6s", "K5s", "KTo", "K9o", "K8o",
      ],
      raise_fold: [
        "A4o", "A3o", "A2o", "KTs", "KJo",
        "QTs", "Q9s", "Q8s", "Q7s", "QJo", "QTo", "Q9o",
        "JTs", "J9s", "J8s", "JTo", "J9o", "T9s", "T8s", "T7s", "T9o",
        "98s", "97s", "98o", "87s", "86s", "76s", "75s", "65s", "64s",
        "54s", "53s", "43s",
      ],
    },
  },

  25: {
    BTN: {
      raise_call: ["99+", "AJs+", "AQo+"],
      jam: [], // 25bb : plus AUCUN open-jam — tout passe par raise
      raise_fold: [
        "88", "77", "66", "55", "44", "33", "22",
        "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
        "AJo", "ATo", "A9o", "A8o", "A7o",
        "KQs", "KJs", "KTs", "K9s", "K8s", "KQo", "KJo", "KTo", "K9o",
        "QJs", "QTs", "Q9s", "Q8s", "QJo", "QTo", "Q9o",
        "JTs", "J9s", "J8s", "JTo", "J9o", "T9s", "T8s", "T7s", "T9o",
        "98s", "97s", "98o", "87s", "86s", "76s", "75s", "65s", "54s", "43s",
      ],
    },
    SB: {
      raise_call: ["99+", "AJs+", "AJo+", "KQs"],
      jam: [],
      raise_fold: [
        "88", "77", "66", "55", "44", "33", "22",
        "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
        "ATo", "A9o", "A8o", "A7o", "A6o", "A5o", "A4o", "A3o", "A2o",
        "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s",
        "KQo", "KJo", "KTo", "K9o", "K8o",
        "QJs", "QTs", "Q9s", "Q8s", "Q7s", "QJo", "QTo", "Q9o", "Q8o",
        "JTs", "J9s", "J8s", "J7s", "JTo", "J9o",
        "T9s", "T8s", "T7s", "T9o", "T8o",
        "98s", "97s", "96s", "98o", "87s", "86s", "85s", "87o",
        "76s", "75s", "76o", "65s", "64s", "54s", "53s", "43s",
      ],
    },
  },

  30: {
    BTN: {
      raise_call: ["JJ+", "AQs+", "AKo"],
      jam: [],
      raise_fold: [
        "TT", "99", "88", "77", "66", "55", "44", "33", "22",
        "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
        "AQo", "AJo", "ATo", "A9o", "A8o",
        "KQs", "KJs", "KTs", "K9s", "KQo", "KJo", "KTo",
        "QJs", "QTs", "Q9s", "QJo", "QTo",
        "JTs", "J9s", "J8s", "JTo", "T9s", "T8s",
        "98s", "97s", "87s", "86s", "76s", "65s", "54s",
      ],
    },
    SB: {
      raise_call: ["TT+", "AQs+", "AQo+"],
      jam: [],
      raise_fold: [
        "99", "88", "77", "66", "55", "44", "33", "22",
        "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
        "AJo", "ATo", "A9o", "A8o", "A7o", "A6o", "A5o",
        "KQs", "KJs", "KTs", "K9s", "K8s", "K7s",
        "KQo", "KJo", "KTo", "K9o", "K8o",
        "QJs", "QTs", "Q9s", "Q8s", "QJo", "QTo", "Q9o",
        "JTs", "J9s", "J8s", "JTo", "J9o", "T9s", "T8s", "T7s", "T9o",
        "98s", "97s", "87s", "86s", "76s", "75s", "65s", "64s", "54s",
      ],
    },
  },
};

// ── Ranges de RE-TAPIS face à un raise (resteal) ─────────────
// Monotonie : BB_vs_SB ⊇ BB_vs_BTN ⊇ SB_vs_BTN (le SB a la BB derrière
// → le plus serré) ; chaque range se resserre avec la profondeur.
const REJAM = {
  SB_rejam_vs_BTN: {
    15: ["66+", "A9s+", "ATo+", "KQs", "KJs", "KQo"],
    20: ["77+", "ATs+", "AJo+", "KQs"],
    25: ["88+", "AJs+", "AQo+"],
    30: ["99+", "AQs+", "AKo"],
  },
  BB_rejam_vs_BTN: {
    15: ["55+", "A7s+", "A9o+", "KTs+", "KQo", "QJs"],
    20: ["66+", "A9s+", "ATo+", "KJs+", "KQo"],
    25: ["77+", "ATs+", "AJo+", "KQs"],
    30: ["88+", "AJs+", "AQo+", "KQs"],
  },
  BB_rejam_vs_SB: {
    15: ["44+", "A5s+", "A8o+", "K9s+", "KJo+", "QJs", "QTs", "JTs"],
    20: ["55+", "A8s+", "A9o+", "KTs+", "KQo", "QJs"],
    25: ["66+", "A9s+", "ATo+", "KJs+", "KQo"],
    30: ["77+", "ATs+", "AJo+", "KQs", "KQo"],
  },
};

// ── Lookups (développement + cache au premier accès) ─────────
export const RAISE_BUCKETS = Object.keys(FIRST_IN).map(Number).sort((a, b) => a - b);

// Palier inférieur de la ZONE raise — null si le tapis est sous 15bb.
export function raiseBucket(bb) {
  let best = null;
  for (const s of RAISE_BUCKETS) if (s <= bb) best = s;
  return best;
}

const planCache = {};
// Map main → 'jam'|'raise_call'|'raise_fold' pour un palier/position.
function planMap(bucket, pos) {
  const key = bucket + "|" + pos;
  if (planCache[key]) return planCache[key];
  const def = FIRST_IN[bucket][pos];
  const map = {};
  for (const plan of ["jam", "raise_call", "raise_fold"])
    for (const hand of range(def[plan])) {
      if (map[hand]) throw new Error(`raiseRanges: ${hand} en double (${key}: ${map[hand]} + ${plan})`);
      map[hand] = plan;
    }
  planCache[key] = map;
  return map;
}

// Plan first-in d'une main. null si hors zone (bb < 15) → jam/fold pur.
export function firstInPlan(hand, bb, pos) {
  const b = raiseBucket(bb);
  if (!b || (pos !== "BTN" && pos !== "SB")) return null;
  return planMap(b, pos)[hand] || "fold";
}

const rejamCache = {};
// Range de re-tapis face à un raise. Scénarios : SB_rejam_vs_BTN ·
// BB_rejam_vs_BTN · BB_rejam_vs_SB. Palier inférieur, plancher 15.
export function rejamRange(bb, scenario) {
  if (!REJAM[scenario]) return new Set();
  const b = raiseBucket(Math.max(bb, RAISE_MIN_BB));
  const key = b + "|" + scenario;
  if (rejamCache[key]) return rejamCache[key];
  const set = new Set(range(REJAM[scenario][b]));
  rejamCache[key] = set;
  return set;
}

export const inRejam = (hand, bb, scenario) => rejamRange(bb, scenario).has(hand);

// Scénario de resteal selon la position et celle du raiseur.
export const rejamScenario = (pos, raiserPos) =>
  pos === "SB" ? "SB_rejam_vs_BTN" : raiserPos === "SB" ? "BB_rejam_vs_SB" : "BB_rejam_vs_BTN";
