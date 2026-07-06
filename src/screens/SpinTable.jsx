import React, { useRef, useState, useEffect } from "react";
import { useStore } from "../state/store.jsx";
import { createSpinGame, dealHand, stepAuto, applyHero, resolveHand, BLINDS } from "../engine/spinEngine.js";
import { coachFeedback, recommend, varianceMessage, icmAlert } from "../data/coach.js";
import { profileOf } from "../data/villainProfiles.js";

// ─────────────────────────────────────────────────────────────
// screens/SpinTable.jsx — Spin & Go JOUABLE, façon table Winamax.
//
// Tu es « Toi » (siège 0, en bas). À ton tour tu décides — first-in :
// TAPIS / RAISE 2BB (≥ 15bb) / FOLD ; face à une relance : RE-TAPIS /
// FOLD ; face à un tapis : CALL / FOLD. Un raise ré-ouvre l'enchère →
// tu peux avoir DEUX décisions dans la même main (raise puis re-tapis).
// Les 2 bots suivent les plans/ranges Nash. Coach 3 niveaux (✓/~/✗).
// ─────────────────────────────────────────────────────────────

const HERO = 0;
const NAMES = ["Toi", "Bot A", "Bot B"];
const SEAT_POS = [
  { bottom: 2, left: "50%", tx: "-50%", betSide: "top" }, // Toi (bas)
  { top: 8, left: 8, betSide: "bottom" },
  { top: 8, right: 8, betSide: "bottom" },
];
const ACT_LABEL = { shove: "TAPIS", raise: "RAISE", call: "CALL", fold: "FOLD", check: "CHECK" };
const ACT_COLOR = { shove: "#f5a83a", raise: "#4ade80", call: "#3b82f6", fold: "#6b7088", check: "#8b90a4" };
const BTN_LABEL = (o, d) => (o === "shove" ? (d.raised ? "RE-TAPIS" : "TAPIS") : o === "raise" ? "RAISE 2BB" : o === "call" ? "CALL" : "FOLD");

const parseCards = (str) => (str ? str.match(/.{2}/gu) || [] : []);
const suitColor = (s) => (s === "♥" || s === "♦" ? "#e0394b" : "#15151c");
const cardStr = (c) => "AKQJT98765432"[c.idx] + "♠♥♦♣"[c.suit];

export default function SpinTable() {
  const { state, dispatch } = useStore();
  const unit = state.prefs.stackUnit; // 'chips' | 'bb'

  const gameRef = useRef(createSpinGame({ names: NAMES, heroId: HERO }));
  const handRef = useRef(null);
  const [phase, setPhase] = useState("idle"); // idle | await | shown
  const [decision, setDecision] = useState(null);
  const [coach, setCoach] = useState(null); // feedback du coach sur ta dernière décision
  const [hint, setHint] = useState(false); // badge conseil pré-action (mode débutant)
  const [variance, setVariance] = useState(null); // popup bad-beat / lucky (auto-dismiss)
  const [auto, setAuto] = useState(false);
  const [recapOpen, setRecapOpen] = useState(false); // récap de session (à la demande)
  // Historique de session (depuis l'ouverture du sim) pour le récap.
  const sessionRef = useRef({ decisions: [], badBeats: 0, lucky: 0, profiles: {} });
  const [, force] = useState(0);
  const bump = () => force((t) => t + 1);

  const g = gameRef.current;
  const last = g.log[g.log.length - 1] || null;
  const over = g.winner != null;
  const lvl = BLINDS[Math.min(g.level, BLINDS.length - 1)];
  const bbNow = lvl.bb;

  const fmt = (chips) => {
    if (unit !== "bb") return chips.toLocaleString("fr-FR");
    const v = chips / bbNow;
    return `${v >= 10 ? Math.round(v) : v.toFixed(1)}bb`;
  };

  const deal = () => {
    if (g.winner != null) return;
    const h = dealHand(g);
    handRef.current = h;
    setCoach(null);
    const r = stepAuto(g, h, HERO);
    if (r.await) { setDecision(r); setPhase("await"); }
    else { resolveHand(g, h); setDecision(null); setPhase("shown"); }
    bump();
  };

  // Profil du vilain pertinent pour le coach (l'agresseur si tu réagis, sinon la BB).
  const relevantVillain = (d, hh) => {
    const target = d.ctxType === "vs_shove" ? d.shoverPos : d.ctxType === "vs_raise" ? d.raiserPos : "BB";
    const e = Object.entries(hh.posOfSeat).find(([, p]) => p === target);
    return e && +e[0] !== HERO ? g.players[+e[0]].profile : null;
  };

  const act = (action) => {
    const d = decision, hh = handRef.current;
    const vp = relevantVillain(d, hh);
    // Coach : évalue ta décision AVANT de résoudre (contexte intact).
    const fb = coachFeedback({
      hand: d.hand, pos: d.pos, bb: d.stackBB, ctxType: d.ctxType, afterRaise: d.afterRaise,
      shoved: d.shoved, shoverPos: d.shoverPos, raised: d.raised, raiserPos: d.raiserPos,
      action, villainProfileId: vp,
    });
    setCoach(fb);
    // Journalise la décision pour le récap de session.
    const s = sessionRef.current;
    s.decisions.push({ n: g.handNo, cards: d.hand, pos: d.pos, bb: d.stackBB, action, expected: fb.expected, grade: fb.grade, correct: fb.correct, cat: fb.cat });
    if (vp) s.profiles[vp] = (s.profiles[vp] || 0) + 1;
    applyHero(g, hh, action);
    const r = stepAuto(g, hh, HERO); // les bots derrière toi…
    if (r.await) { setDecision(r); setPhase("await"); bump(); return; } // …t'ont re-tapis : 2e décision
    resolveHand(g, hh);
    const entry = g.log[g.log.length - 1];
    if (entry && entry.varianceTag === "bad_beat") s.badBeats++;
    if (entry && entry.varianceTag === "lucky_variance") s.lucky++;
    setDecision(null); setPhase("shown"); bump();
  };

  const newGame = () => {
    gameRef.current = createSpinGame({ names: NAMES, heroId: HERO });
    handRef.current = null; setDecision(null); setCoach(null); setAuto(false); setPhase("idle"); bump();
  };

  useEffect(() => { if (phase === "idle" && g.winner == null && g.handNo === 0) deal(); }, []); // eslint-disable-line

  useEffect(() => {
    if (!auto || over) return;
    const t = setTimeout(() => {
      if (phase === "await") act(decision ? (decision.options.includes("check") ? "check" : decision.options[0]) : "fold");
      else if (phase === "shown") deal();
    }, 1100);
    return () => clearTimeout(t);
  }, [auto, phase]); // eslint-disable-line

  // Popup variance (bad-beat / lucky) : une fois par main qualifiante, auto-dismiss.
  useEffect(() => {
    if (phase === "shown" && last && last.varianceTag) {
      setVariance(varianceMessage(last.varianceTag, last.allin.heroEquity));
      const t = setTimeout(() => setVariance(null), 4500);
      return () => clearTimeout(t);
    }
  }, [last && last.hand, phase]); // eslint-disable-line

  const h = handRef.current;
  const heroCards = h && h.hole[HERO] ? h.hole[HERO].map(cardStr) : null;
  const posOf = (id) => (h ? h.posOfSeat[id] : null);
  const actionOf = (id) => (h ? h.actions[id] : null);
  const committedOf = (id) => (h && h.committed[id] != null ? h.committed[id] : 0);
  const isBtn = (id) => { const p = posOf(id); return p === "BTN" || (h && h.hu && p === "SB"); };
  const folded = (id) => actionOf(id) === "fold";
  const wonLast = (id) => phase === "shown" && last && last.result.winners.includes(id);
  const showBoard = phase === "shown" && last && last.board;
  const revealed = (id) => {
    if (id === HERO) return heroCards;
    if (phase === "shown" && last && last.hole[id]) return parseCards(last.hole[id]);
    return null;
  };

  const nameAt = (pos) => {
    const e = Object.entries(h.posOfSeat).find(([, p]) => p === pos);
    return e ? NAMES[+e[0]] : pos;
  };
  const prompt = () => {
    if (phase !== "await" || !decision) return "";
    if (decision.ctxType === "vs_shove")
      return decision.afterRaise
        ? `${nameAt(decision.shoverPos)} sur-tapis par-dessus ta relance — tu suis ?`
        : `Tu es ${decision.pos}. ${nameAt(decision.shoverPos)} fait TAPIS — tu suis ?`;
    if (decision.ctxType === "vs_raise")
      return `Tu es ${decision.pos}. ${nameAt(decision.raiserPos)} relance à 2bb — re-tapis ou fold ?`;
    return `Tu es ${decision.pos}. À toi de parler.`;
  };

  return (
    <div style={S.root}>
      <button style={S.back} onClick={() => dispatch({ type: "GO", screen: "map" })}>← Carte</button>

      <div style={S.head}>
        <span style={S.title}>SPIN &amp; GO</span>
        <div style={S.headRight}>
          <span style={S.meta}>Main {g.handNo || 1} · {lvl.sb}/{lvl.bb}</span>
          <button style={S.unitBtn} title="Récap de session" onClick={() => setRecapOpen(true)}>📋</button>
          <button style={{ ...S.unitBtn, ...(hint ? S.unitBtnOn : {}) }} title="Conseil du coach avant d'agir" onClick={() => setHint((x) => !x)}>💡</button>
          <button style={S.unitBtn} title="Tapis en jetons ou en BB" onClick={() => dispatch({ type: "SET_PREF", key: "stackUnit", value: unit === "bb" ? "chips" : "bb" })}>{unit === "bb" ? "BB" : "🪙"}</button>
        </div>
      </div>

      <div style={S.felt}>
        {/* Pot central + board */}
        <div style={S.center}>
          <div style={S.potChip}><span style={S.potLbl}>POT</span> <b style={S.potVal}>{fmt(potNow(g, h, last, phase))}</b></div>
          <div style={S.board}>
            {showBoard
              ? parseCards(last.board.replace(/ /g, "")).map((c, k) => <Card key={k} c={c} sm />)
              : <span style={S.boardHint}>{phase === "await" ? "à toi de jouer" : phase === "shown" && last && last.result.type === "uncontested" ? "sans abattage" : ""}</span>}
          </div>
        </div>

        {g.players.map((p, i) => {
          const cards = revealed(p.id);
          const a = actionOf(p.id);
          const bet = committedOf(p.id);
          const champ = over && g.winner === p.id;
          const prof = p.id !== HERO && p.profile ? profileOf(p.profile) : null;
          return (
            <div key={p.id} style={{ ...S.seat, ...SEAT_POS[i], transform: SEAT_POS[i].tx ? `translateX(${SEAT_POS[i].tx})` : undefined, opacity: !p.alive ? 0.38 : folded(p.id) ? 0.6 : 1 }}>
              {/* Mise posée devant le joueur (vers le centre), pendant le coup */}
              {phase === "await" && bet > 0 && (
                <div style={{ ...S.bet, ...(SEAT_POS[i].betSide === "top" ? S.betTop : S.betBottom) }}>
                  <span style={S.betDisc} /> {fmt(bet)}
                </div>
              )}

              <div style={S.seatCards}>
                {cards ? cards.map((c, k) => <Card key={k} c={c} hero={p.id === HERO} />)
                  : p.alive && !folded(p.id) && phase !== "shown" ? [0, 1].map((k) => <div key={k} style={S.cardBack} />)
                  : null}
              </div>

              <div title={prof ? `${prof.name} — ${prof.line}` : undefined}
                style={{ ...S.plate, ...(p.id === HERO ? S.plateHero : {}), ...(wonLast(p.id) ? S.plateWin : {}), ...(champ ? S.plateChamp : {}) }}>
                <div style={S.plateTop}>
                  {champ && <span style={S.crown}>👑</span>}
                  {prof && <span style={{ fontSize: 10 }}>{prof.emoji}</span>}
                  <span style={S.pName}>{p.name}</span>
                  {posOf(p.id) && p.alive && <span style={S.posPill}>{posOf(p.id)}</span>}
                  {isBtn(p.id) && p.alive && <span style={S.dealer}>D</span>}
                </div>
                <div style={S.pStack}>{p.alive ? fmt(p.chips) : "ÉLIMINÉ"}</div>
                {prof && <div style={{ ...S.profLine, color: prof.color }}>{prof.name}</div>}
              </div>

              {/* Action préflop (persistante pendant le coup) */}
              {a && p.alive && (
                <div style={{ ...S.actTag, ...(SEAT_POS[i].betSide === "top" ? S.actTagBottom : S.actTagTop), color: ACT_COLOR[a], borderColor: ACT_COLOR[a] + "88" }}>{ACT_LABEL[a]}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bandeau résultat / vainqueur */}
      <div style={S.banner}>
        {over ? (
          <span style={{ color: "#7ee2b8", fontWeight: 800 }}>🏆 {NAMES[g.winner]} remporte la partie ! <span style={S.bannerSub}>({g.handNo} mains)</span></span>
        ) : phase === "await" ? (
          <span>{prompt()}</span>
        ) : phase === "shown" && last ? (
          <span><b>{last.result.winners.map((w) => NAMES[w]).join(" & ")}</b> remporte {last.result.type === "showdown" ? "à l'abattage" : "le coup"}{last.result.winners.includes(HERO) ? " — 👍" : ""}.</span>
        ) : <span style={{ color: "#8b90a4" }}>Nouvelle donne…</span>}
      </div>

      {/* Coach en direct — feedback ✓/~/✗ (reste visible pendant une 2e décision) */}
      {coach && (
        <div style={{ ...S.coach, ...(coach.grade === "ok" ? S.coachOk : coach.grade === "meh" ? S.coachMeh : S.coachErr) }}>
          <span style={S.coachBadge}>{coach.grade === "ok" ? "✓" : coach.grade === "meh" ? "~" : "✗"} COACH</span>
          <span style={S.coachMsg}>{coach.message}</span>
        </div>
      )}

      {/* Signal ICM (court stack en danger + Hero stack moyen) */}
      {phase === "await" && (() => {
        const icm = icmAlert(g.players.filter((p) => p.alive).map((p) => ({ id: p.id, chips: p.chips })), HERO, bbNow);
        return icm ? <div style={S.icm}>⚖️ {icm}</div> : null;
      })()}

      {/* Conseil pré-action (mode débutant 💡) — affiche le PLAN complet */}
      {phase === "await" && hint && decision && (
        <div style={S.hintBadge}>💡 Conseil : <b>{recommend(decision).label}</b></div>
      )}

      {/* Actions */}
      <div style={S.actions}>
        {phase === "await" && decision ? (
          decision.options.map((o) => (
            <button key={o} style={{ ...S.actBtn, ...(o === "shove" ? S.btnShove : o === "raise" ? S.btnRaise : o === "call" ? S.btnCall : S.btnFold) }} onClick={() => act(o)}>
              {BTN_LABEL(o, decision)}
            </button>
          ))
        ) : over ? (
          <button style={{ ...S.actBtn, ...S.btnNext }} onClick={newGame}>↻ Nouvelle partie</button>
        ) : (
          <>
            <button style={{ ...S.actBtn, ...S.btnNext }} onClick={deal}>Main suivante →</button>
            <button style={{ ...S.actBtn, ...S.btnGhost }} onClick={() => setAuto((x) => !x)}>{auto ? "⏸" : "▶"}</button>
          </>
        )}
      </div>

      {/* Récap de session (à la demande) */}
      {recapOpen && <Recap session={sessionRef.current} onClose={() => setRecapOpen(false)} />}

      {/* Popup désamorçage de variance — discret, non bloquant, coin bas */}
      {variance && (
        <div style={{ ...S.variancePop, ...(variance.tag === "bad_beat" ? S.varBad : S.varLucky) }}>
          <div style={S.varTitle}>{variance.tag === "bad_beat" ? "🔵" : "🟡"} {variance.title}</div>
          <div style={S.varBody}>{variance.body}</div>
        </div>
      )}
    </div>
  );
}

// ── Écran récap de session ───────────────────────────────────
// Les catégories d'erreurs viennent du coach (fb.cat) : vol manqué,
// re-tapis trop large, fold d'une main committée, etc.
function Recap({ session, onClose }) {
  const decs = session.decisions;
  const total = decs.length;
  const errs = decs.filter((d) => d.grade === "bad");
  const mehs = decs.filter((d) => d.grade === "meh");
  const acc = total ? Math.round(((total - errs.length - mehs.length) / total) * 100) : 0;
  // Spot prioritaire = catégorie d'erreur la plus fréquente.
  const counts = {};
  errs.forEach((e) => { if (e.cat) counts[e.cat] = (counts[e.cat] || 0) + 1; });
  const priority = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div style={S.recapWrap} onClick={onClose}>
      <div style={S.recap} onClick={(e) => e.stopPropagation()}>
        <div style={S.recapHead}>
          <span style={S.recapTitle}>📋 Récap de session</span>
          <button style={S.recapClose} onClick={onClose}>✕</button>
        </div>

        {total === 0 ? (
          <div style={S.recapEmpty}>Joue quelques mains, puis reviens ici pour ton bilan.</div>
        ) : (
          <>
            <div style={S.recapScore}>
              <div style={{ ...S.scoreBig, color: acc >= 80 ? "#7ee2b8" : acc >= 60 ? "#f5c84a" : "#ef6b5e" }}>{acc}%</div>
              <div style={S.scoreLbl}>décisions optimales · {total - errs.length - mehs.length}/{total}{mehs.length ? ` (+${mehs.length} passables ~)` : ""}</div>
            </div>

            <div style={S.recapStats}>
              <Stat n={total} l="Décisions" />
              <Stat n={errs.length} l="Erreurs" c={errs.length ? "#ef6b5e" : "#7ee2b8"} />
              <Stat n={mehs.length} l="Passables ~" c="#f0e0a8" />
              <Stat n={session.badBeats} l="Bad beats" c="#9fc0e6" />
              <Stat n={session.lucky} l="Variance ✓" c="#f5c84a" />
            </div>

            {priority && (
              <div style={S.recapPriority}>
                <div style={S.recapSub}>🎯 À travailler en priorité</div>
                <div style={S.priorityMsg}>{priority[0]} <span style={S.priorityN}>({priority[1]}×)</span></div>
              </div>
            )}

            {Object.keys(session.profiles).length > 0 && (
              <div style={S.recapProfiles}>
                <div style={S.recapSub}>Profils affrontés</div>
                <div style={S.profRow}>
                  {Object.entries(session.profiles).map(([id, n]) => {
                    const p = profileOf(id);
                    return <span key={id} style={{ ...S.profChip, color: p.color }}>{p.emoji} {p.name} ×{n}</span>;
                  })}
                </div>
              </div>
            )}

            <div style={S.recapSub}>Erreurs à revoir {errs.length > 8 ? "(8 dernières)" : ""}</div>
            {errs.length === 0 ? (
              <div style={S.noErr}>Aucune erreur — jeu Nash parfait. 🎯</div>
            ) : (
              <div style={S.errList}>
                {errs.slice(-8).reverse().map((e, i) => (
                  <div key={i} style={S.errRow}>
                    <span style={S.errHand}>{e.cards}</span>
                    <span style={S.errCtx}>{e.pos} · {e.bb}bb</span>
                    <span style={S.errFix}>tu as {FR(e.action)} → <b style={{ color: "#7ee2b8" }}>{FR(e.expected)}</b></span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
const FR = (a) => ({ shove: "push", call: "call", fold: "fold", check: "check", raise: "raise", jam: "tapis", raise_call: "raise→call", raise_fold: "raise→fold" }[a] || a);
function Stat({ n, l, c }) {
  return <div style={S.statBox}><div style={{ ...S.statN, color: c || "#e7e9f0" }}>{n}</div><div style={S.statL}>{l}</div></div>;
}

function potNow(g, h, last, phase) {
  if (phase === "await" && h) return h.live.reduce((s, id) => s + h.committed[id], 0);
  if (phase === "shown" && last) return last.pot;
  return 0;
}

function Card({ c, sm, hero }) {
  const rank = c.slice(0, c.length - 1);
  const suit = c.slice(-1);
  return (
    <div style={{ ...S.card, ...(sm ? S.cardSm : {}), ...(hero ? S.cardHero : {}) }}>
      <span>{rank}</span>
      <span style={{ color: suitColor(suit) }}>{suit}</span>
    </div>
  );
}

const mono = "'JetBrains Mono', monospace";
const display = "'Bricolage Grotesque', sans-serif";
const S = {
  root: { maxWidth: 560, margin: "0 auto", padding: "16px 0 36px", fontFamily: mono, color: "#e7e9f0" },
  back: { background: "transparent", border: "none", color: "#6b7088", cursor: "pointer", fontFamily: mono, fontSize: 12, marginBottom: 8, padding: "4px 0" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "0 4px" },
  title: { fontFamily: display, fontSize: 16, fontWeight: 800, letterSpacing: 0.5 },
  headRight: { display: "flex", alignItems: "center", gap: 10 },
  meta: { fontSize: 11, color: "#8b90a4", fontVariantNumeric: "tabular-nums" },
  unitBtn: { background: "#12141d", borderWidth: 1, borderStyle: "solid", borderColor: "#2c3447", color: "#67e8f9", borderRadius: 8, padding: "4px 9px", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: mono, minWidth: 34 },
  unitBtnOn: { background: "#1c2740", borderColor: "#67e8f9" },

  felt: {
    position: "relative", height: 392, borderRadius: "42% / 50%",
    background: "radial-gradient(120% 92% at 50% 42%, #1f7555 0%, #14563b 52%, #0c3a27 100%)",
    border: "8px solid #241712", boxShadow: "inset 0 0 50px rgba(0,0,0,.55), 0 10px 30px -12px rgba(0,0,0,.6)", marginBottom: 12,
  },
  center: { position: "absolute", top: "38%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center", width: 240 },
  potChip: { display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(6,12,9,.5)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 99, padding: "3px 12px", color: "#dff3e8" },
  potLbl: { fontSize: 8.5, letterSpacing: 2, opacity: 0.8 },
  potVal: { fontFamily: display, fontSize: 16, fontWeight: 800, fontVariantNumeric: "tabular-nums" },
  board: { display: "flex", gap: 4, justifyContent: "center", minHeight: 38, alignItems: "center", marginTop: 10 },
  boardHint: { fontSize: 11, fontStyle: "italic", color: "#9fdcc0", opacity: 0.8 },

  seat: { position: "absolute", width: 128, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  seatCards: { display: "flex", gap: 4, minHeight: 44 },
  plate: { position: "relative", background: "#0d0e15", borderWidth: 1, borderStyle: "solid", borderColor: "#2c3447", borderRadius: 10, padding: "6px 10px", minWidth: 96, textAlign: "center" },
  plateHero: { borderColor: "#67e8f9" },
  plateWin: { borderColor: "#7ee2b8", boxShadow: "0 0 14px -2px #7ee2b8" },
  plateChamp: { borderColor: "#f5c84a", boxShadow: "0 0 18px -2px #f5c84a", background: "#1a1505" },
  plateTop: { display: "flex", alignItems: "center", justifyContent: "center", gap: 5 },
  crown: { fontSize: 12 },
  pName: { fontFamily: display, fontSize: 12, fontWeight: 800 },
  posPill: { fontSize: 8.5, fontWeight: 700, color: "#0a0b10", background: "#cdd3e0", borderRadius: 4, padding: "1px 4px", letterSpacing: 0.5 },
  dealer: { fontSize: 8.5, fontWeight: 800, color: "#0a0b10", background: "#f5c84a", borderRadius: "50%", width: 14, height: 14, display: "inline-flex", alignItems: "center", justifyContent: "center" },
  pStack: { fontSize: 12.5, color: "#7ee2b8", fontVariantNumeric: "tabular-nums", marginTop: 2, fontWeight: 700 },
  profLine: { fontSize: 8.5, fontWeight: 700, marginTop: 1, letterSpacing: 0.3 },

  // mise posée devant le joueur
  bet: { position: "absolute", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 800, color: "#ffe6a3", background: "rgba(6,12,9,.6)", border: "1px solid rgba(245,200,74,.4)", borderRadius: 99, padding: "2px 8px", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },
  betTop: { top: -20, left: "50%", transform: "translateX(-50%)" },
  betBottom: { bottom: -20, left: "50%", transform: "translateX(-50%)" },
  betDisc: { width: 9, height: 9, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #f7d56a, #d29a1e)", boxShadow: "0 0 4px #f5c84a" },

  // tag d'action préflop
  actTag: { position: "absolute", fontSize: 8.5, fontWeight: 800, letterSpacing: 0.5, background: "#0a0b10", borderWidth: 1, borderStyle: "solid", borderColor: "#2c3447", borderRadius: 99, padding: "1px 7px" },
  actTagTop: { top: -9, right: -4 },
  actTagBottom: { bottom: -9, right: -4 },

  card: { width: 32, height: 44, borderRadius: 5, background: "linear-gradient(#fbfcff,#eef0f6)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: display, fontSize: 15, fontWeight: 800, color: "#15151c", boxShadow: "0 2px 6px rgba(0,0,0,.45)", lineHeight: 1.04 },
  cardSm: { width: 26, height: 36, fontSize: 12.5 },
  cardHero: { boxShadow: "0 0 0 2px #67e8f9, 0 2px 6px rgba(0,0,0,.45)" },
  cardBack: { width: 32, height: 44, borderRadius: 5, background: "repeating-linear-gradient(45deg,#2c3447 0 5px,#222a3a 5px 10px)", border: "1px solid #3a4256", boxShadow: "0 2px 6px rgba(0,0,0,.4)" },

  banner: { textAlign: "center", fontSize: 13, color: "#dfe3ee", margin: "0 0 10px", padding: "0 12px", minHeight: 20, lineHeight: 1.4 },
  bannerSub: { color: "#6b7088", fontWeight: 400, fontSize: 11 },
  // coach
  coach: { display: "flex", alignItems: "flex-start", gap: 8, borderRadius: 11, padding: "10px 12px", marginBottom: 10, fontSize: 12.5, lineHeight: 1.45 },
  coachOk: { background: "#0c1f17", border: "1px solid #1f6b4d", color: "#bff0d8" },
  coachMeh: { background: "#1c1a08", border: "1px solid #6b5a1e", color: "#f0e0a8" },
  coachErr: { background: "#241208", border: "1px solid #7a4a1e", color: "#ffd9a8" },
  coachBadge: { flexShrink: 0, fontFamily: display, fontWeight: 800, fontSize: 10, letterSpacing: 1, opacity: 0.9, paddingTop: 1 },
  coachMsg: { flex: 1 },
  hintBadge: { textAlign: "center", fontSize: 12, color: "#bcd6ff", background: "#101a33", border: "1px solid #2a3f63", borderRadius: 10, padding: "8px 10px", marginBottom: 10 },
  icm: { textAlign: "center", fontSize: 12, color: "#ffd9a8", background: "#241a08", border: "1px solid #6b4a1e", borderRadius: 10, padding: "8px 10px", marginBottom: 10, lineHeight: 1.4 },
  // popup variance (coin bas, auto-dismiss)
  variancePop: { position: "fixed", left: "50%", bottom: 18, transform: "translateX(-50%)", maxWidth: 380, width: "calc(100% - 32px)", borderRadius: 12, padding: "12px 14px", boxShadow: "0 12px 30px -10px rgba(0,0,0,.6)", zIndex: 60, animation: "none" },
  varBad: { background: "#0f1722", borderWidth: 1, borderStyle: "solid", borderColor: "#3a5a7a", color: "#bcd0e6" },
  varLucky: { background: "#211606", borderWidth: 1, borderStyle: "solid", borderColor: "#8a6320", color: "#ffe6b8" },
  varTitle: { fontFamily: display, fontSize: 13, fontWeight: 800, marginBottom: 3 },
  varBody: { fontSize: 11.5, lineHeight: 1.45, opacity: 0.92 },
  actions: { display: "flex", gap: 10, padding: "0 4px" },
  actBtn: { flex: 1, border: "none", padding: "16px", borderRadius: 12, fontSize: 16, fontWeight: 800, cursor: "pointer", fontFamily: display, letterSpacing: 1 },
  btnShove: { background: "#f5a83a", color: "#2a1705" },
  btnRaise: { background: "#4ade80", color: "#052a15" },
  btnCall: { background: "#3b82f6", color: "#04153a" },
  btnFold: { background: "#1b2230", color: "#cdd3e0", border: "1px solid #2c3447" },
  btnNext: { background: "#e7e9f0", color: "#0a0b10" },
  btnGhost: { background: "transparent", color: "#b5bacb", border: "1px solid #272b3d", flex: "0 0 60px", fontSize: 14 },

  // ── Récap de session ──
  recapWrap: { position: "fixed", inset: 0, background: "rgba(6,7,11,.78)", zIndex: 80, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" },
  recap: { width: "100%", maxWidth: 440, background: "#0c0e16", border: "1px solid #1f2433", borderRadius: 16, padding: "18px 18px 22px", fontFamily: mono, color: "#e7e9f0" },
  recapHead: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  recapTitle: { fontFamily: display, fontSize: 17, fontWeight: 800 },
  recapClose: { background: "transparent", border: "none", color: "#6b7088", cursor: "pointer", fontSize: 16 },
  recapEmpty: { fontSize: 13, color: "#8b90a4", textAlign: "center", padding: "20px 0", lineHeight: 1.5 },
  recapScore: { textAlign: "center", marginBottom: 16 },
  scoreBig: { fontFamily: display, fontSize: 46, fontWeight: 800, lineHeight: 1 },
  scoreLbl: { fontSize: 11, color: "#8b90a4", marginTop: 4 },
  recapStats: { display: "flex", gap: 8, marginBottom: 16 },
  statBox: { flex: 1, background: "#12141d", border: "1px solid #1b1e2b", borderRadius: 10, padding: "10px 6px", textAlign: "center" },
  statN: { fontFamily: display, fontSize: 20, fontWeight: 800 },
  statL: { fontSize: 8.5, letterSpacing: 1, color: "#5b6075", marginTop: 2, textTransform: "uppercase" },
  recapPriority: { background: "#1a1408", borderWidth: 1, borderStyle: "solid", borderColor: "#6b4a1e", borderRadius: 10, padding: "10px 12px", marginBottom: 14 },
  recapSub: { fontSize: 9.5, letterSpacing: 1.5, color: "#6b7088", textTransform: "uppercase", fontWeight: 700, marginBottom: 7 },
  priorityMsg: { fontSize: 13.5, fontWeight: 700, color: "#ffd9a8" },
  priorityN: { color: "#8b90a4", fontWeight: 400, fontSize: 11 },
  recapProfiles: { marginBottom: 14 },
  profRow: { display: "flex", gap: 6, flexWrap: "wrap" },
  profChip: { fontSize: 11, fontWeight: 700, background: "#12141d", borderWidth: 1, borderStyle: "solid", borderColor: "#2c3447", borderRadius: 99, padding: "3px 9px" },
  noErr: { fontSize: 12.5, color: "#7ee2b8", padding: "6px 0" },
  errList: { display: "flex", flexDirection: "column", gap: 6 },
  errRow: { display: "flex", alignItems: "center", gap: 8, background: "#12141d", border: "1px solid #1b1e2b", borderRadius: 9, padding: "8px 10px", fontSize: 11.5 },
  errHand: { fontFamily: display, fontWeight: 800, color: "#e7e9f0", minWidth: 36 },
  errCtx: { color: "#8b90a4", minWidth: 64 },
  errFix: { flex: 1, color: "#cdd3e0", textAlign: "right" },
};
