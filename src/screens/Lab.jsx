import React, { useMemo, useState } from "react";
import GridEngine from "../engine/GridEngine.jsx";
import { handAt } from "../engine/poker.js";
import { LEVELS, rangePct, seedFromGuess, proximityCurve, payoutOf, TIER_META, CURVE_DEFAULTS } from "../engine/scoring.js";
import { SPOTS } from "../data/spots.js";
import { useStore } from "../state/store.jsx";
import { Meter, Stars } from "../components/ui/index.jsx";
import { PopNumber, ScreenShake, Confetti } from "../components/juice/index.jsx";

// ─────────────────────────────────────────────────────────────
// screens/Lab.jsx — MODE LABO (spec §6). Bac à sable des mécaniques,
// hors parcours joueur, pour SENTIR bonus & cascades sans rejouer la
// progression. Monte le MÊME GridEngine, `bonuses` pilotés par les
// contrôles → zéro logique dupliquée (spec §0/§6).
// ─────────────────────────────────────────────────────────────

const POWERUPS = [
  { key: "peek", label: "Peek" },
  { key: "second-chance", label: "Second chance" },
  { key: "freeze", label: "Freeze" },
  { key: "reveal-frontier", label: "Reveal frontier" },
];

// Range aléatoire (pour le feeling — pas réaliste, c'est voulu).
const randomRange = () => {
  const p = 0.18 + Math.random() * 0.3;
  const hands = [];
  for (let i = 0; i < 13; i++)
    for (let j = 0; j < 13; j++) if (Math.random() < p) hands.push(handAt(i, j));
  return { id: "lab-random", name: "Range aléatoire", sub: `densité ~${Math.round(p * 100)}%`, stackBB: "—", hands, core: hands, pct: rangePct(hands) };
};

export default function Lab() {
  const { dispatch } = useStore();

  const [spotIdx, setSpotIdx] = useState(0);
  const [randomData, setRandomData] = useState(null);
  const [level, setLevel] = useState("beginner");
  const [cascade, setCascade] = useState(true);
  const [multA, setMultA] = useState(4); // longueur → ×2
  const [multB, setMultB] = useState(6); // longueur → ×3
  const [powerups, setPowerups] = useState([]);
  const [heatOn, setHeatOn] = useState(true);
  const [heatSpeed, setHeatSpeed] = useState(0.25);
  const [heat, setHeat] = useState(0);
  const [juice, setJuice] = useState(0.6);

  const [resetKey, setResetKey] = useState(0);
  const [snap, setSnap] = useState({ meter: 0, clicks: 0, errors: 0, optimal: 0, stars: 3, selectedCount: 0 });
  const [lastCascade, setLastCascade] = useState({ length: 0, multiplier: 1 });
  const [flash, setFlash] = useState(null);
  const [shake, setShake] = useState(0);
  const [burst, setBurst] = useState(null);

  // Phase d'estimation (§8) : courbe continue. k = knob de difficulté.
  const [guessPct, setGuessPct] = useState(20);
  const [k, setK] = useState(CURVE_DEFAULTS.k);
  const [tol, setTol] = useState(CURVE_DEFAULTS.tolerance);
  const [probeErr, setProbeErr] = useState(5); // sonde d'erreur (lecture pure de la courbe)
  const [probeCore, setProbeCore] = useState(8); // coreSize de la sonde
  const [prefill, setPrefill] = useState(null);
  const [labGuess, setLabGuess] = useState(null);

  const rangeData = randomData || SPOTS[spotIdx];
  const multFn = useMemo(
    () => (len) => (len >= multB ? 3 : len >= multA ? 2 : 1),
    [multA, multB]
  );
  const bonuses = useMemo(() => ({ cascadeMultiplier: multFn, powerups }), [multFn, powerups]);

  const reset = () => {
    setResetKey((k) => k + 1);
    setHeat(0);
    setLastCascade({ length: 0, multiplier: 1 });
    setFlash(null);
    setBurst(null);
    setPrefill(null);
    setLabGuess(null);
  };

  // Sème le cœur selon le guess (courbe continue, knob k).
  const seed = () => {
    const g = seedFromGuess(rangeData, guessPct, tol, k);
    setPrefill(g.prefill);
    setLabGuess(g);
    setHeat(0);
    setBurst(null);
    setFlash(null);
  };

  // Sonde pure de la courbe (sans toucher la grille).
  const probe = proximityCurve(probeErr, tol, k, probeCore);

  const togglePowerup = (key) =>
    setPowerups((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]));

  return (
    <div style={S.root}>
      <header style={S.head}>
        <div>
          <div style={S.kicker}>DEV · BAC À SABLE</div>
          <h1 style={S.title}>🧪 Mode Labo</h1>
        </div>
        <button style={S.exit} onClick={() => dispatch({ type: "GO", screen: "map" })}>← Carte</button>
      </header>

      <div style={S.split}>
        {/* ── PANNEAU MOTEUR ── */}
        <div style={S.stage}>
          <Confetti burst={burst} count={Math.round(12 + juice * 30)} />
          <div style={S.spotName}>{rangeData.name} <span style={S.spotSub}>{rangeData.sub}</span></div>

          <div style={{ marginBottom: 10 }}>
            <Meter value={snap.meter} winAt={LEVELS[level].winAt} />
          </div>

          <div style={S.flashRow}>
            {flash && <PopNumber trigger={flash.key} text={flash.text} color={flash.color} size={18} />}
          </div>

          <ScreenShake shakeKey={shake}>
            <GridEngine
              rangeData={rangeData}
              interaction="reconstruct"
              level={level}
              cascade={cascade}
              bonuses={bonuses}
              resetKey={resetKey}
              prefill={prefill}
              onState={setSnap}
              onCascade={({ length, multiplier }) => {
                setLastCascade({ length, multiplier });
                setFlash({ key: Date.now(), text: `⛏ ${length}${multiplier > 1 ? ` ×${multiplier}` : ""}`, color: "#7ee2b8" });
                if (heatOn) setHeat((h) => Math.min(1, h + heatSpeed * (length / 4)));
                if (multiplier >= 3) setBurst(Date.now());
              }}
              onError={() => {
                setFlash({ key: Date.now(), text: "✗", color: "#ef4444" });
                setShake((s) => s + Math.round(1 + juice));
                if (heatOn) setHeat(0);
              }}
            />
          </ScreenShake>

          {/* Jauge de chaleur / streak */}
          {heatOn && (
            <div style={S.heatWrap}>
              <span style={S.heatLbl}>HEAT</span>
              <div style={S.heatTrack}>
                <div style={{ ...S.heatFill, width: `${heat * 100}%` }} />
              </div>
            </div>
          )}

          {/* Lectures en direct */}
          <div style={S.readouts}>
            <Read label="Mètre" value={`${Math.round(snap.meter * 100)}%`} />
            <Read label="Clics/opt" value={`${snap.clicks}/${snap.optimal}`} />
            <Read label="Erreurs" value={snap.errors} c={snap.errors ? "#ef4444" : "#10b981"} />
            <Read label="Étoiles" value={<Stars value={snap.stars} size={12} />} />
            <Read label="Cascade" value={lastCascade.length} />
            <Read label="Mult." value={`×${lastCascade.multiplier}`} c={lastCascade.multiplier > 1 ? "#f59e0b" : undefined} />
            <Read label="Tier %" value={labGuess ? TIER_META[labGuess.tier].label : "—"} c={labGuess ? TIER_META[labGuess.tier].c : undefined} />
            <Read label="Ancres" value={labGuess ? labGuess.seeds : "—"} />
            <Read label="Payout" value={labGuess ? `+${labGuess.payout}` : "—"} c="#7ee2b8" />
          </div>
        </div>

        {/* ── PANNEAU CONTRÔLES ── */}
        <div style={S.panel}>
          <Group label="Range">
            <div style={S.spotBtns}>
              {SPOTS.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => { setRandomData(null); setSpotIdx(i); reset(); }}
                  style={{ ...S.chip, ...(!randomData && spotIdx === i ? S.chipOn : {}) }}
                  title={p.context}
                >
                  {p.name}
                </button>
              ))}
              <button
                onClick={() => { setRandomData(randomRange()); reset(); }}
                style={{ ...S.chip, ...(randomData ? S.chipOn : {}) }}
              >
                🎲 random
              </button>
            </div>
          </Group>

          <Group label="Niveau (recall / dice)">
            <div style={S.spotBtns}>
              {Object.entries(LEVELS).map(([key, v]) => (
                <button
                  key={key}
                  onClick={() => { setLevel(key); reset(); }}
                  style={{ ...S.chip, ...(level === key ? S.chipOn : {}) }}
                >
                  {v.label} · {v.mode}
                </button>
              ))}
            </div>
          </Group>

          <Group label="Cascade">
            <Toggle on={cascade} onClick={() => { setCascade((c) => !c); reset(); }} label={cascade ? "ON" : "OFF"} />
            <Slider label={`×2 dès ${multA} mains`} min={2} max={8} value={multA} onChange={setMultA} disabled={!cascade} />
            <Slider label={`×3 dès ${multB} mains`} min={multA} max={12} value={multB} onChange={setMultB} disabled={!cascade} />
          </Group>

          <Group label="Streak / Heat">
            <Toggle on={heatOn} onClick={() => setHeatOn((h) => !h)} label={heatOn ? "ON" : "OFF"} />
            <Slider label={`vitesse ${heatSpeed.toFixed(2)}`} min={0.05} max={1} step={0.05} value={heatSpeed} onChange={setHeatSpeed} disabled={!heatOn} />
          </Group>

          <Group label="Power-ups">
            <div style={S.spotBtns}>
              {POWERUPS.map((pu) => (
                <button
                  key={pu.key}
                  onClick={() => { togglePowerup(pu.key); reset(); }}
                  style={{ ...S.chip, ...(powerups.includes(pu.key) ? S.chipOn : {}) }}
                >
                  {pu.label}
                </button>
              ))}
            </div>
          </Group>

          <Group label="Juice">
            <Slider label={`intensité ${Math.round(juice * 100)}%`} min={0} max={1} step={0.1} value={juice} onChange={setJuice} />
          </Group>

          <Group label={`Phase % — range réelle ${rangeData.pct}%`}>
            <Slider label={`k (difficulté) ${k.toFixed(2)}`} min={0.2} max={2} step={0.05} value={k} onChange={setK} />
            <Slider label={`tolérance ±${tol}pts`} min={5} max={30} value={tol} onChange={setTol} />
            <Slider label={`guess ${guessPct}%`} min={0} max={100} value={guessPct} onChange={setGuessPct} />
            <button style={{ ...S.chip, alignSelf: "flex-start" }} onClick={seed}>🌱 Semer le cœur</button>
            <div style={S.probeBox}>
              <div style={S.probeTitle}>sonde courbe</div>
              <Slider label={`erreur ${probeErr}pts`} min={0} max={30} value={probeErr} onChange={setProbeErr} />
              <Slider label={`coreSize ${probeCore}`} min={1} max={20} value={probeCore} onChange={setProbeCore} />
              <div style={S.probeRead}>
                <span style={{ color: TIER_META[probe.tier].c, fontWeight: 800 }}>{TIER_META[probe.tier].label}</span>
                <span>frac {probe.frac.toFixed(2)}</span>
                <span>{probe.seeds} ancres</span>
                <span style={{ color: "#7ee2b8" }}>+{payoutOf(probe.frac)}</span>
              </div>
            </div>
          </Group>

          <button style={S.resetBtn} onClick={reset}>↺ Reset le spot</button>
        </div>
      </div>
    </div>
  );
}

// ── sous-composants de contrôle ──
function Group({ label, children }) {
  return (
    <div style={S.group}>
      <div style={S.groupLbl}>{label}</div>
      <div style={S.groupBody}>{children}</div>
    </div>
  );
}
function Toggle({ on, onClick, label }) {
  return (
    <button onClick={onClick} style={{ ...S.toggle, ...(on ? S.toggleOn : {}) }}>{label}</button>
  );
}
function Slider({ label, min, max, step = 1, value, onChange, disabled }) {
  return (
    <label style={{ ...S.slider, opacity: disabled ? 0.4 : 1 }}>
      <span style={S.sliderLbl}>{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))} style={{ width: "100%" }}
      />
    </label>
  );
}
function Read({ label, value, c }) {
  return (
    <div style={S.read}>
      <span style={S.readLbl}>{label}</span>
      <span style={{ ...S.readVal, ...(c ? { color: c } : {}) }}>{value}</span>
    </div>
  );
}

const display = "'Bricolage Grotesque', sans-serif";
const mono = "'JetBrains Mono', monospace";
const S = {
  root: { maxWidth: 920, margin: "0 auto", padding: "20px 18px 40px", fontFamily: mono, color: "#e7e9f0" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  kicker: { fontSize: 10, letterSpacing: 3, color: "#5b6075", fontWeight: 700 },
  title: { fontFamily: display, fontSize: 28, fontWeight: 800, margin: "2px 0 0" },
  exit: { background: "transparent", border: "none", color: "#6b7088", cursor: "pointer", fontFamily: mono, fontSize: 12 },
  split: { display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" },
  stage: {
    flex: "1 1 360px", minWidth: 320, background: "#0a0b10", border: "1px solid #1b1e2b",
    borderRadius: 16, padding: "18px 18px 16px", position: "relative",
  },
  spotName: { fontFamily: display, fontSize: 16, fontWeight: 700, marginBottom: 10 },
  spotSub: { fontSize: 11, color: "#6b7088", fontWeight: 400, fontFamily: mono, marginLeft: 6 },
  flashRow: { height: 26, display: "flex", alignItems: "center", marginBottom: 6 },
  heatWrap: { display: "flex", alignItems: "center", gap: 10, marginTop: 14 },
  heatLbl: { fontSize: 9, letterSpacing: 2, color: "#f59e0b" },
  heatTrack: { flex: 1, height: 8, background: "#12141d", borderRadius: 99, overflow: "hidden" },
  heatFill: { height: "100%", background: "linear-gradient(90deg,#f59e0b,#ef4444)", borderRadius: 99, transition: "width .25s ease" },
  readouts: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 16 },
  read: { background: "#12141d", borderRadius: 9, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 2 },
  readLbl: { fontSize: 8.5, letterSpacing: 1, color: "#5b6075", textTransform: "uppercase" },
  readVal: { fontFamily: display, fontSize: 16, fontWeight: 700 },

  panel: { flex: "1 1 320px", minWidth: 300, display: "flex", flexDirection: "column", gap: 12 },
  group: { background: "#0d0e15", border: "1px solid #1b1e2b", borderRadius: 12, padding: "12px 14px" },
  groupLbl: { fontSize: 9, letterSpacing: 2, color: "#6b7088", textTransform: "uppercase", marginBottom: 10 },
  groupBody: { display: "flex", flexDirection: "column", gap: 10 },
  spotBtns: { display: "flex", flexWrap: "wrap", gap: 6 },
  chip: {
    background: "#12141d", border: "1px solid #272b3d", color: "#b5bacb",
    padding: "7px 11px", borderRadius: 8, fontSize: 11, cursor: "pointer", fontFamily: mono,
  },
  chipOn: { background: "#272b3d", color: "#fff", border: "1px solid #3a4256" },
  toggle: {
    alignSelf: "flex-start", background: "#12141d", border: "1px solid #272b3d", color: "#6b7088",
    padding: "6px 16px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: mono,
  },
  toggleOn: { background: "#10b98122", border: "1px solid #10b981", color: "#7ee2b8" },
  slider: { display: "flex", flexDirection: "column", gap: 4 },
  sliderLbl: { fontSize: 10, color: "#8b90a4" },
  resetBtn: {
    background: "#12141d", border: "1px solid #272b3d", color: "#b5bacb",
    padding: "10px", borderRadius: 9, fontSize: 12, cursor: "pointer", fontFamily: mono,
  },
  probeBox: { background: "#12141d", border: "1px dashed #272b3d", borderRadius: 9, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 },
  probeTitle: { fontSize: 8.5, letterSpacing: 2, color: "#5b6075", textTransform: "uppercase" },
  probeRead: { display: "flex", gap: 12, fontSize: 11, color: "#8b90a4", flexWrap: "wrap", fontFamily: display },
};
