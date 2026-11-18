---
plan:
  id: '16'
  name: 16-comparaison-collectes.md
  link: https://github.com/Exe64/ultimate-ntnx-asbuilt/blob/main/doc/roadmap/16-comparaison-collectes.md
status: active
date: 2026-11-18
description: >
  Comparer deux collectes exportées et produire un rapport d'écarts .docx dans le template.
priority: medium
complexity: L
intent: null
scope:
  modules:
    - engine/asbuilt/compare.js
    - web/app.js
    - web/index.html
    - web/i18n.js
    - tests/compare.test.js
issue:
  id: 16
  url: https://github.com/Exe64/ultimate-ntnx-asbuilt/issues/16
---

# [🔀] Plan #16 - Comparaison de deux collectes

## Objectif

Un intégrateur livre un as-built, puis revient des mois plus tard : qu'est-ce qui a changé ? L'outil compare deux collectes exportées (avant et après) et produit un rapport d'écarts .docx dans le template : lignes ajoutées, supprimées, valeurs modifiées, section par section et cluster par cluster.

## Périmètre

### Inclus
- Moteur `engine/asbuilt/compare.js` : un modèle par collecte (moteur existant), comparaison des sections `table` et `kv`, résultat au format du modèle pour réutiliser l'export Word.
- Rapport : synthèse (nombre d'écarts par section), puis un tableau par section changée : Élément, Champ, Avant, Après.
- Page : « Comparer deux collectes » à l'étape 1 (deux fichiers, un bouton), langue de la page, template par défaut.
- Tests sur la fixture de référence.

### Hors scope
- Schémas, texte de présentation, annexes (journal de collecte, écarts au Build) : comparés à part ou non pertinents.
- Filtrage des valeurs volatiles (capacité utilisée, nombre de VM) : signalées comme les autres.
- Comparaison avec la collecte en cours sans l'exporter.
- Template personnalisé pour le rapport.

## Étapes

- [x] Étape 1 — Moteur : appariement des sections (id + cluster, clusters par uuid puis nom), lignes par clé (première colonne, rang si doublon), cellules modifiées, lignes ajoutées et supprimées, changement d'état (collecté / non collecté) ; modèle de rapport (L · reasoning → Opus)
- [x] Étape 2 — Tests : fixture modifiée (ligne ajoutée, supprimée, valeur changée, kv changé, cluster ajouté), aucune différence entre une collecte et elle-même, rapport .docx généré sans marqueur résiduel (M · standard → Sonnet)
- [x] Étape 3 — Page : bloc « Comparer deux collectes », génération et téléchargement du rapport, messages traduits, couverture i18n (M · standard → Sonnet)
- [x] Étape 4 — README : section « Compare two collections » (XS · standard → Sonnet)
- [ ] 🧪 Tests — Rédiger et exécuter la procédure de test
- [ ] ✅ Validation — Vérifier les résultats des tests et clôturer

## Décisions techniques

| Décision | Choix retenu | Justification |
|----------|-------------|---------------|
| Cadrage | Décidé par l'exécutant, sans questions | Demande de l'utilisateur : enchaîner les trois recommandations sans interruption (2026-11-18) |
| Base de comparaison | Les modèles du moteur, pas les données brutes | Mêmes libellés, unités et formats que le document : un écart se lit comme l'as-built |
| Rendu | Modèle de rapport rendu par `generateAsBuiltDocx` | Même template, même charte, aucun second moteur d'export |
| Clé de ligne | Première colonne ; rang d'occurrence si doublon | Les tableaux commencent par le nom de l'objet (hôte, réseau, conteneur…) |
| Sections comparées | `table` et `kv` | Schémas et texte : dérivés des tableaux ; annexes : propres à chaque collecte |
| Entrées | Deux fichiers exportés | Le format d'export existe déjà, sans identifiants ; pas de collecte live nécessaire |

## Tests

### Prérequis pour les tests

```bash
cd ~/dev/ultimate-ntnx-asbuilt
```

### Procédure de test

```bash
# T1 — Moteur et rapport : tests/compare.test.js (identité, ajouts, suppressions, modifications, kv,
#      cluster ajouté, clé de ligne, état de section, colonnes par nom, anglais, .docx sans marqueur)
npx bun test tests/compare.test.js
# T2 — Suite complète, dont la couverture i18n des textes ajoutés à la page
npx bun test
# T3 — Build de la page
npx bun build web/index.html --target=browser --outdir /tmp/webchk
```

```text
T4 — Dans l'application (navigateur ou Windows) : exporter une collecte, en exporter une seconde
     (ou la même après une modification sur le lab), « Comparer deux collectes » → choisir les deux
     fichiers → « Générer le rapport d'écarts ». Ouvrir le .docx.
```

**Résultats attendus :**
- T1, T2 : 0 fail. T3 : build OK.
- T4 : un .docx `ecarts_<pc>_<date>.docx` dans la charte du template : « Collectes comparées », « Synthèse des écarts », puis un tableau par section changée ; message « Rapport d'écarts généré : N écart(s). ».

### Résultats joués et vérifiés

| Date | Test | Attendu | Observé | Verdict |
|------|------|---------|---------|---------|
| 2026-11-18 | T1 — `npx bun test tests/compare.test.js` | 0 fail | 7 pass, 0 fail, 30 assertions | ✅ |
| 2026-11-18 | T2 — `npx bun test` | 0 fail | 38 pass, 0 fail, 455 assertions, 7 fichiers | ✅ |
| 2026-11-18 | T3 — build de la page | OK | build OK | ✅ |
| 2026-11-18 | T4 — parcours dans l'application | Rapport .docx téléchargé | En attente : aucun navigateur ne démarre sur la machine de l'exécutant (cf. #4) ; à jouer par l'utilisateur | ⏳ |

## Journal de session

### 2026-11-18
- ✅ Issue #16 et plan créés (cadrage par l'exécutant, sur consigne de l'utilisateur).
- 🔨 `engine/asbuilt/compare.js` : un modèle par collecte (toutes sections), sections `table` et `kv` comparées ; clé de ligne = premières colonnes uniques des deux côtés (jusqu'à 3), rang d'occurrence en dernier recours (`pc.identity`, `cfg.disks` ont des doublons en 1re colonne) ; colonnes appariées par nom ; ligne ajoutée ou supprimée décrite « colonne : valeur » ; section collectée d'un seul côté → écart d'état ; clusters appariés par uuid puis nom, ajoutés ou retirés listés sans être comparés. Rendu : modèle as-built (« Collectes comparées », « Synthèse des écarts », sections changées) passé à `generateAsBuiltDocx`.
- 🔨 Page : bloc « Comparer deux collectes » (étape 1), template par défaut, langue de la page, client repris de la collecte récente ; libellés traduits et testés. README : fonctionnalité et section dédiée.
- ⏳ Reste : T4 (parcours dans l'application), puis ✅ Validation et clôture.
