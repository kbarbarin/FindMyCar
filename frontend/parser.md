# Parser — logique et design

Ce document décrit le parser de requête de FindMyCar : comment une phrase en français
libre (`"Toyota Prius+ moins de 10 ans plus de 200 000 km"`) devient un objet structuré
`SearchCriteria` consommable par le moteur de recherche.

Fichier : [`src/services/search/queryParser.js`](./src/services/search/queryParser.js).

## Objectifs

1. **Tolérance** : fautes de frappe mineures, ordre libre des termes, variantes typographiques.
2. **Précision** : extraire des filtres **structurés** (make, model, plages numériques, enums) là où c'est possible, laisser du texte libre en dernier recours.
3. **Déterminisme** : même entrée → même sortie. Aucune dépendance au contexte ou à un LLM.
4. **Migrable** : la signature `parseText(raw) → patch` reste stable. En V2 on peut la remplacer par un appel Cloud Function basé LLM sans toucher à l'UI.

## Vue d'ensemble

```
                  raw text (Fr / En mixed)
                            │
                            ▼
                  1. Normalisation lexicale
                  (lowercase, diacritiques, "15k"→15000,
                   "200 000"→200000, ponctuation)
                            │
                            ▼
                  2. Extracteurs structurés
                  (chacun consomme sa tranche de texte)
                     ├─ années
                     ├─ kilométrage
                     ├─ prix
                     ├─ carburant
                     ├─ boîte de vitesse
                     ├─ pays
                     └─ flags (1ère main, import…)
                            │
                            ▼
                  3. Fuzzy-match Marque / Modèle
                  sur le texte RÉSIDUEL (les patterns
                  structurés ont déjà été retirés)
                            │
                            ▼
                  4. patch : SearchCriteria partiel
                  + `q` = texte brut conservé pour affichage
```

## 1. Normalisation lexicale

Avant toute extraction, le texte passe par `normalizeInput()` :

| Étape | Exemple |
|---|---|
| Strip des diacritiques (NFD + regex) | `"électrique"` → `"electrique"` |
| Lowercase | `"Toyota PRIUS+"` → `"toyota prius+"` |
| Virgule décimale → point | `"15,5k"` → `"15.5k"` |
| `Xk` / `Xk€` / `Xkm` → multiplication par 1000 | `"15k"` → `"15000"`, `"200k km"` → `"200000 km"` |
| Espaces internes dans les nombres | `"200 000"` → `"200000"` |
| Ponctuation résiduelle (`. , ; : ! ? " ( )`) → espace | — |
| Espaces multiples → simple | — |

Les caractères `+` et `-` **sont conservés** : on en a besoin pour `"Prius+"`, `"2018+"`, etc.

## 2. Extracteurs structurés

Chaque extracteur est une **fonction pure** `(text) → { text: resteDuTexte, patch }`.
Il cherche ses motifs avec des regex et **remplace** les tranches consommées par un espace.
L'orchestrateur les applique dans un ordre précis (structuré d'abord, fuzzy-match texte ensuite) :

```js
const steps = [
  extractYears,
  extractMileage,
  extractPrice,
  extractFuel,
  extractTransmission,
  extractCountries,
  extractFlags,
];
```

### Années

Tous les motifs ramènent à une plage `[yearMin, yearMax]`.

| Motif | Effet | Exemple |
|---|---|---|
| `moins de X ans`, `max X ans`, `<=X ans` | `yearMin = anneeEnCours - X` | `"moins de 10 ans"` → yearMin=2016 |
| `plus de X ans`, `min X ans`, `>=X ans` | `yearMax = anneeEnCours - X` | `"plus de 15 ans"` → yearMax=2011 |
| `après YYYY`, `depuis YYYY`, `à partir de YYYY` | `yearMin = YYYY` | `"depuis 2018"` → yearMin=2018 |
| `avant YYYY`, `jusqu'à YYYY` | `yearMax = YYYY` | `"avant 2020"` → yearMax=2020 |
| `YYYY+` | `yearMin = YYYY` | `"2018+"` → yearMin=2018 |
| `entre YYYY et YYYY`, `YYYY-YYYY`, `YYYY à YYYY` | plage complète | `"entre 2018 et 2022"` → [2018,2022] |

L'année courante (`CURRENT_YEAR`) est exportée depuis [`src/mocks/catalog.js`](./src/mocks/catalog.js) pour que parseur et données générées soient toujours cohérents.

### Kilométrage

| Motif | Effet |
|---|---|
| `entre X et Y km` | plage |
| `moins de X km`, `<X km`, `max X km`, `sous X km` | `mileageMax = X` |
| `plus de X km`, `>X km`, `min X km`, `au moins X km` | `mileageMin = X` |

Seuils : `X >= 1000`. Le `Xk` → `X × 1000` est déjà appliqué en étape 1, donc `"200k km"` devient `"200000 km"` → `mileageMin = 200000`.

### Prix

Pattern identique au kilométrage, mais avec suffixes `€`, `eur`, `euros`.
Extension : `"budget X €"` → `priceMax = X`.

Bornes de validité : `500 ≤ X ≤ 500000`.

### Carburant

Itère sur la constante `FUELS` et matche le label canonique (`"Hybride"`, `"Électrique"`, `"Diesel"`…).
Multi-select : plusieurs carburants possibles dans la même phrase.

### Boîte de vitesse

Alias mappés sur les ids canoniques :

| Id | Alias |
|---|---|
| `automatic` | `"automatique"`, `"boite auto"`, `"bva"`, `"dsg"` |
| `manual` | `"manuelle"`, `"boite manuelle"`, `"bvm"` |
| `semi_automatic` | `"semi-automatique"`, `"pilotée"` |

### Pays

On matche **uniquement les labels complets** (`"Allemagne"`, `"Germany"`, `"Belgium"`, `"Pays-Bas"`…).

**Décision volontaire :** on ne détecte pas les codes ISO isolés (`fr`, `de`, `es`). Le risque de collision avec le français est trop élevé — le mot `"de"` est l'une des prépositions les plus fréquentes, et son extraction comme code `DE` saboterait quasi toutes les recherches ("plus de 10 ans" passerait à `countries=DE`).

### Flags

- `"première main"` → `firstHandOnly = true`
- `"import"`, `"importable"`, `"importer"` → `importFriendly = true`

## 3. Fuzzy-match marque / modèle

Sur le texte **résiduel** (après que les extracteurs structurés l'ont nettoyé), on parcourt :

1. **Marques connues** (issues du catalogue `CATALOG` + alias `VW`, `Citroen`) : regex `\bmarque\b`, **triées de la plus longue à la plus courte** pour éviter que `"Model S"` soit préempté par `"Model"`.
2. Si une marque matche, on restreint les modèles candidats à ceux de cette marque (table `MODELS_BY_MAKE`) et on re-applique le même algorithme.
3. Pour la tolérance typographique `"Prius +"` / `"Prius+"` / `"Prius  +"`, la regex compilée depuis le nom de modèle remplace chaque `+` par `\s*\+` :
   ```js
   const pattern = escapeRegExp(mL).replace(/\\\+/g, '\\s*\\+');
   ```

Les valeurs renvoyées passent par `normalizeMake` / `normalizeModel` pour rentrer dans la forme canonique unique (`"Prius +"` → `"Prius+"`, `"Citroen"` → `"Citroën"`).

## 4. Sortie

```js
patch = {
  q: "Toyota Prius+ moins de 10 ans plus de 200 000 km",  // brut conservé pour affichage
  make: "Toyota",
  model: "Prius+",
  yearMin: 2016,
  mileageMin: 200000,
}
```

Les champs absents **restent absents** (pas de `null` bruyant). Le moteur de filtre interprète les champs non renseignés comme "non contraint".

## 5. Interaction avec le filtre

Dans [`src/services/search/searchEngine.js`](./src/services/search/searchEngine.js), `filterListings()` détecte si des critères structurés ont été extraits :

```js
const hasStructured = Boolean(
  normalizedMake || normalizedModel ||
  criteria.yearMin != null || criteria.yearMax != null ||
  criteria.mileageMin != null || criteria.mileageMax != null ||
  criteria.priceMin != null || criteria.priceMax != null ||
  (criteria.fuel && criteria.fuel.length) ||
  (criteria.transmission && criteria.transmission.length) ||
  (criteria.countries && criteria.countries.length) ||
  (criteria.features && criteria.features.length) ||
  criteria.firstHandOnly,
);
```

Si `hasStructured` est `true`, le filtre **ignore `q`** : le texte brut a déjà été "consommé" par le parser. Ça évite qu'une phrase comme `"voiture électrique moins de 5 ans"` rejette tous les résultats parce que le mot `"voiture"` n'apparaît jamais dans un titre d'annonce.

Seul cas où `q` est utilisé : la requête a **zéro critère structuré** (ex: un mot tapé isolé qui n'a matché ni une marque ni un enum). Alors on exige qu'**au moins un token significatif** (non stopword, non numérique) du texte libre apparaisse dans `title + make + model + version` de l'annonce.

## 6. Batterie de tests

Lancer `npm run test:parser` : 13 requêtes couvrant les cas structurés, texte libre, plages, enums. Chacune est assortie d'un nombre **minimum de résultats** attendus ; le test échoue si on tombe en dessous.

Exemple de sortie (dataset ~4 700 annonces générées) :

```
Requête                                                parsed                                    count | min   result
──────────────────────────────────────────────────────────────────────────────────────────────────────────
Toyota Prius+ moins de 10 ans plus de 200 000 km       make=Toyota model=Prius+ yearMin=2016      448 |   20  ✔ PASS
Toyota Prius+                                          make=Toyota model=Prius+                   602 |   50  ✔ PASS
Toyota                                                 make=Toyota                                945 |  200  ✔ PASS
Peugeot 308 SW diesel                                  make=Peugeot model=308 SW fuel=diesel      257 |   10  ✔ PASS
Volvo V90 Allemagne                                    make=Volvo model=V90 countries=DE           19 |    5  ✔ PASS
Tesla Model 3                                          make=Tesla model=Model 3                   566 |   30  ✔ PASS
SUV hybride budget 25 000 €                            priceMax=25000 fuel=hybrid                 794 |   30  ✔ PASS
voiture électrique moins de 5 ans                      yearMin=2021 fuel=electric                 355 |   50  ✔ PASS
Renault Clio moins de 100 000 km                       make=Renault model=Clio                    579 |   30  ✔ PASS
BMW Serie 3 automatique                                make=BMW model=Série 3 transmission=auto   319 |   20  ✔ PASS
Volkswagen Golf entre 2018 et 2022                     make=Volkswagen model=Golf [2018,2022]     244 |   20  ✔ PASS
Audi A4 après 2019                                     make=Audi model=A4 yearMin=2019            306 |   15  ✔ PASS
hybride                                                fuel=hybrid                                813 |  100  ✔ PASS

✔ All cases passed.
```

## 7. Évolutions prévues

- **V1.1** (local) : élargir le catalogue de marques/modèles, ajouter les finitions (`"GT Line"`, `"R Design"`), gérer les mots orphelins comme `"break"`, `"SUV"`, `"cabriolet"` → `bodyType`.
- **V2** (Firebase + LLM) : remplacer `parseText` par un appel à une Cloud Function qui envoie le texte à Claude et récupère le même patch `SearchCriteria`. Avantages : tolérance aux fautes de frappe sérieuses, compréhension de requêtes floues ("une familiale hybride fiable pour toute la famille"). Contrainte : même signature d'API, donc **rien à changer côté UI**.

## 8. Règles de conception

1. **Le parser est une fonction pure** : pas de side-effects, pas d'I/O. Testable en Node.
2. **On consomme le texte en le remplaçant par des espaces** au fur et à mesure. Ça évite les doubles extractions et sert d'audit visuel ("qu'est-ce qui reste à la fin ?").
3. **On ne se bat pas contre les cas ambigus** : si `"de"` est à la fois une préposition et un code pays, on renonce au code pays. Le coût produit est quasi nul, le coût d'une mauvaise extraction est énorme.
4. **Les extracteurs sont triés du plus contraint au moins contraint** : années d'abord (unités très spécifiques), puis km, prix, enums. Fuzzy match make/model en dernier, sur le résidu.
5. **Diacritiques strippés dès l'entrée** : `"électrique"`, `"Électrique"`, `"electrique"` convergent.
