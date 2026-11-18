---
plan:
  id: '14'
  name: 14-pied-de-page-licence.md
  link: https://github.com/Exe64/ultimate-ntnx-asbuilt/blob/main/doc/roadmap/done/14-pied-de-page-licence.md
status: done
date: 2026-11-18
description: >
  Pied de page : la licence GPL-3.0, avec un lien, à la place de « Tous droits réservés ».
priority: medium
complexity: XS
intent: null
scope:
  modules:
    - web/index.html
    - web/i18n.js
issue:
  id: 14
  url: https://github.com/Exe64/ultimate-ntnx-asbuilt/issues/14
---

# [⚖️] Plan #14 - Pied de page : mention de licence

## Objectif

Le pied de page affiche « © 2026 Tous droits réservés », ce qui contredit la licence GPL-3.0 d'un dépôt désormais public. Il affichera la licence, avec un lien vers son texte.

## Périmètre

### Inclus
- Texte du pied de page et sa traduction anglaise.
- Lien vers `LICENSE` sur GitHub.

### Hors scope
- En-têtes de licence dans les fichiers source.
- Mentions du document Word généré.

## Étapes

- [x] Étape 1 — « © 2026 · Licence GPL-3.0 » (lien vers `LICENSE`) à la place de « © 2026 Tous droits réservés. », en français et en anglais (XS · standard → Sonnet)
- [x] 🧪 Tests — Rédiger et exécuter la procédure de test
- [x] ✅ Validation — Vérifier les résultats des tests et clôturer

## Décisions techniques

| Décision | Choix retenu | Justification |
|----------|-------------|---------------|
| Cadrage | Décidé par l'exécutant, sans questions | Demande de l'utilisateur : enchaîner les trois recommandations sans interruption (2026-11-18) |
| Libellé | « © 2026 · Licence GPL-3.0 » | Garde le copyright de l'auteur (compatible GPL), retire « Tous droits réservés » |
| Lien | `https://github.com/Exe64/ultimate-ntnx-asbuilt/blob/main/LICENSE` | Texte de référence, même cible dans les deux langues |

## Tests

### Prérequis pour les tests

```bash
cd ~/dev/ultimate-ntnx-asbuilt
```

### Procédure de test

```bash
npx bun test tests/i18n.test.js     # chaque texte de index.html a sa traduction
grep -c "Tous droits réservés" web/index.html web/i18n.js   # 0 attendu
```

**Résultats attendus :** test i18n vert ; plus aucune occurrence de « Tous droits réservés ».

### Résultats joués et vérifiés

| Date | Test | Attendu | Observé | Verdict |
|------|------|---------|---------|---------|
| 2026-11-18 | `npx bun test tests/i18n.test.js` | 0 fail | 2 pass, 0 fail, 13 assertions | ✅ |
| 2026-11-18 | `grep -c "Tous droits réservés"` dans `web/index.html`, `web/i18n.js` | 0 | 0, 0 | ✅ |

## Journal de session

### 2026-11-18
- ✅ Issue #14 et plan créés (cadrage par l'exécutant, sur consigne de l'utilisateur).
- 🔨 Pied de page : « © 2026 · Licence GPL-3.0 », lien vers `LICENSE` ; anglais « GPL-3.0 license ».
- ✅ Validation : tests conformes ; plan clôturé le 2026-11-18.
