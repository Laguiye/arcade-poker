import React, { createContext, useContext, useReducer, useEffect } from "react";
import { QUESTS, bandsFor, pickSpotForBand } from "../data/quest.js";
import { TUTO_SPOT, spotById } from "../data/spots.js";

// ─────────────────────────────────────────────────────────────
// state/store.jsx — état global. Context+reducer, PERSISTÉ en
// localStorage (progression/économie/avatar/quête/difficulté).
//
// Progression PAR BANDE/ÉCHELLE : on suit la quête, chaque niveau tire le
// spot du palier (ordonné Spin) ou au hasard (MTT). `heat` = momentum de
// session (NON persisté : on repart à 0 à chaque chargement).
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "arcade-poker:v1";
// Tranche DURABLE sauvegardée (le reste = transitoire : écran, spot, etc.).
const PERSIST_KEYS = ["player", "quest", "progressions", "economy", "difficulty", "claimedMissions", "shop", "prefs"];

// Progression vierge (créée par quête).
const PROG0 = () => ({ bandIdx: 0, clearedInBand: 0, maxBandReached: 0, totalCleared: 0, stars: {} });

const initialState = {
  player: { avatarId: null, name: "" },
  quest: "spin-btn", // quête courante (3 positions Spin + MTT), choisie à l'accueil
  // Progression INDÉPENDANTE par quête.
  progressions: { "spin-btn": PROG0(), "spin-sb": PROG0(), "spin-bb": PROG0(), mtt: PROG0() },
  economy: { chips: 0, xp: 0, gems: 0 }, // jetons (linéaire) · xp (→ niveau) · gems (maîtrise)
  heat: 0, // 0..1, persistant
  screen: "boot",
  activeSpot: null,
  estimatePhase: false, // le niveau courant démarre-t-il par une estimation % ?
  practice: false, // rejouer un spot déjà validé : aucune récompense ni progression
  difficulty: "normal", // 'normal' (frontière) | 'difficile' (sans frontière) | 'hardcore' (sans bonus)
  claimedMissions: [], // ids des missions dont la récompense a été réclamée
  shop: { upgrades: {} }, // méta-upgrades permanents achetés (id → niveau)
  prefs: { stackUnit: "chips" }, // préférences d'affichage (persistées) : 'chips' | 'bb'
  lastReward: null,
};

const clampHeat = (h) => Math.max(0, Math.min(1, h));

// Niveau du joueur dérivé de l'XP cumulée (source unique = economy.xp).
export const XP_PER_LEVEL = 400;
export const levelFromXp = (xp) => 1 + Math.floor((xp || 0) / XP_PER_LEVEL);

// Gems = monnaie de MAÎTRISE (rare, distincte des jetons) : clear parfait + paliers.
const GEMS_PERFECT = 1; // clear 3★
const GEMS_GRADUATE = 5; // échelle/bande franchie
const gemsFor = (stars, graduated) => (stars >= 3 ? GEMS_PERFECT : 0) + (graduated ? GEMS_GRADUATE : 0);

function reducer(state, action) {
  switch (action.type) {
    case "GO":
      return { ...state, screen: action.screen };

    case "SELECT_AVATAR":
      return {
        ...state,
        player: { ...state.player, avatarId: action.avatarId, name: action.name || "" },
        screen: "intro", // 3 slides d'onboarding (une fois par save — les saves existantes reprennent sur "map")
      };

    case "SELECT_QUEST":
      // Choix du monde (Spin/MTT) à l'accueil ; la progression de chaque quête
      // est conservée séparément.
      return { ...state, quest: action.quest };

    case "START_NEXT": {
      const q = state.quest;
      const p = state.progressions[q];
      const qdef = QUESTS[q];
      const band = qdef.bands[p.bandIdx];
      // Choix du spot du palier courant :
      //   tutoFirst (MTT) + 1ʳᵉ fois → tuto déguisé
      //   bande ORDONNÉE (spotIds, Spin)  → le tapis du palier, dans l'ordre
      //   bande ALÉATOIRE (filter, MTT)   → tirage au hasard dans la bande
      let spot;
      if (qdef.tutoFirst && p.totalCleared === 0) {
        spot = TUTO_SPOT;
      } else if (band.spotIds) {
        const idx = Math.min(p.clearedInBand, band.spotIds.length - 1);
        spot = spotById[band.spotIds[idx]];
      } else {
        spot = pickSpotForBand(q, p.bandIdx, state.activeSpot?.id);
      }
      // Phase d'estimation : jamais aux niveaux 1-3, seulement sur les spots
      // quasi-linéaires (push/fold). « 1 par 1 » → introduite plus tard (§6).
      const estimatePhase = p.totalCleared >= 3 && !!spot.estimateOk;
      return { ...state, activeSpot: spot, estimatePhase, practice: false, screen: "level" };
    }

    case "REPLAY_SPOT":
      // Rejouer le MÊME spot à zéro, en PRACTICE : aucune récompense, aucune
      // progression. On clone le spot pour forcer le reset des écrans/format
      // (mêmes refs → les effets [spot] ne se relanceraient pas).
      return {
        ...state,
        activeSpot: state.activeSpot ? { ...state.activeSpot } : null,
        practice: true,
        screen: "level",
      };

    case "PRACTICE_DONE":
      // Fin d'un rejouer : on met à jour la grille de revue + les étoiles de
      // CETTE tentative pour l'affichage, mais RIEN n'est crédité.
      return {
        ...state,
        practice: false,
        lastReward: state.lastReward
          ? { ...state.lastReward, stars: action.stars, playerHands: action.playerHands || null, practice: true }
          : null,
        screen: "reward",
      };

    case "SET_DIFFICULTY":
      return { ...state, difficulty: action.difficulty };

    case "SET_PREF":
      // Préférence d'affichage persistée → devient le défaut au prochain chargement.
      return { ...state, prefs: { ...state.prefs, [action.key]: action.value } };

    case "CLAIM_MISSION": {
      // Récompense (gems/chips) portée par l'action ; le store garde juste
      // l'intégrité : une mission déjà réclamée ne crédite jamais 2×.
      if (state.claimedMissions.includes(action.id)) return state;
      return {
        ...state,
        claimedMissions: [...state.claimedMissions, action.id],
        economy: {
          ...state.economy,
          gems: state.economy.gems + (action.gems || 0),
          chips: state.economy.chips + (action.chips || 0),
        },
      };
    }

    case "SET_HEAT":
      return { ...state, heat: clampHeat(action.value) };

    case "BUY_UPGRADE": {
      // Boutique : dépense de gems sur un upgrade permanent. Le coût est
      // porté par l'action ; le store garde l'intégrité (assez de gems).
      if (state.economy.gems < action.cost) return state;
      const lvl = (state.shop.upgrades[action.id] || 0) + 1;
      return {
        ...state,
        economy: { ...state.economy, gems: state.economy.gems - action.cost },
        shop: { ...state.shop, upgrades: { ...state.shop.upgrades, [action.id]: lvl } },
      };
    }

    case "RUN_REWARD":
      // Méta-progression du mode Run : les gems survivent au run.
      return {
        ...state,
        economy: {
          ...state.economy,
          gems: state.economy.gems + (action.gems || 0),
          chips: state.economy.chips + (action.chips || 0),
        },
      };

    case "COMPLETE_LEVEL": {
      const { spotId, stars, chips = 0, xp = 0, heat, playerHands = null, guess = null } = action;
      const q = state.quest;
      const p = state.progressions[q];
      const bands = bandsFor(q);
      const band = bands[p.bandIdx];
      const clearedNow = p.clearedInBand + 1;
      const isLastBand = p.bandIdx >= bands.length - 1;

      let bandIdx = p.bandIdx;
      let clearedInBand = clearedNow;
      let graduated = false;
      if (clearedNow >= band.clears && !isLastBand) {
        bandIdx += 1;
        clearedInBand = 0;
        graduated = true;
      } else if (isLastBand) {
        clearedInBand = Math.min(clearedNow, band.clears); // dernière bande = endless, on cape l'affichage
      }
      const maxBandReached = Math.max(p.maxBandReached, bandIdx);
      const best = Math.max(p.stars[spotId] || 0, stars);

      const newProg = {
        bandIdx,
        clearedInBand,
        maxBandReached,
        totalCleared: p.totalCleared + 1,
        stars: { ...p.stars, [spotId]: best },
      };

      // Validation de CATÉGORIE : finir l'échelle 6 (1ʳᵉ bande, p.bandIdx===0)
      // débloque la catégorie suivante (quête dont `requires` pointe sur nous).
      const qdef = QUESTS[q];
      const unlockedCategory =
        graduated && p.bandIdx === 0
          ? Object.values(QUESTS).find((x) => x.requires === q)
          : null;

      // Gems de maîtrise + détection d'un passage de niveau (XP cumulée).
      const gems = gemsFor(stars, graduated);
      const xpAfter = state.economy.xp + xp;
      const leveledUp = levelFromXp(xpAfter) > levelFromXp(state.economy.xp) ? levelFromXp(xpAfter) : null;

      return {
        ...state,
        progressions: { ...state.progressions, [q]: newProg },
        economy: { chips: state.economy.chips + chips, xp: xpAfter, gems: state.economy.gems + gems },
        heat: heat != null ? clampHeat(heat) : state.heat,
        lastReward: {
          spotName: state.activeSpot ? state.activeSpot.name : "",
          stars, chips, xp, gems, leveledUp,
          bandLabel: band.label,
          clearedInBand: graduated ? band.clears : clearedInBand,
          clears: band.clears,
          graduated,
          nextBandLabel: graduated ? bands[bandIdx].label : null,
          // ── Validation de catégorie (Reward enrichi) ──
          categoryLabel: qdef.label, // "BTN" / "SB" / "BB" / "MTT"
          sector: qdef.sector, // "spin" | "mtt"
          echelleDone: band.echelle || null, // 6/8/10 (spin) ; null (mtt)
          unlockedCategoryLabel: unlockedCategory ? unlockedCategory.label : null,
          playerHands, // grille telle que remplie par le joueur
          guess, // { tier, error, sign } | null
        },
        screen: "reward",
      };
    }

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

// Fusionne les progressions sauvées avec le SCHÉMA courant (tolère un vieux
// save : quêtes ajoutées → vierges, retirées → ignorées, bandIdx clampé).
function mergeProgressions(saved) {
  const out = {};
  for (const q of Object.keys(QUESTS)) {
    const p = saved && saved[q];
    out[q] =
      p && typeof p.bandIdx === "number"
        ? {
            bandIdx: Math.max(0, Math.min(p.bandIdx, QUESTS[q].bands.length - 1)),
            clearedInBand: p.clearedInBand || 0,
            maxBandReached: p.maxBandReached || 0,
            totalCleared: p.totalCleared || 0,
            stars: p.stars && typeof p.stars === "object" ? p.stars : {},
          }
        : PROG0();
  }
  return out;
}

// Charge l'état depuis localStorage (défensif). Reprend sur la carte si un
// avatar est déjà choisi, sinon démarre au boot. heat/spot non repris.
function loadState() {
  try {
    const raw = typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const saved = JSON.parse(raw);
    const hasAvatar = !!(saved.player && saved.player.avatarId);
    return {
      ...initialState,
      player: saved.player && typeof saved.player === "object" ? saved.player : initialState.player,
      quest: QUESTS[saved.quest] ? saved.quest : initialState.quest,
      progressions: mergeProgressions(saved.progressions),
      economy: { ...initialState.economy, ...(saved.economy || {}) },
      difficulty: ["normal", "difficile", "hardcore"].includes(saved.difficulty) ? saved.difficulty : "normal",
      claimedMissions: Array.isArray(saved.claimedMissions) ? saved.claimedMissions : [],
      shop: saved.shop && saved.shop.upgrades && typeof saved.shop.upgrades === "object" ? saved.shop : { upgrades: {} },
      prefs: { ...initialState.prefs, ...(saved.prefs || {}) },
      screen: hasAvatar ? "map" : "boot",
    };
  } catch {
    return initialState;
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, loadState);
  // Sauvegarde la tranche durable à chaque changement pertinent.
  useEffect(() => {
    persist(state);
  }, [state.player, state.quest, state.progressions, state.economy, state.difficulty, state.claimedMissions, state.shop, state.prefs]);
  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      {children}
    </StoreContext.Provider>
  );
}

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore doit être utilisé dans <StoreProvider>");
  return ctx;
};

export const currentProgression = (state) => state.progressions[state.quest];
export const currentBand = (state) => bandsFor(state.quest)[currentProgression(state).bandIdx];
export { QUESTS, bandsFor };

// Sérialise la tranche durable dans localStorage. Après RESET (avatar=null,
// progressions vierges), réécrit un save « propre » → prochain chargement = boot.
export const persist = (state) => {
  try {
    if (typeof localStorage === "undefined") return;
    const slice = {};
    for (const k of PERSIST_KEYS) slice[k] = state[k];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slice));
  } catch {
    // quota plein / mode privé : on ignore (jeu reste jouable en mémoire).
  }
};
