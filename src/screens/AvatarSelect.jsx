import React, { useState } from "react";
import { useStore } from "../state/store.jsx";
import { AVATAR_LIST, avatarOf } from "../data/avatars.js";

// ─────────────────────────────────────────────────────────────
// screens/AvatarSelect.jsx — LE HANGAR : choix du pilote (spec §2).
// Chaque avatar porte un MODIFICATEUR de run (cf. data/avatars.js) :
// le choix compte. Restyle onboarding 2026-07 : vraies cartes de
// personnage (halo tinté, badge perk, flavor), entrée en cascade.
// Animations partagées : classes ob-* de screens/Onboarding.jsx.
// ─────────────────────────────────────────────────────────────

// Lignes d'ambiance (visuel uniquement — les effets réels sont dans `perk`).
const FLAVOR = {
  spade: "Calcule chaque orbite. Ne meurt jamais par accident.",
  heart: "Tout, tout de suite. Les jetons brûlent vite.",
  diamond: "Ne décolle jamais sans la soute pleine.",
  club: "Les erreurs glissent sur lui comme la poussière d'étoiles.",
};

// hex → rgba (halos et badges tintés par pilote)
const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export default function AvatarSelect() {
  const { dispatch } = useStore();
  const [sel, setSel] = useState(null);
  const selAv = sel ? avatarOf(sel) : null;

  return (
    <div style={S.root}>
      <div className="ob-stars" aria-hidden />

      <div style={S.kicker} className="ob-rise">LE HANGAR</div>
      <h1 style={S.title} className="ob-rise ob-d1">Choisis ton pilote</h1>
      <p style={S.lead} className="ob-rise ob-d2">Chaque pilote a un style qui modifie tes runs.</p>

      <div style={S.grid}>
        {AVATAR_LIST.map((a, k) => {
          const on = sel === a.id;
          return (
            <button
              key={a.id}
              onClick={() => setSel(a.id)}
              className={`ob-card ob-rise ob-d${k + 1}`}
              style={{
                ...S.card,
                ...(on ? { borderColor: a.tint, boxShadow: `0 0 26px -8px ${a.tint}`, transform: "translateY(-3px) scale(1.02)" } : {}),
              }}
            >
              <div style={{ ...S.cardHalo, background: `radial-gradient(circle at 50% 32%, ${rgba(a.tint, 0.22)} 0%, transparent 65%)` }} />
              <span style={{ ...S.glyph, color: a.tint, textShadow: `0 0 18px ${rgba(a.tint, 0.6)}` }}>{a.glyph}</span>
              <span style={S.name}>{a.name}</span>
              <span style={{ ...S.perkChip, color: a.tint, background: rgba(a.tint, 0.10), borderColor: rgba(a.tint, 0.35) }}>
                {a.perk}
              </span>
            </button>
          );
        })}
      </div>

      <div style={S.info}>
        {selAv ? (
          <div key={selAv.id} className="ob-rise">
            <div style={{ ...S.infoName, color: selAv.tint }}>{selAv.glyph} {selAv.name}</div>
            <div style={S.infoFlavor}>« {FLAVOR[selAv.id]} »</div>
          </div>
        ) : (
          <div style={S.infoFlavor}>Touche un pilote pour voir son style.</div>
        )}
      </div>

      <button
        style={{ ...S.cta, ...(sel ? {} : S.ctaDisabled) }}
        className={sel ? "ob-cta" : undefined}
        disabled={!sel}
        onClick={() => dispatch({ type: "SELECT_AVATAR", avatarId: sel })}
      >
        Rejoindre la galaxie →
      </button>
    </div>
  );
}

const display = "'Bricolage Grotesque', sans-serif";
const mono = "'JetBrains Mono', monospace";
const S = {
  root: {
    position: "relative", maxWidth: 460, margin: "0 auto", textAlign: "center",
    padding: "36px 20px", fontFamily: mono, color: "#e7e9f0",
  },
  kicker: { fontSize: 10, letterSpacing: 4, color: "#f5a83a", fontWeight: 700, marginBottom: 6 },
  title: { fontFamily: display, fontSize: 32, fontWeight: 800, margin: "0 0 8px" },
  lead: { color: "#8b90a4", fontSize: 12.5, margin: "0 0 24px" },

  grid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 16 },
  card: {
    position: "relative", overflow: "hidden", background: "#0d0e15",
    borderWidth: 2, borderStyle: "solid", borderColor: "#1b1e2b", borderRadius: 18,
    padding: "18px 10px 14px", cursor: "pointer", fontFamily: mono,
    display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
  },
  cardHalo: { position: "absolute", inset: 0, pointerEvents: "none" },
  glyph: { fontSize: 46, lineHeight: 1 },
  name: { fontFamily: display, fontSize: 16, fontWeight: 800, color: "#e7e9f0" },
  perkChip: {
    fontSize: 9.5, fontWeight: 700, letterSpacing: 0.3, lineHeight: 1.35,
    borderWidth: 1, borderStyle: "solid", borderRadius: 99, padding: "3px 9px", maxWidth: "100%",
  },

  info: { minHeight: 62, margin: "2px 0 16px", display: "flex", flexDirection: "column", justifyContent: "center" },
  infoName: { fontFamily: display, fontSize: 17, fontWeight: 800, marginBottom: 3 },
  infoFlavor: { fontSize: 12, color: "#8b90a4", fontStyle: "italic", lineHeight: 1.5 },

  cta: {
    width: "100%", background: "linear-gradient(135deg, #f5a83a 0%, #f06f9e 100%)", border: "none",
    color: "#1a0d05", padding: "15px", borderRadius: 13, fontSize: 15, fontWeight: 800,
    cursor: "pointer", fontFamily: display, letterSpacing: 0.6,
  },
  ctaDisabled: { opacity: 0.25, cursor: "not-allowed", background: "#2c3447", color: "#8b90a4" },
};
