# Arcade Poker — Système d'aide & feedback frontière

> Spec de **design** issue de la session de réflexion du 2026-06-14.
> **Implémenté le 2026-06-14** (build vert, vérifié au preview 3010).
> Fichiers : `engine/GridEngine.jsx` (API impérative + frontière orange + focus/boussole),
> `formats/useStruggle.js` (détection), `formats/RangeMystery.jsx` (tray + plafond).
> Méthode maison : « valide puis continue ».

---

## 0. Principe directeur

Le joueur **déclenche** ses aides — le jeu ne les active jamais tout seul.
Chaque aide **laisse une trace** sur le score esthétique (étoiles), **jamais** sur la
progression : la galère ne creuse jamais un trou. Ton **arcade**, pas Duolingo : une
aide ressemble à un pouvoir / un sauvetage, pas à une correction.

---

## 1. Affichage de la frontière

La frontière = le **bord** du cluster (mains marginales). On la dessine comme un
**côté de case coloré**, calculé vers les voisins *hors-range*
(réutilise `computeFrontier` + `neighborsOf` — le moteur sait déjà quels voisins sont *out*).

- Couleur = **ambre/orange** (`#f59e0b`, langage frontière existant).
  **Jamais rouge** : le rouge est réservé à l'erreur (`RangeReview`, erreurs).
- Ne s'affiche **que sur les cases correctement placées** (enseigne *sur le succès*).
- Ne révèle **jamais** une frontière non trouvée → c'est le rôle de l'aide
  *Révéler-frontière*. On ne retombe pas dans la heatmap persistante (exclue).
- Le **feedback de proximité sur erreur** (↑ trop large / ⇈ beaucoup trop large)
  reste ponctuel : c'est un autre canal, inchangé.

### Le spectre des modes

| Mode | Frontière native | Aides | Bonus (cascade Heat) |
|---|---|---|---|
| **Tuto** | la plus montrée (contour + libellé « lisière ») | oui | oui |
| **Normal** | côté orange **persistant** à la sélection d'une main-frontière | oui | oui |
| **Avancé** | **aucune** native | oui (laissent une trace) | oui |
| **Hardcore** | aucune | **aucune** | **aucun** |

- **Tuto** : nombre de niveaux **à définir**. Coupe **nette** après le tuto
  (pas de fondu progressif).
- En **normal**, le côté orange apparaît à la sélection correcte **et reste**
  tout le niveau → le territoire se contoure au fil du remplissage.

---

## 2. Détection de la galère

**Règle d'or : l'inactivité seule n'est pas une galère.**
Il faut un **signal** ET une **stagnation**.

|  | Mètre avance | Mètre stagne |
|---|---|---|
| **Actif (clique)** | ✅ rien | 🔥 **IL RAME** |
| **Idle** | 🤔 réfléchit — ne pas interrompre | 🧊 **BLOQUÉ** / 🧱 **COINCÉ** |

### Normalisation
- **BLOQUÉ = temps absolu** (une pause humaine est indépendante de la taille de range).
- **RAME = volume relatif** (en multiples de `optimalClicks`).

### Ingrédients (quasi rien de neuf)
1. **Heat** (existe déjà) = le détecteur **RAME**. Heat ≈ 0 persistant = densité
   d'erreurs récente élevée.
2. **Deux horodatages** : `dernier_clic` (idle) et `dernier_progrès_mètre` (stagnation).
3. **`progress_ratio` = meter / winAt** (de `onState`) → route BLOQUÉ vs COINCÉ.

### Arbitrage (un seul état à la fois)
- idle + stagnant + `progress_ratio` < ~0.35 → **BLOQUÉ (départ)**
- idle + stagnant + `progress_ratio` > ~0.6 → **COINCÉ EN FIN**
- actif + stagnant + Heat ≈ 0 → **IL RAME** *(prioritaire : arrêter l'hémorragie d'abord)*

### Seuils de départ (à caler au playtest — ce sont des hypothèses)
- idle → ~9 s (peut-être ~7 s en milieu de niveau)
- grâce départ 5 s / grâce post-aide 3 s
- split progrès : bas < 0.35, haut > 0.6
- RAME : Heat à 0 sur ≥ 2 erreurs consécutives ou ~4 s d'activité
- COINCÉ : `progress_ratio` > 0.6 et pas de progrès depuis ~12 s

### Anti-clignotement
- **Grâce départ** (~5 s, le joueur lit le spot) et **grâce post-aide** (~3 s).
- **Hold** : une fois réveillée, l'aide reste affichée jusqu'à action / progrès.
- **Reset sur progrès — version indulgente** : un saut du mètre éteint l'état de
  galère, **mais l'aide reste « disponible, discrète »** : une pastille persistante
  que **le joueur referme explicitement** (ou qui disparaît à la validation du palier).
  Pas de minuterie cachée.

---

## 3. Catalogue d'aides

À la demande. Le **surfacing est adaptatif** : le jeu choisit *quelles* aides
présenter selon l'état détecté et **fait pulser** le bouton pertinent — jamais de
déclenchement auto. Tray restreint (2 aides à la fois, pas 6).

### 🧊 BLOQUÉ → *Amorce* + *Boussole*
- **Amorce** — révèle 1 ancre-cœur + sa cascade (relance le momentum). *(`peek` moteur)* — **réponse, −2 crans**
- **Boussole** — halo / direction vers le centre du cluster, **aucune case révélée**. — **info, −1 cran**

### 🔥 IL RAME → *Focus* + *Rembobinage*
- **Focus** — grise / verrouille les cases clairement hors-range, enlève le bruit
  (ne révèle pas la réponse). — **info, −1 cran**
- **Rembobinage** — annule la dernière erreur **et** sa chute de Heat. *(`second-chance` moteur)* — **info, −1 cran**

### 🧱 COINCÉ EN FIN → *Révéler-frontière* + *Passer*
- **Révéler-frontière** — contoure toutes les cases-frontière restantes. *(`reveal-frontier` moteur)* — **réponse, −2 crans**
- **Passer** — valide au mètre actuel, récompense partielle, sans honte,
  **0 jeton de coût**. — **0 ★**, palier franchi.

### Phase d'estimation % (slider)
- **Fourchette** — resserre la plage du slider autour d'une zone plausible
  (pas la valeur). → plafonne le tier (jamais PERFECT).
- **Second regard** — un 2e essai si MISS, on garde le meilleur. → plafonne le tier.

---

## 4. Modèle de la « trace » : plafond d'étoiles, **cran par cran**

Le plafond part de **3 ★** (clear propre, aucune aide) et **descend en s'accumulant** :

- aide **info** (Boussole, Focus, Rembobinage) → **−1 cran**
- aide **réponse** (Amorce, Révéler-frontière) → **−2 crans**
- **Passer** → **0 ★**

Exemples : Boussole seule → 2★ · Boussole + Amorce → 0★ · plancher à 0★.

- **Principe pédagogique** : les aides-info coûtent moins que les aides-réponse →
  on pousse le joueur vers celles qui *enseignent encore*.
- Illimitées et auto-régulées (le plafond *est* le coût ; pas d'inventaire).
- *Variante possible si on veut simplifier : chaque aide = −1 cran (uniforme).*

---

## 5. Placement / implémentation

- Toute la **méta** (détection + tray + trace) vit dans **`RangeMystery`** (skin),
  pas dans `GridEngine` (« le moteur émet, ne décide ni juice ni méta »).
- Le **contour-frontière persistant** : nouveau rendu de case piloté par
  `computeFrontier` / `neighborsOf`.
- **Seule pièce mécanique neuve** : un **heartbeat** (~500 ms) dans le skin, car un
  joueur bloqué n'émet aucun event → il faut une horloge pour évaluer les timers
  d'inactivité.

---

## 6. Reporté à la phase roguelite
- **Méta-stat « paliers nettoyés sans aide »** (piste *puriste* : badge / déblocages).
  Pas trackée pour l'instant ; à brancher quand le roguelite arrive.

## 7. Encore à définir
- Nombre de **niveaux de tuto** (avant la coupe nette du contour le plus visible).
- Design détaillé du **mode hardcore** (et avancé) côté UI / déblocage.
