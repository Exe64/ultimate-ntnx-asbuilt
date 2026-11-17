---
plan:
  id: '12'
  name: 12-copyright-pied-de-page.md
  link: https://github.com/Exe64/ultimate-ntnx-asbuilt/blob/main/doc/roadmap/done/12-copyright-pied-de-page.md
status: done
date: 2026-11-17
description: >
  Mention de copyright en bas de la page web.
priority: low
complexity: XS
intent: null
scope:
  modules:
    - web/index.html
    - web/i18n.js
    - web/app.js
    - assets/kofi.png
    - desktop/main.js
    - electrobun.config.ts
    - .github/workflows/ci.yml
    - README.md
    - tests/i18n.test.js
issue:
  id: 12
  url: https://github.com/Exe64/ultimate-ntnx-asbuilt/issues/12
---

# [©] Plan #12 - Copyright en pied de page

## Objectif

Afficher « © 2026 Julien Dumur », un lien GitHub et un lien Blog en bas de la page, discrets, lisibles dans les deux thèmes. Le lien Blog suit la langue de la page (juliendumur.fr / juliendumur.fr/en/).

## Étapes

- [x] 1. `<footer>` en fin de `body` dans `web/index.html`, couleur `--muted`, centré.
- [x] 2. Liens GitHub (github.com/Exe64) et Blog ; `data-href-en` lu par `translateNode` (`web/i18n.js`) pour basculer l'URL du blog avec la langue.
- [x] 3. Texte enrichi : « Ultimate As-Built Generator vX.Y.Z · Conçu par Julien Dumur · © 2026 Tous droits réservés. » + « Outil indépendant, non affilié à Nutanix, Inc. » ; version lue depuis package.json (`web/app.js`), libellés traduits dans `EN`.
- [x] 4. Bouton Ko-fi (https://ko-fi.com/juliendumur) sur sa propre ligne sous Langue/Thème dans la bannière : fond `--accent`, tasse ☕ en CSS, libellé traduit, nouvel onglet.
- [x] 5. Correctif : `.controls` passe de flex-wrap à une grille 2 colonnes, Ko-fi sur toute la ligne (`grid-column: 1 / -1`) ; le flex-basis 100 % élargissait le bloc et le renvoyait sous le titre.
- [x] 6. Logo officiel Ko-fi (`assets/kofi.png`, fourni par l'utilisateur) à la place de l'emoji ☕, en `<img>` 22×18 dans le bouton.
- [x] 7. Titre « Ultimate As-Built Generator » : `<title>`, `<h1>`, pied de page, fenêtre desktop. 
- [x] 8. Nom de build Electrobun (`app.name`), contrôle CI de la description de bun.exe et titre du README renommés. `identifier` et noms des fichiers de release (`ultimate-asbuilt-*`) inchangés ; messages serveur inchangés.
- [x] 🧪 Tests
- [x] ✅ Validation — validée par l'utilisateur dans le navigateur le 2026-11-18.

## Tests

Mode autonomous.

| Test | Attendu | Résultat |
|---|---|---|
| `npm test` | Tous les tests passent (dont couverture i18n : texte ajouté aux invariants FR/EN) | ✅ 17/17 (1er passage : échec couverture i18n, corrigé) |
| Page servie : `grep '<footer' web/index.html` | Footer présent après `#status` | ✅ |
| `npm test` après étape 2 | 17/17, « GitHub » et « Blog » dans les invariants FR/EN | ✅ |
| `npm test` après étape 3 | 17/17, nouveaux libellés couverts par `EN` | ✅ |
| `toEnglish` sur les deux nouveaux libellés | « · Designed by Julien Dumur · © 2026 All rights reserved. » et « Independent tool, not affiliated with Nutanix, Inc. » | ✅ |
| `npm test` après étape 4 | 17/17, libellé Ko-fi couvert par `EN` | ✅ |
| `npm run build:web` après étape 6 | `kofi-*.png` embarqué dans `dist-web` | ✅ |
| `npm test` après étape 7 | 17/17, nouveau titre dans les invariants FR/EN | ✅ |
| CI Windows après étape 8 | bun.exe décrit « Ultimate As-Built Generator », smoke test vert | ⚠️ Non jouée : CI du push `2c127c3` verte (job `test`), job `desktop-windows` exécuté sur tag uniquement. À vérifier au prochain tag `v*`. |
| Navigateur : titre | Onglet, en-tête et pied de page « Ultimate As-Built Generator » | ✅ validé (utilisateur, 2026-11-18) |
| Navigateur : bouton Ko-fi | Langue/Thème à droite du titre (largeur ≥ ~900 px), Ko-fi sous eux aligné à droite, avec le logo officiel ; « Love the app? Buy me a Ko-fi » en EN, ouvre ko-fi.com/juliendumur | ✅ validé (utilisateur, 2026-11-18) |
| Navigateur : version affichée | « Ultimate As-Built Generator v0.2.1 » | ✅ validé (utilisateur, 2026-11-18) |
| Navigateur : basculer FR/EN puis survoler « Blog » | FR → https://juliendumur.fr, EN → https://juliendumur.fr/en/ ; ouverture dans un nouvel onglet | ✅ validé (utilisateur, 2026-11-18) |
