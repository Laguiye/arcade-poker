import React, { useState } from "react";
import { useStore } from "../state/store.jsx";
import { Stars, Button, RangeMini, RangeReview, SpotHeader } from "../components/ui/index.jsx";
import { Confetti } from "../components/juice/index.jsx";
import { themeForSpot } from "../theme/cosmic.js";

// ─────────────────────────────────────────────────────────────
// screens/Reward.jsx — « PALIER VALIDÉ », ouvert AUTOMATIQUEMENT à la
// complétion. Montre la range construite + étoiles + jetons/XP, puis
// enchaîne sur « Niveau suivant » (un bouton Accueil reste dispo).
// ─────────────────────────────────────────────────────────────

export default function Reward() {
  const { state, dispatch } = useStore();
  const r = state.lastReward;
  const [showSolution, setShowSolution] = useState(false);
  if (!r) return null;

  const spot = state.activeSpot; // spot qu'on vient de valider (range à montrer)
  const theme = themeForSpot(spot); // décor du secteur (cohérence carte ↔ niveau)
  const practice = !!r.practice; // rejouer : pas de crédit, pas de progression
  const celebrate = !practice && (r.stars === 3 || r.graduated || r.leveledUp);
  // Graduation d'une catégorie Spin = validation d'une ÉCHELLE.
  const isCategoryGrad = r.graduated && r.sector === "spin" && r.echelleDone;
  const title = practice
    ? "REFAIT ✓"
    : isCategoryGrad
    ? `${r.categoryLabel} · ÉCHELLE ${r.echelleDone} ✓`
    : r.graduated ? "BANDE FRANCHIE ✦" : r.stars === 3 ? "PERFECT ✦" : "PALIER VALIDÉ ✓";

  return (
    <div style={S.root}>
      {celebrate && <Confetti burst={r.spotName + state.progressions[state.quest].totalCleared} />}

      <div style={{ ...S.badge, background: theme.accent }}>{title}</div>
      {spot ? <div style={S.spotHead}><SpotHeader spot={spot} /></div> : <div style={S.spot}>{r.spotName}</div>}

      {/* Revue de grille : ta grille (vert/rouge/manquées) ↔ la vraie range */}
      {spot && (
        <div style={S.rangeCard}>
          {showSolution || !r.playerHands ? (
            <RangeMini hands={spot.hands} accent={theme.accent} />
          ) : (
            <RangeReview target={spot.hands} picked={r.playerHands} accent={theme.accent} />
          )}
          {!showSolution && r.playerHands && (
            <div style={S.legend}>
              <span><i style={{ ...S.dot, background: theme.accent }} /> bonnes</span>
              <span><i style={{ ...S.dot, background: "#ef4444" }} /> erreurs</span>
              <span><i style={{ ...S.dot, boxShadow: "inset 0 0 0 1.5px #6b7088" }} /> manquées</span>
            </div>
          )}
          <div style={S.rangeCaption}>{showSolution ? "La vraie range" : "Ta grille"}</div>
          {r.playerHands && (
            <button style={S.toggle} onClick={() => setShowSolution((s) => !s)}>
              {showSolution ? "← Voir ma grille" : "Voir la solution →"}
            </button>
          )}
        </div>
      )}

      <div className="juice-pop" style={S.starsBig}>
        <Stars value={r.stars} size={36} />
      </div>

      {practice ? (
        <div style={S.practiceNote}>Entraînement — rien n'est crédité. <i>C'est pour le geste.</i></div>
      ) : (
        <>
          <div style={S.gains}>
            <div style={S.gain}>
              <span style={{ ...S.gainVal, color: theme.accentText }}>+{r.chips}</span>
              <span style={S.gainLbl}>JETONS</span>
            </div>
            <div style={S.gain}>
              <span style={{ ...S.gainVal, color: "#3b82f6" }}>+{r.xp}</span>
              <span style={S.gainLbl}>XP</span>
            </div>
            {r.gems > 0 && (
              <div style={S.gain}>
                <span style={{ ...S.gainVal, color: "#67e8f9" }}>+{r.gems}</span>
                <span style={S.gainLbl}>💎 GEMS</span>
              </div>
            )}
          </div>

          {r.leveledUp && (
            <div className="juice-pop" style={S.levelUp}>⬆️ NIVEAU {r.leveledUp}</div>
          )}

          {r.graduated ? (
            <div style={S.unlocks}>
              {r.unlockedCategoryLabel && (
                <div style={S.unlockRow}><span style={S.unlockIcon}>🔓</span> Catégorie débloquée : <b style={{ color: theme.accentText }}>{r.unlockedCategoryLabel}</b></div>
              )}
              {r.nextBandLabel && (
                <div style={S.unlockRow}><span style={S.unlockIcon}>⬆️</span> {r.categoryLabel ? <><b>{r.categoryLabel}</b> passe en </> : "Nouvelle bande : "}<b style={{ color: theme.accentText }}>{r.nextBandLabel}</b></div>
              )}
            </div>
          ) : (
            <div style={S.progress}><span style={S.progIcon}>🎯</span> {r.bandLabel} · palier {r.clearedInBand}/{r.clears}</div>
          )}
        </>
      )}

      {r.graduated && !practice ? (
        <>
          <Button style={{ width: "100%", marginTop: 22 }} onClick={() => dispatch({ type: "GO", screen: "map" })}>
            ⌂ Retour à la carte
          </Button>
          <Button variant="ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => dispatch({ type: "START_NEXT" })}>
            Continuer{r.nextBandLabel ? ` · ${r.nextBandLabel}` : ""} →
          </Button>
        </>
      ) : (
        <>
          <Button style={{ width: "100%", marginTop: 22 }} onClick={() => dispatch({ type: "START_NEXT" })}>
            Niveau suivant →
          </Button>
          <Button variant="ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => dispatch({ type: "REPLAY_SPOT" })}>
            ↻ Rejouer ce niveau
          </Button>
          <button style={S.home} onClick={() => dispatch({ type: "GO", screen: "map" })}>
            ⌂ Accueil
          </button>
        </>
      )}
    </div>
  );
}

const display = "'Bricolage Grotesque', sans-serif";
const mono = "'JetBrains Mono', monospace";
const S = {
  root: {
    maxWidth: 440, margin: "0 auto", textAlign: "center", padding: "40px 22px",
    fontFamily: mono, color: "#e7e9f0", position: "relative",
  },
  badge: {
    display: "inline-block", fontSize: 10, letterSpacing: 3, color: "#0a0b10",
    background: "#7ee2b8", fontWeight: 800, padding: "5px 12px", borderRadius: 99, marginBottom: 8,
  },
  spot: { fontFamily: mono, fontSize: 11, fontWeight: 700, color: "#7ee2b8", letterSpacing: 1, marginBottom: 16, textTransform: "uppercase" },
  spotHead: { marginBottom: 16, textAlign: "left" },
  rangeCard: {
    background: "#0d0e15", border: "1px solid #1b1e2b", borderRadius: 14,
    padding: "16px 14px", marginBottom: 18, display: "inline-block",
  },
  legend: { display: "flex", gap: 14, justifyContent: "center", marginTop: 12, fontSize: 10, color: "#8b90a4" },
  dot: { display: "inline-block", width: 9, height: 9, borderRadius: 2, marginRight: 4, verticalAlign: "middle" },
  rangeCaption: { fontSize: 10, color: "#6b7088", marginTop: 8 },
  toggle: {
    marginTop: 10, background: "transparent", border: "1px solid #272b3d", color: "#b5bacb",
    cursor: "pointer", fontFamily: mono, fontSize: 11, padding: "6px 12px", borderRadius: 8,
  },
  practiceNote: {
    fontSize: 12, color: "#b5bacb", background: "#0d0e15", border: "1px solid #1b1e2b",
    borderRadius: 10, padding: "12px 14px", marginBottom: 4,
  },
  starsBig: { marginBottom: 20 },
  gains: { display: "flex", gap: 12, justifyContent: "center", marginBottom: 16 },
  gain: {
    flex: 1, background: "#12141d", border: "1px solid #1b1e2b", borderRadius: 12,
    padding: "14px", display: "flex", flexDirection: "column", gap: 4,
  },
  gainVal: { fontFamily: display, fontSize: 26, fontWeight: 800, color: "#7ee2b8" },
  gainLbl: { fontSize: 9, letterSpacing: 2, color: "#5b6075" },
  levelUp: {
    fontFamily: display, fontSize: 13, fontWeight: 800, letterSpacing: 1, color: "#bcd6ff",
    background: "#101a33", border: "1px solid #3b82f6", borderRadius: 10, padding: "8px 14px", marginBottom: 16,
  },
  progress: {
    fontSize: 12, color: "#b5bacb", background: "#0d0e15", border: "1px solid #1b1e2b",
    borderRadius: 10, padding: "12px 14px",
  },
  progIcon: { marginRight: 6 },
  unlocks: {
    display: "flex", flexDirection: "column", gap: 8, background: "#0d0e15",
    border: "1px solid #1b1e2b", borderRadius: 10, padding: "12px 14px", textAlign: "left",
  },
  unlockRow: { fontSize: 12.5, color: "#b5bacb", display: "flex", alignItems: "center", gap: 4 },
  unlockIcon: { fontSize: 14 },
  home: {
    width: "100%", marginTop: 10, background: "transparent", border: "none",
    color: "#6b7088", cursor: "pointer", fontFamily: mono, fontSize: 12, padding: "8px",
  },
};
