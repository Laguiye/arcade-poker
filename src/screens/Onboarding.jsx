import React, { useState } from "react";
import { useStore } from "../state/store.jsx";
import { THEMES } from "../theme/cosmic.js";

// ─────────────────────────────────────────────────────────────
// screens/Onboarding.jsx — PREMIÈRE IMPRESSION (DA cosmique).
//
//   Boot  : écran-titre — ciel étoilé, ♠ soleil + ♥♦♣ en orbite,
//           titre dégradé, CTA « Décoller » qui pulse.
//   Intro : 3 slides (une fois par save, passables) — ① la galaxie
//           et ses secteurs ② le principe (mini-range qui s'allume)
//           ③ la boucle (étoiles → gems → boutique → Spin & Go).
//
// Flow : Boot → AvatarSelect → Intro → Carte (SELECT_AVATAR route
// vers `intro` ; les saves existantes reprennent direct sur la carte).
// Styles animés dans ONBOARD_CSS (classes ob-*), injecté par App.
// ─────────────────────────────────────────────────────────────

const display = "'Bricolage Grotesque', sans-serif";
const mono = "'JetBrains Mono', monospace";

// ── Écran-titre ──────────────────────────────────────────────
export function Boot({ onStart }) {
  return (
    <div style={S.root}>
      <div className="ob-stars" aria-hidden />
      <div className="ob-stars ob-stars2" aria-hidden />

      <div style={S.orbitBox} className="ob-rise">
        <div style={S.sunHalo} />
        <div style={S.sun} className="ob-float">♠</div>
        <div className="ob-ring ob-ring1"><span className="ob-planet" style={{ color: "#ef6b5e" }}>♥</span></div>
        <div className="ob-ring ob-ring2"><span className="ob-planet" style={{ color: "#5b9bff" }}>♦</span></div>
        <div className="ob-ring ob-ring3"><span className="ob-planet" style={{ color: "#10b981" }}>♣</span></div>
      </div>

      <div style={S.kicker} className="ob-rise ob-d1">LA GALAXIE DES RANGES</div>
      <h1 style={S.title} className="ob-rise ob-d2">ARCADE&nbsp;POKER</h1>
      <p style={S.tag} className="ob-rise ob-d3">
        Maîtrise les ranges, du tapis le plus court au plus profond — secteur après secteur.
      </p>
      <button style={S.cta} className="ob-rise ob-d4 ob-cta" onClick={onStart}>Décoller 🚀</button>
      <div style={S.foot} className="ob-rise ob-d5">3 secteurs · 4 pilotes · 1 table Spin &amp; Go</div>
    </div>
  );
}

// ── Intro : 3 slides ─────────────────────────────────────────
// Mini-range décorative (slide 2) : coin fort d'une grille 13×13.
const litCell = (i, j) =>
  i === j || (i === 0 && j < 10) || (j === 0 && i < 8) || (i < 3 && j < 6) || (j < 2 && i < 5) || (i < 2 && j < 8);

function MiniGrid() {
  const acc = THEMES.orbite.accent;
  return (
    <div style={S.gridBox}>
      {Array.from({ length: 13 }, (_, i) => (
        <div key={i} style={{ display: "flex", gap: 2 }}>
          {Array.from({ length: 13 }, (_, j) => {
            const on = litCell(i, j);
            return (
              <span
                key={j}
                className={on ? "ob-cell" : undefined}
                style={{
                  width: 9, height: 9, borderRadius: 2,
                  background: on ? acc : "rgba(231,233,240,.07)",
                  boxShadow: on ? `0 0 6px -1px ${acc}` : "none",
                  animationDelay: on ? `${(i + j) * 0.07}s` : undefined,
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Slide 1 : les 3 secteurs de la carte.
const SECTORS = [
  { icon: "☀️", name: "SPIN", sub: "tapis courts", th: THEMES.aube },
  { icon: "🪐", name: "MTT", sub: "tapis moyens", th: THEMES.nebula },
  { icon: "🌙", name: "CASH", sub: "tapis profonds", th: THEMES.confins },
];

function SlideGalaxy() {
  return (
    <div style={S.slideVisual}>
      {SECTORS.map((s, k) => (
        <React.Fragment key={s.name}>
          {k > 0 && <div style={S.pathDash} />}
          <div style={{ ...S.sectorChip, borderColor: s.th.frame, boxShadow: `0 0 18px -6px ${s.th.glow}` }}>
            <span style={{ fontSize: 22 }}>{s.icon}</span>
            <b style={{ fontFamily: display, fontSize: 13, color: s.th.accentText }}>{s.name}</b>
            <span style={{ fontSize: 9, color: "#8b90a4" }}>{s.sub}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

// Slide 3 : la boucle de jeu.
const LOOP = [
  { icon: "⭐", txt: "Chaque niveau maîtrisé rapporte des étoiles, des jetons et de l'XP." },
  { icon: "💎", txt: "Les gems (maîtrise, missions, runs) améliorent ton vaisseau à la boutique." },
  { icon: "🃏", txt: "Et la table SPIN & GO : une vraie partie, avec un coach qui juge chaque décision." },
];

function SlideLoop() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "6px 0 2px" }}>
      {LOOP.map((r, k) => (
        <div key={k} className={`ob-rise ob-d${k + 1}`} style={S.loopRow}>
          <span style={S.loopIcon}>{r.icon}</span>
          <span style={S.loopTxt}>{r.txt}</span>
        </div>
      ))}
    </div>
  );
}

const SLIDES = [
  {
    kicker: "L'UNIVERS",
    title: "Une galaxie à conquérir",
    body: "Trois secteurs, du tapis court au tapis profond. Chaque nœud de la carte est une range à maîtriser.",
    visual: <SlideGalaxy />,
  },
  {
    kicker: "LE PRINCIPE",
    title: "Reconstruis la range",
    body: "Une range = l'ensemble des mains qui se jouent dans un spot. Allume les bonnes cases de la grille — moins de clics, plus d'étoiles.",
    visual: <MiniGrid />,
  },
  {
    kicker: "LA BOUCLE",
    title: "Joue, gagne, décolle",
    body: null,
    visual: <SlideLoop />,
  },
];

export function Intro() {
  const { dispatch } = useStore();
  const [idx, setIdx] = useState(0);
  const slide = SLIDES[idx];
  const last = idx === SLIDES.length - 1;
  const done = () => dispatch({ type: "GO", screen: "map" });

  return (
    <div style={S.root}>
      <div className="ob-stars" aria-hidden />
      <button style={S.skip} onClick={done}>Passer ✕</button>

      {/* key={idx} → l'animation d'entrée rejoue à chaque slide */}
      <div key={idx} style={S.slideWrap}>
        <div className="ob-rise">{slide.visual}</div>
        <div style={S.kicker} className="ob-rise ob-d1">{slide.kicker}</div>
        <h2 style={S.slideTitle} className="ob-rise ob-d2">{slide.title}</h2>
        {slide.body && <p style={S.tag} className="ob-rise ob-d3">{slide.body}</p>}
      </div>

      <div style={S.dots}>
        {SLIDES.map((_, k) => (
          <span key={k} style={{ ...S.dot, ...(k === idx ? S.dotOn : {}) }} onClick={() => setIdx(k)} />
        ))}
      </div>
      <button
        style={S.cta}
        className={last ? "ob-cta" : undefined}
        onClick={() => (last ? done() : setIdx(idx + 1))}
      >
        {last ? "Décoller 🚀" : "Suivant →"}
      </button>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────
const S = {
  root: {
    position: "relative", maxWidth: 440, margin: "0 auto", textAlign: "center",
    padding: "40px 22px 30px", fontFamily: mono, color: "#e7e9f0", minHeight: "70vh",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
  },

  // écran-titre
  orbitBox: { position: "relative", width: 240, height: 240, margin: "0 auto 6px" },
  sunHalo: {
    position: "absolute", left: "50%", top: "50%", width: 130, height: 130,
    transform: "translate(-50%,-50%)", borderRadius: "50%",
    background: "radial-gradient(circle, rgba(245,168,58,.30) 0%, rgba(245,168,58,.08) 55%, transparent 72%)",
    filter: "blur(2px)",
  },
  sun: {
    position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)",
    fontSize: 64, lineHeight: 1, color: "#e7e9f0",
    textShadow: "0 0 26px rgba(245,168,58,.75), 0 0 60px rgba(245,168,58,.35)",
  },
  kicker: { fontSize: 10, letterSpacing: 4, color: "#f5a83a", fontWeight: 700, marginBottom: 8 },
  title: {
    fontFamily: display, fontSize: 42, fontWeight: 800, letterSpacing: 1, margin: "0 0 12px", lineHeight: 1.05,
    background: "linear-gradient(100deg, #ffd79a 0%, #e7e9f0 45%, #b3f1ed 100%)",
    WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
  },
  tag: { color: "#8b90a4", fontSize: 13, margin: "0 0 26px", lineHeight: 1.6, maxWidth: 340 },
  cta: {
    background: "linear-gradient(135deg, #f5a83a 0%, #f06f9e 100%)", border: "none", color: "#1a0d05",
    padding: "15px 34px", borderRadius: 13, fontSize: 15, fontWeight: 800, cursor: "pointer",
    fontFamily: display, letterSpacing: 0.6,
  },
  foot: { marginTop: 22, fontSize: 10, letterSpacing: 1.5, color: "#5b6075" },

  // intro
  skip: {
    position: "absolute", top: 10, right: 10, background: "transparent", border: "none",
    color: "#6b7088", cursor: "pointer", fontFamily: mono, fontSize: 12, padding: 6,
  },
  slideWrap: { minHeight: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" },
  slideTitle: { fontFamily: display, fontSize: 27, fontWeight: 800, margin: "0 0 10px" },
  slideVisual: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, margin: "8px 0 22px" },
  sectorChip: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
    background: "#0d0e15", borderWidth: 1, borderStyle: "solid", borderRadius: 14, padding: "12px 14px", minWidth: 74,
  },
  pathDash: { width: 20, borderTop: "2px dashed #2c3447" },
  gridBox: { display: "flex", flexDirection: "column", gap: 2, margin: "4px 0 22px" },
  loopRow: {
    display: "flex", alignItems: "center", gap: 12, textAlign: "left",
    background: "#0d0e15", border: "1px solid #1b1e2b", borderRadius: 13, padding: "12px 14px", maxWidth: 360,
  },
  loopIcon: { fontSize: 22, flexShrink: 0 },
  loopTxt: { fontSize: 12, color: "#cdd3e0", lineHeight: 1.5 },
  dots: { display: "flex", gap: 8, margin: "18px 0 16px" },
  dot: { width: 8, height: 8, borderRadius: "50%", background: "#2c3447", cursor: "pointer", transition: "background .2s, transform .2s" },
  dotOn: { background: "#f5a83a", transform: "scale(1.25)" },
};

// ── CSS animé (injecté une fois par App) ─────────────────────
export const ONBOARD_CSS = `
/* ciel étoilé (2 couches, scintillement décalé) */
.ob-stars{position:fixed;inset:0;pointer-events:none;z-index:0}
.ob-stars::before{content:"";position:absolute;width:2px;height:2px;border-radius:50%;background:transparent;
box-shadow:8vw 12vh 0 0 rgba(231,233,240,.7),22vw 32vh 0 0 rgba(231,233,240,.4),31vw 8vh 0 0 rgba(231,233,240,.6),
44vw 24vh 0 0 rgba(231,233,240,.35),57vw 6vh 0 0 rgba(231,233,240,.55),66vw 30vh 0 0 rgba(231,233,240,.4),
79vw 14vh 0 0 rgba(231,233,240,.6),91vw 27vh 0 0 rgba(231,233,240,.4),13vw 55vh 0 0 rgba(231,233,240,.45),
28vw 68vh 0 0 rgba(231,233,240,.55),41vw 51vh 0 0 rgba(231,233,240,.3),55vw 73vh 0 0 rgba(231,233,240,.5),
69vw 58vh 0 0 rgba(231,233,240,.35),83vw 66vh 0 0 rgba(231,233,240,.55),94vw 49vh 0 0 rgba(231,233,240,.35),
6vw 84vh 0 0 rgba(231,233,240,.5),24vw 91vh 0 0 rgba(231,233,240,.35),49vw 88vh 0 0 rgba(231,233,240,.45),
72vw 93vh 0 0 rgba(231,233,240,.4),88vw 82vh 0 0 rgba(231,233,240,.5);
animation:ob-twinkle 3.4s ease-in-out infinite}
.ob-stars2::before{transform:translate(3vw,2vh) scale(.7);animation-delay:1.7s;opacity:.7}
@keyframes ob-twinkle{0%,100%{opacity:.9}50%{opacity:.35}}

/* orbites du boot : l'anneau tourne, le glyphe contre-tourne (reste droit) */
.ob-ring{position:absolute;left:50%;top:50%;border:1px dashed rgba(231,233,240,.10);border-radius:50%}
.ob-ring1{width:126px;height:126px;margin:-63px 0 0 -63px;animation:ob-spin 9s linear infinite}
.ob-ring2{width:176px;height:176px;margin:-88px 0 0 -88px;animation:ob-spin 15s linear infinite;animation-delay:-5s}
.ob-ring3{width:226px;height:226px;margin:-113px 0 0 -113px;animation:ob-spin 22s linear infinite;animation-delay:-13s}
.ob-planet{position:absolute;top:-11px;left:50%;margin-left:-11px;width:22px;height:22px;border-radius:50%;
display:flex;align-items:center;justify-content:center;font-size:13px;background:#0d0e15;
border:1px solid #2c3447;box-shadow:0 0 10px -2px currentColor}
.ob-ring1 .ob-planet{animation:ob-spin-rev 9s linear infinite}
.ob-ring2 .ob-planet{animation:ob-spin-rev 15s linear infinite;animation-delay:-5s}
.ob-ring3 .ob-planet{animation:ob-spin-rev 22s linear infinite;animation-delay:-13s}
@keyframes ob-spin{to{transform:rotate(360deg)}}
@keyframes ob-spin-rev{to{transform:rotate(-360deg)}}

/* flottement du soleil */
.ob-float{animation:ob-float 4.5s ease-in-out infinite}
@keyframes ob-float{0%,100%{transform:translate(-50%,-52%)}50%{transform:translate(-50%,-47%)}}

/* entrées en cascade — fill BACKWARDS (pas both) : une fois finie,
   l'animation rend la main aux styles inline (lift de sélection, hover) */
.ob-rise{animation:ob-rise .6s cubic-bezier(.2,.7,.3,1) backwards}
.ob-d1{animation-delay:.10s}.ob-d2{animation-delay:.20s}.ob-d3{animation-delay:.32s}
.ob-d4{animation-delay:.46s}.ob-d5{animation-delay:.60s}
@keyframes ob-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}

/* pulsation du CTA */
.ob-cta{animation:ob-rise .6s .46s cubic-bezier(.2,.7,.3,1) backwards,ob-glow 2.2s 1.2s ease-in-out infinite}
@keyframes ob-glow{0%,100%{box-shadow:0 0 22px -8px #f5a83a}50%{box-shadow:0 0 34px -6px #f06f9e}}

/* cases de la mini-range qui s'allument */
.ob-cell{animation:ob-cell .5s ease both}
@keyframes ob-cell{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}

/* cartes de pilote */
.ob-card{transition:transform .12s ease,border-color .15s ease,box-shadow .2s ease}
.ob-card:hover{transform:translateY(-2px)}
`;
