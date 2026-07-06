import React, { useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────
// components/juice — le juice est une VRAIE feature (~70% de la
// rétention arcade, spec §7), pas de la déco de fin. Composants
// réutilisables, pilotés par les events du GridEngine.
// ─────────────────────────────────────────────────────────────

const display = "'Bricolage Grotesque', sans-serif";

// Chiffre qui jaillit puis monte/fond. `trigger` = clé qui change pour rejouer.
export function PopNumber({ trigger, text, color = "#7ee2b8", size = 28 }) {
  if (text == null) return null;
  return (
    <span
      key={trigger}
      className="juice-pop"
      style={{ fontFamily: display, fontWeight: 800, fontSize: size, color, display: "inline-block" }}
    >
      {text}
    </span>
  );
}

// Enveloppe qui tremble brièvement quand `shakeKey` change (gros combo / erreur).
// IMPORTANT : on relance l'animation via ref + reflow, SANS remonter le sous-arbre
// (un `key` ici réinitialiserait l'état de tout enfant — ex. le GridEngine).
export function ScreenShake({ shakeKey = 0, children, style }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!shakeKey || !ref.current) return;
    const el = ref.current;
    el.classList.remove("juice-shake");
    void el.offsetWidth; // force reflow → l'animation peut rejouer
    el.classList.add("juice-shake");
  }, [shakeKey]);
  return (
    <div ref={ref} style={style}>
      {children}
    </div>
  );
}

// Confettis légers (3★ / PERFECT). `burst` = clé qui change pour relancer.
export function Confetti({ burst, count = 24 }) {
  const [pieces, setPieces] = useState([]);
  const lastRef = useRef(null);
  useEffect(() => {
    if (burst == null || burst === lastRef.current) return;
    lastRef.current = burst;
    const colors = ["#10b981", "#f5b301", "#3b82f6", "#ef4444", "#e7e9f0"];
    setPieces(
      Array.from({ length: count }).map((_, i) => ({
        id: `${burst}-${i}`,
        left: Math.random() * 100,
        delay: Math.random() * 0.2,
        rot: Math.random() * 360,
        color: colors[i % colors.length],
        dur: 0.9 + Math.random() * 0.6,
      }))
    );
    const t = setTimeout(() => setPieces([]), 1800);
    return () => clearTimeout(t);
  }, [burst, count]);

  if (!pieces.length) return null;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 20 }}>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="juice-confetti"
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            transform: `rotate(${p.rot}deg)`,
          }}
        />
      ))}
    </div>
  );
}

// CSS partagé des effets de juice.
export const JUICE_CSS = `
.juice-pop { animation: juicePop .5s cubic-bezier(.2,.9,.2,1); }
@keyframes juicePop {
  0% { transform: translateY(6px) scale(.7); opacity: 0; }
  35% { transform: translateY(-6px) scale(1.15); opacity: 1; }
  100% { transform: translateY(-2px) scale(1); opacity: 1; }
}
.juice-shake { animation: juiceShake .32s ease; }
@keyframes juiceShake {
  0%,100% { transform: translateX(0); }
  20% { transform: translateX(-7px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(3px); }
}
.juice-confetti {
  position: absolute; top: -12px; width: 8px; height: 12px; border-radius: 2px;
  animation-name: juiceFall; animation-timing-function: ease-in; animation-fill-mode: forwards;
}
@keyframes juiceFall {
  to { top: 110%; opacity: 0; }
}
.assist-pulse { animation: assistPulse 1.4s ease-in-out infinite; }
@keyframes assistPulse {
  0%, 100% { box-shadow: 0 0 0 0 #f59e0b00; }
  50% { box-shadow: 0 0 0 3px #f59e0b33; }
}
.combo-tick { animation: comboTick .3s ease; }
@keyframes comboTick {
  0% { transform: scale(1.45); color: #f59e0b; }
  100% { transform: scale(1); }
}
`;
