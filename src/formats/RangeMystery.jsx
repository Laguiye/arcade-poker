import React, { useEffect, useMemo, useRef, useState } from "react";
import GridEngine from "../engine/GridEngine.jsx";
import { LEVELS, rangePct } from "../engine/scoring.js";
import { combosOf } from "../engine/poker.js";
import { Meter, Stars, Button, SpotHeader } from "../components/ui/index.jsx";
import { PopNumber, ScreenShake, Confetti } from "../components/juice/index.jsx";
import Showdown from "../components/Showdown.jsx";
import { equity, pickVillain } from "../engine/equity.js";
import { callRangeForStack } from "../data/callRanges.js";
import { themeForSpot } from "../theme/cosmic.js";
import useStruggle from "./useStruggle.js";

// ─────────────────────────────────────────────────────────────
// formats/RangeMystery.jsx — SKIN sur GridEngine (spec §4).
//
// Disposition : HEAT (gros, en haut) → contexte+titre+« ≈X% » →
// stats (au-dessus de la grille) → GRILLE → flash → mètre de
// remplissage (sous la grille) → TRAY D'AIDES → actions.
//
// Feedback au clic : sigil de frontière (◆) + côté orange persistant.
// SYSTÈME D'AIDE (ASSIST_SPEC) : la galère est détectée (useStruggle) et
// fait PULSER 2 aides pertinentes ; le joueur les déclenche à la demande.
// Chaque aide abaisse le plafond d'étoiles CRAN PAR CRAN (info −1, réponse
// −2 ; Passer → 0★). Tray sticky : reste dispo jusqu'à fermeture explicite.
// ─────────────────────────────────────────────────────────────

const HEAT_GAIN = 0.08;
const HEAT_DROP = 0.34;
const BOOST_THRESHOLD = 0.5;

// #3 MINI-SHOWDOWN — ACTIF (2026-06-28). Déclenché sur cascade boostée /
// éclatement (donc gated par la Heat), spots PUSH uniquement.
const SHOWDOWN_ENABLED = true;
const SHOWDOWN_PROB = 0.18; // ~1 bonus sur 5-6 cascades boostées (tunable playtest)
const SHOWDOWN_WIN_CHIPS = 120; // gagné → bonus ; perdu → rien (« c'est la variance »)

const PROX = {
  frontier: { txt: "◆ Tout proche — frontière", c: "#f59e0b" },
  near: { txt: "↑ Un peu trop large", c: "#eab308" },
  far: { txt: "⇈ Beaucoup trop large", c: "#3b82f6" },
};

// Catalogue. cost = crans retirés du plafond d'étoiles (null = Passer → 0★).
const AIDS = {
  amorce: { label: "Amorce", icon: "✦", cost: 2, hint: "révèle une ancre" },
  boussole: { label: "Boussole", icon: "➤", cost: 1, hint: "montre la zone" },
  focus: { label: "Focus", icon: "▣", cost: 1, hint: "masque le bruit" },
  rembobinage: { label: "Rembobinage", icon: "↶", cost: 1, hint: "annule l'erreur" },
  revealFrontier: { label: "Révéler le bord", icon: "◇", cost: 2, hint: "contoure la frontière" },
  passer: { label: "Passer", icon: "↦", cost: null, hint: "valide et continue" },
};
const TRAY_FOR = {
  bloque: ["amorce", "boussole"],
  rame: ["focus", "rembobinage"],
  coince: ["revealFrontier", "passer"],
};
const STATE_LABEL = { bloque: "Besoin d'un départ ?", rame: "On resserre ?", coince: "Bloqué tout près ?" };

export default function RangeMystery({
  rangeData,
  level = "beginner",
  cascade = true,
  mode = "normal", // 'tuto' | 'normal' | 'difficile' | 'hardcore'
  heat: heatInit = 0,
  prefill = null,
  onHeatChange,
  onComplete,
}) {
  const cfg = LEVELS[level] || LEVELS.beginner;
  const theme = useMemo(() => themeForSpot(rangeData), [rangeData]);
  const pct = rangeData.pct != null ? rangeData.pct : rangePct(rangeData.hands);
  const targetSet = useMemo(() => new Set(rangeData.hands), [rangeData]);
  const totalCombos = useMemo(() => rangeData.hands.reduce((s, h) => s + combosOf(h), 0), [rangeData]);

  const frontierMarks = mode === "normal" || mode === "tuto";
  const aidsEnabled = mode !== "hardcore";

  const [snap, setSnap] = useState({
    meter: 0, clicks: 0, errors: 0, optimal: 0, stars: 3, selectedCount: 0, solved: false,
  });
  const [heat, setHeatState] = useState(() => heatInit);
  const [revealed, setRevealed] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [flash, setFlash] = useState(null);
  const [shake, setShake] = useState(0);
  const [burst, setBurst] = useState(null);

  // ── État du système d'aide ──
  const engineRef = useRef(null);
  const [crans, setCrans] = useState(0);
  const [tray, setTray] = useState(null); // { state, aids } — sticky
  const [lastAidAt, setLastAidAt] = useState(0);
  const [focusOut, setFocusOut] = useState(false);
  const [compassKey, setCompassKey] = useState(null);
  const [revealFrontier, setRevealFrontier] = useState(false);
  const [showdown, setShowdown] = useState(null); // #3 dormant
  const showdownChipsRef = useRef(0);

  const ceiling = Math.max(0, 3 - crans);
  const ceilingRef = useRef(3);
  ceilingRef.current = ceiling;

  // Combos restants à trouver (offsuit=12 > paire=6 > suited=4) — dégraissé à
  // chaque main correctement placée ; une cascade en retire la somme.
  const placedCombos = (snap.selected || []).reduce((s, h) => (targetSet.has(h) ? s + combosOf(h) : s), 0);
  const combosLeft = totalCombos - placedCombos;

  const boosted = mode !== "hardcore" && heat >= BOOST_THRESHOLD; // hardcore = aucun bonus

  // Détection de la galère (heartbeat interne).
  const struggle = useStruggle({
    snap,
    heat,
    winAt: cfg.winAt,
    resetKey: rangeData.id || rangeData,
    enabled: aidsEnabled && !revealed,
    lastAidAt,
  });

  // Réinitialise l'état d'aide à chaque nouveau spot (la Heat, elle, persiste).
  useEffect(() => {
    setCrans(0);
    setTray(null);
    setLastAidAt(0);
    setFocusOut(false);
    setCompassKey(null);
    setRevealFrontier(false);
    setShowdown(null);
    showdownChipsRef.current = 0;
  }, [rangeData]);

  // Tray STICKY : la galère le pose, il reste jusqu'à usage/fermeture explicite
  // (spec §2, version indulgente). Une galère d'un AUTRE type le remplace.
  useEffect(() => {
    if (struggle === "none") return;
    setTray((prev) => (prev && prev.state === struggle ? prev : { state: struggle, aids: TRAY_FOR[struggle] }));
  }, [struggle]);

  const pulsing = tray && struggle === tray.state;

  const setHeat = (updater) => {
    setHeatState((h) => {
      const next = Math.max(0, Math.min(1, typeof updater === "function" ? updater(h) : updater));
      onHeatChange && onHeatChange(next);
      return next;
    });
  };

  const multFn = (len) => {
    let b = len >= 6 ? 3 : len >= 4 ? 2 : 1;
    if (boosted) b = Math.min(4, b + 1);
    return b;
  };
  const bonuses = { cascadeMultiplier: multFn, boostedCascade: boosted };

  const reset = () => {
    setRevealed(false);
    setResetKey((k) => k + 1);
    setFlash(null);
    setBurst(null);
  };

  // #3 (DORMANT) : sur un bonus (cascade boostée / éclatement), une CHANCE de
  // déclencher un mini-showdown à l'équité. Hero = la main de l'ancre, Villain
  // tirée d'une range de call générique par stack. Gains accumulés → crédités
  // à la complétion (donc jamais en practice). Inerte tant que SHOWDOWN_ENABLED
  // est false.
  const maybeShowdown = (heroHand) => {
    if (!SHOWDOWN_ENABLED || showdown || !heroHand) return;
    if (rangeData.action !== "PUSH") return; // récit all-in → spots push
    if (Math.random() > SHOWDOWN_PROB) return;
    const villains = callRangeForStack(rangeData.stackBB);
    if (!villains || !villains.length) return;
    const villain = pickVillain(villains);
    const eq = equity(heroHand, villain);
    const won = Math.random() < eq;
    if (won) showdownChipsRef.current += SHOWDOWN_WIN_CHIPS;
    setShowdown({ key: Date.now(), hero: heroHand, villain, equity: eq, won });
  };

  // ── Déclenchement d'une aide ────────────────────────────────
  const useAid = (id) => {
    const a = AIDS[id];
    if (id === "passer") {
      onComplete && onComplete({ ...snap, heat, stars: 0, passed: true, showdownChips: showdownChipsRef.current });
      return;
    }
    if (id === "amorce") engineRef.current?.seedAnchor();
    else if (id === "boussole") setCompassKey(Date.now());
    else if (id === "focus") setFocusOut(true);
    else if (id === "rembobinage") {
      const h = engineRef.current?.undoLastError();
      if (h) setHeat((x) => x + HEAT_DROP); // on rend la Heat perdue par l'erreur
    } else if (id === "revealFrontier") setRevealFrontier(true);

    if (a.cost) setCrans((c) => c + a.cost);
    setLastAidAt(Date.now());
    setTray(null); // refermé après usage ; la détection peut le re-poser
  };

  // Auto-validation dès que le palier est nettoyé (laisse jouer le juice).
  // Les étoiles sont plafonnées par les aides utilisées (cran par cran).
  useEffect(() => {
    if (snap.solved && !revealed) {
      const t = setTimeout(
        () => onComplete && onComplete({ ...snap, heat, stars: Math.min(snap.stars, ceilingRef.current), showdownChips: showdownChipsRef.current }),
        750
      );
      return () => clearTimeout(t);
    }
  }, [snap.solved, revealed]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScreenShake
      shakeKey={shake}
      style={{
        ...S.root,
        background: `radial-gradient(120% 80% at 50% -8%, ${theme.bgFrom} 0%, ${theme.bgTo} 65%)`,
        border: `1px solid ${theme.frame}`,
        boxShadow: `0 0 0 1px ${theme.glow}22, 0 18px 50px -20px ${theme.glow}55, inset 0 1px 0 ${theme.accent}1a`,
      }}
    >
      <Confetti burst={burst} />

      {/* EN-TÊTE SECTEUR — identité cosmique du décor (icône + nom) */}
      <div style={{ ...S.sector, borderColor: `${theme.frame}66` }}>
        <span style={{ ...S.sectorIcon, boxShadow: `0 0 18px -2px ${theme.glow}` }}>{theme.icon}</span>
        <span style={{ ...S.sectorName, color: theme.accentText }}>{theme.name}</span>
        <span style={{ ...S.sectorDot, background: theme.accent, boxShadow: `0 0 8px ${theme.glow}` }} />
      </div>

      {showdown && (
        <Showdown
          key={showdown.key}
          hero={showdown.hero}
          villain={showdown.villain}
          equity={showdown.equity}
          won={showdown.won}
          winChips={SHOWDOWN_WIN_CHIPS}
          onDone={() => setShowdown(null)}
        />
      )}

      {/* HEAT — gros, tout en haut */}
      <div style={S.heatWrap}>
        <div style={S.heatTop}>
          <span style={{ ...S.heatLabel, color: boosted ? "#f59e0b" : "#8b90a4" }}>
            {boosted ? "🔥 HEAT" : "HEAT"}
          </span>
          {boosted && <span style={S.boostTag}>CASCADE BOOSTÉE ⚡</span>}
        </div>
        <div style={S.heatTrack}>
          <div style={{ ...S.heatFill, width: `${heat * 100}%`, opacity: boosted ? 1 : 0.8 }} />
          <div style={{ ...S.heatThreshold, left: `${BOOST_THRESHOLD * 100}%` }} />
        </div>
      </div>

      {/* Infos clés du spot — bien visibles */}
      <div style={S.spotHead}><SpotHeader spot={rangeData} /></div>
      <div style={S.subRow}>
        <span style={S.hint}>🎯 Range ≈ <b>{pct}%</b> des mains · <b key={combosLeft} className="combo-tick" style={{ ...S.combos, color: theme.accentText }}>{combosLeft}</b> combos</span>
        <span style={S.tag}>{cfg.label} · {cfg.mode}</span>
      </div>

      {/* STATS — au-dessus de la grille (moins de clics = mieux) */}
      <div style={S.statHint}>
        Reconstruis la range en un minimum de clics ↓
        {crans > 0 && <span style={S.ceilTag}> · plafond {ceiling}★ (aides)</span>}
      </div>
      <div style={S.statBlock}>
        <Stat label="Mains" value={snap.selectedCount} />
        <Stat label="Clics" accent value={<span>{snap.clicks}<span style={S.dim}> / {snap.optimal}</span></span>} />
        <Stat label="Erreurs" value={<span style={{ color: snap.errors ? "#ef4444" : "#10b981" }}>{snap.errors}</span>} />
        <Stat label="Efficacité" value={<Stars value={Math.min(snap.stars, ceiling)} size={14} />} />
      </div>

      <GridEngine
        ref={engineRef}
        rangeData={rangeData}
        interaction="reconstruct"
        level={level}
        cascade={cascade}
        bonuses={bonuses}
        accent={theme.accent}
        accentText={theme.accentText}
        panel={theme.panel}
        revealed={revealed}
        resetKey={resetKey}
        prefill={prefill}
        frontierMarks={frontierMarks}
        focusOut={focusOut}
        compassKey={compassKey}
        revealFrontier={revealFrontier}
        onState={setSnap}
        onCorrect={({ frontier }) => {
          setHeat((h) => h + HEAT_GAIN);
          if (frontier) setFlash({ key: Date.now(), text: "◆ Frontière !", color: theme.accent });
        }}
        onCascade={({ chain, length, multiplier, boosted: wasBoost, bloom }) => {
          setFlash({
            key: Date.now(),
            text: bloom
              ? `💥 Éclatement · ${length} mains`
              : wasBoost
              ? `🔥 ${length} mains ×${multiplier}`
              : `⛏ ${length} mains${multiplier > 1 ? ` ×${multiplier}` : ""}`,
            color: bloom || wasBoost ? "#f59e0b" : "#7ee2b8",
            big: bloom || wasBoost,
          });
          if (bloom || wasBoost) {
            setBurst(Date.now());
            maybeShowdown(chain && chain[0]); // #3 : bonus showdown sur cascade boostée
          }
        }}
        onError={({ proximity }) => {
          setHeat((h) => h - HEAT_DROP);
          const p = PROX[proximity] || PROX.far;
          setFlash({ key: Date.now(), text: p.txt, color: p.c });
          setShake((s) => s + 1);
        }}
      />

      {/* FLASH — feedback de proximité / frontière */}
      <div style={S.flashRow}>
        {flash ? (
          <PopNumber trigger={flash.key} text={flash.text} color={flash.color} size={flash.big ? 24 : 18} />
        ) : (
          <span style={S.flashHint}>Clique une main · ◆ = frontière</span>
        )}
      </div>

      {/* MÈTRE DE REMPLISSAGE — sous la grille */}
      <div style={S.meterRow}>
        <div style={S.meterCap}>Range reconstituée</div>
        <Meter value={snap.meter} winAt={cfg.winAt} />
      </div>

      {/* TRAY D'AIDES — posé par la détection, déclenché à la demande */}
      {tray && (
        <div className={pulsing ? "assist-pulse" : ""} style={{ ...S.tray, border: `1px solid ${pulsing ? "#5b4a1f" : "#1b1e2b"}` }}>
          <div style={S.trayHead}>
            <span style={S.trayTitle}>{STATE_LABEL[tray.state]}</span>
            <button style={S.trayClose} onClick={() => setTray(null)} title="Fermer">✕</button>
          </div>
          <div style={S.trayBtns}>
            {tray.aids.map((id) => {
              const a = AIDS[id];
              return (
                <button key={id} style={S.aidBtn} onClick={() => useAid(id)}>
                  <span style={S.aidIcon}>{a.icon}</span>
                  <span style={S.aidLabel}>{a.label}</span>
                  <span style={S.aidMeta}>
                    {a.hint}
                    <span style={S.aidCost}>{a.cost == null ? " · 0★" : ` · −${a.cost}★`}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={S.actions}>
        <Button variant="ghost" onClick={() => setRevealed((r) => !r)}>{revealed ? "Cacher" : "Révéler"}</Button>
        <Button variant="ghost" onClick={reset}>Reset</Button>
      </div>
    </ScreenShake>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div style={S.statItem}>
      <span style={{ ...S.statLabel, ...(accent ? S.statLabelAccent : {}) }}>{label}</span>
      <span style={{ ...S.statVal, ...(accent ? S.statValAccent : {}) }}>{value}</span>
    </div>
  );
}

const mono = "'JetBrains Mono', monospace";
const display = "'Bricolage Grotesque', sans-serif";
const S = {
  root: {
    maxWidth: 560, margin: "0 auto", padding: "20px 22px 40px",
    background: "#0a0b10", fontFamily: mono, color: "#e7e9f0",
    borderRadius: 18, border: "1px solid #1b1e2b", position: "relative",
    overflow: "hidden",
  },
  // En-tête secteur cosmique
  sector: {
    display: "flex", alignItems: "center", gap: 10, marginBottom: 18,
    paddingBottom: 12, borderBottom: "1px solid",
  },
  sectorIcon: {
    fontSize: 20, lineHeight: 1, borderRadius: "50%",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
  },
  sectorName: { fontFamily: display, fontSize: 15, fontWeight: 800, letterSpacing: 0.5, flex: 1 },
  sectorDot: { width: 8, height: 8, borderRadius: "50%" },

  // HEAT gros
  heatWrap: { marginBottom: 20 },
  heatTop: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  heatLabel: { fontSize: 12, letterSpacing: 3, fontWeight: 800, fontFamily: display },
  boostTag: { fontSize: 10, letterSpacing: 1, fontWeight: 800, color: "#0a0b10", background: "#f59e0b", borderRadius: 99, padding: "3px 10px" },
  heatTrack: { position: "relative", height: 16, background: "#12141d", borderRadius: 99, overflow: "hidden", border: "1px solid #1b1e2b" },
  heatFill: { height: "100%", background: "linear-gradient(90deg,#f59e0b,#ef4444)", borderRadius: 99, transition: "width .25s ease" },
  heatThreshold: { position: "absolute", top: 0, width: 2, height: "100%", background: "#5b6075" },

  spotHead: { marginBottom: 10 },
  subRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 8 },
  hint: { fontSize: 12, color: "#b5bacb" },
  combos: { color: "#7ee2b8", display: "inline-block", fontVariantNumeric: "tabular-nums" },
  tag: { fontSize: 10, color: "#6b7088", fontStyle: "italic", whiteSpace: "nowrap" },

  statHint: { fontSize: 10, color: "#6b7088", fontStyle: "italic", marginBottom: 6 },
  ceilTag: { color: "#f59e0b" },
  statBlock: { display: "flex", justifyContent: "space-between", background: "#12141d", borderRadius: 10, padding: "12px 4px", marginBottom: 14 },
  statItem: { flex: 1, textAlign: "center", display: "flex", flexDirection: "column", gap: 3 },
  statLabel: { fontSize: 9, letterSpacing: 1, color: "#5b6075", textTransform: "uppercase" },
  statLabelAccent: { color: "#f5b301" },
  statVal: { fontFamily: display, fontSize: 17, fontWeight: 700, color: "#e7e9f0" },
  statValAccent: { color: "#f5b301", fontSize: 19 },
  dim: { color: "#5b6075", fontSize: 12 },

  flashRow: { height: 28, margin: "12px 0 8px", display: "flex", alignItems: "center", justifyContent: "center" },
  flashHint: { color: "#3f4458", fontSize: 12 },

  meterRow: { display: "flex", flexDirection: "column", gap: 6 },
  meterCap: { fontSize: 9, letterSpacing: 2, color: "#5b6075", textTransform: "uppercase" },

  // Tray d'aides
  tray: { marginTop: 16, background: "#0d0e15", border: "1px solid #1b1e2b", borderRadius: 12, padding: "10px 12px" },
  trayHead: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  trayTitle: { fontSize: 11, letterSpacing: 1, color: "#f59e0b", fontWeight: 700, textTransform: "uppercase" },
  trayClose: { background: "transparent", border: "none", color: "#5b6075", cursor: "pointer", fontSize: 13, padding: 2, lineHeight: 1 },
  trayBtns: { display: "flex", gap: 8 },
  aidBtn: {
    flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
    background: "#12141d", border: "1px solid #272b3d", borderRadius: 10, padding: "9px 11px",
    cursor: "pointer", fontFamily: mono, textAlign: "left",
  },
  aidIcon: { fontSize: 15, color: "#f59e0b" },
  aidLabel: { fontSize: 12.5, fontWeight: 800, color: "#e7e9f0" },
  aidMeta: { fontSize: 9.5, color: "#6b7088" },
  aidCost: { color: "#f59e0b" },

  actions: { display: "flex", gap: 8, marginTop: 16 },
};
