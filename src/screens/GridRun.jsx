import React, { useState } from "react";
import { useStore } from "../state/store.jsx";
import RangeMystery from "../formats/RangeMystery.jsx";
import { spotById } from "../data/spots.js";
import { avatarMod } from "../data/avatars.js";

// ─────────────────────────────────────────────────────────────
// screens/GridRun.jsx — DÉFI : le roguelite porté sur LA GRILLE.
//
// Une chaîne de spots joués en RangeMystery, avec un POOL DE PV partagé :
// chaque ERREUR coûte 1 PV (tallié à la fin de chaque niveau), bust à 0.
// Entre les niveaux, DRAFT d'1 capacité sur 3 (adaptées à la grille).
// Dernier niveau = BOSS. Récompense = gems (méta, persistés via RUN_REWARD).
//
// Réutilise RangeMystery tel quel (aucune modif du format) : on lit
// summary.errors à la complétion ; `prefill` sert à la Prémonition.
// PV de départ = base + boutique (Vie de base) + perso (mod.lives).
// ─────────────────────────────────────────────────────────────

const CHAIN = ["spin-btn-25", "spin-btn-18", "spin-btn-15", "spin-btn-12", "spin-btn-8"];
const isBoss = (i) => i === CHAIN.length - 1;
const BASE_PV = 3;

const GRID_ABILITIES = [
  { id: "gl-life", icon: "♥", name: "Soin", desc: "+1 PV tout de suite" },
  { id: "gl-shield", icon: "🛡️", name: "Bouclier", desc: "Le prochain niveau ne coûte aucun PV" },
  { id: "gl-gold", icon: "💰", name: "Filon", desc: "+50% de gems du Défi" },
  { id: "gl-seed", icon: "✦", name: "Prémonition", desc: "Prochain niveau : démarre avec des ancres révélées" },
];

const shuffle = (arr) => {
  const a = [...arr];
  for (let k = a.length - 1; k > 0; k--) {
    const r = Math.floor(Math.random() * (k + 1));
    [a[k], a[r]] = [a[r], a[k]];
  }
  return a;
};
const drawGrid = () => shuffle(GRID_ABILITIES).slice(0, 3);
const gridGems = (cleared, won, gold) => Math.round((cleared * 3 + (won ? 8 : 0)) * (1 + 0.5 * gold));

export default function GridRun() {
  const { state, dispatch } = useStore();
  const mod = avatarMod(state.player.avatarId);
  const startPV = Math.max(1, BASE_PV + (state.shop.upgrades["extra-life"] || 0) + (mod.lives || 0));

  const [run, setRun] = useState(() => ({
    pv: startPV, pvMax: startPV, idx: 0, cleared: 0, gold: 0, shieldNext: false, seedNext: false,
  }));
  const [phase, setPhase] = useState("playing"); // playing | draft | gameover
  const [draft, setDraft] = useState(null);
  const [result, setResult] = useState(null);
  const [flash, setFlash] = useState(null); // dégât du dernier niveau

  const spot = spotById[CHAIN[run.idx]];
  const back = () => dispatch({ type: "GO", screen: "map" });

  const finishRun = (won, cleared, gold) => {
    const gems = gridGems(cleared, won, gold);
    if (gems > 0) dispatch({ type: "RUN_REWARD", gems });
    setResult({ won, cleared, gems });
    setPhase("gameover");
  };

  const onLevelComplete = (summary) => {
    const errs = run.shieldNext ? 0 : summary.errors || 0;
    const pv = run.pv - errs;
    const cleared = run.cleared + 1;
    setFlash(run.shieldNext ? "🛡️ niveau protégé" : errs > 0 ? `−${errs} PV` : "sans faute ✓");
    if (pv <= 0) { finishRun(false, cleared, run.gold); return; }
    if (isBoss(run.idx)) { finishRun(true, cleared, run.gold); return; }
    setRun((r) => ({ ...r, pv, cleared, idx: r.idx + 1, shieldNext: false, seedNext: false }));
    setDraft(drawGrid());
    setPhase("draft");
  };

  const pickGrid = (ab) => {
    setRun((r) => {
      const n = { ...r };
      if (ab.id === "gl-life") { n.pv = r.pv + 1; n.pvMax = Math.max(r.pvMax, r.pv + 1); }
      else if (ab.id === "gl-shield") n.shieldNext = true;
      else if (ab.id === "gl-seed") n.seedNext = true;
      else if (ab.id === "gl-gold") n.gold = r.gold + 1;
      return n;
    });
    setDraft(null);
    setFlash(null);
    setPhase("playing");
  };

  return (
    <div style={S.root}>
      <button style={S.back} onClick={back}>← Carte</button>

      {/* HUD du Défi */}
      <div style={S.hud}>
        <span style={S.badge}>{isBoss(run.idx) ? <b style={S.boss}>☠ BOSS</b> : `DÉFI · ${run.idx + 1}/${CHAIN.length}`}</span>
        <span style={S.hearts}>
          {Array.from({ length: run.pvMax }).map((_, i) => (
            <span key={i} style={{ opacity: i < run.pv ? 1 : 0.18 }}>♥</span>
          ))}
        </span>
        <span style={S.tags}>
          {run.gold > 0 && <span style={S.tag}>💰×{run.gold}</span>}
          {run.shieldNext && <span style={S.tag}>🛡️</span>}
          {run.seedNext && <span style={S.tag}>✦</span>}
        </span>
      </div>

      {phase === "playing" && (
        <RangeMystery
          key={run.idx}
          rangeData={spot}
          level="beginner"
          cascade
          mode={state.difficulty}
          heat={0}
          prefill={run.seedNext ? spot.hands.slice(0, 3) : null}
          onComplete={onLevelComplete}
        />
      )}

      {phase === "draft" && draft && (
        <div style={S.draftWrap} className="gr-pop">
          {flash && <div style={S.dmg}>{flash}</div>}
          <div style={S.draftKick}>NIVEAU VALIDÉ · choisis un atout</div>
          <div style={S.draftSub}>Prochain : <b>{spot.name}</b>{isBoss(run.idx) ? " ☠ BOSS" : ""}</div>
          <div style={S.cards}>
            {draft.map((a, i) => (
              <button key={i} className="gr-card" style={S.card} onClick={() => pickGrid(a)}>
                <span style={S.cardIcon}>{a.icon}</span>
                <span style={S.cardName}>{a.name}</span>
                <span style={S.cardDesc}>{a.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === "gameover" && result && (
        <div style={S.over} className="gr-pop">
          <div style={{ ...S.overBadge, background: result.won ? "#10b981" : "#ef4444" }}>
            {result.won ? "DÉFI RELEVÉ" : "BUST"}
          </div>
          <h1 style={S.overTitle}>{result.won ? "Boss vaincu ✦" : "Défi terminé"}</h1>
          <div style={S.overStat}>{result.cleared}/{CHAIN.length} niveaux franchis</div>
          {result.gems > 0 && <div style={S.overGems}>+{result.gems} 💎 <span style={S.overGemsSub}>gardés</span></div>}
          <button style={S.cta} onClick={back}>⌂ Retour à la carte</button>
        </div>
      )}

      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.gr-pop { animation: grPop .3s cubic-bezier(.2,.9,.2,1); }
@keyframes grPop { from { transform: scale(.94); opacity: 0 } to { transform: scale(1); opacity: 1 } }
.gr-card:hover { border-color: #67e8f9 !important; background: #0f1820 !important; }
`;

const mono = "'JetBrains Mono', monospace";
const display = "'Bricolage Grotesque', sans-serif";
const S = {
  root: { maxWidth: 560, margin: "0 auto", padding: "16px 0 0", fontFamily: mono, color: "#e7e9f0" },
  back: { background: "transparent", border: "none", color: "#6b7088", cursor: "pointer", fontFamily: mono, fontSize: 12, marginBottom: 10, padding: "4px 0" },
  hud: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, padding: "0 4px", minHeight: 24 },
  badge: { fontFamily: display, fontSize: 13, fontWeight: 800, letterSpacing: 0.5, color: "#b5bacb" },
  boss: { color: "#ef4444" },
  hearts: { fontSize: 17, color: "#ef4444", letterSpacing: 2 },
  tags: { display: "flex", gap: 6 },
  tag: { fontSize: 11, fontWeight: 700, color: "#67e8f9", background: "#0d1b1f", border: "1px solid #1f4a52", borderRadius: 99, padding: "2px 8px" },

  // draft
  draftWrap: { textAlign: "center", padding: "20px 16px 32px", maxWidth: 480, margin: "0 auto" },
  dmg: { fontFamily: display, fontSize: 14, fontWeight: 800, color: "#f59e0b", marginBottom: 14 },
  draftKick: { fontFamily: display, fontSize: 22, fontWeight: 800, marginBottom: 4 },
  draftSub: { fontSize: 12.5, color: "#8b90a4", marginBottom: 18 },
  cards: { display: "flex", flexDirection: "column", gap: 10 },
  card: {
    display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, textAlign: "left",
    background: "#0d0e15", border: "1px solid #272b3d", borderRadius: 14, padding: "14px 16px",
    cursor: "pointer", fontFamily: mono, color: "#e7e9f0", transition: "border-color .15s, background .15s",
  },
  cardIcon: { fontSize: 24, lineHeight: 1 },
  cardName: { fontFamily: display, fontSize: 16, fontWeight: 800, color: "#67e8f9" },
  cardDesc: { fontSize: 12, color: "#8b90a4", lineHeight: 1.4 },

  // gameover
  over: { textAlign: "center", padding: "48px 22px", maxWidth: 420, margin: "0 auto" },
  overBadge: { display: "inline-block", fontSize: 10, letterSpacing: 3, color: "#0a0b10", fontWeight: 800, padding: "5px 12px", borderRadius: 99, marginBottom: 12 },
  overTitle: { fontFamily: display, fontSize: 30, fontWeight: 800, margin: "0 0 14px" },
  overStat: { fontSize: 13, color: "#8b90a4", marginBottom: 12 },
  overGems: { fontFamily: display, fontSize: 20, fontWeight: 800, color: "#67e8f9", marginBottom: 26 },
  overGemsSub: { fontSize: 11, color: "#5b6075", fontWeight: 400, fontFamily: mono },
  cta: { width: "100%", background: "#e7e9f0", border: "none", color: "#0a0b10", padding: "14px", borderRadius: 11, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: mono, letterSpacing: 0.5 },
};
