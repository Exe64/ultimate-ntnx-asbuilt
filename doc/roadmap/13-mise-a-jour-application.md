---
plan:
  id: '13'
  name: 13-mise-a-jour-application.md
  link: https://github.com/Exe64/ultimate-ntnx-asbuilt/blob/main/doc/roadmap/13-mise-a-jour-application.md
status: active
date: 2026-11-18
description: >
  L'application desktop Windows signale une nouvelle release stable et se met à jour en un clic ;
  les exécutables portables affichent la nouvelle version avec un lien vers la release.
priority: medium
complexity: L
intent: null
scope:
  modules:
    - server/update.js
    - server/app.js
    - desktop/main.js
    - electrobun.config.ts
    - web/index.html
    - web/app.js
    - web/i18n.js
    - .github/workflows/ci.yml
    - README.md
    - tests/
issue:
  id: 13
  url: https://github.com/Exe64/ultimate-ntnx-asbuilt/issues/13
---

# [⬆️] Plan #13 - Mise à jour depuis l'application

## Objectif

Quand une release stable `v*` est publiée, l'application desktop Windows le signale au démarrage et se met à jour en un clic (Updater Electrobun, fichiers joints à la release GitHub). Les exécutables portables affichent la nouvelle version avec un lien vers la release.

## Périmètre

### Inclus
- Vérification au démarrage, silencieuse si à jour ou hors ligne (délai court ~5 s) ; `NO_UPDATE_CHECK=1` la coupe.
- Bandeau bilingue en haut de page : bouton « Mettre à jour » (desktop) ou lien vers la release (portables).
- Bouton grisé pendant une collecte ou une génération ; confirmation (saisies non exportées perdues) sinon.
- CI : fichiers de mise à jour Electrobun (`artifacts/`) joints à la release, `*-update.json` en dernier.
- Note de transition (v0.2.2 → réinstaller une fois), README.
- Releases v0.3.0 (apporte l'updater) puis v0.3.1 (teste la mise à jour en un clic).

### Hors scope
- Signature de code.
- Canal canary / pré-releases (exclues de `releases/latest`).
- Mise à jour automatique des exécutables portables.
- Witness (reliquat du plan #6).

## Étapes

### Lot 1 — code testable localement
- [x] Étape 1 — Serveur : `server/update.js` (dernière release via l'API GitHub, délai 5 s, échec silencieux, comparaison de versions, source injectable pour le desktop) ; route `GET /api/update` ; tests avec un faux GitHub (M · standard → Sonnet)
- [ ] Étape 2 — Desktop : `release.baseUrl` (`https://github.com/Exe64/ultimate-ntnx-asbuilt/releases/latest/download`) ; `Updater.checkForUpdate()` au démarrage dans `desktop/main.js`, branché sur `/api/update` ; `POST /api/update/apply` (téléchargement, application, redémarrage) (M · reasoning → Opus)
- [x] Étape 3 — Page : bandeau bilingue, bouton ou lien selon la source, grisé pendant collecte/génération, confirmation ; libellés couverts par le test i18n (M · standard → Sonnet)

### Lot 2 — CI, releases, validation Windows
- [ ] Étape 4 — CI : job `desktop-windows` joint `artifacts/*` à la release sans renommage, `*-update.json` en dernier ; `Setup.zip` garde son nom ; smoke tests verts (S · standard → Sonnet)
- [x] Étape 5 — README (section « Mises à jour », `NO_UPDATE_CHECK`) et note de transition dans les notes de release v0.3.0 (XS · standard → Sonnet)
- [ ] Étape 6 — Releases : tag `v0.3.0`, puis `v0.3.1` (petite correction) (S · standard → Sonnet)
- [ ] 🧪 Tests — Rédiger et exécuter la procédure de test, dont la mise à jour réelle v0.3.0 → v0.3.1 sur Windows 11
- [ ] ✅ Validation — Vérifier les résultats des tests et clôturer

## Décisions techniques

| Décision | Choix retenu | Justification |
|----------|-------------|---------------|
| Déclencheur | Une vérification au démarrage | Pas d'appel réseau répété ; rien ne s'affiche si à jour |
| Affichage | Bandeau dans la page | Bilingue, cohérent avec le thème, même composant desktop et portables |
| Hors ligne | Échec silencieux, délai ~5 s, `NO_UPDATE_CHECK=1` | L'outil tourne chez des clients, parfois sans Internet |
| Hébergement | GitHub Releases `releases/latest/download` | Supporté par Electrobun 2.0.6 pour le canal stable ; aucun hébergement à ajouter |
| Sécurité de la collecte | Bouton grisé pendant collecte/génération, confirmation sinon | `applyUpdate()` redémarre l'application |
| Transition v0.2.2 | Note « réinstaller une fois » dans la release v0.3.0 | La v0.2.2 n'embarque pas de `release.baseUrl` |
| Validation | Deux releases stables successives | Les pré-releases ne passent pas par `releases/latest` |
| Smart App Control | Pas de signature de code ; limite documentée dans le README | Choix de l'utilisateur (2026-11-18) : SAC bloque tout binaire non signé, sans contournement |

### Risques identifiés

| Risque | Parade |
|---|---|
| Fenêtre de quelques minutes où la release existe sans `update.json` (job Ubuntu avant job Windows) | Échec silencieux ; la mise à jour sera vue au démarrage suivant |
| Pas de patch différentiel pour v0.3.0 (aucune release précédente avec artefacts Electrobun) | Archive complète seule ; patchs à partir de v0.3.1 |
| Updater non testable sous WSL | Build et smoke test en CI, puis Windows 11 à l'étape 🧪 |
| API GitHub non authentifiée : 60 requêtes/h par IP | Une requête par démarrage |
| `bun test` bloqué sans sortie au cadrage (2026-11-18) | Diagnostiquer avant l'étape 1 |

## Tests

> Procédure rédigée à l'étape 🧪 Tests (mode `autonomous`) ; résultats joués consignés ci-dessous.

### Prérequis pour les tests

```bash
cd ~/dev/ultimate-ntnx-asbuilt
npm ci
```

### Procédure de test

```bash
# À compléter à l'étape 🧪 Tests
```

**Résultats attendus :** à compléter.

### Résultats joués et vérifiés

| Date | Test | Attendu | Observé | Verdict |
|------|------|---------|---------|---------|
| 2026-11-18 | Windows 11 (SAC désactivé) : installation manuelle de v0.3.0 depuis `Setup.zip` | L'application démarre, pied de page v0.3.0, pas de bandeau (dernière release) | Démarre en 0.3.0 (retour utilisateur) | ✅ |
| 2026-11-18 | Auto-check exécuteur : suite complète (`npx bun test`), dont `tests/update.test.js` (versions, faux GitHub, hors ligne, délai, `NO_UPDATE_CHECK`, une seule vérification, routes `/api/update` et `/api/update/apply`) et couverture i18n du bandeau | 0 fail | 26 pass, 0 fail, 402 assertions, 5 fichiers | ✅ |

## Journal de session

### 2026-11-18
- ✅ Fait : bilan du projet, cadrage (6 décisions), proposition validée, plan créé et rattaché à l'issue #13.
- 📋 Prochain : diagnostiquer le blocage de `bun test`, puis étape 1.
- 📝 Constat : `bun test` ne bloquait pas, `node_modules/` était absent. `npm ci` se traîne : réseau lent, jusqu'à 290 s pour un paquet.
- 🔨 Code des étapes 1 à 5 écrit (mode one-shot, sans tests intermédiaires) : `server/update.js` et les routes `/api/update` et `/api/update/apply`, Updater dans `desktop/main.js`, `release.baseUrl`, bandeau, traductions, job CI et README. Vérification avant de cocher : suite `bun test`, puis un run CI `workflow_dispatch` pour l'étape 4.
- ✅ Suite 26 pass ; version 0.3.0 ; 4 commits poussés ; tag `v0.3.0` posé sur accord de l'utilisateur (run 44338759482).
- ❌ Job `desktop-windows` en échec à « List update files » : la chaîne Electrobun de la CI ne produit pas de `*-checksum.json` (doc de la branche main en avance). Produit : `stable-win-x64-update.json`, `stable-win-x64-update-v2.json`, `stable-win-x64-UltimateAs-BuiltGenerator.tar.zst`. Correctif `fix(ci)` : seuls le manifeste et l'archive sont exigés, les deux manifestes partent en dernier.
- 🔁 Tag non déplacé : reconstruction via `workflow_dispatch` sur `main` (run 44339583955, code identique au tag hors `ci.yml`), artefacts ajoutés à la main à la release v0.3.0, manifestes en dernier. Note de transition FR/EN ajoutée en tête des notes de la release.
- 🔁 Téléchargement local coupé (réseau). Ajout de l'entrée `release_tag` au `workflow_dispatch` (refusée si `package.json` ne porte pas cette version) ; run 44346748013 vert : release v0.3.0 complète (Setup.zip, exe Windows, `.tar.zst`, `update.json`, `update-v2.json`, 4 exe Linux/macOS).
- 🚧 Bloquant : sur Windows 11, Smart App Control (SAC) bloque l'installation de v0.3.0. Le plan #9 n'avait vu que SmartScreen, qui se contourne ; SAC ne se contourne pas pour un binaire non signé. Le même blocage toucherait chaque version installée par l'Updater. Décision attendue : signature de code (nouveau plan) ou SAC désactivé sur le poste de test.
- 💡 Décision (utilisateur) : signature de code abandonnée, SignPath Foundation compris. Poste de test : SAC désactivé pour valider v0.3.0 → v0.3.1. Limite assumée et documentée dans le README : avec SAC activé, ni l'application ni l'exe portable ne se lancent.
- ✅ v0.3.0 installée à la main, démarre en 0.3.0. Tag `v0.3.1` (run 44391298409 vert ; release complète, marquée Latest).
- 🚧 Bloquant : le dépôt `Exe64/ultimate-ntnx-asbuilt` est **privé**. Sans authentification, `releases/latest/download/stable-win-x64-update.json` et `api.github.com/.../releases/latest` renvoient 404, donc la vérification ne trouve jamais rien (échec silencieux). Visibilité non vérifiée au cadrage. Options : rendre le dépôt public, publier les releases dans un dépôt public dédié, ou utiliser un autre hébergement public. Décision attendue de l'utilisateur.
- ✅ Dépôt passé en public par l'utilisateur. Sans authentification : `update.json` de `releases/latest/download` → v0.3.1, archive `.tar.zst` téléchargeable, API `releases/latest` → v0.3.1. Pas de patch différentiel pour v0.3.1 (dépôt privé au build), mise à jour par archive complète (~48 Mo).
- ❌ Windows 11, v0.3.0 relancée après passage en public : **pas de bandeau** (capture utilisateur, pied de page v0.3.0).
- 🔍 Diagnostic : côté serveur tout répond. Depuis WSL, `stable-win-x64-update-v2.json?<cache-buster>` (requête exacte de l'Updater 2.0.6, deux redirections 302) → 200 en < 1 s, manifeste valide (identifier, channel stable, platform win, tarSha256). Causes possibles côté app : délai de 5 s trop court (l'Updater s'accorde 30 s par requête), ou erreur Electrobun avalée sans trace. Aucune preuve faute de journal.
- 🔨 `desktop/main.js` : journal `%TEMP%\ultimate-asbuilt-update.log` (statuts `Updater.onStatusChange`, infos locales, résultat de la vérification, téléchargement), délai porté à 30 s. Test sans nouvelle release : build `workflow_dispatch` (version 0.3.1, hash différent de la release) installé à la main ; l'Updater compare les hash et doit donc proposer la release 0.3.1.
- ❌ Build de test installé : pas de bandeau. Journal : `local` vide puis `[error] Unsupported update channel: ""`.
- 💡 Cause racine : `Updater.getLocalInfo()` (Electrobun 2.0.6) lit `../Resources/version.json` **relativement au répertoire courant**, attendu = dossier de `bun.exe`, et garde le résultat (vide) toute la session. Or `desktop/main.js` fait `process.chdir(import.meta.dir)` depuis le plan #9 (lancement par le menu Démarrer). Le canal lu est donc vide et la vérification échoue avant toute requête réseau.
- 🔨 Correctif : `chdir` vers `dirname(process.execPath)`, `Updater.getLocalInfo()` (mis en cache), puis `chdir(import.meta.dir)`. Smoke test CI (lancé depuis `%SystemRoot%`) : échoue si le journal ne contient pas `local <version> stable`.
