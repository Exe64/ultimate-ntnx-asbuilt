---
plan:
  id: '15'
  name: 15-sauvegarde-avant-mise-a-jour.md
  link: https://github.com/Exe64/ultimate-ntnx-asbuilt/blob/main/doc/roadmap/15-sauvegarde-avant-mise-a-jour.md
status: active
date: 2026-11-18
description: >
  Avant une mise à jour, l'application Windows sauvegarde la collecte et les saisies, puis les
  recharge au lancement suivant.
priority: medium
complexity: M
intent: null
depends_on: ['13']
scope:
  modules:
    - server/app.js
    - server/resume.js
    - desktop/main.js
    - web/app.js
    - web/index.html
    - web/i18n.js
    - tests/
issue:
  id: 15
  url: https://github.com/Exe64/ultimate-ntnx-asbuilt/issues/15
---

# [💾] Plan #15 - Sauvegarde automatique avant une mise à jour

## Objectif

Une mise à jour redémarre l'application. Aujourd'hui, les saisies non exportées sont perdues, et le bandeau demande un second clic pour le dire. L'application sauvegardera la collecte et les saisies avant de redémarrer, et les rechargera au lancement suivant.

## Périmètre

### Inclus
- La page envoie l'export (format existant, sans identifiants) avec la demande de mise à jour.
- Le serveur l'écrit dans un fichier, puis le relit et le supprime au lancement suivant.
- La page recharge la collecte comme un import, et le dit.
- Retrait de l'avertissement et du second clic.

### Hors scope
- Sauvegarde continue (hors mise à jour).
- Mots de passe : jamais sauvegardés (le format d'export n'en contient pas).
- Préférences langue et thème : voir décisions.

## Étapes

- [x] Étape 1 — Serveur : `server/resume.js` (écrit, relit une fois, supprime) ; `POST /api/update/apply` accepte `{ resume }` et l'écrit avant le redémarrage ; `GET /api/resume` (jeton) rend la sauvegarde une fois ; tests (M · standard → Sonnet)
- [x] Étape 2 — Desktop : fichier de reprise dans le dossier de l'application (`Updater.appDataFolder()`), à défaut `%TEMP%` (S · standard → Sonnet)
- [x] Étape 3 — Page : export joint au clic, reprise au lancement (même rendu qu'un import), avertissement et second clic retirés, libellés traduits (S · standard → Sonnet)
- [ ] 🧪 Tests — Rédiger et exécuter la procédure de test
- [ ] ✅ Validation — Vérifier les résultats des tests et clôturer

## Décisions techniques

| Décision | Choix retenu | Justification |
|----------|-------------|---------------|
| Cadrage | Décidé par l'exécutant, sans questions | Demande de l'utilisateur : enchaîner les trois recommandations sans interruption (2026-11-18) |
| Stockage | Fichier côté serveur, pas `localStorage` | La page est servie sur `127.0.0.1:<port aléatoire>` : l'origine change à chaque lancement, donc `localStorage` ne survit pas au redémarrage |
| Format | L'export existant (`buildExport`) | Déjà sans identifiants, déjà validé par `parseExport` et `/api/import` |
| Lecture | Une seule fois, fichier supprimé | Pas de collecte d'un client qui traîne sur le poste |
| Échec de sauvegarde | La mise à jour n'a pas lieu, l'erreur s'affiche | Ne jamais perdre une collecte en silence |
| Sans collecte à l'écran | Mise à jour directe, rien à sauvegarder | Pas d'étape inutile |

## Tests

### Prérequis pour les tests

```bash
cd ~/dev/ultimate-ntnx-asbuilt
```

### Procédure de test

```bash
# T1 — Suite automatisée : tests/resume.test.js (sauvegarde, reprise unique, refus, échec, jeton) et i18n
npx bun test
# T2 — Builds de la page et de l'application desktop
npx bun build web/index.html --target=browser --outdir /tmp/webchk
npx bun build desktop/main.js --target=bun --external electrobun --outdir /tmp/chk
```

```powershell
# T3 — Windows 11, à la première release après v0.3.2 (v0.3.2 installée) : collecter ou importer
#      une collecte, saisir un client, cliquer « Mettre à jour ». Après le redémarrage :
#      la collecte et le client sont revenus, message « Collecte de … reprise après la mise à jour ».
Get-ChildItem $env:LOCALAPPDATA\fr.juliendumur.ultimate-asbuilt\stable -Filter resume-after-update.json   # aucun fichier
```

**Résultats attendus :**
- T1 : 0 fail. T2 : les deux builds passent.
- T3 : collecte et saisies restaurées après le redémarrage ; plus de fichier de reprise ensuite.

### Résultats joués et vérifiés

| Date | Test | Attendu | Observé | Verdict |
|------|------|---------|---------|---------|
| 2026-11-18 | T1 — `npx bun test` | 0 fail | 31 pass, 0 fail, 424 assertions, 6 fichiers (dont `tests/resume.test.js` : 5 tests) | ✅ |
| 2026-11-18 | T2 — builds page et desktop | OK | `web build ok`, `desktop build ok` | ✅ |
| 2026-11-18 | T3 — Windows 11, mise à jour réelle | Collecte restaurée | En attente : la v0.3.2 installée n'a pas ce code, il faut une release suivante | ⏳ |

## Journal de session

### 2026-11-18
- ✅ Issue #15 et plan créés (cadrage par l'exécutant, sur consigne de l'utilisateur).
- 📝 Constat au cadrage : la langue et le thème, « mémorisés » dans `localStorage` (#7, #11), ne survivent pas à un relancement de l'application ou de l'exe : le port, donc l'origine, change à chaque lancement. Hors périmètre ici, à traiter à part.
- 🔨 `server/resume.js` (lu et supprimé au démarrage du serveur, rendu une fois, retiré si la mise à jour échoue) ; `POST /api/update/apply` accepte `{ resume }`, refuse tout autre format que l'export ; `GET /api/resume` (jeton) ; `desktop/main.js` : fichier dans `Updater.appDataFolder()`, à défaut `%TEMP%`.
- 🔨 Page : l'export part avec le clic « Mettre à jour », reprise au lancement par le même chemin que l'import (`restore()`), avertissement et second clic retirés, remplacés par « la collecte en cours est conservée » ; libellés traduits et testés ; README à jour.
- 📝 Vu en passant : l'infobulle du bouton grisé (« Disponible une fois la collecte… ») n'est pas traduite, `translateNode` ne traite pas l'attribut `title` (#13).
- ⏳ Reste : T3 sur Windows à la prochaine release, puis ✅ Validation et clôture.
