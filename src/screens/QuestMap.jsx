import React from "react";
import { useStore } from "../state/store.jsx";
import { ChipCounter } from "../components/ui/index.jsx";
import { QUEST_LIST, bandsFor } from "../data/quest.js";

// ─────────────────────────────────────────────────────────────
// screens/QuestMap.jsx — l'accueil ne propose PAS de niveaux à la
// carte : on suit la quête. On montre le SQUELETTE linéaire des
// bandes (axe-maître), la position courante + le plus haut atteint,
// et UN bouton « Continuer » qui tire le prochain spot au hasard.
// (Menu dev → Labo / Run conservé.)
// ─────────────────────────────────────────────────────────────

const DIFFS = [
  { id: "normal", label: "Normal", desc: "frontière orange" },
  { id: "difficile", label: "Difficile", desc: "sans frontière" },
  { id: "hardcore", label: "Hardcore", desc: "sans bonus" },
];

export default function QuestMap() {
  const { state, dispatch } = useStore();
  const quest = state.quest;
  const bands = bandsFor(quest);
  const { bandIdx, clearedInBand, maxBandReached, totalCleared } = state.progressions[quest];
  const band = bands[bandIdx];

  const ctaLabel = totalCleared === 0 ? "Commencer la quête →" : "Continuer →";

  return (
    <div style={S.root}>
      <header style={S.head}>
        <div>
          <div style={S.kicker}>TA QUÊTE</div>
          <h1 style={S.title}>Du tapis le plus court au plus profond</h1>
          <p style={S.lead}>Maîtrise le poker, un palier de stack à la fois.</p>
        </div>
        <ChipCounter value={state.economy.chips} />
      </header>

      {/* Choix du MONDE : Spin / MTT (chacun jouable dans les 3 difficultés) */}
      <div style={S.questLabel}>MONDE</div>
      <div style={S.questRow}>
        {QUEST_LIST.map((qu) => {
          const on = quest === qu.id;
          return (
            <button
              key={qu.id}
              style={{ ...S.questBtn, ...(on ? S.questBtnOn : {}) }}
              onClick={() => dispatch({ type: "SELECT_QUEST", quest: qu.id })}
            >
              <span style={S.questIcon}>{qu.icon}</span>
              <span style={{ ...S.questName, ...(on ? S.questNameOn : {}) }}>{qu.label}</span>
              <span style={S.questSub}>{qu.sub}</span>
            </button>
          );
        })}
      </div>

      {/* Squelette linéaire des bandes */}
      <div style={S.track}>
        {bands.map((b, i) => {
          const reached = i <= maxBandReached;
          const current = i === bandIdx;
          return (
            <React.Fragment key={b.id}>
              {i > 0 && <div style={{ ...S.link, ...(reached ? S.linkOn : {}) }} />}
              <div
                style={{
                  ...S.node,
                  ...(reached ? S.nodeReached : {}),
                  ...(current ? S.nodeCurrent : {}),
                }}
                className={current ? "qm-glow" : undefined}
              >
                <span style={S.nodeIcon}>{reached ? b.icon : "🔒"}</span>
                <span style={S.nodeLabel}>{b.label}</span>
                {current && (
                  <span style={S.nodeProg}>{clearedInBand}/{b.clears}</span>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Étape courante + action unique */}
      <div style={S.current}>
        <div style={S.currentIcon}>{band.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={S.currentLabel}>ÉTAPE COURANTE</div>
          <div style={S.currentBand}>{band.label} <span style={S.currentBandSub}>{band.sub}</span></div>
          <div style={S.currentSub}>
            {totalCleared === 0
              ? "Premier spot : un petit tuto pour sentir la cascade."
              : `Spot tiré au hasard dans la bande · palier ${clearedInBand}/${band.clears}`}
          </div>
        </div>
      </div>

      {/* Choix de difficulté (appliqué au prochain spot lancé) */}
      <div style={S.diffLabel}>DIFFICULTÉ</div>
      <div style={S.diffRow}>
        {DIFFS.map((d) => {
          const on = state.difficulty === d.id;
          return (
            <button
              key={d.id}
              style={{ ...S.diffBtn, ...(on ? S.diffBtnOn : {}) }}
              onClick={() => dispatch({ type: "SET_DIFFICULTY", difficulty: d.id })}
            >
              <span style={{ ...S.diffName, ...(on ? S.diffNameOn : {}) }}>{d.label}</span>
              <span style={S.diffDesc}>{d.desc}</span>
            </button>
          );
        })}
      </div>

      <button style={S.cta} onClick={() => dispatch({ type: "START_NEXT" })}>
        {ctaLabel}
      </button>

      <div style={S.devMenu}>
        <span style={S.devLabel}>menu dev</span>
        <button style={S.devBtn} onClick={() => dispatch({ type: "GO", screen: "lab" })}>
          🧪 Mode Labo
        </button>
        <button style={S.devBtn} onClick={() => dispatch({ type: "GO", screen: "run" })}>
          🎰 Run (Spin 3-max)
        </button>
      </div>
    </div>
  );
}

const display = "'Bricolage Grotesque', sans-serif";
const mono = "'JetBrains Mono', monospace";
const S = {
  root: { maxWidth: 560, margin: "0 auto", padding: "24px 22px 40px", fontFamily: mono, color: "#e7e9f0" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 26 },
  kicker: { fontSize: 10, letterSpacing: 3, color: "#5b6075", fontWeight: 700 },
  title: { fontFamily: display, fontSize: 26, fontWeight: 800, margin: "4px 0 6px", lineHeight: 1.1 },
  lead: { color: "#8b90a4", fontSize: 12, margin: 0 },

  questLabel: { fontSize: 9, letterSpacing: 2, color: "#5b6075", marginBottom: 8 },
  questRow: { display: "flex", gap: 10, marginBottom: 24 },
  questBtn: {
    flex: 1, display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start",
    background: "#0d0e15", border: "1px solid #1b1e2b", borderRadius: 14, padding: "14px 16px",
    cursor: "pointer", fontFamily: mono, textAlign: "left",
  },
  questBtnOn: { background: "#12141d", border: "1px solid #7ee2b8" },
  questIcon: { fontSize: 22 },
  questName: { fontFamily: display, fontSize: 18, fontWeight: 800, color: "#b5bacb" },
  questNameOn: { color: "#7ee2b8" },
  questSub: { fontSize: 10.5, color: "#6b7088" },

  track: { display: "flex", alignItems: "center", marginBottom: 24 },
  link: { flex: "0 0 24px", height: 2, background: "#1b1e2b" },
  linkOn: { background: "#2c3447" },
  node: {
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
    background: "#0d0e15", border: "1px solid #1b1e2b", borderRadius: 12, padding: "12px 6px", opacity: 0.5,
  },
  nodeReached: { opacity: 1 },
  nodeCurrent: { background: "#12141d", border: "1px solid #2c3447" },
  nodeIcon: { fontSize: 18 },
  nodeLabel: { fontSize: 10, color: "#b5bacb", textAlign: "center", lineHeight: 1.2 },
  nodeProg: { fontSize: 10, fontWeight: 700, color: "#7ee2b8", fontFamily: display },

  current: {
    display: "flex", alignItems: "center", gap: 14, background: "#12141d",
    border: "1px solid #1b1e2b", borderRadius: 14, padding: "16px 18px", marginBottom: 16,
  },
  currentIcon: { fontSize: 30 },
  currentLabel: { fontSize: 9, letterSpacing: 2, color: "#5b6075" },
  currentBand: { fontFamily: display, fontSize: 20, fontWeight: 800, margin: "2px 0 4px" },
  currentBandSub: { fontFamily: mono, fontSize: 11, fontWeight: 400, color: "#6b7088" },
  currentSub: { fontSize: 11, color: "#6b7088", lineHeight: 1.4 },

  diffLabel: { fontSize: 9, letterSpacing: 2, color: "#5b6075", marginBottom: 8 },
  diffRow: { display: "flex", gap: 8, marginBottom: 16 },
  diffBtn: {
    flex: 1, display: "flex", flexDirection: "column", gap: 3, alignItems: "center",
    background: "#0d0e15", border: "1px solid #1b1e2b", borderRadius: 11, padding: "10px 6px",
    cursor: "pointer", fontFamily: mono,
  },
  diffBtnOn: { background: "#12141d", border: "1px solid #f59e0b" },
  diffName: { fontFamily: display, fontSize: 13, fontWeight: 800, color: "#b5bacb" },
  diffNameOn: { color: "#f59e0b" },
  diffDesc: { fontSize: 9.5, color: "#6b7088" },

  cta: {
    width: "100%", background: "#e7e9f0", border: "none", color: "#0a0b10",
    padding: "15px", borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: "pointer",
    fontFamily: mono, letterSpacing: 0.5,
  },

  devMenu: {
    display: "flex", alignItems: "center", gap: 10, marginTop: 28, paddingTop: 18,
    borderTop: "1px dashed #1b1e2b", flexWrap: "wrap",
  },
  devLabel: { fontSize: 9, letterSpacing: 2, color: "#3f4458", textTransform: "uppercase" },
  devBtn: {
    background: "#0d0e15", border: "1px solid #272b3d", color: "#b5bacb",
    padding: "8px 12px", borderRadius: 9, fontSize: 12, cursor: "pointer", fontFamily: mono,
  },
};

// glow injecté globalement (cf. App)
export const MAP_CSS = `
.qm-glow { animation: qmGlow 1.6s ease-in-out infinite; }
@keyframes qmGlow {
  0%,100% { box-shadow: 0 0 0 0 rgba(231,233,240,0); }
  50% { box-shadow: 0 0 0 3px rgba(231,233,240,.18); }
}
`;
