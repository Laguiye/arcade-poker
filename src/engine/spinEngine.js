// ─────────────────────────────────────────────────────────────
// engine/spinEngine.js — SIMULATEUR de Spin & Go (3-max), logique PURE.
//
// Une vraie partie : 3 joueurs à 25bb, blindes hyper-turbo qui montent,
// distribution réelle des cartes, jusqu'à ce qu'un seul joueur ait tous
// les jetons. Modèle PRÉFLOP "Design A" (résolution all-in only) :
//   • first-in ≥ 15bb eff : FOLD / RAISE 2bb / TAPIS (plans 4 classes)
//   • first-in < 15bb     : TAPIS / FOLD (jam/fold pur, comme avant)
//   • face à un raise     : FOLD / RE-TAPIS (jamais de flat-call/limp)
//   • face à un tapis     : CALL / FOLD
// Toute feuille = pot non disputé OU all-in → abattage sur un vrai
// board. Abstraction assumée : aucun postflop joué.
//
// Deux usages :
//   • FULL-AUTO (spectateur) : playHand(state) / playToEnd(state).
//   • PAS-À-PAS (jouable)     : dealHand → stepAuto(heroId) [pause sur
//     la décision de Hero] → applyHero → stepAuto → resolveHand.
//
// RÉUTILISE : ranges Nash de data/spots.js (spotById) + score7() de
// engine/equity.js (abattage sur vrai board → side pots multiway).
// Zéro dépendance React.
// ─────────────────────────────────────────────────────────────

import { RANKS } from "./poker.js";
import { score7 } from "./equity.js";
import { nashRange } from "../data/nashRanges.js";
import { firstInPlan, inRejam, rejamScenario, RAISE_MIN_BB, RAISE_TO_BB } from "../data/raiseRanges.js";
import { randomProfileId, profileOf } from "../data/villainProfiles.js";

// Barème hyper-turbo (jetons). 25bb au départ = 500 jetons / blindes 10-20.
export const BLINDS = [
  { sb: 10, bb: 20 }, { sb: 15, bb: 30 }, { sb: 20, bb: 40 }, { sb: 30, bb: 60 },
  { sb: 40, bb: 80 }, { sb: 50, bb: 100 }, { sb: 75, bb: 150 }, { sb: 100, bb: 200 },
  { sb: 150, bb: 300 }, { sb: 200, bb: 400 }, { sb: 300, bb: 600 }, { sb: 400, bb: 800 },
  { sb: 600, bb: 1200 }, { sb: 1000, bb: 2000 },
];
const LEVEL_EVERY = 5; // mains par palier de blindes (hyper-turbo)
export const START_STACK = 500; // 25bb à 10-20

// ── Cartes ───────────────────────────────────────────────────
const makeDeck = () => {
  const d = [];
  for (let i = 0; i < 13; i++) for (let s = 0; s < 4; s++) d.push({ idx: i, suit: s });
  return d;
};
const shuffle = (a) => {
  for (let k = a.length - 1; k > 0; k--) {
    const r = Math.floor(Math.random() * (k + 1));
    [a[k], a[r]] = [a[r], a[k]];
  }
  return a;
};
// Notation grille d'une main de 2 cartes (idx 0=A..12=2). Carte haute = idx bas.
const notation = (c1, c2) => {
  const [a, b] = c1.idx <= c2.idx ? [c1, c2] : [c2, c1];
  if (a.idx === b.idx) return RANKS[a.idx] + RANKS[a.idx];
  return RANKS[a.idx] + RANKS[b.idx] + (a.suit === b.suit ? "s" : "o");
};
const cardStr = (c) => RANKS[c.idx] + "♠♥♦♣"[c.suit];

// ── Décisions préflop via les ranges Nash + profil du joueur ──
// Scénario de CALL Nash face à un agresseur (tapis... ou raise traité
// comme un tapis quand le tapis effectif est sous la zone raise).
export const callScenario = (pos, aggrPos) =>
  pos === "SB" ? "SB_call_vs_BTN" : aggrPos === "SB" ? "BB_call_vs_SB" : "BB_call_vs_BTN";
// Scénario Nash selon la position + s'il fait face à un tapis.
const scenarioFor = (h, id) => {
  if (!h.shoved) return h.posOfSeat[id] === "BTN" ? "BTN_push" : h.posOfSeat[id] === "SB" ? "SB_push" : null;
  return callScenario(h.posOfSeat[id], h.shoverPos);
};
// Le profil DÉCALE le tapis effectif (serré = comme plus profond, station = comme plus court).
const profiledEff = (effBB, profileId, kind) => effBB * (profileOf(profileId)[kind] || 1);

// ── Side pots : répartit les mises selon les contributions ────
function settlePots(contrib, eligible, strength) {
  const won = {};
  const live = contrib.filter((c) => c.amt > 0).map((c) => ({ ...c }));
  const levels = [...new Set(live.map((c) => c.amt))].sort((a, b) => a - b);
  let prev = 0;
  for (const lvl of levels) {
    const layer = lvl - prev;
    const contributors = live.filter((c) => c.amt >= lvl);
    const pot = layer * contributors.length;
    const elig = contributors.filter((c) => eligible.has(c.p)).map((c) => c.p);
    if (pot <= 0) { prev = lvl; continue; }
    if (elig.length === 0) {
      contributors.forEach((c) => (won[c.p] = (won[c.p] || 0) + layer));
    } else {
      const best = Math.max(...elig.map((p) => strength[p]));
      const winners = elig.filter((p) => strength[p] === best);
      const share = Math.floor(pot / winners.length);
      let rem = pot - share * winners.length;
      winners.forEach((p) => { won[p] = (won[p] || 0) + share + (rem > 0 ? 1 : 0); if (rem > 0) rem--; });
    }
    prev = lvl;
  }
  return won;
}

// ── Création de partie ───────────────────────────────────────
// heroId : siège du joueur humain (pas de profil) ; les autres = bots typés.
export function createSpinGame({ startStack = START_STACK, names = ["Joueur 1", "Joueur 2", "Joueur 3"], heroId = null } = {}) {
  return {
    players: names.map((name, i) => ({
      id: i, name, chips: startStack, alive: true,
      profile: i === heroId ? null : randomProfileId(),
    })),
    button: 0, level: 0, handNo: 0, log: [], winner: null, heroId,
  };
}

const aliveIds = (s) => s.players.filter((p) => p.alive).map((p) => p.id);

// Ordre des sièges (ids) dans le sens horaire à partir du bouton, parmi les vivants.
function seatOrder(state) {
  const out = [];
  for (let k = 0; k < state.players.length; k++) {
    const id = (state.button + k) % state.players.length;
    if (state.players[id].alive) out.push(id);
  }
  return out; // [BTN, SB, BB] (3) ou [BTN/SB, BB] (HU)
}

// ── Mise en place d'une main : blindes + distribution ────────
export function dealHand(state) {
  state.handNo += 1;
  state.level = Math.min(BLINDS.length - 1, Math.floor((state.handNo - 1) / LEVEL_EVERY));
  const { sb, bb } = BLINDS[state.level];
  const live = aliveIds(state);

  const seats = seatOrder(state);
  const hu = seats.length === 2;
  const posOfSeat = {};
  if (hu) { posOfSeat[seats[0]] = "SB"; posOfSeat[seats[1]] = "BB"; } // bouton = SB en HU
  else { posOfSeat[seats[0]] = "BTN"; posOfSeat[seats[1]] = "SB"; posOfSeat[seats[2]] = "BB"; }
  const sbId = hu ? seats[0] : seats[1];
  const bbId = hu ? seats[1] : seats[2];
  const actOrder = hu ? [seats[0], seats[1]] : [seats[0], seats[1], seats[2]];

  const start = {}, committed = {}, folded = {}, allIn = {}, actions = {};
  live.forEach((id) => { start[id] = state.players[id].chips; committed[id] = 0; folded[id] = false; allIn[id] = false; });

  const post = (id, amt) => {
    const put = Math.min(state.players[id].chips, amt);
    committed[id] += put; state.players[id].chips -= put;
    if (state.players[id].chips === 0) allIn[id] = true;
  };
  post(sbId, sb); post(bbId, bb);

  const deck = shuffle(makeDeck());
  const hole = {}, handStr = {};
  live.forEach((id) => { hole[id] = [deck.pop(), deck.pop()]; handStr[id] = notation(hole[id][0], hole[id][1]); });

  const acted = {};
  live.forEach((id) => { acted[id] = false; });

  return {
    sb, bb, hu, seats, posOfSeat, sbId, bbId, actOrder, live,
    start, committed, folded, allIn, actions, deck, hole, handStr,
    currentBet: Math.max(committed[sbId], committed[bbId]),
    shoved: false, shoverPos: null, shoverId: null,
    raised: false, raiserPos: null, raiserId: null,
    acted, turnIdx: -1, seq: [],
  };
}

// Prochain joueur qui doit parler (ordre des sièges après turnIdx) :
// ni foldé, ni all-in, et (n'a pas encore agi OU fait face à une mise
// supérieure à la sienne — action ré-ouverte par un raise/tapis).
function nextToAct(h) {
  const n = h.actOrder.length;
  for (let k = 1; k <= n; k++) {
    const id = h.actOrder[(h.turnIdx + k) % n];
    if (h.folded[id] || h.allIn[id]) continue;
    if (!h.acted[id] || h.committed[id] < h.currentBet) return id;
  }
  return null;
}

// Options d'un joueur dans la situation courante (Design A).
function optionsFor(state, h, id) {
  const toCall = h.currentBet - h.committed[id];
  if (h.shoved) return ["call", "fold"];
  if (h.raised) return ["shove", "fold"]; // resteal : re-tapis ou fold (jamais de flat-call)
  // first-in
  if (h.posOfSeat[id] === "BB" && toCall === 0) return ["check"]; // walk : la BB garde les blindes
  const raiseCost = RAISE_TO_BB * h.bb - h.committed[id];
  if (h.start[id] / h.bb >= RAISE_MIN_BB && state.players[id].chips > raiseCost)
    return ["shove", "raise", "fold"]; // zone raise (≥ 15bb)
  return ["shove", "fold"];
}

// Décision automatique (vilains) : plans/ranges décalés par le profil.
function autoAction(state, h, id) {
  const options = optionsFor(state, h, id);
  if (options[0] === "check") return "check";
  const profileId = state.players[id].profile;
  const hand = h.handStr[id];

  if (h.shoved) {
    const eff = profiledEff(Math.min(h.start[id], h.currentBet) / h.bb, profileId, "call");
    // Le raiseur face au re-tapis : sa CLASSE de plan décide (raise_call →
    // call), au tapis EFFECTIF du shove (re-tapis court → on paie plus large).
    if (h.actions[id] === "raise") {
      const plan = firstInPlan(hand, eff, h.posOfSeat[id]);
      if (plan === "raise_call") return "call";
      if (plan === "raise_fold") return "fold";
      // classe jam/fold ou eff sous la zone → range de call Nash ci-dessous
    }
    return nashRange(eff, scenarioFor(h, id)).has(hand) ? "call" : "fold";
  }

  if (h.raised) {
    // Resteal : re-tapis ou fold. À court tapis (sous la zone), le raise
    // vaut un tapis → range de CALL Nash (large) plutôt que resteal.
    const effBB = Math.min(h.start[id], h.start[h.raiserId]) / h.bb;
    if (effBB < RAISE_MIN_BB) {
      const eff = profiledEff(effBB, profileId, "call");
      return nashRange(eff, callScenario(h.posOfSeat[id], h.raiserPos)).has(hand) ? "shove" : "fold";
    }
    const eff = profiledEff(effBB, profileId, "resteal");
    return inRejam(hand, eff, rejamScenario(h.posOfSeat[id], h.raiserPos)) ? "shove" : "fold";
  }

  // First-in : plan 4 classes en zone raise, sinon jam/fold Nash pur.
  const eff = profiledEff(h.start[id] / h.bb, profileId, "push");
  if (options.includes("raise")) {
    const plan = firstInPlan(hand, eff, h.posOfSeat[id]);
    if (plan === "jam") return "shove";
    if (plan === "raise_call" || plan === "raise_fold") return "raise";
    if (plan === "fold") return "fold";
    // plan null (profil décalé sous la zone) → retombe en jam/fold pur
  }
  return nashRange(eff, scenarioFor(h, id)).has(hand) ? "shove" : "fold";
}

// Applique une action (mute h + tapis du state).
function applyAction(state, h, id, action) {
  h.actions[id] = action;
  h.seq.push({ id, action });
  h.acted[id] = true;
  h.turnIdx = h.actOrder.indexOf(id);
  if (action === "fold") { h.folded[id] = true; }
  else if (action === "raise") {
    const put = Math.min(state.players[id].chips, RAISE_TO_BB * h.bb - h.committed[id]);
    h.committed[id] += put; state.players[id].chips -= put;
    if (state.players[id].chips === 0) h.allIn[id] = true; // garde-fou (hors zone en théorie)
    h.currentBet = Math.max(h.currentBet, h.committed[id]);
    h.raised = true; h.raiserPos = h.posOfSeat[id]; h.raiserId = id;
  } else if (action === "shove") {
    const put = state.players[id].chips; // tout le tapis restant
    h.committed[id] += put; state.players[id].chips = 0; h.allIn[id] = true;
    h.currentBet = Math.max(h.currentBet, h.committed[id]);
    h.shoved = true; h.shoverPos = h.posOfSeat[id]; h.shoverId = id;
  } else if (action === "call") {
    const toCall = h.currentBet - h.committed[id];
    const put = Math.min(state.players[id].chips, toCall);
    h.committed[id] += put; state.players[id].chips -= put;
    if (state.players[id].chips === 0) h.allIn[id] = true;
  }
  // 'check' → rien à miser.
}

// Joue les vilains jusqu'au tour de Hero (pause) ou jusqu'à la fin de
// l'enchère (un raise/tapis RÉ-OUVRE l'action → Hero peut devoir parler
// deux fois dans la même main : raise puis face au re-tapis).
// Renvoie { await:true, id, options, ctxType, … } si Hero doit agir,
// sinon { await:false }. heroId=null → tout en auto.
export function stepAuto(state, h, heroId = null) {
  let id;
  while ((id = nextToAct(h)) != null) {
    if (id === heroId) {
      const options = optionsFor(state, h, id);
      if (options[0] === "check") { applyAction(state, h, id, "check"); continue; }
      const ctxType = h.shoved ? "vs_shove" : h.raised ? "vs_raise" : "first_in";
      const eff = ctxType === "vs_shove" ? Math.min(h.start[id], h.currentBet)
        : ctxType === "vs_raise" ? Math.min(h.start[id], h.start[h.raiserId])
        : h.start[id];
      return {
        await: true, id, options, pos: h.posOfSeat[id],
        toCall: h.currentBet - h.committed[id], hand: h.handStr[id],
        shoved: h.shoved, shoverPos: h.shoverPos,
        raised: h.raised, raiserPos: h.raiserPos,
        ctxType, afterRaise: h.actions[id] === "raise",
        scenario: ctxType === "vs_raise" ? callScenario(h.posOfSeat[id], h.raiserPos) : scenarioFor(h, id),
        stackBB: Math.max(1, Math.round(eff / h.bb)),
      };
    }
    applyAction(state, h, id, autoAction(state, h, id));
  }
  return { await: false };
}

// Applique la décision de Hero (le joueur en attente) puis avance.
export function applyHero(state, h, action) {
  applyAction(state, h, nextToAct(h), action);
}

// Équité de Hero à l'abattage (Monte Carlo sur les VRAIES cartes connues des
// contendants) — pour le désamorçage de variance. Indépendant du board réel.
function heroEquityAtShowdown(heroId, contenders, hole, N = 700) {
  const used = new Set();
  contenders.forEach((id) => hole[id].forEach((c) => used.add(c.idx * 4 + c.suit)));
  const pool = [];
  for (let i = 0; i < 52; i++) if (!used.has(i)) pool.push({ idx: Math.floor(i / 4), suit: i % 4 });
  let acc = 0;
  for (let n = 0; n < N; n++) {
    const board = [], taken = new Set();
    while (board.length < 5) { const r = Math.floor(Math.random() * pool.length); if (!taken.has(r)) { taken.add(r); board.push(pool[r]); } }
    const scores = contenders.map((id) => ({ id, s: score7([...hole[id], ...board]) }));
    const mx = Math.max(...scores.map((x) => x.s));
    const top = scores.filter((x) => x.s === mx);
    if (top.some((x) => x.id === heroId)) acc += 1 / top.length;
  }
  return acc / N;
}

// Abattage + répartition (side pots) + éliminations + log + rotation bouton.
export function resolveHand(state, h) {
  const contenders = h.live.filter((id) => !h.folded[id]);
  const pot = h.live.reduce((s, id) => s + h.committed[id], 0);
  const contrib = h.live.map((id) => ({ p: id, amt: h.committed[id] }));
  const eligible = new Set(contenders);

  let board = [];
  const strength = {};
  let result;
  if (contenders.length === 1) {
    const w = contenders[0];
    state.players[w].chips += pot; // récupère sa mise + dead money
    result = { type: "uncontested", winners: [w] };
  } else {
    board = [h.deck.pop(), h.deck.pop(), h.deck.pop(), h.deck.pop(), h.deck.pop()];
    contenders.forEach((id) => { strength[id] = score7([...h.hole[id], ...board]); });
    const gains = settlePots(contrib, eligible, strength);
    Object.entries(gains).forEach(([p, amt]) => { state.players[+p].chips += amt; });
    const best = Math.max(...contenders.map((id) => strength[id]));
    result = { type: "showdown", winners: contenders.filter((id) => strength[id] === best) };
  }

  // Désamorçage de variance : équité de Hero à l'abattage all-in + tag.
  let allin = null, varianceTag = null;
  if (state.heroId != null && result.type === "showdown" && contenders.includes(state.heroId)) {
    const eq = heroEquityAtShowdown(state.heroId, contenders, h.hole);
    const heroWon = result.winners.includes(state.heroId);
    if (eq > 0.58 && !heroWon) varianceTag = "bad_beat";
    else if (eq < 0.42 && heroWon) varianceTag = "lucky_variance";
    allin = { heroEquity: eq, outcome: heroWon ? "won" : "lost" };
  }

  state.players.forEach((p) => { if (p.alive && p.chips <= 0) p.alive = false; });
  const live = aliveIds(state);

  const entry = {
    hand: state.handNo, level: state.level, blinds: `${h.sb}/${h.bb}`,
    bb: h.bb, pos: h.posOfSeat, actions: { ...h.actions },
    seq: [...h.seq], raised: h.raised ? h.raiserPos : null,
    hole: Object.fromEntries(contenders.map((id) => [id, h.hole[id].map(cardStr).join("")])),
    board: board.map(cardStr).join(" "), pot, result, allin, varianceTag,
    stacks: state.players.map((p) => p.chips),
  };
  state.log.push(entry);

  if (live.length <= 1) { state.winner = live[0] ?? null; }
  else {
    do { state.button = (state.button + 1) % state.players.length; }
    while (!state.players[state.button].alive);
  }
  return entry;
}

// ── Wrapper full-auto (spectateur / playToEnd) : Hero = personne ──
export function playHand(state) {
  if (state.winner != null) return state;
  if (aliveIds(state).length <= 1) { state.winner = aliveIds(state)[0] ?? null; return state; }
  const h = dealHand(state);
  stepAuto(state, h, null);
  resolveHand(state, h);
  return state;
}

export function playToEnd(state, maxHands = 1000) {
  while (state.winner == null && state.handNo < maxHands) playHand(state);
  if (state.winner == null) {
    const top = state.players.reduce((a, b) => (b.chips > a.chips ? b : a));
    state.winner = top.id;
  }
  return state;
}
