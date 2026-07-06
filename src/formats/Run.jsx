import React, { useState, useRef, useEffect } from "react";
import { SPIN_3MAX } from "../data/playlists.js";
import { computeFrontier } from "../engine/frontier.js";
import { useStore } from "../state/store.jsx";
import { drawDraft, multForStreak, runGems, abilityById, randomStartAbility } from "../data/abilities.js";
import { avatarMod } from "../data/avatars.js";

// ─────────────────────────────────────────────────────────────
// formats/Run.jsx — Run = roguelite de survie à une TABLE 3-max
// (brief §5). RELOCALISÉ tel quel depuis modes/run/RunMode.jsx :
// Run est un skin sur la DONNÉE commune (frontière dérivée), pas
// sur la grille — donc aucune logique de matrice à dédupliquer (§0).
//
// Le spot se déroule : après chaque décision le bouton tourne
// (Hero : BTN → BB → SB → BTN…), les blindes suivent, le stack fond
// par paliers. Hero ne décide que sur les spots "folded to you" :
//   • BTN → action sur toi → OPEN/PUSH ou FOLD
//   • SB  → BTN se couche → à toi → OPEN/PUSH ou FOLD
//   • BB  → tout le monde se couche → WALK (s'enchaîne tout seul)
// Décision = frontière bilatérale (engine/frontier.js).
// Score = jetons accumulés × paliers franchis. Vies modulables.
// ─────────────────────────────────────────────────────────────

const playlist = SPIN_3MAX;
const BASE = 100;
const LIFE_CHOICES = [1, 3, 5];

// Position du Hero au fil des mains (le bouton tourne dans le sens horaire).
const CYCLE = ["BTN", "BB", "SB"];
const heroLabelAt = (step) => CYCLE[((step % 3) + 3) % 3];
const isWalk = (step) => heroLabelAt(step) === "BB";

// Labels des 3 sièges selon la position du Hero (Hero / Vilain gauche / Vilain droite).
const SEATS = {
  BTN: { hero: "BTN", left: "SB", right: "BB" },
  SB: { hero: "SB", left: "BB", right: "BTN" },
  BB: { hero: "BB", left: "BTN", right: "SB" },
};

const shuffle = (arr) => {
  const a = [...arr];
  for (let k = a.length - 1; k > 0; k--) {
    const r = Math.floor(Math.random() * (k + 1));
    [a[k], a[r]] = [a[r], a[k]];
  }
  return a;
};

const buildQueue = (tier) => shuffle(computeFrontier(tier.hands)).slice(0, tier.count);
const isBossTier = (idx) => idx === playlist.tiers.length - 1; // dernier palier = BOSS

// Découpe une main ("A5s" / "AA" / "AQo") en 2 cartes affichables.
const SUIT = { spade: "♠", heart: "♥", club: "♣" };
const cardsOf = (hand) => {
  const r1 = hand[0];
  const r2 = hand[1];
  if (hand.length === 2) return [{ r: r1, s: "spade" }, { r: r2, s: "heart" }]; // paire
  const suited = hand[2] === "s";
  return [{ r: r1, s: "spade" }, { r: r2, s: suited ? "spade" : "heart" }];
};

export default function Run() {
  const { state, dispatch } = useStore();
  const up = state.shop.upgrades || {}; // upgrades permanents (boutique)
  const mod = avatarMod(state.player.avatarId); // modificateur du perso
  // Bonus cumulés (boutique + perso) affichés en config.
  const perks = [];
  const extraLives = (up["extra-life"] || 0) + (mod.lives || 0);
  if (extraLives) perks.push(`${extraLives > 0 ? "+" : ""}${extraLives} ♥`);
  const startChipsBonus = (up["nest-egg"] ? 2000 : 0) + (mod.chips || 0);
  if (startChipsBonus) perks.push(`+${startChipsBonus} 🪙`);
  if (up["head-start"]) perks.push("🎴 capacité");
  (mod.abilities || []).forEach((id) => perks.push(`${abilityById(id).icon} de base`));
  const [phase, setPhase] = useState("config"); // config | playing | draft | gameover
  const [g, setG] = useState(null);
  const [feedback, setFeedback] = useState(null); // {correct, hand, gain, want, cleared}
  const [draft, setDraft] = useState(null); // [3 capacités] entre paliers
  const [result, setResult] = useState(null);
  const [shake, setShake] = useState(0);

  const lockRef = useRef(false);
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const startRun = (lives) => {
    clearTimeout(timerRef.current);
    lockRef.current = false;
    setFeedback(null);
    setDraft(null);
    setResult(null);
    // Bonus permanents (boutique + perso) appliqués au départ.
    const total = Math.max(1, lives + extraLives); // jamais sous 1 vie
    setG({
      livesMax: total,
      livesLeft: total,
      tierIdx: 0,
      qIdx: 0,
      queue: buildQueue(playlist.tiers[0]),
      heroStep: 0, // 0 = BTN au début du palier
      stepId: 0,
      chips: startChipsBonus, // Magot de départ + perso
      streak: 0,
      mult: 1,
      tiersCleared: 0,
      tierErrors: 0,
      abilities: [
        ...(up["head-start"] ? [randomStartAbility()] : []), // Tête de série
        ...(mod.abilities || []), // capacités de base du perso
      ],
      shieldReady: true, // bouclier rechargé à chaque palier
    });
    setPhase("playing");
  };

  // Applique la capacité draftée puis reprend le jeu sur le palier suivant.
  const pickAbility = (ab) => {
    setG((prev) => {
      if (ab.id === "jackpot") return { ...prev, chips: prev.chips + 1500 };
      const n = { ...prev, abilities: [...prev.abilities, ab.id] };
      if (ab.id === "second-life") { n.livesMax = prev.livesMax + 1; n.livesLeft = prev.livesLeft + 1; }
      return n;
    });
    setDraft(null);
    setPhase("playing");
  };

  // Beat "walk" : quand le Hero est en BB, personne n'ouvre → on enchaîne seul.
  useEffect(() => {
    if (phase !== "playing" || !g || feedback) return;
    if (!isWalk(g.heroStep)) return;
    const t = setTimeout(() => {
      setG((prev) => ({ ...prev, heroStep: prev.heroStep + 1, stepId: prev.stepId + 1 }));
    }, 850);
    return () => clearTimeout(t);
  }, [phase, g?.heroStep, g?.stepId, feedback]);

  const onAnswer = (choice) => {
    if (phase !== "playing" || lockRef.current || !g || isWalk(g.heroStep) || feedback) return;
    const tier = playlist.tiers[g.tierIdx];
    const item = g.queue[g.qIdx];
    const correct = (choice === "action") === item.inRange;

    const has = (id) => g.abilities.includes(id);
    lockRef.current = true;

    let { chips, streak, mult, livesLeft, tierErrors, shieldReady } = g;
    let gain = 0;
    let blocked = false; // erreur encaissée par le Bouclier
    if (correct) {
      streak += 1;
      mult = multForStreak(streak, has("momentum"));
      gain = BASE * mult;
      if (has("muscle")) gain = Math.round(gain * 1.5); // Gros bras
      chips += gain;
    } else if (shieldReady && has("shield")) {
      shieldReady = false; // Bouclier : absorbe (pas de vie, streak gardé)
      blocked = true;
      setShake((s) => s + 1);
    } else {
      if (!has("cool-head")) { streak = 0; mult = 1; } // Sang-froid garde le streak
      livesLeft -= 1;
      tierErrors += 1;
      setShake((s) => s + 1);
    }

    const next = { ...g, chips, streak, mult, livesLeft, tierErrors, shieldReady, stepId: g.stepId + 1 };
    let over = null;
    let cleared = null;
    let toDraft = false;

    if (livesLeft <= 0) {
      over = { won: false };
    } else if (g.qIdx + 1 < g.queue.length) {
      next.qIdx = g.qIdx + 1;
      next.heroStep = g.heroStep + 1; // le bouton tourne
    } else {
      const bonus = 500 * (g.tierIdx + 1);
      next.chips = chips + bonus;
      next.tiersCleared = g.tiersCleared + 1;
      cleared = { perfect: tierErrors === 0, bonus, label: tier.label, boss: isBossTier(g.tierIdx) };
      if (g.tierIdx + 1 >= playlist.tiers.length) {
        over = { won: true };
      } else {
        next.tierIdx = g.tierIdx + 1;
        next.qIdx = 0;
        next.queue = buildQueue(playlist.tiers[g.tierIdx + 1]);
        next.tierErrors = 0;
        next.heroStep = 0;
        next.shieldReady = true; // recharge le Bouclier au nouveau palier
        toDraft = true; // DRAFT avant d'enchaîner sur le palier suivant
      }
    }

    setFeedback({ correct, hand: item.hand, gain, want: item.inRange ? tier.action : "FOLD", cleared, blocked });

    const delay = cleared ? 1150 : correct ? 560 : 820;
    timerRef.current = setTimeout(() => {
      lockRef.current = false;
      setFeedback(null);
      setG(next);
      if (over) {
        const score = next.chips * (next.tiersCleared + 1);
        const gems = runGems(next.tiersCleared, over.won);
        if (gems > 0) dispatch({ type: "RUN_REWARD", gems });
        setResult({ won: over.won, chips: next.chips, tiersCleared: next.tiersCleared, score, gems });
        setPhase("gameover");
      } else if (toDraft) {
        setDraft(drawDraft(next.abilities));
        setPhase("draft");
      }
    }, delay);
  };

  return (
    <div style={S.root} className={shake ? "rm-shake" : undefined} key={shake}>
      <style>{CSS}</style>
      {phase === "config" && <Config onStart={startRun} perks={perks} />}
      {phase === "playing" && g && <Playing g={g} feedback={feedback} onAnswer={onAnswer} />}
      {phase === "draft" && draft && g && <Draft options={draft} g={g} onPick={pickAbility} />}
      {phase === "gameover" && result && (
        <GameOver result={result} onReplay={() => setPhase("config")} />
      )}
    </div>
  );
}

// ── Config (vies modulables) ─────────────────────────────────
function Config({ onStart, perks = [] }) {
  const [lives, setLives] = useState(3);
  return (
    <div style={{ textAlign: "center" }}>
      <div style={S.badge}>RUN</div>
      <h1 style={S.bigTitle}>{playlist.name}</h1>
      <p style={S.lead}>{playlist.sub}</p>

      {perks.length > 0 && (
        <div style={S.perks}>
          <span style={S.perksLabel}>BONUS</span>
          {perks.map((p, i) => <span key={i} style={S.perkPill}>{p}</span>)}
        </div>
      )}

      <div style={S.tierStrip}>
        {playlist.tiers.map((t, i) => (
          <div key={i} style={S.tierChip}>
            <span style={S.tierBb}>{t.bb}bb</span>
            <span style={S.tierLbl}>{t.label}</span>
          </div>
        ))}
      </div>

      <div style={S.cfgBlock}>
        <div style={S.cfgLabel}>VIES</div>
        <div style={S.lifeRow}>
          {LIFE_CHOICES.map((n) => (
            <button
              key={n}
              onClick={() => setLives(n)}
              style={{ ...S.lifeBtn, ...(lives === n ? S.lifeBtnActive : {}) }}
            >
              {"♥".repeat(n)}
              <span style={S.lifeNum}>{n}</span>
            </button>
          ))}
        </div>
        <div style={S.cfgHint}>
          {lives === 1 ? "Hardcore — une faute et c'est fini." : "Encaisse quelques fautes avant le bust."}
        </div>
      </div>

      <button style={S.startBtn} onClick={() => onStart(lives)}>
        LANCER LE RUN →
      </button>
    </div>
  );
}

// ── Jeu ──────────────────────────────────────────────────────
function Playing({ g, feedback, onAnswer }) {
  const tier = playlist.tiers[g.tierIdx];
  const fb = feedback;
  const heroLabel = heroLabelAt(g.heroStep);
  const seats = SEATS[heroLabel];
  const walking = isWalk(g.heroStep);
  const item = g.queue[g.qIdx];

  const ctx =
    heroLabel === "BTN"
      ? "Action sur toi."
      : heroLabel === "SB"
      ? "BTN se couche → à toi."
      : "Tout le monde se couche.";

  return (
    <div>
      {/* HUD */}
      <div style={S.hud}>
        <div style={S.hudLeft}>
          <span style={S.hudTier}>
            {isBossTier(g.tierIdx) ? <span style={S.bossTag}>☠ BOSS</span> : `Palier ${g.tierIdx + 1}/${playlist.tiers.length}`}
          </span>
          <span style={S.hudBb}>{tier.bb}bb · {tier.label}</span>
        </div>
        <div style={S.hearts}>
          {Array.from({ length: g.livesMax }).map((_, i) => (
            <span key={i} style={{ opacity: i < g.livesLeft ? 1 : 0.18 }}>♥</span>
          ))}
        </div>
      </div>

      {/* Capacités actives */}
      {g.abilities.length > 0 && (
        <div style={S.abilityStrip}>
          {g.abilities.map((id, i) => {
            const a = abilityById(id);
            const spent = id === "shield" && !g.shieldReady; // bouclier déjà consommé ce palier
            return (
              <span key={i} style={{ ...S.abilityPip, opacity: spent ? 0.35 : 1 }} title={`${a.name} — ${a.desc}`}>
                {a.icon}
              </span>
            );
          })}
        </div>
      )}

      <div style={S.chipsRow}>
        <div>
          <div style={S.chipsLabel}>JETONS</div>
          <div style={S.chipsVal}>{g.chips.toLocaleString("fr-FR")}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={S.chipsLabel}>STREAK</div>
          <div style={{ ...S.streakVal, ...(g.mult > 1 ? S.streakHot : {}) }} key={g.streak}>
            {g.streak} {g.mult > 1 && <span style={S.multTag}>×{g.mult}</span>}
          </div>
        </div>
      </div>

      <div style={S.progressTrack}>
        <div style={{ ...S.progressFill, width: `${(g.qIdx / g.queue.length) * 100}%` }} />
      </div>

      {/* PALIER FRANCHI */}
      {fb && fb.cleared ? (
        <div style={S.stage}>
          <div className="rm-pop" style={S.clearCard}>
            <div style={S.clearTitle}>{fb.cleared.boss ? "BOSS VAINCU ☠" : fb.cleared.perfect ? "PERFECT ✦" : "PALIER FRANCHI"}</div>
            <div style={S.clearSub}>+{fb.cleared.bonus} jetons{fb.cleared.boss ? " · run complet !" : " · choisis une capacité…"}</div>
          </div>
        </div>
      ) : (
        <>
          {/* TABLE */}
          <div style={S.tableWrap}>
            <div style={S.felt}>
              <div style={S.feltCenter}>
                <div style={S.potLabel}>3-max</div>
                <div style={S.potBb}>{tier.bb}bb</div>
              </div>

              {/* Vilain gauche */}
              <Seat style={S.seatLeft} label={seats.left} bb={tier.bb} folded={walking || seats.left !== "BTN"} hero={false} />
              {/* Vilain droite */}
              <Seat style={S.seatRight} label={seats.right} bb={tier.bb} folded={walking || seats.right !== "BTN"} hero={false} />

              {/* Hero */}
              <div style={S.seatHero}>
                <div style={S.cards}>
                  {walking
                    ? [0, 1].map((k) => <div key={k} style={S.cardBack} />)
                    : cardsOf(item.hand).map((c, k) => (
                        <div
                          key={k}
                          className="rm-pop"
                          style={{ ...S.card, ...(fb ? (fb.correct ? S.cardOk : fb.blocked ? S.cardShield : S.cardKo) : {}) }}
                        >
                          <span>{c.r}</span>
                          <span style={{ color: c.s === "heart" ? "#e0394b" : "#1a1a22" }}>{SUIT[c.s]}</span>
                        </div>
                      ))}
                </div>
                <div style={S.heroTag}>
                  <span style={S.posPill}>{seats.hero}</span>
                  <span style={S.heroStack}>{tier.bb}bb</span>
                </div>
              </div>
            </div>
          </div>

          {/* CONTEXTE / FEEDBACK */}
          <div style={S.ctxLine}>
            {walking ? (
              <span className="rm-pop" style={{ color: "#f59e0b", fontWeight: 700 }}>WALK — tu prends les blindes</span>
            ) : fb ? (
              fb.correct ? (
                <span style={{ color: "#10b981", fontWeight: 700 }}>
                  ✓ {fb.want} {fb.gain > 0 && `· +${fb.gain}`}
                </span>
              ) : fb.blocked ? (
                <span style={{ color: "#f59e0b", fontWeight: 700 }}>🛡️ encaissé — c'était {fb.want}</span>
              ) : (
                <span style={{ color: "#ef4444", fontWeight: 700 }}>✗ c'était {fb.want}</span>
              )
            ) : (
              <span style={{ color: "#8b90a4" }}>{ctx}</span>
            )}
          </div>

          {/* BOUTONS (cachés pendant le walk) */}
          <div style={{ ...S.btnRow, visibility: walking ? "hidden" : "visible" }}>
            <button
              style={{ ...S.actionBtn, ...(fb && fb.want === tier.action ? S.actionBtnRight : {}) }}
              onClick={() => onAnswer("action")}
            >
              {tier.action}
            </button>
            <button
              style={{ ...S.foldBtn, ...(fb && fb.want === "FOLD" ? S.foldBtnRight : {}) }}
              onClick={() => onAnswer("fold")}
            >
              FOLD
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Seat({ style, label, bb, folded }) {
  return (
    <div style={{ ...S.seat, ...style, opacity: folded ? 0.4 : 1 }}>
      <div style={S.avatar}>{label === "BTN" ? "●" : "○"}</div>
      <div style={S.seatMeta}>
        <span style={S.posPillSm}>{label}</span>
        <span style={S.seatStack}>{bb}bb</span>
      </div>
      {folded && <div style={S.foldedTag}>fold</div>}
    </div>
  );
}

// ── Draft de capacités (entre paliers) ───────────────────────
function Draft({ options, g, onPick }) {
  const nextTier = playlist.tiers[g.tierIdx]; // g a déjà avancé au palier suivant
  const boss = isBossTier(g.tierIdx);
  return (
    <div style={{ textAlign: "center" }} className="rm-pop">
      <div style={{ ...S.badge, background: "#67e8f9", color: "#06222a" }}>RÉCOMPENSE</div>
      <h1 style={S.bigTitle}>Choisis une capacité</h1>
      <p style={S.lead}>
        Prochain : <b style={{ color: boss ? "#ef4444" : "#7ee2b8" }}>{nextTier.bb}bb · {nextTier.label}{boss ? " ☠ BOSS" : ""}</b>
      </p>
      <div style={S.draftCards}>
        {options.map((a, i) => (
          <button key={i} className="run-draft" style={S.draftCard} onClick={() => onPick(a)}>
            <span style={S.draftIcon}>{a.icon}</span>
            <span style={S.draftName}>{a.name}</span>
            <span style={S.draftDesc}>{a.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Fin ──────────────────────────────────────────────────────
function GameOver({ result, onReplay }) {
  const won = result.won;
  return (
    <div style={{ textAlign: "center" }} className="rm-pop">
      <div style={{ ...S.badge, background: won ? "#10b981" : "#ef4444", color: "#0a0b10" }}>
        {won ? "RUN COMPLET" : "BUST"}
      </div>
      <h1 style={S.bigTitle}>{won ? "Tu as tenu ✦" : "Run terminé"}</h1>

      <div style={S.scoreBox}>
        <div style={S.scoreFormula}>
          <span>{result.chips.toLocaleString("fr-FR")}</span>
          <span style={S.scoreOp}>jetons ×</span>
          <span>{result.tiersCleared + 1}</span>
          <span style={S.scoreOp}>(paliers)</span>
        </div>
        <div style={S.scoreVal}>{result.score.toLocaleString("fr-FR")}</div>
        <div style={S.scoreLabel}>SCORE</div>
      </div>

      <div style={S.goStats}>
        <span>{result.tiersCleared}/{playlist.tiers.length} paliers franchis</span>
      </div>

      {result.gems > 0 && (
        <div style={S.goGems}>+{result.gems} 💎 <span style={S.goGemsSub}>gardés pour la suite</span></div>
      )}

      <button style={S.startBtn} onClick={onReplay}>REJOUER →</button>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────
const CSS = `
.rm-pop { animation: rmPop .26s cubic-bezier(.2,.9,.2,1); }
@keyframes rmPop { from { transform: scale(.82); opacity: 0 } to { transform: scale(1); opacity: 1 } }
.run-draft:hover { border-color: #67e8f9 !important; background: #0f1820 !important; }
.rm-shake { animation: rmShake .32s ease; }
@keyframes rmShake {
  0%,100% { transform: translateX(0) }
  20% { transform: translateX(-7px) }
  40% { transform: translateX(6px) }
  60% { transform: translateX(-4px) }
  80% { transform: translateX(3px) }
}
`;

const mono = "'JetBrains Mono', monospace";
const display = "'Bricolage Grotesque', sans-serif";

const S = {
  root: {
    maxWidth: 560, margin: "0 auto", padding: "26px 22px 32px",
    background: "#0a0b10", fontFamily: mono, color: "#e7e9f0",
    borderRadius: 18, border: "1px solid #1b1e2b", minHeight: 540,
  },
  badge: {
    display: "inline-block", fontSize: 10, letterSpacing: 3, color: "#0a0b10",
    background: "#e7e9f0", fontWeight: 700, padding: "4px 10px", borderRadius: 99, marginBottom: 12,
  },
  bigTitle: { fontFamily: display, fontSize: 32, fontWeight: 800, margin: "0 0 6px" },
  lead: { color: "#b5bacb", fontSize: 13, margin: "0 0 22px" },
  perks: { display: "flex", gap: 6, justifyContent: "center", alignItems: "center", flexWrap: "wrap", marginBottom: 20 },
  perksLabel: { fontSize: 9, letterSpacing: 2, color: "#5b6075" },
  perkPill: { fontSize: 11, fontWeight: 700, color: "#67e8f9", background: "#0d1b1f", border: "1px solid #1f4a52", borderRadius: 99, padding: "3px 9px" },

  // config
  tierStrip: { display: "flex", gap: 8, justifyContent: "center", marginBottom: 26 },
  tierChip: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
    background: "#12141d", border: "1px solid #1b1e2b", borderRadius: 10, padding: "10px 14px", minWidth: 84,
  },
  tierBb: { fontFamily: display, fontSize: 18, fontWeight: 800, color: "#7ee2b8" },
  tierLbl: { fontSize: 10, color: "#6b7088" },
  cfgBlock: { background: "#0d0e15", border: "1px solid #1b1e2b", borderRadius: 12, padding: "18px 16px", marginBottom: 22 },
  cfgLabel: { fontSize: 10, letterSpacing: 2, color: "#5b6075", marginBottom: 12 },
  lifeRow: { display: "flex", gap: 8, justifyContent: "center", marginBottom: 10 },
  lifeBtn: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
    background: "#12141d", border: "1px solid #272b3d", color: "#ef4444",
    borderRadius: 10, padding: "10px 18px", cursor: "pointer", fontFamily: mono, fontSize: 13, letterSpacing: 1,
  },
  lifeBtnActive: { background: "#ef44441a", border: "1px solid #ef4444" },
  lifeNum: { color: "#b5bacb", fontSize: 11, fontWeight: 700 },
  cfgHint: { fontSize: 11, color: "#6b7088", fontStyle: "italic" },
  startBtn: {
    width: "100%", background: "#e7e9f0", border: "none", color: "#0a0b10",
    padding: "14px", borderRadius: 11, fontSize: 14, fontWeight: 800, cursor: "pointer",
    fontFamily: mono, letterSpacing: 1,
  },

  // HUD
  hud: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  hudLeft: { display: "flex", flexDirection: "column", gap: 2 },
  hudTier: { fontFamily: display, fontSize: 15, fontWeight: 800 },
  hudBb: { fontSize: 11, color: "#6b7088" },
  hearts: { fontSize: 18, color: "#ef4444", letterSpacing: 3 },
  chipsRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 },
  chipsLabel: { fontSize: 9, letterSpacing: 2, color: "#5b6075" },
  chipsVal: { fontFamily: display, fontSize: 28, fontWeight: 800, color: "#7ee2b8", fontVariantNumeric: "tabular-nums", lineHeight: 1 },
  streakVal: { fontFamily: display, fontSize: 22, fontWeight: 800, color: "#6b7088", lineHeight: 1 },
  streakHot: { color: "#f59e0b" },
  multTag: { fontSize: 14, color: "#f59e0b" },
  progressTrack: { height: 6, background: "#12141d", borderRadius: 99, overflow: "hidden", marginBottom: 16 },
  progressFill: { height: "100%", background: "#10b981", borderRadius: 99, transition: "width .3s ease" },

  // table
  tableWrap: { padding: "4px 0 6px" },
  felt: {
    position: "relative", height: 256, borderRadius: "46% / 50%",
    background: "radial-gradient(120% 90% at 50% 38%, #1d6b4f 0%, #145239 55%, #0e3b29 100%)",
    border: "6px solid #2a1c14", boxShadow: "inset 0 0 36px rgba(0,0,0,.45)",
  },
  feltCenter: {
    position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%)",
    textAlign: "center", color: "#bfe6d3",
  },
  potLabel: { fontSize: 10, letterSpacing: 3, opacity: 0.7 },
  potBb: { fontFamily: display, fontSize: 18, fontWeight: 800 },

  seat: { position: "absolute", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: 74 },
  seatLeft: { top: 14, left: 18 },
  seatRight: { top: 14, right: 18 },
  avatar: {
    width: 34, height: 34, borderRadius: "50%", background: "#0d0e15", border: "2px solid #2c3447",
    display: "flex", alignItems: "center", justifyContent: "center", color: "#7ee2b8", fontSize: 14,
  },
  seatMeta: { display: "flex", flexDirection: "column", alignItems: "center", gap: 1 },
  posPillSm: { fontSize: 9, fontWeight: 700, color: "#0a0b10", background: "#cdd3e0", borderRadius: 5, padding: "1px 5px", letterSpacing: 1 },
  seatStack: { fontSize: 10, color: "#bfe6d3", fontVariantNumeric: "tabular-nums" },
  foldedTag: { fontSize: 9, color: "#8b90a4", fontStyle: "italic" },

  seatHero: {
    position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
  },
  cards: { display: "flex", gap: 6 },
  card: {
    width: 44, height: 60, borderRadius: 7, background: "#f3f4f8",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    fontFamily: display, fontSize: 20, fontWeight: 800, color: "#1a1a22",
    boxShadow: "0 3px 8px rgba(0,0,0,.4)", lineHeight: 1.05,
  },
  cardOk: { boxShadow: "0 0 0 3px #10b981, 0 3px 8px rgba(0,0,0,.4)" },
  cardKo: { boxShadow: "0 0 0 3px #ef4444, 0 3px 8px rgba(0,0,0,.4)" },
  cardBack: {
    width: 44, height: 60, borderRadius: 7,
    background: "repeating-linear-gradient(45deg, #2c3447 0 6px, #232a3a 6px 12px)",
    border: "1px solid #3a4256", boxShadow: "0 3px 8px rgba(0,0,0,.4)",
  },
  heroTag: { display: "flex", alignItems: "center", gap: 6 },
  posPill: { fontSize: 11, fontWeight: 700, color: "#0a0b10", background: "#e7e9f0", borderRadius: 6, padding: "2px 8px", letterSpacing: 1, fontFamily: display },
  heroStack: { fontSize: 12, color: "#bfe6d3", fontVariantNumeric: "tabular-nums" },

  ctxLine: { textAlign: "center", fontSize: 14, minHeight: 22, margin: "12px 0 14px" },

  btnRow: { display: "flex", gap: 12 },
  actionBtn: {
    flex: 1, background: "#10b98122", border: "2px solid #10b981", color: "#7ee2b8",
    padding: "18px", borderRadius: 14, fontSize: 18, fontWeight: 800, cursor: "pointer",
    fontFamily: display, letterSpacing: 1,
  },
  actionBtnRight: { background: "#10b981", color: "#0a0b10" },
  foldBtn: {
    flex: 1, background: "#12141d", border: "2px solid #272b3d", color: "#b5bacb",
    padding: "18px", borderRadius: 14, fontSize: 18, fontWeight: 800, cursor: "pointer",
    fontFamily: display, letterSpacing: 1,
  },
  foldBtnRight: { background: "#e7e9f0", color: "#0a0b10", border: "2px solid #e7e9f0" },

  stage: { textAlign: "center", minHeight: 300, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" },
  clearCard: { background: "#10b9811a", border: "2px solid #10b981", borderRadius: 16, padding: "28px 34px" },
  clearTitle: { fontFamily: display, fontSize: 30, fontWeight: 800, color: "#7ee2b8" },
  clearSub: { fontSize: 14, color: "#6b9c87", marginTop: 6 },

  // game over
  scoreBox: { background: "#0d0e15", border: "1px solid #1b1e2b", borderRadius: 14, padding: "22px 16px", marginBottom: 16 },
  scoreFormula: { display: "flex", gap: 8, justifyContent: "center", alignItems: "baseline", flexWrap: "wrap", fontFamily: display, fontWeight: 800, fontSize: 18, color: "#b5bacb" },
  scoreOp: { fontSize: 11, color: "#5b6075", fontWeight: 400, fontFamily: mono },
  scoreVal: { fontFamily: display, fontSize: 48, fontWeight: 800, color: "#7ee2b8", margin: "10px 0 2px", fontVariantNumeric: "tabular-nums" },
  scoreLabel: { fontSize: 10, letterSpacing: 3, color: "#5b6075" },
  goStats: { fontSize: 12, color: "#6b7088", marginBottom: 14 },
  goGems: { fontFamily: display, fontSize: 18, fontWeight: 800, color: "#67e8f9", marginBottom: 22 },
  goGemsSub: { fontSize: 11, color: "#5b6075", fontWeight: 400, fontFamily: mono },

  // boss + capacités
  bossTag: { color: "#ef4444", fontFamily: display, fontWeight: 800, letterSpacing: 1 },
  abilityStrip: { display: "flex", gap: 6, marginBottom: 12, minHeight: 22 },
  abilityPip: {
    width: 26, height: 26, borderRadius: 8, background: "#12141d", border: "1px solid #2c3447",
    display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14,
  },
  cardShield: { boxShadow: "0 0 0 3px #f59e0b, 0 3px 8px rgba(0,0,0,.4)" },

  // draft
  draftCards: { display: "flex", flexDirection: "column", gap: 10, marginTop: 8 },
  draftCard: {
    display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, textAlign: "left",
    background: "#0d0e15", border: "1px solid #272b3d", borderRadius: 14, padding: "14px 16px",
    cursor: "pointer", fontFamily: mono, color: "#e7e9f0", transition: "border-color .15s, background .15s",
  },
  draftIcon: { fontSize: 24, lineHeight: 1 },
  draftName: { fontFamily: display, fontSize: 16, fontWeight: 800, color: "#67e8f9" },
  draftDesc: { fontSize: 12, color: "#8b90a4", lineHeight: 1.4 },
};
