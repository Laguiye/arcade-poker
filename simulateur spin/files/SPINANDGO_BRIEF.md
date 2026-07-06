# ARCADE POKER — Module Spin & Go Simulator
## Brief complet V1.1
**Dernière mise à jour :** 22 juin 2026
**Statut :** Prêt pour intégration ou projet parallèle
**Lien projet existant :** ARCADE_POKER_BRIEF.md / roguelite schema / FRONT_SPEC.md

---

## 1. Concept

Un simulateur de poker pédagogique qui reproduit la sensation de jouer une vraie partie
contre des adversaires IA typés, avec un **coach intervenant en live** pendant la main —
sans jamais casser le rythme du jeu.

### Différenciation vs concurrents (PokerSnowie, Advanced Poker Training)

| Feature | PokerSnowie | APT | Arcade Poker |
|---|---|---|---|
| Feedback erreurs hero | ✅ | ✅ | ✅ |
| Feedback erreurs vilain | ❌ | ❌ | ✅ |
| Profils adversaires visuels | ❌ | ❌ | ✅ |
| Vocabulaire poker FR | ❌ | ❌ | ✅ |
| Interface mobile-first moderne | ⚠️ bugs | ❌ web only | ✅ |
| Récap session à la demande | partiel | partiel | ✅ |
| Rythme de jeu non interrompu | ⚠️ | ⚠️ | ✅ |

---

## 2. Format de test V1 : Spin & Go 3-max

### Pourquoi ce format

- **3 positions seulement** : BTN, SB, BB — arbre de décision minimal
- **Push/fold dominant** : la majorité des décisions à ≤ 25bb se prennent avant/au flop
- **Postflop simplifié** : SPR quasi toujours < 2 → règles heuristiques suffisent
- **Ranges documentées** : Nash push/fold 3-max disponibles via HoldemResources / ICMIZER
- **Variance réelle** : les stacks bougent, le jeu est vivant

### Spectre de stacks couvert : 2bb à 50bb

Les stacks fluctuent selon les résultats. La V1 couvre tout le spectre en 4 zones
comportementales :

#### Zone 1 — Court critique (2-7bb)
- Stratégie : push quasi-systématique, calls très larges
- Coach : messages ultra-courts et directifs
  > *"À 5bb, tu pushes toute ta range depuis cette position."*
- Postflop : inexistant ou mécanique (SPR < 0.5 → engagement automatique)
- ICM : signal si un joueur est en danger d'élimination

#### Zone 2 — Push/fold pur (8-15bb)
- Stratégie : push/fold strict, appels avec calling ranges Nash
- Coach : corrections claires, références aux ranges
  > *"ATo est un call rentable ici à 12bb face à ce profil de push."*
- Postflop : SPR < 1.5, quasi-mécanique (flop only, message court)

#### Zone 3 — Push/fold dominant (16-25bb)
- Stratégie : push/fold principalement, quelques open/fold possibles
- Coach : complet — toutes les interventions actives
- Postflop : SPR 1-2, heuristiques flop (5-6 règles)

#### Zone 4 — Jeu court-profond (26-50bb)
- Stratégie : mix push/fold + open-raise/fold + jeu postflop
- Coach : avertissement que les règles push/fold ne s'appliquent plus strictement
  > *"À 35bb, un push depuis le BTN est fort. Un min-raise peut être envisagé."*
- Postflop : heuristiques étendues, SPR jusqu'à 4
- **V1 limité** : couvert partiellement, full coverage en V2

### Scope V1 strictement délimité

- NLHE uniquement
- 2bb à 30bb : couverture complète push/fold
- Postflop : flop avec SPR < 2 uniquement
- Turn/river à SPR < 1 : message court mécanique

---

## 3. Règle d'or du coach

> **Le coach ne dit jamais ce que le joueur ne peut pas savoir légitimement.**

### Sources d'information autorisées

| Source | Autorisée | Exemple |
|---|---|---|
| Cartes de hero | ✅ | "Ton AJo est..." |
| Board visible | ✅ | "Sur ce flop A72..." |
| Cartes retournées au showdown | ✅ | "Il a retourné 88" |
| Actions visibles des vilains | ✅ | "Il a pushouté, fold..." |
| Profil affiché du vilain | ✅ | "Il est bleu — il fold souvent" |
| Cartes cachées du vilain (en cours de main) | ❌ | JAMAIS |
| Résultat d'une main sans showdown | ❌ | JAMAIS |

### Formulation correcte vs incorrecte

| ❌ Interdit | ✅ Autorisé |
|---|---|
| "Il avait AQ et a bien folded" | "Avec son profil serré, il fold largement ici" |
| "Tu avais 78% d'equity" | "Tu étais favori contre sa range probable" |
| "Il a foldé une main marginale" | "Il sort de ses habitudes — range inhabituelle" |

---

## 4. Système de profils adversaires

### Principe pédagogique central

Le profil coloré est **l'outil pédagogique le plus important** du simulateur.
Objectif : entraîner le joueur à **chercher le type d'adversaire** plutôt que jouer
ses seules cartes. Ce réflexe est directement transposable en vraie partie.

### Système de couleurs V1

| Couleur | Code | Archétype | Comportement clé |
|---|---|---|---|
| 🔵 Bleu | `nit` | Le Serré | Push range top 18%, fold souvent face aux pushes |
| 🟢 Vert | `reg` | L'Équilibré | ≈ Nash, ligne standard, prévisible |
| 🟡 Jaune | `fish` | La Station | Call trop large, fold rarement, ne bluff pas |
| 🟠 Orange | `lag` | Le Semi-Agressif | Push large, adaptatif — V2 |
| 🔴 Rouge | `maniaque` | Le Maniaque | Push presque tout, call ou shove constamment — V2 |

**V1 : 3 profils (Bleu / Vert / Jaune)**

### Format fiche joueur

```
🔵  [NOM]
"Le Serré"
Push range : top 18% • Fold vs push : 78% • Postflop : passif
```

```
🟡  [NOM]
"La Station"
Push range : top 55% • Fold vs push : 32% • Postflop : call machine
```

### Usage dans les interventions coach

Le coach cite toujours la couleur + le comportement :
> *"Il est bleu — il devrait folder ici très souvent. Tu peux pousher plus large."*
> *"Il est jaune — il va call trop. Évite de bluffer."*

---

## 5. Types d'interventions coach live

### Type 1 — Badge contextuel pré-action *(mode débutant, désactivable)*
- Apparaît avant l'action de hero
- 1 phrase max, non bloquant
- Désactivable dans les settings

> *"K4s en SB à 25bb — push rentable contre un bleu."*

### Type 2 — Feedback post-action hero *(toujours actif)*
- Déclenché si erreur détectée (action vs range Nash)
- Overlay court, non bloquant, 3-4 secondes
- Deux sous-types :
  - **Erreur hero** : correction + raison courte
  - **Action correcte mais situation exploitable** : signal d'opportunité

> *(hero fold QJo SB à 20bb)*
> *"QJo : push rentable en SB à 20bb, surtout contre un bleu. Fold trop serré."*

### Type 3 — Signal de tendance vilain *(actif, sans révéler cartes)*
- Quand le vilain dévie visiblement de son profil habituel
- Signal positif (exploiter) ou alerte (attention)

> *(vilain jaune fold face au push de hero)*
> *"Inhabituel pour lui. Il a peut-être resserré son jeu. Note la tendance."*

> *(vilain bleu push depuis UTG — rare)*
> *"Un bleu qui push depuis UTG — range plus forte que d'habitude. Ajuste ton call."*

### Récap fin de session *(à la demande, jamais en cours de main)*
- Liste des mains avec erreur EV significative (cliquables, rejouables)
- Score global : EV perdu vs Nash
- Tendances vilains résumées sur la session
- 1-2 spots prioritaires à travailler

---

## 6. Heuristiques postflop (SPR < 2)

5 règles couvrant 90% des situations à cette profondeur :

1. **SPR < 0.8** → Engagement automatique avec toute main avec equity (pair ou mieux, draw nutté)
2. **SPR 0.8-1.5, overpair ou top pair top kicker** → Shove ou call shove systématique
3. **SPR 0.8-1.5, draw nutté** → Semi-bluff shove (fold equity + equity)
4. **SPR 0.8-1.5, draw faible ou bottom pair** → Fold face à aggression, check/fold en passif
5. **SPR > 1.5** → Message coach : "Spot plus complexe, joue ta main par sa valeur showdown"

Règle ICM légère (V1) :
- Si un joueur est à < 5bb ET hero est le stack moyen → resserrer légèrement les calls
  > *"ICM : laisse le chip leader presser le court. Évite les flips marginaux."*

---

## 7. Architecture technique

### Approche hybride A+B

| Composant | Approche | Outil |
|---|---|---|
| Préflop — décisions hero | Lookup table JSON Nash par [position][stack] | nash_3max_ranges.json |
| Comportement vilains | Déviations prédéfinies par profil (%, threshold) | villain_profiles.json |
| Détection erreur hero/vilain | Compare action vs range → trigger | moteur JS/Python |
| Feedback coach | LLM (Claude Sonnet) avec prompt structuré | API Anthropic |
| Postflop | 5 règles SPR heuristiques | logique statique |
| Moteur de jeu | PokerKit (Python) ou logique custom JS | selon stack existant |
| Interface | React, mobile-first | Identité nav/emerald/red existante |

### Lookup table — indexation

```
nash_ranges[stack_arrondi][position][scenario]
→ Array de mains (ex: ["AA","KK","AKs",...])
```

Stacks couverts : 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 17, 20, 22, 25, 28, 30bb
Entre deux paliers → arrondir au palier inférieur

Scénarios couverts par range :
- `BTN_push` : push BTN all-in (SB + BB derrière)
- `SB_push` : push SB all-in (BTN a fold, BB derrière)
- `SB_call_vs_BTN` : SB call push BTN (BB encore à parler → range plus serrée)
- `BB_call_vs_BTN` : BB call push BTN (SB a fold)
- `BB_call_vs_SB` : BB call push SB (BTN a fold)

---

## 8. Modèle de données — Structure d'une main

```json
{
  "hand_id": "uuid",
  "positions": { "hero": "SB", "v1": "BB", "v2": "BTN" },
  "stacks_bb": { "hero": 22, "v1": 18, "v2": 35 },
  "profils": { "v1": "nit", "v2": "fish" },
  "hero_cards": ["Ah", "Jd"],
  "actions_preflop": [
    { "player": "v2", "action": "fold" },
    { "player": "hero", "action": "push", "amount_bb": 22 },
    { "player": "v1", "action": "fold" }
  ],
  "board": [],
  "actions_postflop": [],
  "showdown": {
    "v1_cards": null,
    "v2_cards": null
  },
  "hero_decisions": [
    {
      "street": "preflop",
      "action": "push",
      "optimal": "push",
      "ev_loss_bb": 0,
      "in_range": true
    }
  ],
  "coach_triggers": [
    {
      "moment": "preflop_hero_action",
      "type": "action_correcte",
      "message": "AJo est un push standard en SB à 22bb. Bien joué."
    },
    {
      "moment": "v1_fold",
      "type": "tendance_vilain",
      "profil": "nit",
      "message": "Bleu classique — il fold trop souvent face aux pushes SB."
    }
  ],
  "session_review": {
    "ev_loss_bb": 0,
    "notable": false
  }
}
```

Cartes vilain = `null` si pas de showdown. Coach ne commente jamais les cartes cachées.

---

## 9. Vocabulaire poker francophone (référence)

| Terme EN | Terme FR poker | Utilisé dans le coach |
|---|---|---|
| Push / shove | Push / pousher / tapis | ✅ |
| Fold | Fold / se coucher / bûche | ✅ |
| Call | Call / suivre | ✅ |
| Raise | Relancer | ✅ |
| Check | Check | ✅ |
| All-in | Tapis / all-in | ✅ |
| Range | Range | ✅ (conservé en FR poker) |
| EV | EV / espérance | ✅ |
| Stack | Stack / tapis | ✅ |
| Big blind | BB / blindes | ✅ |
| Villain | Vilain / adversaire | ✅ |
| Spot | Spot / situation | ✅ |
| Equity | Equity / équité | ✅ |
| SPR | SPR (Stack-to-Pot Ratio) | ✅ |

---

## 10. Lien avec Arcade Poker existant

- Ce module **Spin & Go simulator** = **monde/chapitre dédié** dans l'architecture roguelite
- La mécanique **Range Mystery** (estimation % / ranges) reste le game loop principal
- Ce module est le **mode "partie simulée"** qui complète le mode quiz/drill
- Identité visuelle : conserver **navy / emerald / red neo-arcade premium**
- Les profils vilains colorés peuvent alimenter la **progression roguelite** (débloquer profils, mondes)

---

## 11. Priorités build

1. ✅ `nash_3max_ranges.json` — ranges push/fold Nash 3-max, 2-30bb, tous scénarios
2. `villain_profiles.json` — 3 profils V1 (nit/reg/fish) avec paramètres de déviation
3. Moteur de détection erreur préflop — compare action vs range → trigger coach
4. Prompt coach — template LLM structuré : contexte + action + profil → message court FR
5. Interface table — 3 sièges, pastilles couleur, overlay coach non bloquant, mobile-first
6. Récap session — liste mains rejouables, score EV

---

*Ce document est le contexte d'ouverture pour Claude Code.*
*Fichiers associés : nash_3max_ranges.json, villain_profiles.json*
