---
plan:
  id: '4'
  name: 4-export-import-collecte.md
  link: https://github.com/Exe64/ultimate-ntnx-asbuilt/blob/main/doc/roadmap/done/4-export-import-collecte.md
status: done
date: 2026-10-12
description: >
  Exporter la collecte et les saisies manuelles dans un fichier JSON sans
  identifiants, et le réimporter pour régénérer un document ou reprendre une
  collecte.
priority: medium
complexity: M
intent: null
scope:
  modules:
    - server/main.js
    - web/app.js
    - web/index.html
    - tests/
blocks:
  - '7'
issue:
  id: 4
  url: https://github.com/Exe64/ultimate-ntnx-asbuilt/issues/4
---

# [💾] Plan #4 - Export / import de la collecte

## Objectif

La collecte ne vit qu'en mémoire : fermer la fenêtre ou recharger la page oblige à tout
recollecter et à ressaisir site et switches. Un fichier exporté doit permettre de régénérer
un document hors ligne, de reprendre une collecte, et de transmettre un cas pour diagnostic.

## Périmètre

### Inclus
- Format de fichier : collecte, saisies manuelles (client, projet, site, switches, sections
  cochées), version du format.
- Export depuis la page.
- Import : la page se remplit et le serveur est rechargé, pour pouvoir retenter un Prism Element.
- Refus d'un fichier invalide ou d'une version inconnue.

### Hors scope
- Tout stockage d'identifiants.
- Stockage côté serveur ou base de données.

## Étapes

- [x] Étape 1 — Format du fichier : collecte, saisies manuelles, version ; aucun identifiant (S · standard → Sonnet)
- [x] Étape 2 — Export depuis la page (S · standard → Sonnet)
- [x] Étape 3 — Import : la page se remplit et le serveur est rechargé (M · standard → Sonnet)
- [x] Étape 4 — Refus d'un fichier invalide ou d'une version inconnue (S · standard → Sonnet)
- [x] 🧪 Tests — Rédiger et exécuter la procédure de test (avant-dernière étape, obligatoire)
- [x] ✅ Validation — Vérifier les résultats des tests et clôturer (dernière étape, obligatoire)

## Décisions techniques

| Décision | Choix retenu | Justification |
|----------|-------------|---------------|
| Contenu du fichier | Collecte + saisies manuelles, jamais d'identifiants | Décision de cadrage du 2026-10-12 |
| Import | Recharge aussi le serveur | Permet de retenter un Prism Element après reprise |
| Format | `{ format, version: 1, appVersion, exportedAt, bundle, inputs }` | Le marqueur `format` et la version permettent de refuser proprement un fichier étranger ou trop récent |
| Saisies exportées | Tous les champs nommés de l'étape 3, sauf le template | Capture générique du formulaire : un champ ajouté plus tard est exporté sans code en plus |
| Saisies et nouvelle tentative | Les saisies sont relues avant de redessiner l'étape 3, puis remises | Retenter un Prism Element effaçait site et switches |
| Ordre | Après le plan #3 | Le plan #3 modifie la forme de la collecte ; évite de retoucher deux fois |

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

echo "=== T2 Server Tests Including Export Import ==="
npx bun test tests/server.test.js

echo "=== T3 Import Route Needs The Token ==="
(PORT=18443 NO_OPEN=1 timeout 8 npx bun server/main.js >/dev/null 2>&1 &) ; sleep 3 ; curl -s -o /dev/null -w "%{http_code}" -X POST -H "content-type: application/json" -d "{}" http://127.0.0.1:18443/api/import

echo "=== T4 Page Offers Export And Import ==="
grep -c 'id="exportBtn"' web/index.html
grep -c 'id="importFile"' web/index.html
```

**Résultats attendus :**
- T1 : `9 pass`, `0 fail`, sur 2 fichiers.
- T2 : `5 pass`, `0 fail`.
- T3 : `403`.
- T4 : `1` puis `1`.

### Résultats joués et vérifiés

| Date | Test | Attendu | Observé | Verdict |
|------|------|---------|---------|---------|
| 2026-10-12 | Auto-check exécuteur : suite complète | 9 pass, 0 fail | 9 pass, 0 fail, 221 assertions | ✅ |
| 2026-10-12 | Auto-check exécuteur : parcours de la page en DOM simulé (jsdom, hors dépôt) contre le faux Prism | collecte, export sans identifiant, import sur page neuve avec saisies restaurées, refus d'un fichier invalide, saisies conservées après une nouvelle tentative Prism Element | les six contrôles passent | ✅ |
| 2026-10-12 | T1 suite complète (vérificateur) | 9 pass, 0 fail, 2 fichiers | 9 pass, 0 fail, 221 assertions | ✅ |
| 2026-10-12 | T2 tests serveur (vérificateur) | 5 pass, 0 fail | 5 pass, 0 fail, 55 assertions | ✅ |
| 2026-10-12 | T3 import sans jeton (vérificateur) | 403 | 403 | ✅ |
| 2026-10-12 | T4 boutons de la page (vérificateur) | 1 puis 1 | 1 puis 1 | ✅ |

Verdict du vérificateur indépendant (sous-agent, 2026-10-12) : **PASS**.

Limite : le parcours n'a pas été joué dans un vrai navigateur (Chromium ne démarre pas sur la machine de
développement, bibliothèque `libatk` absente). À confirmer lors de la validation sur le lab.

## Journal de session

### Session 2026-10-12
- ✅ Fait : cadrage, création du plan et de l'issue #4.
- ✅ Fait : étapes 1 à 4 (`web/exportFile.js`, route `/api/import`, boutons d'export et d'import, conservation des saisies).
- ✅ Clôture 2026-10-12 : Export de la collecte et des saisies en JSON sans identifiants, import sur page neuve avec rechargement du serveur, refus des fichiers invalides.
