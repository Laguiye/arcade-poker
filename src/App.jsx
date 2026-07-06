import React from "react";
import { StoreProvider, useStore } from "./state/store.jsx";
import AvatarSelect from "./screens/AvatarSelect.jsx";
import GalacticMap, { GALMAP_CSS } from "./screens/GalacticMap.jsx";
import Level from "./screens/Level.jsx";
import Reward from "./screens/Reward.jsx";
import Lab from "./screens/Lab.jsx";
import GridRun from "./screens/GridRun.jsx";
import SpinTable from "./screens/SpinTable.jsx";
import Run from "./formats/Run.jsx";
import { GRID_CSS } from "./engine/GridEngine.jsx";
import { UI_CSS } from "./components/ui/index.jsx";
import { JUICE_CSS } from "./components/juice/index.jsx";

// ─────────────────────────────────────────────────────────────
// App.jsx — routeur d'écran (machine à états §1). Un seul état
// `screen` global (store). Pas de react-router pour le MVP.
//   Boot → Avatar → Carte → Niveau → Récompense → Carte
//   Carte ⇄ Labo / Run (menu dev)
// ─────────────────────────────────────────────────────────────

const FONT = `@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=JetBrains+Mono:wght@400;500;700&display=swap');`;

export default function App() {
  return (
    <StoreProvider>
      <style>{FONT + GRID_CSS + UI_CSS + JUICE_CSS + GALMAP_CSS}</style>
      <div style={page}>
        <Router />
      </div>
    </StoreProvider>
  );
}

function Router() {
  const { state, dispatch } = useStore();
  switch (state.screen) {
    case "boot":
      return <Boot onStart={() => dispatch({ type: "GO", screen: "avatar" })} />;
    case "avatar":
      return <AvatarSelect />;
    case "map":
      return <GalacticMap />;
    case "level":
      return <Level />;
    case "reward":
      return <Reward />;
    case "lab":
      return <Lab />;
    case "run":
      return <RunScreen back={() => dispatch({ type: "GO", screen: "map" })} />;
    case "gridrun":
      return <GridRun />;
    case "spintable":
      return <SpinTable />;
    default:
      return <Boot onStart={() => dispatch({ type: "GO", screen: "avatar" })} />;
  }
}

// Boot splash → entre dans le parcours.
function Boot({ onStart }) {
  return (
    <div style={boot.root}>
      <div style={boot.mark}>♠</div>
      <h1 style={boot.title}>ARCADE POKER</h1>
      <p style={boot.tag}>Maîtrise les ranges. Du tapis le plus court au plus profond.</p>
      <button style={boot.cta} onClick={onStart}>Commencer →</button>
    </div>
  );
}

// Run en tant qu'écran dev (hors parcours linéaire), avec retour carte.
function RunScreen({ back }) {
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "16px 0 0" }}>
      <button style={boot.back} onClick={back}>← Carte</button>
      <Run />
    </div>
  );
}

const page = {
  minHeight: "100vh",
  // Ambiance galactique : nébuleuses diffuses sur fond profond.
  background:
    "radial-gradient(900px 500px at 15% 0%, #1b1430 0%, transparent 55%)," +
    "radial-gradient(800px 480px at 85% 12%, #102036 0%, transparent 55%)," +
    "radial-gradient(700px 600px at 50% 110%, #0c2226 0%, transparent 55%)," +
    "radial-gradient(1200px 600px at 50% -10%, #14182a 0%, #07080c 60%)",
  padding: "24px 16px 60px",
  boxSizing: "border-box",
};

const display = "'Bricolage Grotesque', sans-serif";
const mono = "'JetBrains Mono', monospace";
const boot = {
  root: { maxWidth: 440, margin: "0 auto", textAlign: "center", padding: "72px 22px", fontFamily: mono, color: "#e7e9f0" },
  mark: { fontSize: 56, color: "#10b981", marginBottom: 8 },
  title: { fontFamily: display, fontSize: 40, fontWeight: 800, letterSpacing: 1, margin: "0 0 10px" },
  tag: { color: "#8b90a4", fontSize: 13, margin: "0 0 32px", lineHeight: 1.5 },
  cta: {
    background: "#e7e9f0", border: "none", color: "#0a0b10", padding: "14px 28px",
    borderRadius: 11, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: mono, letterSpacing: 0.5,
  },
  back: { background: "transparent", border: "none", color: "#6b7088", cursor: "pointer", fontFamily: mono, fontSize: 12, marginBottom: 10 },
};
