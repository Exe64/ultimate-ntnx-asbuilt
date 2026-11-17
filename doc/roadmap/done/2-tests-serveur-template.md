---
plan:
  id: '2'
  name: 2-tests-serveur-template.md
  link: https://github.com/Exe64/ultimate-ntnx-asbuilt/blob/main/doc/roadmap/done/2-tests-serveur-template.md
status: done
date: 2026-10-12
description: >
  Couvrir par des tests le jeton, les routes du serveur et le contrôle du
  template personnalisé ; fiabiliser le téléchargement du document.
priority: high
complexity: S
intent: null
scope:
  modules:
    - server/main.js
    - web/app.js
    - tests/
issue:
  id: 2
  url: https://github.com/Exe64/ultimate-ntnx-asbuilt/issues/2
---

# [🧪] Plan #2 - Tests du serveur et du template, correctif du téléchargement

## Objectif

Les trois tests actuels couvrent le moteur et la collecte, mais ni le serveur (jeton, routes),
ni le contrôle du template personnalisé. Une régression sur le garde-fou du jeton passerait
inaperçue. Par ailleurs l'URL de téléchargement est révoquée juste après le clic.

## Périmètre

### Inclus
- Extraction du contrôle de template (`checkTemplate`, `web/app.js`) dans un module testable.
- Tests du serveur : jeton absent ou faux, routes, ordre Prism Central puis Prism Element.
- Tests du contrôle de template : fichier illisible, marqueur absent, style absent.
- Révocation différée de l'URL de téléchargement.

### Hors scope
- Tests navigateur de la page.

## Étapes

- [x] Étape 1 — Sortir le contrôle du template de `web/app.js` dans un module testable (XS · standard → Sonnet)
- [x] Étape 2 — Tests du serveur : jeton absent ou faux, routes, ordre Prism Central puis Prism Element (S · standard → Sonnet)
- [x] Étape 3 — Tests du contrôle de template : fichier illisible, marqueur absent, style absent (S · standard → Sonnet)
- [x] Étape 4 — Révoquer l'URL de téléchargement après un délai (XS · standard → Sonnet)
- [x] 🧪 Tests — Rédiger et exécuter la procédure de test (avant-dernière étape, obligatoire)
- [x] ✅ Validation — Vérifier les résultats des tests et clôturer (dernière étape, obligatoire)

## Décisions techniques

| Décision | Choix retenu | Justification |
|----------|-------------|---------------|
| Outil de test | `bun test`, déjà en place | Pas de nouvelle dépendance |
| Tests navigateur | Aucun | Décision de cadrage du 2026-10-12 |

## Tests

### Prérequis pour les tests

```bash
echo "=== Go To Project ==="
cd /srv/dev/ultimate-ntnx-asbuilt

echo "=== Install Dependencies ==="
npm ci
```

### Procédure de test

```bash
echo "=== T1 Full Suite ==="
npm test

echo "=== T2 Server And Template Tests Only ==="
npx bun test tests/server.test.js

echo "=== T3 Template Check Lives In Its Own Module ==="
grep -c "export async function checkTemplate" web/templateCheck.js
grep -c "function checkTemplate" web/app.js

echo "=== T4 Download Url Is Revoked After A Delay ==="
grep -c "setTimeout(() => URL.revokeObjectURL" web/app.js

echo "=== T5 Built Page Still Bundles ==="
(PORT=18441 NO_OPEN=1 timeout 6 npx bun server/main.js >/dev/null 2>&1 &) ; sleep 3 ; curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:18441/
```

**Résultats attendus :**
- T1 : `7 pass`, `0 fail`, sur 2 fichiers.
- T2 : `4 pass`, `0 fail` (page et template sans jeton ; refus sans jeton ; ordre PC puis PE ; contrôle du template).
- T3 : `1` puis `0`.
- T4 : `1`.
- T5 : `200`.

### Résultats joués et vérifiés

| Date | Test | Attendu | Observé | Verdict |
|------|------|---------|---------|---------|
| 2026-10-12 | Auto-check exécuteur : suite complète | 7 pass, 0 fail | 7 pass, 0 fail, 194 assertions | ✅ |
| 2026-10-12 | Auto-check exécuteur : mutation (garde du jeton désactivée) | les tests du jeton échouent | 2 fail, puis 7 pass après restauration | ✅ |
| 2026-10-12 | T1 suite complète (vérificateur) | 7 pass, 0 fail, 2 fichiers | 7 pass, 0 fail, 194 assertions, 2 fichiers | ✅ |
| 2026-10-12 | T2 tests serveur et template (vérificateur) | 4 pass, 0 fail | 4 pass, 0 fail, 37 assertions | ✅ |
| 2026-10-12 | T3 module dédié (vérificateur) | 1 puis 0 | 1 puis 0 | ✅ |
| 2026-10-12 | T4 révocation différée (vérificateur) | 1 | 1 | ✅ |
| 2026-10-12 | T5 page servie (vérificateur) | 200 | 200 | ✅ |

Verdict du vérificateur indépendant (sous-agent, 2026-10-12) : **PASS**. Sa limite : la sortie de bun ne nomme
pas les tests, seul le compte de T2 est confirmé.

## Journal de session

### Session 2026-10-12
- ✅ Fait : cadrage, création du plan et de l'issue #2.
- ✅ Fait : étapes 1 à 4 (`web/templateCheck.js`, `tests/server.test.js`, `tests/fixtures/fakePrism.js`, révocation différée).
- ✅ Clôture 2026-10-12 : Jeton, routes et contrôle du template couverts par quatre nouveaux tests ; URL de téléchargement révoquée après un délai.
