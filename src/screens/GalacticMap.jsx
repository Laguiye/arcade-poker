import React, { useState } from "react";
import { useStore, levelFromXp, XP_PER_LEVEL } from "../state/store.jsx";
import { QUESTS, bandsFor, questUnlocked } from "../data/quest.js";
import { spotsWhere, spotById } from "../data/spots.js";
import { THEMES } from "../theme/cosmic.js";
import { MISSIONS, missionState, claimableCount } from "../data/missions.js";
import { SHOP_ITEMS, ownedLevel, isMaxed, nextCost } from "../data/shop.js";
import { AVATARS } from "../data/avatars.js";

// ─────────────────────────────────────────────────────────────
// screens/GalacticMap.jsx — ACCUEIL « carte galactique ».
//
// SECTEUR SPIN éclaté en 3 VOIES = 3 quêtes par position (BTN/SB/BB),
// chacune un CRESCENDO ORDONNÉ de tapis (3 → 25bb). Le nœud porte le
// TAPIS (le crescendo est lisible), la BB marque l'adversaire (B/S), et
// les étoiles sont RÉELLES par nœud (chaque spin = un spot fixe).
// SECTEUR MTT / CASH = quête mtt (bandes aléatoires), nœuds indexés,
// étoiles = meilleur de la bande (proxy).
//
// Reskin VISUEL : un nœud dispo/courant lance START_NEXT de sa quête.
// ─────────────────────────────────────────────────────────────

// Couleurs d'ÉTAT (fixes, hors-thème) — cf. légende de la maquette.
const CUR = "#5b9bff"; // COURANT (bleu, pulse + halo)
const AVAIL = "#f5a83a"; // DÉBLOQUÉ (orange, disponible)
const LOCK_BG = "#0e1018";
const LOCK_BORDER = "#262b3a";

// Voies du SECTEUR SPIN (même famille orange = short stack). Débloquées en
// chaîne : BTN ouvert ; SB après BTN (échelle 6) ; BB après SB.
const SPIN_LANES = [
  { quest: "spin-btn", title: "BTN", action: "OPEN-JAM", dot: "#5b9bff" },
  { quest: "spin-sb", title: "SB", action: "OPEN-JAM", dot: "#f5c84a", lockHint: "Finis BTN · échelle 6" },
  { quest: "spin-bb", title: "BB", action: "CALL vs BTN & SB", dot: "#c879e0", lockHint: "Finis SB · échelle 6" },
];
// Secteurs MTT / CASH (quête mtt, 2 bandes aléatoires).
const MTT_SECTORS = [
  { quest: "mtt", bi: 0, theme: THEMES.nebula, title: "SECTEUR MTT", stack: "MID STACK", icon: "🪐" },
  { quest: "mtt", bi: 1, theme: THEMES.confins, title: "SECTEUR CASH", stack: "DEEP STACK", icon: "🌌" },
];

// Disposition serpentine des nœuds (gauche→droite, puis on descend) — robuste
// pour n quelconque (8 pour BTN/SB, 16 pour BB, 3-4 pour MTT).
const PER_ROW = 4;
const XS = [14, 38, 62, 86]; // colonnes en %
const ROW_H = 58;
const PAD_Y = 30;
function layoutFor(n) {
  const pos = [];
  for (let k = 0; k < n; k++) {
    const row = Math.floor(k / PER_ROW);
    let col = k % PER_ROW;
    if (row % 2 === 1) col = PER_ROW - 1 - col; // serpentin
    pos.push([XS[col], PAD_Y + row * ROW_H]);
  }
  const rows = Math.ceil(n / PER_ROW);
  return { pos, h: PAD_Y * 2 + (rows - 1) * ROW_H };
}

// État d'un nœud k selon la progression de sa quête.
function nodeState(prog, bi, k, clears, activeQuest, quest) {
  const isActive = quest === activeQuest;
  if (bi < prog.bandIdx) return "done";
  if (bi > prog.bandIdx) return "locked";
  if (prog.clearedInBand >= clears) return k < clears - 1 ? "done" : isActive ? "current" : "available";
  if (k < prog.clearedInBand) return "done";
  if (k === prog.clearedInBand) return isActive ? "current" : "available";
  return "locked";
}

export default function GalacticMap() {
  const { state, dispatch } = useStore();
  const [sheet, setSheet] = useState(null);

  const av = AVATARS[state.player.avatarId] || AVATARS.spade;
  const { chips, xp, gems } = state.economy;
  const nClaimable = claimableCount(state);
  const level = levelFromXp(xp);
  const xpInto = xp - (level - 1) * XP_PER_LEVEL;
  const xpNeed = XP_PER_LEVEL;

  const playNode = (quest) => {
    if (!questUnlocked(state, quest)) return; // garde-fou : voie verrouillée
    if (state.quest !== quest) dispatch({ type: "SELECT_QUEST", quest });
    dispatch({ type: "START_NEXT" });
  };

  // ── Volets dépliables (état persisté dans les prefs) ─────────
  const questOpen = state.prefs.mapQuestOpen !== false;
  const arcadeOpen = state.prefs.mapArcadeOpen !== false;
  const toggle = (key, open) => dispatch({ type: "SET_PREF", key, value: !open });

  // ── Contexte du bouton CONTINUER (reprend la quête courante) ──
  const contQuest = QUESTS[state.quest];
  const contProg = state.progressions[state.quest];
  const contBands = bandsFor(state.quest);
  const contBi = Math.min(contProg.bandIdx, contBands.length - 1);
  const contBand = contBands[contBi];
  const contK = Math.min(contProg.clearedInBand, contBand.clears - 1);
  const contSpot = contBand.spotIds ? spotById[contBand.spotIds[contK]] : null;
  const contTheme = contQuest.sector === "spin" ? THEMES.aube : contBi > 0 ? THEMES.confins : THEMES.nebula;
  const contDetail = contSpot
    ? `${contQuest.label} · ${contBand.label} · tapis ${contSpot.stackBB}bb${contSpot.vs ? ` vs ${contSpot.vs}` : ""}`
    : `MTT · ${contBand.label} · niveau ${Math.min(contProg.clearedInBand + 1, contBand.clears)}/${contBand.clears}`;

  // ── Rendu d'une voie / secteur ──────────────────────────────
  const renderCard = ({ quest, bi = 0, theme, title, stack, icon, compact, locked, lockHint }) => {
    const prog = state.progressions[quest];
    const band = bandsFor(quest)[bi];

    // Voie VERROUILLÉE : une ligne compacte (moins de bruit visuel que
    // les cartes pleines — l'attention reste sur ce qui est jouable).
    if (locked) {
      return (
        <div key={`${quest}-locked`} style={S.lockedRow}>
          {icon && <span style={{ filter: "grayscale(1)", opacity: 0.5, display: "inline-flex" }}>{icon}</span>}
          <span style={S.lockedTitle}>{title}</span>
          <span style={S.lockedHint}>🔒 {lockHint}</span>
        </div>
      );
    }
    const clears = band.clears;
    const ordered = !!band.spotIds;
    const layout = layoutFor(clears);
    // Étoiles : réelles par nœud (ordonné) ; sinon meilleur de la bande (proxy).
    const bandBest = ordered
      ? 0
      : spotsWhere(band.filter).reduce((m, s) => Math.max(m, prog.stars[s.id] || 0), 0);
    const path = layout.pos.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");

    // Pastilles d'échelle (6→8→10) : pleine = échelle finie, contour = en cours.
    // ✓ « validée » dès l'échelle 6 bouclée (maxBandReached ≥ 1).
    const allBands = bandsFor(quest);
    const hasEchelles = allBands[0].echelle != null;
    const lastBi = allBands.length - 1;
    const echDone = (i) =>
      i < prog.bandIdx ||
      (i === lastBi && prog.bandIdx === lastBi && prog.clearedInBand >= allBands[lastBi].clears);
    const validated = prog.maxBandReached >= 1;

    return (
      <div key={`${quest}-${bi}`} style={{ ...S.sector, ...(compact ? S.laneCard : {}), borderColor: `${theme.frame}55` }}>
        <div style={{ ...S.nebula, background: `radial-gradient(70% 60% at 40% 30%, ${theme.glow}1f 0%, transparent 70%)` }} />
        <div style={S.sectorHead}>
          {icon && <span style={{ ...S.sectorIcon, boxShadow: `0 0 16px -2px ${theme.glow}` }}>{icon}</span>}
          <div>
            <div style={{ ...S.sectorTitle, color: theme.accentText }}>{title}</div>
            <div style={S.sectorStack}>{stack}</div>
          </div>
          {hasEchelles && (
            <div style={S.tierWrap}>
              {validated && (
                <span style={{ ...S.validBadge, color: theme.accent, borderColor: `${theme.accent}99` }}>✓</span>
              )}
              <span style={S.pips}>
                {allBands.map((b, i) => (
                  <span
                    key={i}
                    title={`Échelle ${b.echelle}`}
                    style={{
                      ...S.pip,
                      ...(echDone(i)
                        ? { background: theme.accent, borderColor: theme.accent }
                        : i === prog.bandIdx
                        ? { borderColor: theme.accent }
                        : {}),
                    }}
                  />
                ))}
              </span>
            </div>
          )}
        </div>

        <div style={{ ...S.nodes, height: layout.h }}>
          <svg style={S.path} viewBox={`0 0 100 ${layout.h}`} preserveAspectRatio="none" width="100%" height={layout.h}>
            <path d={path} fill="none" stroke={theme.accent} strokeWidth="0.7" strokeDasharray="2 2.4"
              strokeLinecap="round" opacity="0.6" style={{ filter: `drop-shadow(0 0 3px ${theme.glow})` }} />
          </svg>

          {layout.pos.map(([x, y], k) => {
            const st = nodeState(prog, bi, k, clears, state.quest, quest);
            const tappable = st === "current" || st === "available";
            const ring = st === "current" ? CUR : st === "available" ? AVAIL : st === "done" ? theme.accent : LOCK_BORDER;
            const isCur = st === "current";
            // Étiquette du nœud : le TAPIS (crescendo) si ordonné, sinon l'index.
            let label = k + 1;
            let badge = null;
            let stars = bandBest;
            if (ordered) {
              const spot = spotById[band.spotIds[k]];
              label = spot.stackBB;
              if (spot.vs) badge = spot.vs[0]; // B (vs BTN) / S (vs SB)
              stars = prog.stars[band.spotIds[k]] || 0;
            }
            return (
              <React.Fragment key={k}>
                {isCur && <span style={{ ...S.ship, left: `${x}%`, top: y - 30 }}>🚀</span>}
                <button
                  onClick={tappable ? () => playNode(quest) : undefined}
                  disabled={!tappable}
                  className={isCur ? "gm-pulse" : undefined}
                  style={{
                    ...S.node, left: `${x}%`, top: y, border: `2px solid ${ring}`,
                    background: st === "locked" ? LOCK_BG : st === "done" ? `${theme.accent}1f` : `${ring}26`,
                    color: st === "locked" ? "#3f4458" : st === "done" ? theme.accentText : "#fff",
                    cursor: tappable ? "pointer" : "default",
                    boxShadow: isCur ? `0 0 0 4px ${CUR}33, 0 0 22px -2px ${CUR}` : "none",
                  }}
                >
                  {st === "locked" ? <span style={S.lockIcon}>🔒</span> : label}
                  {badge && st !== "locked" && <span style={{ ...S.badge, background: ring }}>{badge}</span>}
                </button>
                {st === "done" && (
                  <span style={{ ...S.nodeStars, left: `${x}%`, top: y + 22 }}>
                    {"★".repeat(stars)}<span style={{ color: "#2c3040" }}>{"★".repeat(3 - stars)}</span>
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={S.root}>
      {/* ── HUD haut ── */}
      <div style={S.hud}>
        <div style={{ ...S.avatar, color: av.tint }}>{av.glyph}</div>
        <div style={S.hudMid}>
          <div style={S.currencies}>
            <span style={S.cur}><span style={S.curIcon}>🪙</span>{String(chips).padStart(4, "0")}</span>
            <span style={S.cur}><span style={S.curIcon}>💎</span>{String(gems).padStart(4, "0")}</span>
            <button style={S.plus} onClick={() => setSheet(sheet === "shop" ? null : "shop")} title="Boutique">+</button>
          </div>
          <div style={S.xpRow}>
            <span style={S.xpLabel}>XP</span>
            <div style={S.xpTrack}><div style={{ ...S.xpFill, width: `${(xpInto / xpNeed) * 100}%` }} /></div>
            <span style={S.xpNums}>{xpInto} / {xpNeed}</span>
          </div>
        </div>
        <div style={S.levelBadge}>{level}</div>
      </div>

      {/* ── CONTINUER — reprend la quête exactement où elle en est ── */}
      <button
        style={{ ...S.contBtn, borderColor: `${contTheme.frame}88`, boxShadow: `0 0 22px -8px ${contTheme.glow}` }}
        onClick={() => playNode(state.quest)}
      >
        <span style={{ ...S.contRocket, filter: `drop-shadow(0 0 8px ${contTheme.glow})` }}>🚀</span>
        <span style={S.contText}>
          <span style={S.contKicker}>TA QUÊTE</span>
          <b style={S.contName}>Continuer</b>
          <span style={{ ...S.contDetail, color: contTheme.accentText }}>{contDetail}</span>
        </span>
        <span style={{ ...S.contGo, background: contTheme.accent }}>▶</span>
      </button>

      {/* ══ SECTION QUÊTE (volet dépliable) ══ */}
      <button style={S.sectionHead} onClick={() => toggle("mapQuestOpen", questOpen)}>
        <span style={{ ...S.sectionIcon, color: "#f5a83a" }}>✦</span>
        <div style={{ textAlign: "left" }}>
          <div style={S.sectionTitle}>LA QUÊTE</div>
          <div style={S.sectionSub}>Apprends les ranges, secteur par secteur.</div>
        </div>
        <span style={{ ...S.chev, transform: questOpen ? "rotate(0deg)" : "rotate(-90deg)" }}>▾</span>
      </button>

      <div style={{ ...S.fold, gridTemplateRows: questOpen ? "1fr" : "0fr" }}>
        <div style={S.foldInner}>
          {/* ── SECTEUR SPIN : 3 voies par position ── */}
          <div style={S.groupHead}>
            <span style={{ ...S.groupIcon, boxShadow: `0 0 16px -2px ${THEMES.aube.glow}` }}>☀️</span>
            <div>
              <div style={{ ...S.groupTitle, color: THEMES.aube.accentText }}>SECTEUR SPIN</div>
              <div style={S.groupSub}>SHORT STACK · 3-max · 3 positions</div>
            </div>
          </div>
          <div style={S.sky}>
            {SPIN_LANES.map((lane) => {
              const unlocked = questUnlocked(state, lane.quest);
              const prog = state.progressions[lane.quest];
              const bi = prog.bandIdx; // échelle courante (6→8→10)
              const band = bandsFor(lane.quest)[bi];
              return renderCard({
                quest: lane.quest, bi, theme: THEMES.aube, compact: true,
                title: lane.title,
                stack: unlocked ? `ÉCHELLE ${band.echelle} · ${lane.action}` : lane.action,
                icon: <span style={{ ...S.posDot, background: lane.dot }} />,
                locked: !unlocked, lockHint: lane.lockHint,
              });
            })}
          </div>

          {/* ── SECTEURS MTT / CASH ── */}
          <div style={{ ...S.sky, marginTop: 16 }}>
            {MTT_SECTORS.map((sec) => renderCard(sec))}
          </div>
        </div>
      </div>

      {/* ══ SECTION ARCADE (volet dépliable) ══ */}
      <button style={{ ...S.sectionHead, marginTop: questOpen ? 26 : 10 }} onClick={() => toggle("mapArcadeOpen", arcadeOpen)}>
        <span style={S.sectionIcon}>🕹️</span>
        <div style={{ textAlign: "left" }}>
          <div style={S.sectionTitle}>SALLE D'ARCADE</div>
          <div style={S.sectionSub}>Teste-toi en partie — gagne gems &amp; jetons.</div>
        </div>
        <span style={{ ...S.chev, transform: arcadeOpen ? "rotate(0deg)" : "rotate(-90deg)" }}>▾</span>
      </button>

      <div style={{ ...S.fold, gridTemplateRows: arcadeOpen ? "1fr" : "0fr" }}>
        <div style={S.foldInner}>
          <button style={S.spinFeature} onClick={() => dispatch({ type: "GO", screen: "spintable" })}>
            <span style={S.spinIcon}>🃏</span>
            <span style={S.spinText}>
              <b style={S.spinName}>SPIN &amp; GO</b>
              <span style={S.spinSub}>Vraie partie 3-max · le coach juge chaque décision</span>
            </span>
            <span style={{ ...S.rewardTag, color: "#7ee2b8", borderColor: "#2f9e6b" }}>🧠 COACH</span>
            <span style={S.spinGo}>JOUER →</span>
          </button>

          <div style={S.modesRow}>
            <button style={S.modeCard} onClick={() => dispatch({ type: "GO", screen: "run" })}>
              <span style={S.modeIcon}>🎰</span>
              <span style={S.modeText}><b style={S.modeName}>RUN</b><span style={S.modeSub}>Survie push/fold</span></span>
              <span style={{ ...S.rewardTag, color: "#67e8f9", borderColor: "#2c5a6a" }}>💎</span>
            </button>
            <button style={{ ...S.modeCard, ...S.modeCardAlt }} onClick={() => dispatch({ type: "GO", screen: "gridrun" })}>
              <span style={S.modeIcon}>♟️</span>
              <span style={S.modeText}><b style={S.modeName}>DÉFI</b><span style={S.modeSub}>Roguelite sur grille</span></span>
              <span style={{ ...S.rewardTag, color: "#67e8f9", borderColor: "#2c5a6a" }}>💎</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Feuilles ── */}
      {sheet === "missions" && (
        <Sheet title="Missions" onClose={() => setSheet(null)}>
          <div style={S.missionList}>
            {MISSIONS.map((m) => {
              const ms = missionState(m, state);
              return (
                <div key={m.id} style={{ ...S.mission, opacity: ms.claimed ? 0.6 : 1 }}>
                  <span style={S.missionIcon}>{m.icon}</span>
                  <div style={S.missionMid}>
                    <div style={S.missionLabel}>{m.label}</div>
                    <div style={S.missionDesc}>{m.desc}</div>
                    <div style={S.missionTrack}>
                      <div style={{ ...S.missionFill, width: `${(ms.value / m.goal) * 100}%` }} />
                    </div>
                    <div style={S.missionNums}>{ms.value} / {m.goal}</div>
                  </div>
                  {ms.claimed ? (
                    <span style={S.missionClaimed}>✓</span>
                  ) : ms.claimable ? (
                    <button style={S.missionClaim}
                      onClick={() => dispatch({ type: "CLAIM_MISSION", id: m.id, gems: m.gems })}>
                      +{m.gems} 💎
                    </button>
                  ) : (
                    <span style={S.missionReward}>+{m.gems} 💎</span>
                  )}
                </div>
              );
            })}
          </div>
        </Sheet>
      )}
      {sheet === "shop" && (
        <Sheet title="Boutique" onClose={() => setSheet(null)}>
          <div style={S.shopIntro}>Dépense tes 💎 en bonus permanents pour le Run.</div>
          <div style={S.missionList}>
            {SHOP_ITEMS.map((item) => {
              const lvl = ownedLevel(state.shop, item.id);
              const maxed = isMaxed(item, state.shop);
              const cost = nextCost(item, state.shop);
              const afford = gems >= cost;
              return (
                <div key={item.id} style={S.mission}>
                  <span style={S.missionIcon}>{item.icon}</span>
                  <div style={S.missionMid}>
                    <div style={S.missionLabel}>
                      {item.name}{item.max > 1 && <span style={S.shopLvl}> · {lvl}/{item.max}</span>}
                    </div>
                    <div style={S.missionDesc}>{item.desc}</div>
                  </div>
                  {maxed ? (
                    <span style={S.shopMax}>MAX</span>
                  ) : (
                    <button
                      style={{ ...S.missionClaim, ...(afford ? {} : S.shopBtnOff) }}
                      disabled={!afford}
                      onClick={() => dispatch({ type: "BUY_UPGRADE", id: item.id, cost })}
                    >
                      {cost} 💎
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Sheet>
      )}
      {sheet === "params" && (
        <Sheet title="Paramètres" onClose={() => setSheet(null)}>
          <div style={S.diffLabel}>DIFFICULTÉ</div>
          <div style={S.diffRow}>
            {DIFFS.map((d) => {
              const on = state.difficulty === d.id;
              return (
                <button key={d.id} style={{ ...S.diffBtn, ...(on ? S.diffBtnOn : {}) }}
                  onClick={() => dispatch({ type: "SET_DIFFICULTY", difficulty: d.id })}>
                  <span style={{ ...S.diffName, ...(on ? S.diffNameOn : {}) }}>{d.label}</span>
                  <span style={S.diffDesc}>{d.desc}</span>
                </button>
              );
            })}
          </div>
          <div style={S.devRow}>
            <button style={S.devBtn} onClick={() => dispatch({ type: "RESET" })}>↺ Recommencer</button>
          </div>
        </Sheet>
      )}

      {/* ── Barre de navigation ── */}
      <nav style={S.nav}>
        <NavItem icon="◎" label="Carte" active onClick={() => setSheet(null)} />
        <NavItem icon="▤" label="Missions" active={sheet === "missions"} badge={nClaimable} onClick={() => setSheet(sheet === "missions" ? null : "missions")} />
        <NavItem icon="🚀" label="Vaisseau" onClick={() => dispatch({ type: "GO", screen: "lab" })} />
        <NavItem icon="⚙" label="Paramètres" active={sheet === "params"} onClick={() => setSheet(sheet === "params" ? null : "params")} />
      </nav>
    </div>
  );
}

const DIFFS = [
  { id: "normal", label: "Normal", desc: "frontière orange" },
  { id: "difficile", label: "Difficile", desc: "sans frontière" },
  { id: "hardcore", label: "Hardcore", desc: "sans bonus" },
];

function NavItem({ icon, label, active, badge = 0, onClick }) {
  return (
    <button style={{ ...S.navItem, ...(active ? S.navItemOn : {}) }} onClick={onClick}>
      <span style={S.navIconWrap}>
        <span style={S.navIcon}>{icon}</span>
        {badge > 0 && <span style={S.navBadge}>{badge}</span>}
      </span>
      <span style={S.navLabel}>{label}</span>
    </button>
  );
}

function Sheet({ title, children, onClose }) {
  return (
    <div style={S.sheetWrap} onClick={onClose}>
      <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={S.sheetHead}>
          <span style={S.sheetTitle}>{title}</span>
          <button style={S.sheetClose} onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const display = "'Bricolage Grotesque', sans-serif";
const mono = "'JetBrains Mono', monospace";
const S = {
  root: { maxWidth: 460, margin: "0 auto", padding: "16px 14px 96px", fontFamily: mono, color: "#e7e9f0", position: "relative" },

  hud: { display: "flex", alignItems: "center", gap: 12, background: "#0c0e16", border: "1px solid #1b1e2b", borderRadius: 16, padding: "10px 12px", marginBottom: 14 },
  avatar: { width: 42, height: 42, flexShrink: 0, borderRadius: "50%", background: "#12141d", border: "1px solid #2c3040", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, lineHeight: 1 },
  hudMid: { flex: 1, display: "flex", flexDirection: "column", gap: 6 },
  currencies: { display: "flex", alignItems: "center", gap: 12 },
  cur: { display: "inline-flex", alignItems: "center", gap: 4, fontFamily: display, fontWeight: 800, fontSize: 13, fontVariantNumeric: "tabular-nums" },
  curIcon: { fontSize: 12 },
  plus: { marginLeft: "auto", width: 22, height: 22, borderRadius: 6, background: "#12141d", border: "1px solid #2c3040", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15, color: "#67e8f9", cursor: "pointer", padding: 0, fontFamily: display, fontWeight: 800, lineHeight: 1 },
  xpRow: { display: "flex", alignItems: "center", gap: 7 },
  xpLabel: { fontSize: 9, letterSpacing: 1, color: "#5b6075", fontWeight: 700 },
  xpTrack: { flex: 1, height: 6, background: "#12141d", borderRadius: 99, overflow: "hidden" },
  xpFill: { height: "100%", background: "linear-gradient(90deg,#3b82f6,#5b9bff)", borderRadius: 99, transition: "width .35s ease" },
  xpNums: { fontSize: 9.5, color: "#6b7088", fontVariantNumeric: "tabular-nums" },
  levelBadge: { width: 34, height: 34, flexShrink: 0, borderRadius: "50%", background: "#12141d", border: "1px solid #3b82f6", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: display, fontWeight: 800, fontSize: 15, color: "#bcd6ff" },

  // ── Bouton CONTINUER (héros) ──
  contBtn: {
    display: "flex", alignItems: "center", gap: 12, width: "100%", cursor: "pointer", textAlign: "left",
    background: "linear-gradient(135deg,#141021,#0b0d15)", borderWidth: 1.5, borderStyle: "solid",
    borderRadius: 16, padding: "13px 14px", marginBottom: 22, fontFamily: mono, color: "#e7e9f0",
  },
  contRocket: { fontSize: 26, lineHeight: 1, flexShrink: 0 },
  contText: { display: "flex", flexDirection: "column", gap: 1, flex: 1, minWidth: 0 },
  contKicker: { fontSize: 8.5, letterSpacing: 2.5, color: "#5b6075", fontWeight: 700 },
  contName: { fontFamily: display, fontSize: 18, fontWeight: 800, letterSpacing: 0.4 },
  contDetail: { fontSize: 10.5, fontVariantNumeric: "tabular-nums" },
  contGo: {
    flexShrink: 0, width: 34, height: 34, borderRadius: "50%", color: "#0a0b10",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800,
  },

  // ── En-têtes de section (Quête / Arcade) — boutons de volet ──
  sectionHead: {
    display: "flex", alignItems: "center", gap: 10, width: "100%", cursor: "pointer",
    background: "transparent", fontFamily: mono, color: "#e7e9f0", padding: "0 2px 8px",
    marginBottom: 12, borderWidth: "0 0 1px", borderStyle: "solid", borderColor: "#1b1e2b",
  },
  sectionIcon: { fontSize: 17, lineHeight: 1 },
  sectionTitle: { fontFamily: display, fontSize: 14, fontWeight: 800, letterSpacing: 2, color: "#e7e9f0" },
  sectionSub: { fontSize: 9.5, color: "#6b7088", marginTop: 1 },
  chev: { marginLeft: "auto", color: "#6b7088", fontSize: 13, lineHeight: 1, transition: "transform .25s ease" },

  // Volet dépliable (grid 1fr/0fr = repli animé sans hauteur codée en dur)
  fold: { display: "grid", transition: "grid-template-rows .32s ease" },
  foldInner: { overflow: "hidden", minHeight: 0 },

  // Tag de gain sur les cartes arcade
  rewardTag: {
    flexShrink: 0, fontSize: 9, fontWeight: 800, letterSpacing: 0.5, fontFamily: mono,
    borderWidth: 1, borderStyle: "solid", borderRadius: 99, padding: "3px 7px", whiteSpace: "nowrap",
  },

  // Voie verrouillée compacte
  lockedRow: {
    display: "flex", alignItems: "center", gap: 9, padding: "9px 13px",
    background: "#0b0d13", border: "1px solid #171a26", borderRadius: 12,
  },
  lockedTitle: { fontFamily: display, fontSize: 12, fontWeight: 800, color: "#5b6075", letterSpacing: 1 },
  lockedHint: { marginLeft: "auto", fontSize: 10, color: "#4d5266", letterSpacing: 0.3 },

  // ── Cartes de mode roguelite ──
  modesRow: { display: "flex", gap: 10, marginBottom: 18 },
  modeCard: {
    flex: 1, display: "flex", alignItems: "center", gap: 9, cursor: "pointer",
    background: "linear-gradient(135deg,#13202e,#0c0e16)", border: "1px solid #25415a",
    borderRadius: 14, padding: "12px 13px", fontFamily: mono, color: "#e7e9f0", textAlign: "left",
  },
  modeCardAlt: { background: "linear-gradient(135deg,#1d1230,#0c0e16)", border: "1px solid #4a2f6a" },
  modeIcon: { fontSize: 22, lineHeight: 1, flexShrink: 0 },
  modeText: { display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flex: 1 },
  modeName: { fontFamily: display, fontSize: 15, fontWeight: 800, letterSpacing: 0.5 },
  modeSub: { fontSize: 10, color: "#8b90a4" },

  // Carte phare Spin & Go
  spinFeature: {
    display: "flex", alignItems: "center", gap: 12, width: "100%", cursor: "pointer", textAlign: "left",
    background: "linear-gradient(135deg,#123a2b,#0c1016)", borderWidth: 1, borderStyle: "solid", borderColor: "#2f9e6b",
    borderRadius: 16, padding: "14px 16px", marginBottom: 12, boxShadow: "0 0 18px -8px #2f9e6b",
    fontFamily: mono, color: "#e7e9f0",
  },
  spinIcon: { fontSize: 26, lineHeight: 1, flexShrink: 0 },
  spinText: { display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 },
  spinName: { fontFamily: display, fontSize: 18, fontWeight: 800, letterSpacing: 0.5, color: "#7ee2b8" },
  spinSub: { fontSize: 10.5, color: "#9fb8ac" },
  spinGo: { flexShrink: 0, fontFamily: display, fontWeight: 800, fontSize: 12, color: "#0a0b10", background: "#7ee2b8", borderRadius: 99, padding: "6px 12px", letterSpacing: 0.5 },

  groupHead: { display: "flex", alignItems: "center", gap: 10, margin: "0 4px 10px" },
  groupIcon: { fontSize: 20, borderRadius: "50%" },
  groupTitle: { fontFamily: display, fontSize: 15, fontWeight: 800, letterSpacing: 1.5 },
  groupSub: { fontSize: 9, letterSpacing: 2, color: "#6b7088", fontWeight: 700 },

  sky: { display: "flex", flexDirection: "column", gap: 12 },
  sector: { position: "relative", borderRadius: 18, borderWidth: 1, borderStyle: "solid", borderColor: "#1b1e2b", padding: "12px 10px 6px", background: "linear-gradient(180deg,#0b0d15,#080a11)", overflow: "hidden" },
  laneCard: { padding: "10px 10px 4px" },
  nebula: { position: "absolute", inset: 0, pointerEvents: "none" },
  sectorHead: { position: "relative", display: "flex", alignItems: "center", gap: 10, marginBottom: 4, padding: "0 4px" },
  sectorIcon: { fontSize: 18, borderRadius: "50%" },
  posDot: { width: 12, height: 12, borderRadius: "50%", display: "inline-block", boxShadow: "0 0 8px currentColor" },
  sectorTitle: { fontFamily: display, fontSize: 13, fontWeight: 800, letterSpacing: 1 },
  sectorStack: { fontSize: 9, letterSpacing: 2, color: "#6b7088", fontWeight: 700 },
  tierWrap: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, position: "relative" },
  validBadge: { fontSize: 10, fontWeight: 800, borderWidth: 1, borderStyle: "solid", borderColor: "#3a4055", borderRadius: 99, padding: "1px 6px", lineHeight: 1.4 },
  pips: { display: "inline-flex", gap: 4, alignItems: "center" },
  pip: { width: 7, height: 7, borderRadius: "50%", borderWidth: 1.5, borderStyle: "solid", borderColor: "#3a4055", background: "transparent", boxSizing: "border-box" },

  nodes: { position: "relative", width: "100%" },
  path: { position: "absolute", inset: 0, pointerEvents: "none" },
  node: { position: "absolute", width: 38, height: 38, borderRadius: "50%", transform: "translate(-50%,-50%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: display, fontWeight: 800, fontSize: 14, padding: 0, transition: "transform .1s ease" },
  badge: { position: "absolute", top: -4, right: -4, width: 15, height: 15, borderRadius: "50%", fontSize: 9, fontWeight: 800, color: "#0a0b10", display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid #0a0b10" },
  lockIcon: { fontSize: 12 },
  nodeStars: { position: "absolute", transform: "translate(-50%,0)", fontSize: 8.5, letterSpacing: 1, color: "#f5b301", whiteSpace: "nowrap", pointerEvents: "none" },
  ship: { position: "absolute", transform: "translate(-50%,0)", fontSize: 17, pointerEvents: "none", filter: "drop-shadow(0 0 6px #5b9bff)" },

  sheetWrap: { position: "fixed", inset: 0, background: "rgba(4,5,9,.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 },
  sheet: { width: "100%", maxWidth: 460, background: "#0c0e16", border: "1px solid #1b1e2b", borderRadius: "18px 18px 0 0", padding: "16px 18px 28px" },
  sheetHead: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  sheetTitle: { fontFamily: display, fontSize: 16, fontWeight: 800 },
  sheetClose: { background: "transparent", border: "none", color: "#6b7088", cursor: "pointer", fontSize: 15 },
  // ── Missions (contrats) ──
  missionList: { display: "flex", flexDirection: "column", gap: 8 },
  mission: { display: "flex", alignItems: "center", gap: 11, background: "#0d0e15", border: "1px solid #1b1e2b", borderRadius: 12, padding: "11px 12px" },
  missionIcon: { fontSize: 19, lineHeight: 1, flexShrink: 0, width: 22, textAlign: "center" },
  missionMid: { flex: 1, minWidth: 0 },
  missionLabel: { fontFamily: display, fontSize: 13, fontWeight: 800, color: "#e7e9f0" },
  missionDesc: { fontSize: 10.5, color: "#8b90a4", marginBottom: 6 },
  missionTrack: { height: 5, background: "#12141d", borderRadius: 99, overflow: "hidden" },
  missionFill: { height: "100%", background: "linear-gradient(90deg,#3b82f6,#67e8f9)", borderRadius: 99, transition: "width .35s ease" },
  missionNums: { fontSize: 9, color: "#6b7088", marginTop: 3, fontVariantNumeric: "tabular-nums" },
  missionClaim: { flexShrink: 0, background: "#67e8f9", border: "none", color: "#06222a", fontWeight: 800, fontFamily: mono, fontSize: 12, padding: "8px 10px", borderRadius: 9, cursor: "pointer", whiteSpace: "nowrap" },
  missionClaimed: { flexShrink: 0, color: "#10b981", fontSize: 18, fontWeight: 800, width: 56, textAlign: "center" },
  missionReward: { flexShrink: 0, fontFamily: display, fontWeight: 800, fontSize: 12, color: "#5b6075", width: 56, textAlign: "center", whiteSpace: "nowrap" },
  // ── Boutique ──
  shopIntro: { fontSize: 11.5, color: "#8b90a4", marginBottom: 12, lineHeight: 1.4 },
  shopLvl: { color: "#67e8f9", fontWeight: 700, fontSize: 11 },
  shopMax: { flexShrink: 0, color: "#10b981", fontFamily: display, fontWeight: 800, fontSize: 12, width: 56, textAlign: "center" },
  shopBtnOff: { background: "#1b2330", color: "#5b6075", cursor: "not-allowed" },

  diffLabel: { fontSize: 9, letterSpacing: 2, color: "#5b6075", marginBottom: 8 },
  diffRow: { display: "flex", gap: 8, marginBottom: 16 },
  diffBtn: { flex: 1, display: "flex", flexDirection: "column", gap: 3, alignItems: "center", background: "#0d0e15", border: "1px solid #1b1e2b", borderRadius: 11, padding: "10px 6px", cursor: "pointer", fontFamily: mono },
  diffBtnOn: { background: "#12141d", border: "1px solid #f59e0b" },
  diffName: { fontFamily: display, fontSize: 13, fontWeight: 800, color: "#b5bacb" },
  diffNameOn: { color: "#f59e0b" },
  diffDesc: { fontSize: 9.5, color: "#6b7088" },
  devRow: { display: "flex", gap: 8 },
  devBtn: { flex: 1, background: "#0d0e15", border: "1px solid #272b3d", color: "#b5bacb", padding: "10px", borderRadius: 9, fontSize: 12, cursor: "pointer", fontFamily: mono },

  nav: { position: "fixed", left: 0, right: 0, bottom: 0, display: "flex", justifyContent: "center", gap: 4, background: "rgba(8,10,17,.92)", borderTop: "1px solid #1b1e2b", padding: "8px 8px max(8px,env(safe-area-inset-bottom))", backdropFilter: "blur(8px)", zIndex: 40 },
  navItem: { flex: 1, maxWidth: 110, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "transparent", border: "none", cursor: "pointer", color: "#5b6075", fontFamily: mono, padding: "4px 0" },
  navItemOn: { color: "#bcd6ff" },
  navIconWrap: { position: "relative", display: "inline-flex" },
  navIcon: { fontSize: 17, lineHeight: 1 },
  navBadge: { position: "absolute", top: -5, right: -9, minWidth: 15, height: 15, padding: "0 3px", borderRadius: 99, background: "#67e8f9", color: "#06222a", fontFamily: display, fontWeight: 800, fontSize: 9.5, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 8px #67e8f988" },
  navLabel: { fontSize: 9.5, letterSpacing: 0.5, textTransform: "uppercase" },
};

export const GALMAP_CSS = `
.gm-pulse { animation: gmPulse 1.6s ease-in-out infinite; }
@keyframes gmPulse {
  0%,100% { box-shadow: 0 0 0 4px #5b9bff22, 0 0 18px -4px #5b9bff; }
  50%     { box-shadow: 0 0 0 7px #5b9bff14, 0 0 30px -2px #5b9bff; }
}
`;
