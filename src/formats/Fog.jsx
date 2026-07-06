import React from "react";
import GridEngine from "../engine/GridEngine.jsx";

// ─────────────────────────────────────────────────────────────
// formats/Fog.jsx — BROUILLARD : PLACEHOLDER (spec §4).
// Structure prête, contenu PAS codé dans ce build.
//
// Cible (brief §4) : cases masquées + couche fog. Révéler la
// frontière éclaire les cases voisines. Skin sur le MÊME GridEngine
// en interaction:'masked' (le moteur sait déjà rendre des cases "?").
//
// TODO(brief §4) :
//   - couche de brouillard par-dessus la grille (cases révélées une à une)
//   - indices : révéler une main frontière éclaire son voisinage
//   - power-up "Reveal frontier" déjà supporté par GridEngine (bonuses.powerups)
//   - scoring : recall sur les cases dé-brumées
// Introduit APRÈS Range Mystery (jamais 2 mécaniques neuves d'un coup, §2).
// ─────────────────────────────────────────────────────────────

export default function Fog({ rangeData, level = "beginner", onComplete }) {
  return (
    <div style={S.root}>
      <div style={S.badge}>BROUILLARD · à venir</div>
      <h2 style={S.title}>{rangeData?.name || "Fog"}</h2>
      <p style={S.note}>
        Placeholder. Le format Brouillard montera ce même GridEngine en{" "}
        <code>interaction:'masked'</code> avec une couche de brouillard.
        Voir le TODO dans <code>formats/Fog.jsx</code> (brief §4).
      </p>

      {/* Aperçu : le moteur en mode masqué (cases "?"), non jouable utilement encore. */}
      {rangeData && (
        <div style={{ opacity: 0.5, pointerEvents: "none" }}>
          <GridEngine rangeData={rangeData} interaction="masked" level={level} cascade={false} />
        </div>
      )}

      {onComplete && (
        <button style={S.btn} onClick={() => onComplete({ stars: 0, skipped: true })}>
          Retour
        </button>
      )}
    </div>
  );
}

const display = "'Bricolage Grotesque', sans-serif";
const mono = "'JetBrains Mono', monospace";
const S = {
  root: {
    maxWidth: 560, margin: "0 auto", padding: "28px 22px",
    background: "#0a0b10", border: "1px dashed #2c3447", borderRadius: 18,
    fontFamily: mono, color: "#b5bacb",
  },
  badge: { fontSize: 10, letterSpacing: 3, color: "#6b7088", fontWeight: 700, marginBottom: 8 },
  title: { fontFamily: display, fontSize: 24, fontWeight: 800, color: "#e7e9f0", margin: "0 0 8px" },
  note: { fontSize: 13, lineHeight: 1.6, color: "#8b90a4", marginBottom: 18 },
  btn: {
    background: "#12141d", border: "1px solid #272b3d", color: "#b5bacb",
    padding: "10px 16px", borderRadius: 9, fontSize: 12, cursor: "pointer", fontFamily: mono, marginTop: 16,
  },
};
