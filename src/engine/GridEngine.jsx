import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { RANKS, handAt, posOf, cascadeReveal, dominationReveal, radialReveal, distToRange } from "./poker.js";
import { computeFrontier } from "./frontier.js";
import { LEVELS, meterOf, optimalClicks, efficiency, coreAnchors } from "./scoring.js";

// ─────────────────────────────────────────────────────────────
// engine/GridEngine.jsx — LE moteur matrice réutilisable (spec §3).
// Un seul écran de grille ; les formats l'habillent (spec §0).
// Il GÈRE la sélection + le score et ÉMET des événements ; il ne
// décide NI le juice NI la méta-progression (ça reste aux écrans).
//
// Heatmap PERSISTANTE : exclue. Mais feedback de proximité PONCTUEL au clic
// (sigil ◆/↑/⇈ sur la case) pour aider à se situer.
//
// FRONTIÈRE PERSISTANTE (côté orange) : la spec d'aide réintroduit un
// marquage NON-éphémère, mais SEULEMENT sur les cases bien placées (enseigne
// sur le succès, jamais sur l'inconnu → on ne retombe pas dans la heatmap).
//
// API IMPÉRATIVE (ref) pour les aides « à la demande » du skin :
//   seedAnchor()      → Amorce : révèle 1 ancre-cœur + cascade
//   undoLastError()   → Rembobinage : annule la dernière erreur
//
// Props :
//   rangeData    { hands[], freqs?, name, context, stackBB, ... }
//   interaction  'reconstruct' | 'masked'
//   level        'beginner' | 'intermediate'  (→ recall/dice, winAt, k)
//   cascade      bool · bonuses { cascadeMultiplier(len)->n, boostedCascade, powerups[] }
//   revealed     bool · resetKey change → reset · prefill [mains] → cascade d'ouverture
//   frontierMarks  bool — côté orange persistant sur les frontières placées
//   focusOut       bool — masque/verrouille les cases clairement hors-range (aide Focus)
//   compassKey     number — change → glow sur le centroïde du cluster (aide Boussole)
//   revealFrontier bool — contoure toutes les frontières (aide Révéler-frontière)
//   onProgress(meter) · onState(snapshot incl. selected/solved)
//   onCascade({chain,length,multiplier,boosted}) · onCorrect({hand,chain,frontier})
//   onError({hand,dist,proximity,frontier}) · onSolve({stars,clicks,optimal,errors})
// ─────────────────────────────────────────────────────────────

const POWERUPS = {
  PEEK: "peek", // teinte faiblement les cases in-range
  SECOND_CHANCE: "second-chance", // 1re erreur pardonnée
  FREEZE: "freeze", // (timing — géré par l'hôte, no-op moteur)
  REVEAL_FRONTIER: "reveal-frontier", // surligne la frontière
};

const FOCUS_FAR = 3; // au-delà de cette distance Manhattan, "clairement hors-range"

const defaultCascadeMultiplier = (len) => (len >= 6 ? 3 : len >= 4 ? 2 : 1);

const inB = (a, b) => a >= 0 && b >= 0 && a <= 12 && b <= 12;

// Côtés d'une case (grille 13×13) tournés vers un voisin HORS-range → c'est là
// que la range « se termine » : on y pose un TIRET central orange (pas toute la
// ligne). Renvoie les côtés concernés ('top'|'bottom'|'left'|'right').
const outwardSides = (hand, target) => {
  const [i, j] = posOf[hand];
  const out = [];
  if (inB(i - 1, j) && !target.has(handAt(i - 1, j))) out.push("top");
  if (inB(i + 1, j) && !target.has(handAt(i + 1, j))) out.push("bottom");
  if (inB(i, j - 1) && !target.has(handAt(i, j - 1))) out.push("left");
  if (inB(i, j + 1) && !target.has(handAt(i, j + 1))) out.push("right");
  return out;
};

// Coins (diagonales) tournés vers un voisin HORS-range : complète le contour
// aux ANGLES du territoire (cas où les côtés orthogonaux sont in-range mais la
// diagonale sort). Renvoie 'tl'|'tr'|'bl'|'br'.
const DIAG = [["tl", -1, -1], ["tr", -1, 1], ["bl", 1, -1], ["br", 1, 1]];
const outwardCorners = (hand, target) => {
  const [i, j] = posOf[hand];
  const out = [];
  for (const [key, di, dj] of DIAG) {
    const a = i + di, b = j + dj;
    if (inB(a, b) && !target.has(handAt(a, b))) out.push(key);
  }
  return out;
};

const GridEngine = forwardRef(function GridEngine(
  {
    rangeData,
    interaction = "reconstruct",
    level = "beginner",
    cascade = true,
    bonuses = {},
    accent = "#10b981", // couleur d'identité du décor (reskin cosmique) ; vert = défaut
    accentText = "#9af0c8", // texte clair sur fond accent
    panel = "#0d0e15", // fond du panneau de grille (tinté par le décor)
    revealed = false,
    resetKey = 0,
    prefill = null,
    frontierMarks = false,
    focusOut = false,
    compassKey = null,
    revealFrontier = false,
    onProgress,
    onCascade,
    onCorrect,
    onError,
    onSolve,
    onState,
  },
  ref
) {
  const cfg = LEVELS[level] || LEVELS.beginner;
  const powerups = bonuses.powerups || [];
  const multFn = bonuses.cascadeMultiplier || defaultCascadeMultiplier;
  const masked = interaction === "masked";

  // Fréquences (cœur f:1, frontière 0<f<1). Défaut binaire si absentes (Lab).
  const freqs = useMemo(
    () => rangeData.freqs || Object.fromEntries(rangeData.hands.map((h) => [h, 1])),
    [rangeData]
  );
  const target = useMemo(() => new Set(rangeData.hands), [rangeData]);
  const optimal = useMemo(
    () => optimalClicks(rangeData.hands, cascade),
    [rangeData, cascade]
  );
  // Frontière de la range : toujours calculée (feedback au clic) ; un Set
  // sépare le powerup "reveal-frontier" (qui pré-surligne) du feedback.
  const frontierSet = useMemo(
    () => new Set(computeFrontier(rangeData.hands).map((f) => f.hand)),
    [rangeData]
  );
  const showFrontier = powerups.includes(POWERUPS.REVEAL_FRONTIER) || revealFrontier;

  // Cases « clairement hors-range » → grisées/verrouillées par l'aide Focus.
  const farSet = useMemo(() => {
    const s = new Set();
    for (let i = 0; i < 13; i++)
      for (let j = 0; j < 13; j++) {
        const h = handAt(i, j);
        if (!target.has(h) && distToRange(h, target) > FOCUS_FAR) s.add(h);
      }
    return s;
  }, [target]);

  // Centroïde du cluster (cible de la Boussole).
  const centroidHand = useMemo(() => {
    let si = 0, sj = 0, n = 0;
    target.forEach((h) => { const [i, j] = posOf[h]; si += i; sj += j; n++; });
    if (!n) return null;
    const ci = Math.max(0, Math.min(12, Math.round(si / n)));
    const cj = Math.max(0, Math.min(12, Math.round(sj / n)));
    return handAt(ci, cj);
  }, [target]);

  const [selected, setSelected] = useState(() => new Set());
  const [errors, setErrors] = useState(0);
  const [clicks, setClicks] = useState(0);
  const [mark, setMark] = useState(null); // {key, hand, kind} — sigil transitoire sur la case cliquée
  const [bloom, setBloom] = useState(null); // {key, center, cells} — éclatement radial transitoire
  const [compassOn, setCompassOn] = useState(false);
  const secondChanceRef = useRef(false);
  const solvedRef = useRef(false);
  const errorOrderRef = useRef([]); // pile des erreurs (pour Rembobinage)

  // Réinitialisation sur changement de spot, de niveau, de prefill ou via resetKey.
  // `prefill` = ancres semées par le guess → cascade d'ouverture (le cœur se
  // "détonne" tout seul ; la frontière reste à finir à la main).
  useEffect(() => {
    const init = new Set();
    if (prefill && prefill.length) {
      prefill.forEach((h) => cascadeReveal(h, target).forEach((x) => init.add(x)));
    }
    setSelected(init);
    setErrors(0);
    setClicks(0);
    setMark(null);
    setBloom(null);
    secondChanceRef.current = false;
    solvedRef.current = false;
    errorOrderRef.current = [];
    if (init.size > 1) {
      onCascade && onCascade({ chain: [...init], length: init.size, multiplier: 1, boosted: false, opening: true });
    }
  }, [rangeData, level, resetKey, prefill]); // eslint-disable-line react-hooks/exhaustive-deps

  // Le sigil s'efface après un court instant.
  useEffect(() => {
    if (!mark) return;
    const t = setTimeout(() => setMark(null), 1100);
    return () => clearTimeout(t);
  }, [mark]);

  // L'éclatement radial se résorbe après l'anim.
  useEffect(() => {
    if (!bloom) return;
    const t = setTimeout(() => setBloom(null), 600);
    return () => clearTimeout(t);
  }, [bloom]);

  // Pulse de la Boussole (glow sur le centroïde, transitoire).
  useEffect(() => {
    if (!compassKey) return;
    setCompassOn(true);
    const t = setTimeout(() => setCompassOn(false), 1700);
    return () => clearTimeout(t);
  }, [compassKey]);

  const meter = useMemo(
    () => meterOf(selected, freqs, cfg.mode),
    [selected, freqs, cfg.mode]
  );
  const { quota, stars } = useMemo(
    () => efficiency(errors, rangeData.hands, cfg.k),
    [errors, rangeData, cfg.k]
  );
  // La FRONTIÈRE (0<f<1) doit toujours être finie à la main pour valider —
  // un bon guess détonne le cœur mais ne gagne jamais le niveau seul (spec §5).
  const frontierHands = useMemo(
    () => Object.keys(freqs).filter((h) => freqs[h] > 0 && freqs[h] < 1),
    [freqs]
  );
  const frontierDone = frontierHands.every((h) => selected.has(h));
  const solved = meter >= cfg.winAt && selected.size > 0 && frontierDone;

  // ── Émission d'événements (l'hôte décide quoi en faire) ──
  useEffect(() => {
    onProgress && onProgress(meter);
  }, [meter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onState &&
      onState({
        meter,
        clicks,
        errors,
        optimal,
        quota,
        stars,
        selectedCount: selected.size,
        selected: [...selected],
        solved,
      });
  }, [meter, clicks, errors, optimal, quota, stars, solved]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (solved && !solvedRef.current) {
      solvedRef.current = true;
      onSolve && onSolve({ stars, clicks, optimal, errors });
    }
  }, [solved]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── API impérative pour les aides du skin ───────────────────
  useImperativeHandle(
    ref,
    () => ({
      // Amorce : révèle la première ancre-cœur pas encore couverte + sa cascade.
      // N'octroie PAS de Heat (c'est une aide, pas une réussite du joueur).
      seedAnchor() {
        const core = Object.keys(freqs).filter((h) => freqs[h] === 1);
        const anchors = coreAnchors(core);
        for (const a of anchors) {
          const chain = cascade ? cascadeReveal(a, target) : [a];
          if (chain.every((h) => selected.has(h))) continue;
          setSelected((prev) => {
            const n = new Set(prev);
            chain.forEach((h) => n.add(h));
            return n;
          });
          onCascade && onCascade({ chain, length: chain.length, multiplier: 1, boosted: false, opening: true });
          return a;
        }
        return null;
      },
      // Rembobinage : retire la dernière erreur (et son décompte). L'hôte
      // restaure la Heat associée.
      undoLastError() {
        const stack = errorOrderRef.current;
        if (!stack.length) return null;
        const h = stack.pop();
        setSelected((prev) => {
          const n = new Set(prev);
          n.delete(h);
          return n;
        });
        setErrors((e) => Math.max(0, e - 1));
        return h;
      },
    }),
    [freqs, target, cascade, selected] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const toggle = (hand) => {
    if (revealed) return;
    if (focusOut && farSet.has(hand) && !selected.has(hand)) return; // verrouillé par Focus
    const next = new Set(selected);

    if (next.has(hand)) {
      // désélection main par main (pour corriger) — pas de cascade inverse
      next.delete(hand);
      const idx = errorOrderRef.current.indexOf(hand);
      if (idx >= 0) errorOrderRef.current.splice(idx, 1); // l'erreur n'est plus là
    } else if (target.has(hand)) {
      // Reveal selon Heat + géométrie :
      //   froid              → cascade LINÉAIRE (1 axe, vers le plus fort)
      //   chaud + CŒUR       → ÉCLATEMENT RADIAL 1 anneau (voisines in-range)
      //   chaud + BORD       → flood de DOMINATION (comportement boosté existant)
      const boosted = !!bonuses.boostedCascade;
      const interior = !frontierSet.has(hand); // entourée = pas une frontière
      let chain;
      let isBloom = false;
      let bloomRing = null;
      if (!cascade) {
        chain = [hand];
      } else if (boosted) {
        // Le déroulé VERS LE HAUT (domination) reste PRIORITAIRE. L'éclatement
        // n'AJOUTE que l'anneau de voisines + son anim : il ne prend jamais le
        // pas sur la cascade qui remonte la range.
        const base = dominationReveal(hand, target);
        if (interior) {
          const ring = radialReveal(hand, target);
          const set = new Set(base);
          ring.forEach((h) => set.add(h));
          chain = [...set];
          if (ring.length > 1) { isBloom = true; bloomRing = ring; }
        } else {
          chain = base;
        }
      } else {
        chain = cascadeReveal(hand, target);
      }
      chain.forEach((h) => next.add(h));
      const onFront = frontierSet.has(hand);
      setMark({ key: Date.now(), hand, kind: onFront ? "front-pos" : "in" });
      if (isBloom) setBloom({ key: Date.now(), center: hand, cells: new Set(bloomRing) });
      onCorrect && onCorrect({ hand, chain, frontier: onFront });
      if (chain.length > 1) {
        onCascade &&
          onCascade({ chain, length: chain.length, multiplier: multFn(chain.length), boosted, bloom: isBloom });
      }
    } else {
      // hors-range : erreur (sauf Seconde chance qui pardonne la 1re).
      // Proximité = distance à la frontière → aide le joueur à se situer.
      next.add(hand);
      const dist = distToRange(hand, target);
      const proximity = dist <= 1 ? "frontier" : dist <= 3 ? "near" : "far";
      setMark({ key: Date.now(), hand, kind: proximity === "frontier" ? "front-neg" : proximity });
      if (powerups.includes(POWERUPS.SECOND_CHANCE) && !secondChanceRef.current) {
        secondChanceRef.current = true;
      } else {
        setErrors((e) => e + 1);
        errorOrderRef.current.push(hand); // mémorise pour Rembobinage
      }
      onError && onError({ hand, dist, proximity, frontier: proximity === "frontier" });
    }

    setSelected(next);
    setClicks((c) => c + 1);
  };

  const peek = powerups.includes(POWERUPS.PEEK);

  return (
    <div style={{ ...S.gridWrap, background: panel }}>
      <div style={S.grid}>
        {RANKS.map((_, i) =>
          RANKS.map((__, j) => {
            const hand = handAt(i, j);
            const isSel = selected.has(hand);
            const inTarget = target.has(hand);
            const isPair = i === j;
            const isSuited = i < j;

            let bg = isPair ? "#1c2030" : isSuited ? "#171a26" : "#12141d";
            let border = "transparent";
            let color = "#5b6075";
            let label = hand;
            let opacity = 1;

            // Masqué (Fog / placeholder) : on cache l'identité tant que non révélée.
            if (masked && !revealed && !isSel) {
              label = "?";
              color = "#3f4458";
            }

            // Indices power-ups (Labo) — Peek + Reveal frontier.
            if (peek && inTarget && !isSel && !revealed) {
              bg = accent + "0f";
            }
            if (showFrontier && frontierSet.has(hand) && !revealed) {
              border = "#6b7088";
            }

            // Solution révélée.
            if (revealed && inTarget) {
              bg = accent + "22";
              border = accent;
              color = accentText;
            }
            // Sélection joueur.
            if (isSel) {
              if (inTarget) {
                bg = accent + "33";
                border = accent;
                color = accentText;
              } else {
                bg = "#ef444433";
                border = "#ef4444";
                color = "#ffb4b4";
              }
              label = hand;
            }

            // Aide Focus : estompe + verrouille les cases clairement hors-range.
            const dim = focusOut && !revealed && !isSel && farSet.has(hand);
            if (dim) opacity = 0.16;

            const boxShadow = `inset 0 0 0 1px ${border}`;

            // Marqueurs de FRONTIÈRE (mode normal/tuto), sur les cases PLACÉES :
            //   - non-paire → TIRET central orange du côté tourné vers le fold
            //   - paire     → COIN orange sur la PLUS PETITE paire de la range
            //     (un tiret n'indiquerait rien d'utile sur la diagonale des pockets)
            // Marqueurs de FRONTIÈRE (mode normal/tuto) sur les cases PLACÉES,
            // MÊMES règles pour tous (paires comprises) : tirets sur les côtés
            // orthogonaux hors-range + coins sur les diagonales hors-range. Le bas
            // de la range de pockets ressort naturellement comme coin ↘.
            let dashes = [];
            let corners = [];
            if (frontierMarks && isSel && inTarget && !revealed) {
              dashes = outwardSides(hand, target);
              corners = outwardCorners(hand, target);
            }

            const isCompass = compassOn && hand === centroidHand;
            const inBloom = bloom && bloom.cells.has(hand);
            const showMark = mark && mark.hand === hand && MARK[mark.kind].s;
            return (
              <button
                key={hand}
                onClick={() => toggle(hand)}
                disabled={dim}
                className={"cell" + (isCompass ? " cell-compass" : "") + (inBloom ? " cell-bloom" : "")}
                style={{
                  position: "relative",
                  background: bg,
                  boxShadow,
                  color,
                  opacity,
                  cursor: dim ? "default" : "pointer",
                  // l'éclatement irradie : le centre part d'abord, l'anneau suit
                  animationDelay: inBloom && hand !== bloom.center ? "0.06s" : undefined,
                }}
              >
                {label}
                {dashes.map((s) => (
                  <span key={s} className={"fdash fdash-" + s} />
                ))}
                {corners.map((c) => (
                  <span key={"c" + c} className={"fcorner fcorner-" + c} />
                ))}
                {showMark && (
                  <span key={mark.key} className="cell-mark" style={{ color: mark.kind === "front-pos" ? accent : MARK[mark.kind].c }}>
                    {MARK[mark.kind].s}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
});

export default GridEngine;

// Sigils de feedback au clic (frontière + proximité d'erreur).
//   front-pos = bonne main pile sur le fil · front-neg = erreur tout proche
//   near = un peu trop large · far = beaucoup trop large/haut
const MARK = {
  "front-pos": { s: "◆", c: "#10b981" },
  "front-neg": { s: "◆", c: "#f59e0b" },
  near: { s: "↑", c: "#eab308" },
  far: { s: "⇈", c: "#3b82f6" },
  in: { s: "", c: "transparent" },
};

const mono = "'JetBrains Mono', monospace";
const S = {
  gridWrap: { background: "#0d0e15", padding: 8, borderRadius: 12 },
  grid: { display: "grid", gridTemplateColumns: "repeat(13, 1fr)", gap: 3 },
};

// styles de cellule partagés (injectés une fois par l'app, cf. index.css /
// les formats). Repris à l'identique du proto.
export const GRID_CSS = `
.cell {
  aspect-ratio: 1; border: none; border-radius: 4;
  font-size: 9.5px; font-weight: 500; font-family: ${mono}; cursor: pointer;
  display: flex; align-items: center; justify-content: center; padding: 0;
  border-radius: 4px;
  transition: transform .08s ease, background .12s ease, opacity .2s ease;
}
.cell:hover { transform: scale(1.12); z-index: 5; }
.cell:active { transform: scale(.94); }
.cell:disabled { transform: none; }
.cell-mark {
  position: absolute; top: -5px; right: -3px; font-size: 11px; font-weight: 800;
  pointer-events: none; line-height: 1; text-shadow: 0 1px 2px rgba(0,0,0,.6);
  animation: markPop .55s cubic-bezier(.2,.9,.2,1); z-index: 6;
}
@keyframes markPop {
  0% { transform: scale(0) translateY(5px); opacity: 0; }
  55% { transform: scale(1.35) translateY(-3px); opacity: 1; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}
.cell-compass { animation: compassGlow 1.7s ease-out; z-index: 7; }
@keyframes compassGlow {
  0%   { box-shadow: 0 0 0 0 #f59e0b00; }
  25%  { box-shadow: 0 0 0 4px #f59e0bcc, 0 0 16px 4px #f59e0b88; transform: scale(1.18); }
  100% { box-shadow: 0 0 0 0 #f59e0b00; transform: scale(1); }
}
.cell-bloom { animation: cellBloom .5s ease-out; z-index: 6; }
@keyframes cellBloom {
  0%   { transform: scale(.85); box-shadow: 0 0 0 0 #f59e0b00; }
  45%  { transform: scale(1.3);  box-shadow: 0 0 11px 2px #f59e0baa; }
  100% { transform: scale(1);   box-shadow: 0 0 0 0 #f59e0b00; }
}
/* Marqueurs de frontière : tiret central (côté fold) + coin (plus petite paire) */
.fdash { position: absolute; background: #f59e0b; border-radius: 1px; pointer-events: none; z-index: 4; }
.fdash-top    { top: 1px;    left: 30%; width: 40%; height: 2.5px; }
.fdash-bottom { bottom: 1px; left: 30%; width: 40%; height: 2.5px; }
.fdash-left   { left: 1px;   top: 30%; width: 2.5px; height: 40%; }
.fdash-right  { right: 1px;  top: 30%; width: 2.5px; height: 40%; }
.fcorner { position: absolute; width: 0; height: 0; pointer-events: none; z-index: 4; }
.fcorner-br { right: 1px; bottom: 1px; border-left: 6px solid transparent;  border-bottom: 6px solid #f59e0b; }
.fcorner-bl { left: 1px;  bottom: 1px; border-right: 6px solid transparent; border-bottom: 6px solid #f59e0b; }
.fcorner-tr { right: 1px; top: 1px;    border-left: 6px solid transparent;  border-top: 6px solid #f59e0b; }
.fcorner-tl { left: 1px;  top: 1px;    border-right: 6px solid transparent; border-top: 6px solid #f59e0b; }
`;
