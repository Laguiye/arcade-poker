// ─────────────────────────────────────────────────────────────
// formats/index.js — registre des formats (skins sur GridEngine).
// L'écran Level résout un nœud de la carte vers son composant via
// sa clé `format`. Ajouter un format = une ligne ici.
// ─────────────────────────────────────────────────────────────

import RangeMystery from "./RangeMystery.jsx";
import Run from "./Run.jsx";
import Fog from "./Fog.jsx";

export const FORMATS = {
  "range-mystery": RangeMystery,
  run: Run,
  fog: Fog,
};
