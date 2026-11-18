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

- [ ] Étape 1 — Moteur : appariement des sections (id + cluster, clusters par uuid puis nom), lignes par clé (première colonne, rang si doublon), cellules modifiées, lignes ajoutées et supprimées, changement d'état (collecté / non collecté) ; modèle de rapport (L · reasoning → Opus)
- [ ] Étape 2 — Tests : fixture modifiée (ligne ajoutée, supprimée, valeur changée, kv changé, cluster ajouté), aucune différence entre une collecte et elle-même, rapport .docx généré sans marqueur résiduel (M · standard → Sonnet)
- [ ] Étape 3 — Page : bloc « Comparer deux collectes », génération et téléchargement du rapport, messages traduits, couverture i18n (M · standard → Sonnet)
- [ ] Étape 4 — README : section « Compare two collections » (XS · standard → Sonnet)
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
npx bun test tests/compare.test.js
npx bun test
```

**Résultats attendus :** à compléter à l'étape 🧪 Tests.

### Résultats joués et vérifiés

| Date | Test | Attendu | Observé | Verdict |
|------|------|---------|---------|---------|

## Journal de session

### 2026-11-18
- ✅ Issue #16 et plan créés (cadrage par l'exécutant, sur consigne de l'utilisateur).
