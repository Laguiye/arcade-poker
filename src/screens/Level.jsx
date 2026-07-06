import React, { useEffect, useRef, useState } from "react";
import { useStore } from "../state/store.jsx";
import { FORMATS } from "../formats/index.js";
import { seedFromGuess, linearRangeForPct, TIER_META } from "../engine/scoring.js";
import { RangeMini, SpotHeader } from "../components/ui/index.jsx";
import { themeForSpot } from "../theme/cosmic.js";

// ─────────────────────────────────────────────────────────────
// screens/Level.jsx — hôte d'un format au-dessus de GridEngine.
// Si `estimatePhase` : slider d'estimation (%) AVANT la reconstruction.
//   1. le joueur estime la largeur (aperçu linéaire live, ≠ vraie range)
//   2. un seul LOCK → seedFromGuess() sème des ancres-cœur selon la
//      proximité (PERFECT→tout le cœur … MISS→pity seed)
//   3. ces ancres passent en `prefill` à GridEngine (cascade d'ouverture)
// La frontière reste TOUJOURS à finir à la main. Étoiles = reconstruction
// + 0 erreur, JAMAIS le guess. Jetons = proximité.
// ─────────────────────────────────────────────────────────────

const chipsFor = (stars) => 100 * stars;
const xpFor = (stars) => 25 * stars;

export default function Level() {
  const { state, dispatch } = useStore();
  const spot = state.activeSpot;
  const estimate = state.estimatePhase;

  const [guessPct, setGuessPct] = useState(20);
  const [guess, setGuess] = useState(null); // résultat de seedFromGuess une fois locké

  const heatRef = useRef(state.heat);
  const completedRef = useRef(false);
  useEffect(() => { heatRef.current = state.heat; }, [spot]);
  useEffect(() => {
    // reset de la phase d'estimation à chaque nouveau spot
    setGuess(null);
    setGuessPct(20);
  }, [spot]);
  useEffect(() => {
    return () => { if (!completedRef.current) dispatch({ type: "SET_HEAT", value: heatRef.current }); };
  }, [spot]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!spot) return null;

  const Format = FORMATS["range-mystery"];
  const showSlider = estimate && !guess;

  const lock = () => setGuess(seedFromGuess(spot, guessPct));

  const complete = (summary) => {
    completedRef.current = true;
    const stars = summary?.stars ?? 0;
    if (state.practice) {
      // Rejouer : on ne crédite rien, on met juste à jour la grille de revue.
      dispatch({ type: "PRACTICE_DONE", stars, playerHands: summary?.selected || null });
      return;
    }
    const bonus = guess ? guess.payout : 0; // jetons continus (proximité)
    const showdownChips = summary?.showdownChips || 0; // #3 dormant → 0
    dispatch({
      type: "COMPLETE_LEVEL",
      spotId: spot.id,
      stars,
      chips: chipsFor(stars) + bonus + showdownChips,
      xp: xpFor(stars),
      heat: summary?.heat,
      playerHands: summary?.selected || null,
      guess: guess ? { tier: guess.tier, error: guess.error, sign: guess.sign } : null,
    });
  };

  return (
    <div style={S.root}>
      <button style={S.back} onClick={() => dispatch({ type: "GO", screen: "map" })}>← Carte</button>

      {showSlider ? (
        <Estimate spot={spot} guessPct={guessPct} setGuessPct={setGuessPct} onLock={lock} />
      ) : (
        <>
          {spot.tuto && (
            <div style={S.bubble}>
              Clique le <b>bas</b> d'une colonne dans la range : la cascade déroule la suite toute seule. ⛏
            </div>
          )}
          {guess && (
            <div style={{ ...S.guessBanner, border: `1px solid ${TIER_META[guess.tier].c}` }}>
              <span style={{ color: TIER_META[guess.tier].c, fontWeight: 800 }}>{TIER_META[guess.tier].label}</span>
              <span style={S.guessSub}>
                {guess.error <= 3 ? "lecture parfaite" : guess.sign === "large" ? "TROP LARGE" : "TROP SERRÉ"} · {guess.tier === "miss" ? "cœur à finir à la main" : "cœur semé"}
              </span>
            </div>
          )}
          <Format
            rangeData={spot}
            level="beginner"
            cascade
            mode={spot.tuto ? "normal" : state.difficulty}
            heat={state.heat}
            prefill={guess ? guess.prefill : null}
            onHeatChange={(h) => { heatRef.current = h; }}
            onComplete={complete}
          />
        </>
      )}
    </div>
  );
}

// ── Phase d'estimation : le slider, prof muet ────────────────
// Thématisée au secteur cosmique du spot (cohérence carte ↔ niveau ↔ estimation).
function Estimate({ spot, guessPct, setGuessPct, onLock }) {
  const preview = linearRangeForPct(guessPct);
  const theme = themeForSpot(spot);
  return (
    <div
      style={{
        ...S.estRoot,
        background: `radial-gradient(120% 80% at 50% -8%, ${theme.bgFrom} 0%, ${theme.bgTo} 65%)`,
        border: `1px solid ${theme.frame}`,
        boxShadow: `0 0 0 1px ${theme.glow}22, 0 18px 50px -20px ${theme.glow}55`,
      }}
    >
      {/* EN-TÊTE SECTEUR — même identité cosmique que la grille */}
      <div style={{ ...S.sector, borderColor: `${theme.frame}66` }}>
        <span style={{ ...S.sectorIcon, boxShadow: `0 0 18px -2px ${theme.glow}` }}>{theme.icon}</span>
        <span style={{ ...S.sectorName, color: theme.accentText }}>{theme.name}</span>
        <span style={{ ...S.sectorDot, background: theme.accent, boxShadow: `0 0 8px ${theme.glow}` }} />
      </div>

      <div style={{ marginBottom: 12 }}><SpotHeader spot={spot} /></div>
      <h1 style={S.estTitle}>Quelle largeur ?</h1>
      <p style={S.estLead}>Estime le % de mains de cette range. Un bon read te détonne le cœur.</p>

      <div style={{ ...S.previewWrap, background: theme.panel, borderColor: `${theme.frame}66` }}>
        <RangeMini hands={preview} cell={16} accent={theme.accent} />
        <div style={S.previewCap}>aperçu approximatif (haut de range)</div>
      </div>

      <div style={{ ...S.pctBig, color: theme.accent }}>{guessPct}<span style={S.pctUnit}>%</span></div>
      <input
        type="range" min={0} max={100} value={guessPct}
        onChange={(e) => setGuessPct(Number(e.target.value))}
        style={{ ...S.slider, accentColor: theme.accent }}
      />
      <div style={S.scaleRow}><span>serré</span><span>large</span></div>

      <button style={S.lockBtn} onClick={onLock}>Verrouiller l'estimation →</button>
      <div style={S.lockHint}>Un seul essai par spot.</div>
    </div>
  );
}

const mono = "'JetBrains Mono', monospace";
const display = "'Bricolage Grotesque', sans-serif";
const S = {
  root: { maxWidth: 560, margin: "0 auto", padding: "16px 0 0" },
  back: { background: "transparent", border: "none", color: "#6b7088", cursor: "pointer", fontFamily: mono, fontSize: 12, marginBottom: 10, padding: "4px 0" },
  bubble: {
    maxWidth: 560, margin: "0 auto 12px", background: "#12203b", border: "1px solid #1e3a6b",
    color: "#bcd2ff", borderRadius: 12, padding: "12px 16px", fontSize: 12.5, fontFamily: mono, lineHeight: 1.5,
  },
  guessBanner: {
    maxWidth: 560, margin: "0 auto 12px", background: "#0d0e15", border: "1px solid",
    borderRadius: 12, padding: "10px 16px", fontFamily: mono, display: "flex", alignItems: "center", gap: 12,
  },
  guessSub: { fontSize: 11, color: "#8b90a4" },

  // estimation
  estRoot: {
    maxWidth: 560, margin: "0 auto", padding: "26px 22px 34px",
    borderRadius: 18, fontFamily: mono, color: "#e7e9f0", textAlign: "center",
  },
  // En-tête secteur cosmique (calqué sur RangeMystery)
  sector: {
    display: "flex", alignItems: "center", gap: 10, marginBottom: 18,
    paddingBottom: 12, borderBottom: "1px solid", textAlign: "left",
  },
  sectorIcon: {
    fontSize: 20, lineHeight: 1, borderRadius: "50%",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
  },
  sectorName: { fontFamily: display, fontSize: 15, fontWeight: 800, letterSpacing: 0.5, flex: 1 },
  sectorDot: { width: 8, height: 8, borderRadius: "50%" },
  estTitle: { fontFamily: display, fontSize: 30, fontWeight: 800, margin: "6px 0 6px" },
  estLead: { fontSize: 12.5, color: "#8b90a4", margin: "0 0 20px", lineHeight: 1.5 },
  previewWrap: { display: "inline-block", background: "#0d0e15", border: "1px solid #1b1e2b", borderRadius: 14, padding: "14px 14px 10px", marginBottom: 18 },
  previewCap: { fontSize: 10, color: "#5b6075", marginTop: 8 },
  pctBig: { fontFamily: display, fontSize: 56, fontWeight: 800, color: "#f59e0b", lineHeight: 1 },
  pctUnit: { fontSize: 24, marginLeft: 2 },
  slider: { width: "100%", margin: "14px 0 4px", accentColor: "#f59e0b" },
  scaleRow: { display: "flex", justifyContent: "space-between", fontSize: 10, color: "#6b7088", marginBottom: 22 },
  lockBtn: {
    width: "100%", background: "#e7e9f0", border: "none", color: "#0a0b10", padding: "14px",
    borderRadius: 11, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: mono, letterSpacing: 0.5,
  },
  lockHint: { fontSize: 10, color: "#5b6075", marginTop: 8, fontStyle: "italic" },
};
