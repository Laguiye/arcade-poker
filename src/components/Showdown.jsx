import React, { useEffect, useState } from "react";

// ─────────────────────────────────────────────────────────────
// components/Showdown.jsx — mini-showdown bonus (#3), PRÉSENTATIONNEL.
//
// Reçoit un coup DÉJÀ résolu (l'équité + gagné/perdu décidés par l'appelant)
// et le met en scène : ta main vs Villain + l'équité, puis FLIP du résultat.
//   gagné  → « GAGNÉ +X » (bonus)
//   perdu  → « c'est la variance » (rien ne se passe, jamais punitif)
// Pas de board affiché (flip stylisé). Auto-dismiss via onDone.
// ─────────────────────────────────────────────────────────────

export default function Showdown({ hero, villain, equity, won, winChips = 0, onDone }) {
  const [phase, setPhase] = useState("face"); // 'face' → 'result'
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("result"), 950);
    const t2 = setTimeout(() => onDone && onDone(), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pct = Math.round(equity * 100);
  return (
    <div style={S.overlay}>
      <div className="juice-pop" style={S.card}>
        <div style={S.label}>SHOWDOWN</div>
        <div style={S.row}>
          <Hand value={hero} mine />
          <span style={S.vs}>vs</span>
          <Hand value={villain} />
        </div>
        <div style={S.eqRow}>
          <div style={S.eqTrack}><div style={{ ...S.eqFill, width: `${pct}%` }} /></div>
          <span style={S.eqPct}>{pct}%</span>
        </div>

        {phase === "result" && (
          <div className="juice-pop" style={S.result}>
            {won ? (
              <span style={{ color: "#10b981", fontWeight: 800 }}>GAGNÉ · +{winChips} 🪙</span>
            ) : (
              <span style={{ color: "#8b90a4" }}>perdu — <i>c'est la variance</i></span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Hand({ value, mine }) {
  return (
    <span style={{ ...S.hand, ...(mine ? S.handMine : {}) }}>{value}</span>
  );
}

const mono = "'JetBrains Mono', monospace";
const display = "'Bricolage Grotesque', sans-serif";
const S = {
  overlay: {
    position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(6,7,11,.72)", borderRadius: 18, zIndex: 30,
  },
  card: {
    background: "#12141d", border: "1px solid #272b3d", borderRadius: 16,
    padding: "20px 24px", textAlign: "center", fontFamily: mono, minWidth: 240,
  },
  label: { fontSize: 10, letterSpacing: 3, color: "#f59e0b", fontWeight: 800, marginBottom: 12 },
  row: { display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 14 },
  vs: { fontSize: 11, color: "#5b6075", fontStyle: "italic" },
  hand: {
    fontFamily: display, fontSize: 20, fontWeight: 800, color: "#b5bacb",
    background: "#0d0e15", border: "1px solid #272b3d", borderRadius: 10, padding: "8px 12px",
  },
  handMine: { color: "#9af0c8", border: "1px solid #10b981" },
  eqRow: { display: "flex", alignItems: "center", gap: 10 },
  eqTrack: { flex: 1, height: 8, background: "#0d0e15", borderRadius: 99, overflow: "hidden", border: "1px solid #272b3d" },
  eqFill: { height: "100%", background: "linear-gradient(90deg,#10b981,#7ee2b8)", borderRadius: 99, transition: "width .4s ease" },
  eqPct: { fontFamily: display, fontSize: 14, fontWeight: 800, color: "#7ee2b8", minWidth: 38, textAlign: "right" },
  result: { marginTop: 16, fontSize: 14 },
};
