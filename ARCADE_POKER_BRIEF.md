# Arcade Poker — Brief de handoff (gelé)

> **Pour Claude Code.** Consolide et **gèle** les décisions produit/design de la session.
> Supersède `backlog-range-mystery.md` (à archiver). La notion de **température / heatmap est volontairement EXCLUE** — à réintroduire après les premiers tests joueurs.
> Méthode de travail attendue : **valide puis continue** (pas de génération en masse). Décisions encodées dans les fichiers repo pour les sessions futures.

---

## ★ TÂCHE CLAUDE CODE (à exécuter)

1. **Créer un nouveau projet nommé `arcade poker`.**
2. **Localiser le prototype existant `RangeMystery.jsx`** (composant React déjà codé, décrit en §6). S'il est fourni dans les fichiers : l'intégrer tel quel comme base du **mode Builder**. Sinon : le régénérer depuis §3-§6.
3. **Scaffolder l'architecture deux modes** (§2) : Builder (existant) + Run (à construire, §5).
4. **NE PAS implémenter la température** (exclue, cf. §8).
5. Avant tout build du mode Run : proposer un plan court et **attendre validation**.

---

## 1. Vision

Un jeu d'**arcade** de poker. Le plateau = la matrice 13×13 (fixe). Le **« décor » = la range cible d'un spot** (ex. « Push 11bb BTN », « Open CO 25bb »), et le décor définit le niveau. L'objectif produit reste la boucle `jouer → satisfaction → encore`. L'apprentissage se produit **en arrière-plan** ; le produit ne doit jamais ressembler à une école de poker.

Positionnement tranché : **arcade**, pas Duolingo. Pas d'arbre de compétences lourd ni de répétition espacée — juste une carte de niveaux qui avance, avec du feedback qui claque.

---

## 2. Architecture : deux modes, une donnée

La donnée (ranges en dur) est **commune** ; seul le rendu change.

- **Builder = Range Mystery** *(existant, cf. §6)*. Reconstruire une range case par case, sensation puzzle/étude. Mode « apprendre / cartographier la frontière ».
- **Run** *(à construire, cf. §5)*. Mini-tournoi roguelite, sensation « je joue un Spin & Go court ». Mode « prouver sous pression ».
- Lien possible (optionnel) : 3-étoiler le Range Mystery d'un spot débloque son Run. Mais les deux restent jouables séparément.

---

## 3. Données — ranges en dur

Source de vérité unique pour les deux modes. Format actuel (dans `RangeMystery.jsx`) : tableau `PUZZLES`, chaque entrée `{ name, sub, hands: [...] }` où `hands` liste les mains in-range (`"AKs"`, `"77"`, `"AQo"`…). Combos : paire = 6, suited = 4, offsuit = 12.

Spots déjà présents : UTG Open, BTN Open, Shove 10bb. À étendre par **profondeur de stack** (le curseur de difficulté, cf. §7) : 8bb → 11bb → 15bb → 20bb → 25bb → open cash → 3bet pots.

---

## 4. Cascade « démineur » — règles gelées (déjà codées)

Implémentée dans `cascadeReveal` (§6). Cliquer une main in-range remonte sa ligne sémantique et sélectionne le segment in-range **contigu au-dessus**, stop au premier trou.

- **Unidirectionnel bas → haut.** Jamais vers le bas.
- **Le bas exact doit être cliqué** : cliquer A3s remonte depuis A3s ; A2s reste à cocher.
- Axes : paire → diagonale ; connecteur suité (j=i+1) → diagonale connecteurs ; autre suited → rangée kicker ; offsuit → colonne kicker.
- Cascade = **1 clic** pour l'efficacité (anti brute-force). Hors-range cliquée = +1 erreur, pas de cascade.
- **Question ouverte (à trancher au build)** : sens de cascade des connecteurs suités, et le chevauchement AKs (atteignable par rangée A *et* par diagonale connecteurs).

---

## 5. Mode Run — spec à construire

**Forme :** roguelite de survie. Une séquence de spots ; **un bust met fin au run**. Score = jetons accumulés × paliers franchis.

**Le stack fond pendant le run** (= la rampe de difficulté *à l'intérieur* d'une partie). Ex. run « Spin & Go 3-handed » : 25bb (open/fold large) → 15bb (la range se resserre) → 10bb (push/fold pur) → 6bb HU (range ultra-large). La range correcte **change à chaque palier** ; la compétence testée = adapter sa frontière quand on raccourcit.

**Unité par main = DÉCISION FRONTIÈRE BILATÉRALE** *(option retenue)* :
- On présente une main + le décor + deux boutons (PUSH/FOLD ou OPEN/FOLD). Tap → feedback immédiat → main suivante (~2 s/main).
- **Seules les mains « frontière » apparaissent** (les triviales AA / 72o sont exclues).
- **Définition stricte de « frontière » :** une main dont la décision **diffère d'au moins une voisine** sur l'un des **3 axes** : (a) kicker (A8o open ↔ A7o fold), (b) suited/offsuit (A5s ↔ A5o), (c) paires (55 ↔ 44). Les **deux côtés** sont servis : parfois la main juste-dedans (réponse : push), parfois la main juste-dehors (réponse : **fold**). Indispensable anti-brute-force : sans le côté fold, « push tout » gagnerait.
- Dérivé **automatiquement** de la donnée range existante (voisinage sur les 3 axes) — aucune donnée nouvelle.

**Construction cheap :** une **playlist de spots scénarisés** + un wrapper « tapis de jetons ». **Pas d'IA adverse, pas d'ICM, pas de multiway.** Ne pas dériver vers une simulation SNG complète.

---

## 6. Prototype existant — `RangeMystery.jsx`

Composant React autonome (~520 lignes) à réutiliser comme **mode Builder**. Pièces clés :

- `RANKS`, `combosOf(hand)`, `handAt(i,j)`, `posOf` — matrice 13×13 et combos.
- `classify` / `STEP` / `cascadeReveal(hand, target)` — la cascade démineur (§4).
- `PUZZLES` — ranges en dur (§3). `LEVELS` — débutant (recall, victoire ≥90%, k=0.5) / intermédiaire (Dice pondéré combos, victoire 100%, k=0.25).
- **Score (deux canaux)** : jauge = `recall` (commun/cible) ou `dice` (`2·commun/(mien+cible)`, pondéré combos) selon le niveau ; flash chaud/froid par clic via `distToRange` (distance Manhattan dans la matrice — c'est le feedback de proximité actuel, **à ne pas confondre avec la heatmap température différée**).
- **Efficacité** : `errors` vs `quota = round(taille×k)` → `stars` ; `optimal` (clics du jeu parfait) calculé via les « bas de segment ». Affichage `clics / optimal`.
- `console.log` par clic (clic n°, main, mains révélées, mètre).

Claude Code : **chercher ce fichier en premier**, le brancher comme Builder, et n'y toucher que par modifs ciblées.

---

## 7. Progression & mécaniques arcade

**Niveaux & étoiles :** tout le monde commence au **niveau 1**. Le **niveau = le flow** (terminer = 1★, toujours atteignable, personne n'est bloqué). Les **étoiles = le skill** (3★ = proche de l'optimal, 0 erreur). Même niveau, deux ressentis — résout débutant vs joueur fort sans parcours séparés.

**Stack depth = curseur de difficulté.** Petites ranges courtes (shove 8bb ≈ 8-12 mains) = niveaux 1 idéaux : courts, gagnables, et la cascade fait *claquer* le premier puzzle.

**Bonus — règle de fer : gagné par le skill, jamais acheté ; enseigne ou récompense, jamais friction arbitraire.**
- **Combo de cascade** : multiplicateur qui grimpe avec la longueur révélée (×2 à 4 mains, ×3 à 6…). Mécanique signature, à sur-jouer visuellement.
- **Streak / survie** (Run) : décisions justes consécutives → jauge → multiplicateur de jetons ; une erreur la casse.
- **Power-ups gagnés (jamais payés)** : *Peek* (révèle une ligne), *Second chance* (encaisse une erreur sans casser le streak), *Freeze* (mode chrono). *Reveal frontier* à manier avec prudence (corrompt le skill — bannir des modes classés).
- **Objectifs variés par niveau** : range complète / bluffs seuls / **mode delta** (les mains qui changent entre 25bb et 11bb) / ≤ N coups / 0 erreur.
- **Méta-progression douce** : étoiles → XP → déblocage de « mondes » (familles de spots : Open/Fold → Push/Fold → 3bet pots → vs limpers).
- **Juice = vraie feature** (≈70% de la rétention arcade) : chiffres qui jaillissent, screen-shake léger sur gros combo, « PERFECT », confettis 3★, son montant.

**Exclus (pièges) :** vies/énergie (sabote « encore un puzzle »), boosters achetables (corrompent le classement, predatory), hasard pur décidant du score (le public poker décroche).

---

## 8. Différé — à réintroduire APRÈS tests

- **Température / heatmap (rouge/orange/vert).** Exclue pour l'instant. À trancher quand on y reviendra : rouge = **frontière** (marge EV, là où le skill vit) plutôt que rouge = bas de range (force, trivial). Garde-fou : en Builder, ne montrer la heatmap qu'à l'**écran de révélation** (sinon ça donne la réponse) ; utilisable en live dans le Run.
- **Bande marginale EV+ / écran de révélation** ; données solveur (le in/out actuel suffit au MVP).
- **Autres puzzle-types** (Frequency Hunter, Range Tetris, Poker Connections…) — après validation de la boucle.

---

## 9. Monétisation (réflexion, post-validation boucle)

Rien avant d'avoir prouvé la boucle. Modèle visé : **puzzle/daily gratuit (produit d'appel viral) + jeu illimité & profondeur Avancé/Expert payants**. On gate la quantité et la profondeur, **jamais la découverte**. Pas d'énergie, pas de booster payant.
