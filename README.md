# Arcade Poker

Jeu d'**arcade** de poker. Le plateau = la matrice 13×13. Le « décor » = la range
cible d'un spot (ex. « BTN 3bb open-jam »), et le décor définit le niveau. Boucle
produit : `jouer → satisfaction → encore`. L'apprentissage se fait en arrière-plan.

> Décisions produit/design **gelées** dans `ARCADE_POKER_BRIEF.md`.
> Système d'aide : `ASSIST_SPEC.md`. Méthode de travail : **valide puis continue**.

## Architecture : un moteur de grille, des formats qui l'habillent

```
src/
  engine/         ← logique PURE (zéro state React)
    poker.js         RANKS, combos, classify, cascadeReveal, dominationReveal…
    scoring.js       LEVELS, meterOf, optimalClicks, seedFromGuess (phase %)
    frontier.js      computeFrontier (contour de la range)
    equity.js        équité préflop main-vs-main (Monte Carlo) — mini-showdown
    GridEngine.jsx   LE composant matrice 13×13 réutilisable (émet des events,
                     ne décide ni juice ni méta)
  formats/        ← « skins » au-dessus du moteur
    RangeMystery.jsx   reconstruire une range case par case (format principal)
    Run.jsx            mini-run de survie (écran dev)
    Fog.jsx            placeholder
    useStruggle.js     détection de galère → surfaçage des aides
  screens/        ← machine à états (routée par store.screen)
    AvatarSelect · GalacticMap (accueil) · Level (hôte d'un format) ·
    Reward · Lab (labo de réglage)
  data/
    spots.js         expandeur de notation + SPOTS (ranges Nash sourcées)
    quest.js         QUÊTES = mondes/voies (Spin par position, MTT)
    playlists.js     playlists du Run
    callRanges.js    ranges de call génériques (mini-showdown)
  state/store.jsx   Context + reducer + persistance localStorage
  theme/cosmic.js   palettes cosmiques (1 par secteur) + themeForSpot
  components/       ui/ (RangeMini, SpotHeader…) · juice/ · Showdown.jsx
```

- **Format principal = Range Mystery** : reconstruire une range. Cascade « démineur »
  vers le plus fort (`dominationReveal`), Heat persistante (cascade boostée),
  phase d'estimation % optionnelle, mini-showdown bonus à l'équité.
- **Contenu** : secteur **Spin** (3-max) = 3 quêtes par position **BTN → SB → BB**
  (déblocage progressif, échelles 6/8/10 = crescendo de tapis 3→25bb) ;
  secteur **MTT** (6-max) = Short → Deep.
- **3 modes** (carte) : Normal (frontière + aides + bonus) / Difficile / Hardcore.

## Exclus pour l'instant

- **Température / heatmap persistante** (brief §8) — à réintroduire après les premiers
  tests joueurs. Le feedback de proximité PONCTUEL au clic (sigils) n'est pas la
  heatmap : c'est un indice instantané, pas une carte de chaleur persistante.

## Démarrer

```bash
npm install
npm run dev      # http://localhost:3010
npm run build    # build de prod (vérif avant de continuer)
```
