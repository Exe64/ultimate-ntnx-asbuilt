---
plan:
  id: '11'
  name: 11-theme-sombre-habillage.md
  link: https://github.com/Exe64/ultimate-ntnx-asbuilt/blob/main/doc/roadmap/done/11-theme-sombre-habillage.md
status: done
date: 2026-11-17
description: >
  Thème sombre par défaut, bascule Clair et habillage de la page :
  en-tête de marque, étapes, cartes, états, palette du template.
priority: medium
complexity: M
intent: null
scope:
  modules:
    - web/index.html
    - web/app.js
    - web/i18n.js
    - assets/logo.png
    - assets/banner.jpg
    - tests/theme.test.js
issue:
  id: 11
  url: https://github.com/Exe64/ultimate-ntnx-asbuilt/issues/11
---

# [🌗] Plan #11 - Thème sombre et habillage de l'interface

## Objectif

Donner à la page une identité soignée, cohérente avec le livrable Word, et
utilisable en clair comme en sombre, au choix de l'utilisateur.

## Périmètre

### Inclus
- Tokens de couleur clair et sombre, avec la palette du template : violet `#7855fa` et vert Nutanix
- Bascule de thème Clair / Sombre (Sombre par défaut ; Auto retiré en revue), choix retenu dans le navigateur, appliqué avant l'affichage pour éviter un flash au chargement
- En-tête de marque : logo `assets/icon.png`, favicon, sélecteur de langue existant, bascule de thème
- Habillage des sections : étapes 1-2-3, cartes, champs, boutons, focus, survol, désactivé, badges OK/KO ; sortie des `style=` inline
- Libellés de la bascule dans le dictionnaire i18n existant

### Hors scope
- Refonte de la mise en page (assistant, barre latérale)
- Police embarquée (polices système uniquement)
- Playwright ou capture automatique
- Barre de titre native de l'app desktop (plan #9)
- Logique i18n (plan #7, clôturé) : le sélecteur est restylé, pas modifié

## Étapes

- [x] Étape 1 — Tokens de couleur des deux thèmes et remplacement des couleurs écrites en dur (S · standard → Sonnet)
- [x] Étape 2 — En-tête de marque : logo, favicon, langue, bascule de thème (S · standard → Sonnet)
- [x] Étape 3 — Bascule de thème : application avant l'affichage, choix retenu, libellés i18n (S · standard → Sonnet)
- [x] Étape 4 — Habillage des sections : étapes, cartes, champs, boutons, états, badges ; sortie des `style=` inline (M · standard → Sonnet)
- [x] 🧪 Tests — Tests existants, script de contraste AA dans les deux thèmes, procédure de revue visuelle
- [x] ✅ Validation — Revue visuelle par l'utilisateur, puis clôture

## Décisions techniques

| Décision | Choix retenu | Justification |
|----------|-------------|---------------|
| Choix du thème | ~~Auto / Clair / Sombre~~ → Clair / Sombre, Sombre par défaut | Revue visuelle : l'opérateur retire le mode Auto (2026-11-17) |
| Ambition | Raffinement marqué | Page d'outil : précision et lisibilité avant l'effet ; structure et textes conservés |
| Palette | Celle du template (violet et vert Nutanix) | L'appli et le livrable se ressemblent |
| Polices | Polices système | Outil hors ligne, rien n'est ajouté au poids de l'exe |
| Logo | ~~`assets/icon.png`~~ → nouveau logo `assets/logo.png` (page à coin plié + grille de nœuds) | L'icône d'origine, trop chargée, était illisible à 64 px |
| Bannière | Bande fine (~120 px) derrière le titre, sombre dans les deux thèmes | Identité sans repousser le formulaire ; rappel du bandeau de couverture Word |
| Lien avec #7 | Indépendant (#7 clôturé le 2026-11-17) | Le sélecteur de langue est restylé, la logique i18n ne change pas |
| Validation | Script de contraste et revue visuelle humaine | Pas de navigateur headless sur la machine |

## Tests

### Prérequis pour les tests

```bash
cd /srv/dev/ultimate-ntnx-asbuilt
BUN=node_modules/.bin/bun
```

### Procédure de test

```bash
# T1 — Suite complète (dont tests/theme.test.js : contraste AA des tokens, clair et sombre)
$BUN test

# T2 — Aucun style inline restant dans la page
grep -c 'style=' web/index.html

# T3 — Bundle navigateur (app desktop) : logo embarqué, script de thème dans <head>, tokens light-dark
$BUN build web/index.html --target=browser --outdir=/tmp/uab-web
ls /tmp/uab-web/*.png
grep -c "localStorage.getItem('theme')" /tmp/uab-web/index.html

# T4 — Exécutable compilé : page et logo servis
$BUN build server/main.js --compile --minify --outfile=/tmp/uab
PORT=38917 /tmp/uab &
curl -s http://127.0.0.1:38917/ | grep -o 'logo-[^"]*\.png'
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' http://127.0.0.1:38917/<logo trouvé ci-dessus>
kill %1
```

**Résultats attendus :**
- T1 : 0 fail ; les tests `AA contrast in light theme` et `AA contrast in dark theme` passent.
- T2 : `0`.
- T3 : un PNG `logo-*.png` d'environ 37 Ko ; `1` occurrence du script de thème.
- T4 : logo en `200 image/png`.

**Revue visuelle (opérateur, étape ✅ Validation)** : `bun server/main.js` (ou l'exe), puis
- sombre au premier lancement ; bascule Clair / Sombre immédiate ; recharger garde le choix sans flash de l'autre thème ;
- en-tête : logo, titre, langue et thème alignés ; filet vert dessous ; tout passe en anglais avec la langue (Theme / Light / Dark) ;
- étapes 1-2-3 avec pastille ; champs, focus clavier (Tab), boutons, bouton « Parcourir » des fichiers lisibles dans les deux thèmes ;
- étape 2 : états Collecté (vert) / erreur (rouge) avec pastille ;
- à 400 px de large : en-tête replié proprement, pas de défilement horizontal.

### Résultats joués et vérifiés

| Date | Test | Attendu | Observé | Verdict |
|------|------|---------|---------|---------|
| 2026-11-17 | T1 Suite complète | 0 fail, contraste AA clair et sombre | 17 pass / 0 fail ; theme.test.js 2 pass (84 assertions) | ✅ PASS |
| 2026-11-17 | T2 Styles inline | 0 | 0 | ✅ PASS |
| 2026-11-17 | T3 Bundle navigateur | logo-*.png ~37 Ko, script de thème ×1 | logo-7v4k98w5.png 37 058 o, ×1 | ✅ PASS |
| 2026-11-17 | T4 Exe compilé | logo 200 image/png | 200 image/png, 37 058 o | ✅ PASS |
| 2026-11-17 | Logo et bannière servis (dev, bundle, exe) | 200 | logo 200 image/png, bannière 200 image/jpeg | ✅ PASS |
| 2026-11-17 | ✅ Revue visuelle | thème, en-tête à bannière, logo, étapes | validé par l'opérateur (« nickel on est tout bon ») | ✅ PASS |

## Journal de session

### Session 2026-11-17
- ✅ Fait : cadrage, création du plan et de l'issue #11
- ✅ Fait : étapes 1 à 4. Tokens `light-dark()` (une seule définition par couleur), thème forcé par `data-theme` posé par un script dans `<head>` avant l'affichage ; en-tête avec logo (`assets/logo.png`, 128 px, tiré de icon.png), langue et bascule Auto / Clair / Sombre ; pastilles d'étape, cartes, champs, focus, bouton de fichier, états OK/KO à pastille ; plus aucun `style=` inline. Test de contraste AA ajouté (`tests/theme.test.js`), liste des textes invariants du test i18n mise à jour.
- ✅ Fait : 🧪 Tests rejoués par le vérificateur, tous PASS.
- ✅ Fait : revue visuelle 1 (thème Auto, anglais) : logo agrandi de 48 à 64 px à la demande de l'opérateur.
- ✅ Fait : revue visuelle 2 : mode Auto retiré, Sombre par défaut (`color-scheme: dark`, `data-theme=light` pour le clair). Le logo actuel ne convient pas ; nouveau logo, et peut-être une bannière, à générer par l'opérateur (Gemini).
- ✅ Fait : revue visuelle 3 : nouveau logo (généré par l'opérateur avec Gemini, recadré, 128 px, 16 Ko) et bannière fine dans l'en-tête (`assets/banner.jpg`, 20 Ko). La bande reste sombre dans les deux thèmes (`color-scheme: dark` sur `header`), comme la couverture Word ; dégradé à gauche pour le texte, filet vert dessous. Bannière en `<img>` : Bun ne réécrit pas les `url()` du `<style>` intégré (404). Bundle et exe servent le logo et la bannière (200).
- ✅ Fait : revue visuelle 4 : contour du logo retiré (fond fondu dans la bande par `mix-blend-mode: lighten`), logo agrandi à 88 px (recadré serré, 192 px).
- ✅ Fait : ✅ Validation par l'opérateur ; plan clôturé.
