// ─────────────────────────────────────────────────────────────
// data/coach.js — COACH EN DIRECT (brief §5 + extension RAISE Design A).
// Évalue la décision de Hero vs les ranges (Nash push/fold + partitions
// raise) et produit un message court en FR. Messages générés LOCALEMENT
// (pas de LLM) — déterministes, hors-ligne.
//
// Jugement en PLANS, 3 niveaux :
//   ok  ✓ = optimal        meh ~ = jouable mais sous-optimal
//   bad ✗ = erreur (porte une catégorie `cat` pour le récap)
// 3 contextes : first_in (fold/raise/tapis) · vs_raise (fold/re-tapis) ·
// vs_shove (call/fold — cold ou après son propre raise).
//
// Règle d'or (brief §3) : ne s'appuie QUE sur des infos légitimes
// (cartes de Hero, position, stack, profil AFFICHÉ du vilain, actions
// visibles). Jamais les cartes cachées.
// ─────────────────────────────────────────────────────────────

import { nashRange, nashBucket, COACH_ZONE, VARIANCE } from "./nashRanges.js";
import { firstInPlan, inRejam, rejamScenario, RAISE_MIN_BB } from "./raiseRanges.js";
import { profileOf } from "./villainProfiles.js";

// Scénario Nash depuis le contexte de décision de Hero.
export function heroScenario(pos, shoved, shoverPos) {
  if (!shoved) return pos === "BTN" ? "BTN_push" : pos === "SB" ? "SB_push" : null; // BB folded-to = walk
  if (pos === "SB") return "SB_call_vs_BTN";
  return shoverPos === "SB" ? "BB_call_vs_SB" : "BB_call_vs_BTN";
}

// Action attendue (Nash jam/fold pur) : 'shove'|'call' si la main est dans la range.
export function nashAction(hand, bb, scenario) {
  if (!scenario) return "check";
  const agg = scenario.includes("push") ? "shove" : "call";
  return nashRange(bb, scenario).has(hand) ? agg : "fold";
}

// Scénario de call quand une relance vaut un tapis (court) / cold call.
const callScen = (pos, aggrPos) =>
  pos === "SB" ? "SB_call_vs_BTN" : aggrPos === "SB" ? "BB_call_vs_SB" : "BB_call_vs_BTN";

// Labels courts des plans/actions (badge 💡 + récap).
export const PLAN_LABEL = {
  jam: "TAPIS", raise_call: "RAISE (call si re-tapis)", raise_fold: "RAISE (fold si re-tapis)",
  fold: "FOLD", shove: "TAPIS", call: "CALL", check: "CHECK",
};

// Recommandation pré-action (badge 💡) depuis le contexte de décision
// renvoyé par stepAuto : { hand, stackBB, pos, ctxType, afterRaise,
// raiserPos, shoverPos }.
export function recommend(d) {
  const { hand, stackBB: bb, pos } = d;
  if (d.ctxType === "vs_raise") {
    const should = bb < RAISE_MIN_BB
      ? nashRange(bb, callScen(pos, d.raiserPos)).has(hand)
      : inRejam(hand, bb, rejamScenario(pos, d.raiserPos));
    return { action: should ? "shove" : "fold", label: should ? "RE-TAPIS" : "FOLD" };
  }
  if (d.ctxType === "vs_shove") {
    if (d.afterRaise) {
      const plan = firstInPlan(hand, bb, pos);
      if (plan === "raise_call") return { action: "call", label: "CALL" };
      if (plan === "raise_fold") return { action: "fold", label: "FOLD" };
    }
    const a = nashAction(hand, bb, heroScenario(pos, true, d.shoverPos));
    return { action: a, label: a === "call" ? "CALL" : "FOLD" };
  }
  // first-in : plan 4 classes en zone raise, sinon jam/fold pur
  const plan = firstInPlan(hand, bb, pos);
  if (plan) return { action: plan, label: PLAN_LABEL[plan] };
  const a = nashAction(hand, bb, heroScenario(pos, false, null));
  return { action: a, label: PLAN_LABEL[a] || "FOLD" };
}

// Rappel de zone (court critique / push-fold pur / zone raise / deep).
function zoneNote(bb, pos) {
  if (bb < 5) return COACH_ZONE.critical_under_5bb[pos] || "";
  if (bb < RAISE_MIN_BB) return COACH_ZONE.push_fold_pure_5_15bb.reminder;
  if (bb <= 25) return "Zone raise (15–25bb) : vol (raise/fold), piège (raise/call) ou tapis — le re-tapis punit les voleurs.";
  return "Au-dessus de 25bb, plus d'open-jam : tout passe par le raise 2bb. Committé = raise/call, vol = raise/fold.";
}

// Feedback post-action. ctx : { hand, pos, bb, ctxType, afterRaise,
// shoved, shoverPos, raised, raiserPos, action, villainProfileId }
// → { grade, correct, expected, cat, message, zone }
export function coachFeedback(ctx) {
  const H = ctx.hand, bb = ctx.bb, pos = ctx.pos, act = ctx.action;
  const ctxType = ctx.ctxType || (ctx.shoved ? "vs_shove" : "first_in");
  const prof = ctx.villainProfileId ? profileOf(ctx.villainProfileId) : null;

  let grade = "ok", expected, msg, cat = null;

  if (ctxType === "first_in") {
    const plan = firstInPlan(H, bb, pos);
    if (plan) {
      expected = plan;
      if (act === "raise") {
        if (plan === "raise_call") msg = `Raise — et tu es committé : si on te re-tapis, tu paies. ${H} domine leur range.`;
        else if (plan === "raise_fold") msg = `Raise-vol — 2bb pour prendre les blindes, fold assumé si re-tapis.`;
        else if (plan === "jam") { grade = "meh"; msg = `Jouable, mais ${H} préfère le TAPIS direct à ${bb}bb — main qui déteste le re-tapis.`; }
        else { grade = "bad"; cat = "Vol trop large"; msg = `${H} est un FOLD en ${pos} à ${bb}bb — vol trop large, même pour 2bb.`; }
      } else if (act === "shove") {
        if (plan === "jam") msg = `Bon tapis — ${H} se jam direct en ${pos} à ${bb}bb.`;
        else if (plan === "raise_call") { grade = "meh"; msg = `Tapis jouable, mais un RAISE gagne plus : tu gardes des mains dominées dans le coup.`; }
        else if (nashRange(bb, heroScenario(pos, false, null)).has(H)) {
          grade = "meh"; msg = `OK en pur push/fold, mais pourquoi risquer ${bb}bb quand un raise à 2bb vole aussi bien ?`;
        } else { grade = "bad"; cat = "Push trop large"; msg = `${H} est ${plan === "raise_fold" ? "un raise/FOLD" : "un FOLD"} en ${pos} — tapis beaucoup trop cher.`; }
      } else { // fold
        if (plan === "fold") msg = `Bon fold — ${H} est hors range d'open en ${pos} à ${bb}bb.`;
        else if (plan === "raise_fold") { grade = "bad"; cat = "Vol manqué (raise/fold)"; msg = `Vol manqué — ${H} se raise/fold en ${pos} : 2bb pour ramasser les blindes.`; }
        else { grade = "bad"; cat = "Fold trop serré"; msg = `${H} se joue en ${pos} à ${bb}bb (${plan === "jam" ? "tapis direct" : "raise/call"}) — fold trop serré.`; }
      }
    } else {
      // hors zone (< 15bb) → jam/fold pur, modèle historique
      expected = nashAction(H, bb, heroScenario(pos, false, null));
      if (act === expected) msg = expected === "shove" ? `Bonne décision — ${H} se push en ${pos} à ${bb}bb.` : `Bon fold — ${H} est hors range en ${pos} à ${bb}bb.`;
      else if (expected === "shove") { grade = "bad"; cat = "Fold trop serré — push manqué"; msg = `${H} se PUSH en ${pos} à ${bb}bb — fold trop serré.`; }
      else { grade = "bad"; cat = "Push trop large"; msg = `${H} est un FOLD en ${pos} à ${bb}bb — push trop large.`; }
    }
  } else if (ctxType === "vs_raise") {
    const short = bb < RAISE_MIN_BB; // sous la zone, la relance vaut un tapis
    const should = short
      ? nashRange(bb, callScen(pos, ctx.raiserPos)).has(H)
      : inRejam(H, bb, rejamScenario(pos, ctx.raiserPos));
    expected = should ? "shove" : "fold";
    if (act === expected) msg = should
      ? (short ? `Bon tapis — à ${bb}bb, sa relance vaut un all-in : ${H} paie.` : `Bon re-tapis — ${H} punit la relance ${ctx.raiserPos} à ${bb}bb.`)
      : `Bon fold — ${H} ne re-tapis pas face à la relance ${ctx.raiserPos}.`;
    else if (should) { grade = "bad"; cat = "Re-tapis manqué vs relance"; msg = `${H} se RE-TAPIS face à la relance ${ctx.raiserPos} à ${bb}bb — fold trop serré.`; }
    else { grade = "bad"; cat = "Re-tapis trop large"; msg = `${H} est un FOLD face à cette relance — re-tapis trop large à ${bb}bb.`; }
  } else {
    // vs_shove : cold, ou après son propre raise (la classe du plan décide)
    if (ctx.afterRaise) {
      const plan = firstInPlan(H, bb, pos);
      const should = plan === "raise_call" ? true
        : plan === "raise_fold" ? false
        : nashRange(bb, callScen(pos, ctx.shoverPos)).has(H); // classe jam/fold ou court → Nash
      expected = should ? "call" : "fold";
      if (act === expected) msg = should
        ? `Committé — ${H} a raise pour payer ce re-tapis. Bon call.`
        : `Vol raté, bien lâché — tu ne perds que 2bb au lieu de ${bb}.`;
      else if (should) { grade = "bad"; cat = "Fold d'une main committée"; msg = `${H} raise pour CALLER le re-tapis — en foldant tu laisses 2bb morts avec la main devant.`; }
      else { grade = "bad"; cat = "Call du re-tapis trop large"; msg = `${H} était un raise/FOLD — payer ${bb}bb ici brûle ton vol.`; }
    } else {
      expected = nashAction(H, bb, heroScenario(pos, true, ctx.shoverPos));
      if (act === expected) msg = expected === "call" ? `Bon call — ${H} suit le tapis à ${bb}bb.` : `Bon fold — ${H} ne suit pas ce tapis à ${bb}bb.`;
      else if (expected === "call") { grade = "bad"; cat = "Fold trop serré — call manqué"; msg = `${H} doit SUIVRE le tapis à ${bb}bb — fold trop serré.`; }
      else { grade = "bad"; cat = "Call trop large"; msg = `${H} est un FOLD ici à ${bb}bb — call trop large.`; }
    }
  }

  // Note de profil (légitime : profil AFFICHÉ de l'adversaire pertinent).
  let profNote = "";
  if (prof && prof.id !== "reg") {
    if (ctxType === "vs_raise")
      profNote = prof.id === "nit"
        ? ` ${prof.emoji} ${prof.name} : sa relance est serrée — re-tapis moins.`
        : ` ${prof.emoji} ${prof.name} : sa relance est large — re-tapis ta value.`;
    else if (ctxType === "first_in" && firstInPlan(H, bb, pos))
      profNote = prof.id === "nit"
        ? ` ${prof.emoji} ${prof.name} : il fold large — élargis tes vols (raise/fold).`
        : ` ${prof.emoji} ${prof.name} : il ne lâche rien — vole moins, joue ta value.`;
    else
      profNote = prof.id === "nit"
        ? ` ${prof.emoji} ${prof.name} : il fold large — tu peux serrer tes calls / élargir tes push.`
        : ` ${prof.emoji} ${prof.name} : il call large et ne bluffe pas — value, pas de bluff.`;
  }

  return { grade, correct: grade === "ok", expected, cat, message: msg + profNote, zone: zoneNote(bb, pos) };
}

// Désamorçage de variance (brief §6) — message depuis le tag posé par le moteur.
export function varianceMessage(tag, equity) {
  if (!tag) return null;
  const m = VARIANCE.messages[tag];
  const pct = Math.round((equity || 0) * 100);
  return { tag, title: m.titre, body: m.body.replace("{equity}", pct) };
}

// Heuristique ICM (brief §7) : un joueur en danger (< 6bb) ET Hero = stack moyen.
// `alive` = [{ id, chips }] des joueurs encore en lice. Renvoie un message ou null.
export function icmAlert(alive, heroId, bb) {
  if (alive.length < 3) return null; // notion de "stack moyen" → 3 joueurs
  const hero = alive.find((p) => p.id === heroId);
  if (!hero) return null;
  const chips = alive.map((p) => p.chips).sort((a, b) => a - b);
  const isMiddle = hero.chips === chips[1]; // ni le plus court ni le chip leader
  const shortInDanger = alive.some((p) => p.id !== heroId && p.chips < 6 * bb);
  if (isMiddle && shortInDanger) return "ICM — laisse le chip leader presser le court stack. Évite les confrontations marginales.";
  return null;
}

export { nashBucket };
