import React, { useState } from "react";
import { useStore } from "../state/store.jsx";
import { AVATAR_LIST, avatarOf } from "../data/avatars.js";

// ─────────────────────────────────────────────────────────────
// screens/AvatarSelect.jsx — choix du perso (spec §2). Chaque avatar
// porte un MODIFICATEUR de run (cf. data/avatars.js) : le choix compte.
// ─────────────────────────────────────────────────────────────

export default function AvatarSelect() {
  const { dispatch } = useStore();
  const [sel, setSel] = useState(null);
  const selAv = sel ? avatarOf(sel) : null;

  return (
    <div style={S.root}>
      <div style={S.kicker}>NOUVELLE PARTIE</div>
      <h1 style={S.title}>Choisis ton joueur</h1>
      <p style={S.lead}>Chaque perso a un style de jeu qui modifie tes Runs.</p>

      <div style={S.grid}>
        {AVATAR_LIST.map((a) => (
          <button
            key={a.id}
            onClick={() => setSel(a.id)}
            style={{ ...S.avatar, ...(sel === a.id ? S.avatarSel : {}) }}
          >
            <span style={{ fontSize: 40, color: a.tint }}>{a.glyph}</span>
          </button>
        ))}
      </div>

      <div style={S.info}>
        {selAv ? (
          <>
            <div style={{ ...S.infoName, color: selAv.tint }}>{selAv.glyph} {selAv.name}</div>
            <div style={S.infoPerk}>{selAv.perk}</div>
          </>
        ) : (
          <div style={S.infoPerk}>Touche un perso pour voir son style.</div>
        )}
      </div>

      <button
        style={{ ...S.cta, ...(sel ? {} : S.ctaDisabled) }}
        disabled={!sel}
        onClick={() => dispatch({ type: "SELECT_AVATAR", avatarId: sel })}
      >
        Entrer dans la quête →
      </button>
    </div>
  );
}

const display = "'Bricolage Grotesque', sans-serif";
const mono = "'JetBrains Mono', monospace";
const S = {
  root: {
    maxWidth: 480, margin: "0 auto", textAlign: "center", padding: "40px 22px",
    fontFamily: mono, color: "#e7e9f0",
  },
  kicker: { fontSize: 10, letterSpacing: 3, color: "#5b6075", fontWeight: 700, marginBottom: 6 },
  title: { fontFamily: display, fontSize: 34, fontWeight: 800, margin: "0 0 8px" },
  lead: { color: "#8b90a4", fontSize: 13, margin: "0 0 28px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 },
  info: { minHeight: 56, marginBottom: 20, display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 },
  infoName: { fontFamily: display, fontSize: 17, fontWeight: 800 },
  infoPerk: { fontSize: 12.5, color: "#8b90a4" },
  avatar: {
    aspectRatio: "1", background: "#12141d", border: "2px solid #1b1e2b", borderRadius: 16,
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    transition: "transform .1s ease, border-color .15s ease",
  },
  avatarSel: { border: "2px solid #e7e9f0", transform: "scale(1.06)", background: "#1c2030" },
  cta: {
    width: "100%", background: "#e7e9f0", border: "none", color: "#0a0b10",
    padding: "14px", borderRadius: 11, fontSize: 14, fontWeight: 800, cursor: "pointer",
    fontFamily: mono, letterSpacing: 0.5,
  },
  ctaDisabled: { opacity: 0.3, cursor: "not-allowed" },
};
