---
plan:
  id: '7'
  name: 7-interface-bilingue.md
  link: https://github.com/Exe64/ultimate-ntnx-asbuilt/blob/main/doc/roadmap/done/7-interface-bilingue.md
status: done
date: 2026-10-12
description: >
  La page s'utilise en français ou en anglais : langue du navigateur par
  défaut, bascule dans la page, liée à la langue du document.
priority: low
complexity: S
intent: null
scope:
  modules:
    - web/index.html
    - web/app.js
    - web/i18n.js
    - tests/i18n.test.js
blockedBy:
  - '5'
issue:
  id: 7
  url: https://github.com/Exe64/ultimate-ntnx-asbuilt/issues/7
---

# [🌍] Plan #7 - Interface bilingue

## Objectif

Le document sort en français ou en anglais, mais la page et les messages d'erreur du serveur
sont en français seulement. La page doit s'utiliser dans les deux langues.

## Périmètre

### Inclus
- Dictionnaire des libellés de la page et des messages du serveur.
- Bascule de langue, langue du navigateur par défaut, liée à la langue du document.

### Hors scope
- Autres langues que le français et l'anglais.

## Étapes

- [x] Étape 1 — Dictionnaire des libellés de la page et des messages du serveur (S · standard → Sonnet)
- [x] Étape 2 — Bascule de langue, langue du navigateur par défaut, liée à la langue du document (S · standard → Sonnet)
- [x] 🧪 Tests — Rédiger et exécuter la procédure de test (avant-dernière étape, obligatoire)
- [x] ✅ Validation — Vérifier les résultats des tests et clôturer (dernière étape, obligatoire)

## Décisions techniques

| Décision | Choix retenu | Justification |
|----------|-------------|---------------|
| Ordre | En dernier, après les plans #4 et #5 | Ils ajoutent des libellés à la page ; les traduire une seule fois |
| Mécanisme | Le français reste la source et la clé ; `web/i18n.js` traduit chaque nœud de texte (et les placeholders) à l'arrivée dans la page, via un `MutationObserver` | Ni `index.html`, ni `app.js`, ni le serveur ne changent leurs textes : un seul mécanisme pour la page, le rendu dynamique et les messages du serveur |
| Messages variables et du serveur | Motifs (compteurs, journal) et fragments (erreurs composées du serveur) dans le même module | Le serveur reste en français, sans paramètre de langue à transporter |
| Dictionnaire | Propre à la page, hors de `engine/i18n.dict.js` | Le dictionnaire du moteur est celui du document ; la page n'y ajoute rien |
| Lien page / document | Dans les deux sens : changer l'une change l'autre ; une collecte importée impose la langue de son document | Validé le 2026-11-17 (option 1) |
| Langue par défaut | Celle mémorisée dans le navigateur, sinon celle du navigateur (français si `fr*`, anglais sinon) | `localStorage` sous `try` : une fenêtre privée retombe sur la langue du navigateur |
| Titres des sections | Lus dans le catalogue (`title.en`), la liste se redessine en gardant les saisies | Les titres existent déjà dans les deux langues |

## Tests

### Prérequis pour les tests

Dépendances installées (`npm install`).

### Procédure de test

```bash
echo "=== T1 Full Suite ==="
cd /srv/dev/ultimate-ntnx-asbuilt
npx bun test

echo "=== T2 Page Translation Tests ==="
npx bun test tests/i18n.test.js
```

**Résultats attendus :**
- T1 : `15 pass`, `0 fail`.
- T2 : `2 pass`, `0 fail` — chaque texte et placeholder de `index.html` a sa traduction ; compteurs, journal et erreurs du serveur traduits ; noms, adresses et clés inchangés.

### Validation réelle (à jouer par Julien)

```bash
echo "=== Start The App ==="
cd /srv/dev/ultimate-ntnx-asbuilt
npm start
```

**Résultats attendus :**
- Navigateur en anglais (ou bascule « English » en haut à droite) : toute la page en anglais, y compris les messages d'état et d'erreur (essayer un mot de passe faux).
- La bascule en haut et la langue du document (étape 3) restent alignées dans les deux sens ; la liste des sections passe en anglais sans perdre les cases cochées ni les saisies.
- La langue choisie est retrouvée au rechargement de la page.

### Résultats joués et vérifiés

| Date | Test | Attendu | Observé | Verdict |
|------|------|---------|---------|---------|
| 2026-11-17 | Auto-check exécuteur : suite complète | 15 pass, 0 fail | 15 pass, 0 fail, 288 assertions | ✅ |
| 2026-11-17 | Auto-check exécuteur : DOM simulé (happy-dom, hors dépôt) | page en anglais, retour au français, message ajouté après coup traduit | page traduite ; placeholder d'exemple inchangé ; « Prism Central unreachable or refused (HTTP 401): no response » ; retour au français complet, `lang="fr"` ; re-bascule anglaise correcte | ✅ |
| 2026-11-17 | Rendu dans Chromium headless | page rendue | non joué : bibliothèques système absentes (`libatk`) sur la machine de développement | ⚠️ |
| 2026-11-17 | T1-T2 (vérificateur indépendant, sous-agent) | 15 pass ; 2 pass | 15 pass, 288 assertions ; 2 pass, 12 assertions ; tous les messages de la page et du serveur passés dans `toEnglish` sortent en anglais ; observateur sans boucle ni double traduction ; lien page / document et `localStorage` conformes | ✅ PASS |
| 2026-11-17 | Correction suite à la revue | message de rastérisation d'un schéma traduit | fragment ajouté, test étendu | ✅ |
| 2026-11-17 | Validation réelle dans le navigateur (Julien) | page en anglais, bascule liée au document, langue retrouvée au rechargement | conformes | ✅ |

## Journal de session

### Session 2026-10-12
- ✅ Fait : cadrage, création du plan et de l'issue #7.
- 🚧 Blocages : attend le plan #5 (le plan #4 est clos).

### Session 2026-11-17
- ✅ Fait : plan débloqué (#5 clos) ; exécution en one-shot, lien page / document dans les deux sens.
- ✅ Fait : étapes 1-2 — `web/i18n.js` (dictionnaire, motifs, fragments, observateur), bascule en tête de page, titres des sections du catalogue ; `tests/i18n.test.js`.
- ✅ Fait : vérification indépendante (PASS) ; message de rastérisation traduit.
- ✅ Validation : tests et vérification dans le navigateur conformes ; plan clôturé le 2026-11-17.
