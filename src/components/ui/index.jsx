import React from "react";
import { RANKS, handAt } from "../../engine/poker.js";

// ─────────────────────────────────────────────────────────────
// components/ui — primitives d'habillage réutilisables par les
// écrans et les formats. Aucune logique de jeu (spec §0).
// ─────────────────────────────────────────────────────────────

// Grille 13×13 STATIQUE (non jouable) : affiche une range (mains à l'accent).
export function RangeMini({ hands, cell = 15, accent = "#10b981" }) {
  const target = new Set(hands);
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(13, ${cell}px)`, gap: 2, justifyContent: "center" }}>
      {RANKS.map((_, i) =>
        RANKS.map((__, j) => {
          const h = handAt(i, j);
          const on = target.has(h);
          return (
            <div key={h} style={{ width: cell, height: cell, borderRadius: 3, background: on ? accent : "#161922", opacity: on ? 1 : 0.5 }} />
          );
        })
      )}
    </div>
  );
}

// Grille 13×13 de REVUE : ce que le joueur a rempli.
//   vert = bonne main · rouge = erreur · contour gris = main de la range manquée
export function RangeReview({ target, picked, cell = 16, accent = "#10b981" }) {
  const tgt = new Set(target);
  const pick = new Set(picked);
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(13, ${cell}px)`, gap: 2, justifyContent: "center" }}>
      {RANKS.map((_, i) =>
        RANKS.map((__, j) => {
          const h = handAt(i, j);
          const inT = tgt.has(h), inP = pick.has(h);
          let bg = "#161922", op = 0.5, box = "none";
          if (inT && inP) { bg = accent; op = 1; }               // correct
          else if (!inT && inP) { bg = "#ef4444"; op = 1; }      // erreur
          else if (inT && !inP) { bg = "#161922"; op = 1; box = "inset 0 0 0 1.5px #6b7088"; } // manquée
          return (
            <div key={h} style={{ width: cell, height: cell, borderRadius: 3, background: bg, opacity: op, boxShadow: box }} />
          );
        })
      )}
    </div>
  );
}

const mono = "'JetBrains Mono', monospace";
const display = "'Bricolage Grotesque', sans-serif";

const fmt = (x) => Math.round(x * 100);

// En-tête de spot : les infos clés en pastilles bien visibles
// (format · position · profondeur · action). La profondeur (axe-maître) et
// l'action sont accentuées.
export function SpotHeader({ spot }) {
  if (!spot) return null;
  if (spot.tuto || !spot.formatLabel) {
    return <div style={SH.tutoBadge}>{spot.context}</div>;
  }
  const actionColor = spot.action === "PUSH" ? "#f59e0b" : spot.action === "CALL" ? "#3b82f6" : "#10b981";
  return (
    <div style={SH.row}>
      <Pill label="FORMAT" value={spot.formatLabel} />
      <Pill label="POSITION" value={spot.vs ? `${spot.pos} vs ${spot.vs}` : spot.pos} />
      <Pill label="STACK" value={`${spot.stackBB}bb`} valColor="#7ee2b8" />
      <Pill label="ACTION" value={spot.action} valColor={actionColor} bg={`${actionColor}1a`} border={actionColor} />
    </div>
  );
}

function Pill({ label, value, valColor = "#e7e9f0", bg = "#12141d", border = "#1b1e2b" }) {
  return (
    <div style={{ ...SH.pill, background: bg, border: `1px solid ${border}` }}>
      <span style={SH.pillLabel}>{label}</span>
      <span style={{ ...SH.pillVal, color: valColor }}>{value}</span>
    </div>
  );
}

const SH = {
  row: { display: "flex", gap: 6, flexWrap: "wrap" },
  pill: {
    flex: "1 1 0", minWidth: 62, display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
    border: "1px solid #1b1e2b", borderRadius: 10, padding: "8px 6px",
  },
  pillLabel: { fontSize: 8, letterSpacing: 1.5, color: "#5b6075", fontWeight: 700 },
  pillVal: { fontFamily: display, fontSize: 16, fontWeight: 800, lineHeight: 1 },
  tutoBadge: {
    display: "inline-block", fontSize: 11, letterSpacing: 2, color: "#7ee2b8", fontWeight: 700,
    textTransform: "uppercase", background: "#10b9811a", border: "1px solid #10b981",
    borderRadius: 99, padding: "6px 14px",
  },
};

// Jauge de progression 0..1.
export function Meter({ value, winAt = 1 }) {
  const color = value >= winAt ? "#10b981" : value > 0.6 ? "#eab308" : "#f97316";
  return (
    <div style={M.wrap}>
      <div style={M.track}>
        <div className="meter-fill" style={{ width: `${fmt(value)}%`, background: color }} />
      </div>
      <div style={{ ...M.pct, color }}>{fmt(value)}%</div>
    </div>
  );
}

// Étoiles de maîtrise (0..max).
export function Stars({ value = 0, max = 3, size = 16 }) {
  return (
    <span style={{ fontSize: size, letterSpacing: 2 }}>
      <span style={{ color: "#f5b301" }}>{"★".repeat(value)}</span>
      <span style={{ color: "#2c3040" }}>{"★".repeat(Math.max(0, max - value))}</span>
    </span>
  );
}

// Compteur de jetons (avec valeur monospace tabulaire).
export function ChipCounter({ value = 0, label = "JETONS" }) {
  return (
    <div>
      <div style={C.label}>{label}</div>
      <div style={C.val}>{value.toLocaleString("fr-FR")}</div>
    </div>
  );
}

// Bouton générique (variant primary | ghost).
export function Button({ children, variant = "primary", style, ...rest }) {
  const base = variant === "primary" ? B.primary : B.ghost;
  return (
    <button style={{ ...base, ...style }} {...rest}>
      {children}
    </button>
  );
}

const M = {
  wrap: { display: "flex", alignItems: "center", gap: 12 },
  track: { flex: 1, height: 12, background: "#12141d", borderRadius: 99, overflow: "hidden" },
  pct: {
    fontFamily: display, fontSize: 26, fontWeight: 800, minWidth: 64,
    textAlign: "right", fontVariantNumeric: "tabular-nums",
  },
};

const C = {
  label: { fontSize: 9, letterSpacing: 2, color: "#5b6075" },
  val: {
    fontFamily: display, fontSize: 28, fontWeight: 800, color: "#7ee2b8",
    fontVariantNumeric: "tabular-nums", lineHeight: 1,
  },
};

const B = {
  primary: {
    background: "#e7e9f0", border: "none", color: "#0a0b10",
    padding: "12px 18px", borderRadius: 10, fontSize: 13, fontWeight: 800,
    cursor: "pointer", fontFamily: mono, letterSpacing: 0.5,
  },
  ghost: {
    background: "#12141d", border: "1px solid #272b3d", color: "#b5bacb",
    padding: "12px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700,
    cursor: "pointer", fontFamily: mono,
  },
};

// CSS partagé des primitives (transitions de la jauge).
export const UI_CSS = `
.meter-fill { height: 100%; border-radius: 99px; transition: width .35s cubic-bezier(.2,.8,.2,1), background .3s ease; }
`;
