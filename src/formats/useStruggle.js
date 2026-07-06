import { useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────
// formats/useStruggle.js — DÉTECTION de la galère (ASSIST_SPEC §2).
//
// Vit dans le skin (méta), pas dans le moteur (« GridEngine émet, ne
// décide ni juice ni méta »). Consomme le snapshot du moteur + la Heat.
//
// Règle d'or : l'inactivité SEULE n'est pas une galère. Il faut un signal
// ET une stagnation. 2×2 (actif/idle × avance/stagne).
//   - BLOQUÉ  = temps absolu (idle) + peu de progrès
//   - COINCÉ  = idle/stagnation + progrès déjà haut
//   - IL RAME = actif + stagnant + Heat≈0 (la Heat EST le détecteur de rame)
//
// Le moteur étant event-driven, un joueur bloqué n'émet rien → un HEARTBEAT
// (500 ms) évalue les timers. Retourne 'none'|'bloque'|'rame'|'coince'.
// ─────────────────────────────────────────────────────────────

const HEARTBEAT = 500;
const GRACE_START = 5000; // il lit le spot
const GRACE_AID = 3000; // on laisse respirer après une aide
const IDLE = 9000; // pas de clic → "bloqué/coincé"
const STALL = 2500; // mètre figé récemment
const COINCE_STALL = 12000; // coincé même en cliquant un peu
const PROG_LOW = 0.35;
const PROG_HIGH = 0.6;
const EPS = 0.001;

export default function useStruggle({ snap, heat, winAt = 1, resetKey, enabled = true, lastAidAt = 0 }) {
  const [state, setState] = useState("none");

  // Valeurs « live » lues dans le heartbeat (évite de recréer l'intervalle).
  const live = useRef({});
  live.current = { snap, heat, winAt, enabled, lastAidAt };

  // Timers, réinitialisés à chaque nouveau spot.
  const t = useRef({ startTs: 0, lastClickTs: 0, lastProgressTs: 0, prevClicks: 0, prevMeter: 0 });

  useEffect(() => {
    const now = Date.now();
    t.current = {
      startTs: now,
      lastClickTs: now,
      lastProgressTs: now,
      prevClicks: snap.clicks,
      prevMeter: snap.meter,
    };
    setState("none");
  }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Met à jour les horodatages quand le snapshot bouge.
  useEffect(() => {
    const r = t.current;
    if (snap.clicks !== r.prevClicks) {
      r.lastClickTs = Date.now();
      r.prevClicks = snap.clicks;
    }
    if (snap.meter > r.prevMeter + EPS) {
      r.lastProgressTs = Date.now();
    }
    r.prevMeter = snap.meter;
  }, [snap.clicks, snap.meter]);

  // Heartbeat unique.
  useEffect(() => {
    const id = setInterval(() => {
      const { snap, heat, winAt, enabled, lastAidAt } = live.current;
      const r = t.current;
      const now = Date.now();

      if (!enabled || snap.solved) return setState("none");
      if (now - r.startTs < GRACE_START) return setState("none");
      if (lastAidAt && now - lastAidAt < GRACE_AID) return setState("none");

      const idle = now - r.lastClickTs;
      const stall = now - r.lastProgressTs;
      const pr = winAt ? snap.meter / winAt : 0;

      let s = "none";
      if (heat <= EPS && idle < IDLE && stall > STALL && snap.errors > 0) {
        s = "rame"; // prioritaire : arrêter l'hémorragie
      } else if (idle > IDLE && stall > STALL) {
        s = pr > PROG_HIGH ? "coince" : "bloque";
      } else if (pr > PROG_HIGH && stall > COINCE_STALL) {
        s = "coince";
      }
      setState(s);
    }, HEARTBEAT);
    return () => clearInterval(id);
  }, []);

  return state;
}
