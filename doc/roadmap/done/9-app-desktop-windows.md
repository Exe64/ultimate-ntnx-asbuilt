---
plan:
  id: '9'
  name: 9-app-desktop-windows.md
  link: https://github.com/Exe64/ultimate-ntnx-asbuilt/blob/main/doc/roadmap/done/9-app-desktop-windows.md
status: done
date: 2026-11-17
description: >
  Sous Windows 11, une application Electrobun (fenêtre native WebView2) affiche la page
  actuelle, sans console ni navigateur ; l'installeur s'ajoute à la release.
priority: medium
complexity: L
intent: null
scope:
  modules:
    - server/main.js
    - desktop/
    - electrobun.config
    - scripts/build.js
    - .github/workflows/ci.yml
    - README.md
issue:
  id: 9
  url: https://github.com/Exe64/ultimate-ntnx-asbuilt/issues/9
---

# [🪟] Plan #9 - Application desktop Windows (Electrobun)

## Objectif

Aujourd'hui l'exe Windows ouvre une console (URL, Ctrl+C pour quitter) puis la page dans le
navigateur. Sous Windows 11, l'utilisateur doit pouvoir installer et lancer une vraie
application : fenêtre native qui affiche la page actuelle, sans console ni navigateur, et
fermer la fenêtre arrête le serveur.

## Périmètre

### Inclus
- Application Electrobun pour Windows (WebView2), même page et même serveur que l'exe actuel.
- Installeur `Setup.zip` ajouté à la release, construit par un job CI `windows-latest`.
- Icône fournie par l'utilisateur (PNG 256×256 ou .ico).
- README : choix installeur / exe portable, contournement SmartScreen, Windows 11 requis.

### Hors scope
- Mise à jour automatique (update.json, patchs binaires).
- Signature de code.
- Application desktop Linux et macOS (restent sur le navigateur).
- Boîte « Enregistrer sous » native.
- Toute modification de l'interface ou du moteur.
- L'exe portable Windows : console conservée (seule l'icône est ajoutée, étape 4).

## Étapes

- [x] Étape 1 — Extraire de `server/main.js` un `startServer()` qui renvoie URL et jeton ; console et ouverture du navigateur restent dans le point d'entrée actuel, tests existants verts (S · standard → Sonnet)
- [x] Étape 2 — Prototype : `electrobun.config` + `desktop/main.js` (serveur dans le processus Bun principal, fenêtre sur `127.0.0.1/#jeton`, quitter à la fermeture) ; job CI `windows-latest` qui publie le `Setup.zip` en artefact de workflow. ⏸️ Test manuel Windows 11 (rendu, collecte, téléchargement .docx/.json) ; si échec, arrêt et décision commune (L · reasoning → Opus)
- [x] Étape 3 — Packaging : icône utilisateur (`win.icon`), nom et identifiant de l'application, version reprise de `package.json` (S · standard → Sonnet)
- [x] Étape 4 — Icônes uniformisées : `assets/icon.ico` (16→256 px) régénéré depuis le nouveau logo, carré arrondi fond anthracite, coins transparents ; `assets/icon.png` supprimé ; exe portable Windows compilé dans le job `windows-latest` avec `--windows-icon`, il remplace dans la release celui du job Ubuntu (M · standard → Sonnet)
- [x] Étape 5 — Release : sur tag `v*`, le job Windows joint `ultimate-asbuilt-windows-x64-Setup.zip` à la release, à côté des cinq exécutables ; job Ubuntu inchangé (M · standard → Sonnet)
- [x] Étape 6 — README : installeur ou exe portable, avertissement SmartScreen, Windows 11 requis pour l'application desktop (XS · standard → Sonnet)
- [x] 🧪 Tests — Rédiger et exécuter la procédure de test (avant-dernière étape, obligatoire)
- [x] ✅ Validation — Vérifier les résultats des tests et clôturer (dernière étape, obligatoire)

Lots : Lot 1 (étapes 1–2, prototype et point de décision), Lot 2 (étapes 3–8).

## Décisions techniques

| Décision | Choix retenu | Justification |
|----------|-------------|---------------|
| Framework desktop | Electrobun (WebView2) | Choix utilisateur ; processus principal sous Bun, `Bun.serve` y tourne tel quel |
| Livrables Windows | Installeur Electrobun **et** exe portable actuel | Electrobun ne produit pas d'exe portable ; personne n'est bloqué sans droits d'installation |
| Exe portable | Console conservée | Sert de secours ; pas d'arrêt automatique à écrire |
| Plateformes desktop | Windows seul | Linux/macOS gardent le navigateur ; un seul runner CI en plus |
| Build Windows | Runner `windows-latest` | Electrobun ne compile pas en croisé |
| Version Windows cible | Windows 11+ | Support officiel Electrobun ; Windows 10 non garanti |
| Enregistrement des fichiers | Comportement par défaut de WebView2 (Téléchargements) | Pas de code natif ; à vérifier au prototype |
| Démarrage partagé | `startServer()` commun aux deux points d'entrée | Évite que navigateur et desktop divergent |
| Échec du prototype | Arrêt et décision commune | Pas de bascule automatique vers webview-bun |
| Nom dans le Gestionnaire des tâches | Hook `postBuild` : rcedit (description, version, icône) sur `bin/bun.exe` et `bin/launcher.exe` | La fenêtre appartient au `bun.exe` embarqué, décrit « Bun » ; Electrobun n'a pas d'option pour ça |
| Release si le job Windows échoue | Release publiée quand même | Le job Ubuntu crée la release (5 exe) ; le job Windows y ajoute l'installeur ensuite (`gh release upload`), relançable seul |
| Déclencheur du job Windows | Tags `v*` + `workflow_dispatch` | Push ordinaires inchangés ; prototypes construits à la demande |
| Icône de l'exe portable | Exe Windows compilé sur le runner `windows-latest` avec `--windows-icon`, publié par-dessus celui du job Ubuntu | `--windows-icon` ne fonctionne pas en compilation croisée ; rcedit sur un exe `bun --compile` risque d'abîmer le bundle embarqué |
| Forme de l'icône | Carré arrondi, fond anthracite, coins transparents (style Windows 11) | Choix utilisateur (2026-11-18), même dessin que le logo de la page (#11) |
| Page de l'app desktop | Construite à part pour le navigateur (`build:web`), copiée dans `Resources/app/web`, servie par `desktop/main.js` via `startServer(page)` | Le bundler Electrobun compile l'import HTML de Bun pour Bun (`node:module`), inerte dans WebView2 ; l'exe navigateur garde sa page embarquée |

## Tests

### Prérequis pour les tests

```bash
# Dépôt : https://github.com/Exe64/ultimate-ntnx-asbuilt — commit de l'étape 2 poussé sur main.
# Poste de test : Windows 11 x64, accès au lab Prism Central (lecture seule suffit).
```

### Procédure de test

**Étape 2 — prototype (manuel, Windows 11)**

```bash
# 1. Lancer le build Windows à la demande, puis suivre le run
gh workflow run CI --ref main
gh run watch "$(gh run list --workflow CI --limit 1 --json databaseId -q '.[0].databaseId')"

# 2. Télécharger l'installeur produit par le job desktop-windows
gh run download "$(gh run list --workflow CI --limit 1 --json databaseId -q '.[0].databaseId')" -n ultimate-asbuilt-windows-x64-Setup
```

Sur le poste Windows 11 :

1. Dézipper `ultimate-asbuilt-windows-x64-Setup.zip`, lancer le Setup (SmartScreen : « Informations complémentaires » → « Exécuter quand même »).
2. Lancer « Ultimate As-Built » : une fenêtre s'ouvre sur la page, **sans console ni navigateur**.
3. Prism Central → Détecter les clusters → Collecter (au moins un Prism Element).
4. Générer le .docx ; l'ouvrir dans Word.
5. Exporter la collecte (.json) ; recharger la fenêtre (Ctrl+R) ; Importer ce .json.
6. Télécharger le template par défaut ; le renvoyer au moment de générer.
7. Fermer la fenêtre ; Gestionnaire des tâches : plus aucun processus « Ultimate As-Built » ni `bun`.

**Résultats attendus :** build CI vert ; fenêtre native sans console ; collecte et génération identiques à l'exe navigateur ; .docx, .json et template enregistrés dans Téléchargements ; aucun processus restant après fermeture.

**Étapes 3 à 6 — icônes, release, README (CI puis manuel, Windows 11)**

```bash
# 1. Après push sur main : build Windows à la demande, puis suivre le run
gh workflow run CI --ref main
RUN=$(gh run list --workflow CI --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch "$RUN" --exit-status
# 2. Installeur et exe portable produits par le job desktop-windows
gh run download "$RUN" -n ultimate-asbuilt-windows-x64-Setup
gh run download "$RUN" -n ultimate-asbuilt-windows-x64
```

Sur le poste Windows 11 :

1. Explorateur : `ultimate-asbuilt-windows-x64.exe` porte le nouveau logo (carré arrondi anthracite, page violette, coin vert).
2. Lancer l'exe portable : console + page dans le navigateur, comme avant.
3. Installer le Setup, lancer « Ultimate As-Built » : nouveau logo dans le menu Démarrer, la barre des tâches et la fenêtre.
4. Gestionnaire des tâches : « Ultimate As-Built » avec le nouveau logo (plus « Bun »).
5. Release (étape 5) : vérifiée à la prochaine release `v*` — installeur et exe Windows à icône présents, l'exe remplaçant celui du job Ubuntu.

**Résultats attendus :** jobs `test` et `desktop-windows` verts (dont « Smoke test portable exe ») ; deux artefacts ; nouveau logo partout aux points 1, 3 et 4 ; l'exe portable fonctionne comme avant.

### Résultats joués et vérifiés

| Date | Test | Attendu | Observé | Verdict |
|------|------|---------|---------|---------|
| 2026-11-17 | Étape 1 — `npm test` | 11 pass, 0 fail | 11 pass, 0 fail (233 expect) | ✅ PASS |
| 2026-11-17 | Étape 1 — `bun build server/main.js --compile` puis lancement `NO_OPEN=1` | Compile, affiche URL + jeton | Compile en 0,8 s, affiche `http://127.0.0.1:<port>/#<jeton>` | ✅ PASS |
| 2026-11-17 | Étape 2 — `npm run build:desktop` sur Linux (contrôle du bundler, pas une cible) | Build OK ; import HTML et template embarqués | Build OK ; bundle contient `index.html`, `index-*.js`, `asbuilt-default-*.docx` ; `exitOnLastWindowClosed: true` dans `build.json` | ✅ PASS |
| 2026-11-17 | Étape 2 — lancement du bundle Linux (sans GTK/WebKit ni écran) | — | Échec au chargement des libs natives (`libNativeWrapper.so`) avant le serveur : non testable ici, attendu | ➖ N/A |
| 2026-11-17 | Étape 2 — `npm test` après ajout d'Electrobun | 11 pass | 11 pass, 0 fail | ✅ PASS |
| 2026-11-17 | Étape 2 — CI `workflow_dispatch` (run 44051305556) | test + desktop-windows verts, installeur en artefact | test ✅, desktop-windows ✅, release ignorée ; artefact `ultimate-asbuilt-windows-x64-Setup` (48,3 Mo) | ✅ PASS |
| 2026-11-17 | Étape 2 — Windows 11, 1er essai (installeur run 44051305556) | Fenêtre au lancement | Installation OK ; lancement menu Démarrer sans effet. Log : `Bundled file "./index-*.js" not found` — Bun résout les assets de la page contre le répertoire courant (System32) | ❌ FAIL |
| 2026-11-17 | Étape 2 — correctif `process.chdir(import.meta.dir)` + smoke test CI (run 44055554773 : archive de l'app extraite, lancée avec `-WorkingDirectory %SystemRoot%`, `ELECTROBUN_CONSOLE=1`) | URL affichée, page en 200 | URL affichée, page 200, processus vivant à 25 s ; job vert | ✅ PASS |
| 2026-11-17 | Étape 2 — Windows 11, 2e essai (run 44055554773) | Page fonctionnelle | Fenêtre et page affichées ; « Détecter les clusters » sans effet (bouton jamais grisé, aucun statut) | ❌ FAIL |
| 2026-11-17 | Étape 2 — smoke test étendu au script de la page (run 44061986349) | Script servi, code navigateur | Script servi (200, 1,4 Mo) mais commence par `import { createRequire } from "node:module"` : le bundler Electrobun compile l'import HTML pour Bun, WebView2 rejette le module | 🔎 cause |
| 2026-11-17 | Étape 2 — page construite à part (`build:web`, `--target=browser`), servie par `desktop/main.js` ; smoke test refuse tout `from "node:` (run 44062707772) | Script navigateur servi | `index-kxyqx050.js` 200, 829 Ko, sans import `node:` ; job vert | ✅ PASS |
| 2026-11-17 | Étape 2 — prototype sur Windows 11, 3e essai (procédure ci-dessus) | voir résultats attendus | points 1 à 7 conformes (journal) | ✅ PASS |
| 2026-11-18 | Étapes 4–6 — `npm test` et syntaxe de `ci.yml` (local) | 17 pass ; YAML valide | 17 pass, 0 fail ; YAML valide | ✅ PASS |
| 2026-11-18 | Étape 4 — `icon.ico` | 7 tailles 16→256 en PNG, coins transparents | 7 entrées PNG (77 Ko) ; aperçu 256 conforme ; 16 px lisible (page + coin vert) | ✅ PASS |
| 2026-11-18 | Étape 5 — release sur tag `v0.2.2` (run 44202168796) | Jobs verts ; installeur et exe Windows joints à côté des exécutables | test ✅, release ✅, desktop-windows ✅ ; release : 4 exe Linux/macOS + `windows-x64.exe` + `windows-x64-Setup.zip` | ✅ PASS (CI) |
| 2026-11-18 | Étapes 3–4 — Windows 11, binaires v0.2.2 : icône exe portable, exe portable fonctionnel, logo menu Démarrer / barre des tâches / fenêtre, aucun processus après fermeture | Conformes | Points 1, 2, 3 et 5 conformes | ✅ PASS |
| 2026-11-18 | Étape 3 — Windows 11, Gestionnaire des tâches (point 4) | Groupe « Ultimate As-Built » avec le logo | Groupe « Bun » avec l'icône de Bun ; la fenêtre « Ultimate As-Built Generator » est rangée dessous | ❌ FAIL |
| 2026-11-18 | Point 4 — diagnostic : `bin/bun.exe` extrait de l'installeur v0.2.2 (`Setup.tar.zst`) | Ressources de version renommées | Un seul bloc de version : `FileDescription` et `ProductName` = « Ultimate As-Built Generator ». Le binaire livré est correct ; cause probable : cache Windows (MuiCache / cache d'icônes) gardé des prototypes installés au même chemin | 🔎 cause |
| 2026-11-18 | Point 4 — processus réel (Windows 11) | Fenêtre portée par le `bun.exe` installé, bonne description | `…\fr.juliendumur.ultimate-asbuilt\stable\app\bin\bun.exe`, Description « Ultimate As-Built Generator », 0.2.2 | ✅ |
| 2026-11-18 | Point 4 — MuiCache vidé (entrée `bun.exe` = « Bun » / « Oven » présente), `ie4uinit -show`, relance | Groupe renommé | Toujours « Bun » | ❌ FAIL |
| 2026-11-18 | Point 4 — ressources de `bun.exe` (v0.2.2) | Icônes et version à nous seulement | Les 7 `RT_ICON` sont les nôtres ; un seul `RT_VERSION` correct ; il reste le groupe `IDI_MYICON` de Bun (1 entrée, pointe sur notre icône 16 px) en plus de notre groupe `1`. Rien dans le fichier ne donne « Bun » ni l'icône de Bun : la source est un cache de Windows | 🔎 cause |
| 2026-11-18 | Point 4 — redémarrage, puis « Accéder aux détails » et arbre des processus | — | Toujours « Bun » ; le groupe pointe sur le `bun.exe` installé (propriétés : notre icône, bonne description) ; arbre launcher → bun → msedgewebview2 propre | 🔎 |
| 2026-11-18 | Point 4 — même app copiée dans `%TEMP%\uab-test` (chemin jamais vu par Windows) et lancée | Groupe « Ultimate As-Built Generator » avec le logo | Groupe « Ultimate As-Built Generator » avec le logo | ✅ PASS |

> Vérification : self-check inline (pas de sous-agent vérificateur), résultats bruts ci-dessus.

## Journal de session

### Session 2026-11-17
- ✅ Fait : cadrage (livrables, plateformes, auto-update et signature hors périmètre, Windows 11, icône fournie, plan B), issue #9, plan créé.
- ✅ Étape 1 : `server/app.js` (`startServer()`), `server/main.js` réduit au lancement navigateur.
- ✅ Étape 2 (code) : Electrobun 2.0.6 (bootstrap npm → Hutch 0.29.0), `desktop/main.js`, `electrobun.config.ts`, script `build:desktop`, job CI `desktop-windows` (tags + `workflow_dispatch`, installeur joint à la release si tag : étape 4 écrite dans la foulée).
- 📝 Constat : Electrobun v2 télécharge sa chaîne (Hutch, bun 1.4.4, core) depuis ses releases GitHub, sommes SHA-256 vérifiées. Le bundler conserve l'import HTML de Bun : risque principal levé côté build.
- ❌→✅ Windows : lancement depuis le menu Démarrer (cwd System32) corrigé par `process.chdir` ; page inerte (script compilé pour Bun par Electrobun) corrigée par une page construite à part pour le navigateur.
- ✅ Étape 2 validée sur Windows 11 (points 1 à 7).
- ✅ Étape 3 (code) : icône fournie recadrée, `win.icon`, hook `postBuild` (rcedit) pour le nom « Bun » du Gestionnaire des tâches.
- 📋 Prochain : vérification visuelle étape 3 sur Windows, puis étape 5 (README), 🧪 Tests (release de test : étape 4), ✅ Validation.

### Session 2026-11-18
- 📝 Plan modifié : nouvelle étape 4 (icônes uniformisées avec le logo du plan #11, exe portable Windows compris), étapes suivantes renumérotées.
- ✅ Étape 4 : `icon.ico` régénéré (carré arrondi, 7 tailles PNG), `icon.png` supprimé ; job `desktop-windows` : exe portable compilé avec `--windows-icon`, smoke test, artefact, joint à la release par-dessus celui du job Ubuntu.
- ✅ Étape 6 : README, section Windows (application ou exe portable, SmartScreen, Windows 11) et publication.
- 📋 Prochain : push, run CI `workflow_dispatch`, contrôle Windows 11 (étapes 3 et 4) ; étape 5 éprouvée à la prochaine release.
- 🔎 Point 4 (Gestionnaire des tâches « Bun ») : binaire v0.2.2 correct (version, icônes, aucun AUMID) ; cause = cache Windows lié au chemin d'installation, hérité des prototypes. Lancée depuis un chemin neuf, l'app s'affiche sous son nom et son logo. Une installation neuve n'est pas concernée ; aucun changement de code.
- 📝 Reste connu : le groupe d'icônes `IDI_MYICON` de Bun subsiste dans `bun.exe` (pointe sur notre icône 16 px) ; sans effet visible constaté.
- ✅ Validation : étapes 1 à 6 livrées, tests Windows 11 conformes ; plan clôturé.
