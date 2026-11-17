---
plan:
  id: '5'
  name: 5-robustesse-avancement.md
  link: https://github.com/Exe64/ultimate-ntnx-asbuilt/blob/main/doc/roadmap/done/5-robustesse-avancement.md
status: done
date: 2026-10-12
description: >
  Parallélisme borné sur la lecture des ports par hôte, délai par appel
  réglable, et avancement affiché cluster par cluster pendant la collecte.
priority: medium
complexity: M
intent: null
scope:
  modules:
    - server/bundle.js
    - server/prism/collect.js
    - server/main.js
    - web/app.js
    - tests/
blocks:
  - '7'
issue:
  id: 5
  url: https://github.com/Exe64/ultimate-ntnx-asbuilt/issues/5
---

# [📶] Plan #5 - Robustesse de collecte et avancement par cluster

## Objectif

Les ports physiques sont lus avec un appel par hôte, tous lancés en même temps, et chaque
appel a un délai fixe de 60 s. Pendant la collecte, la page n'affiche qu'un message fixe.
Une collecte sur un gros parc doit aboutir, et l'utilisateur doit voir où elle en est.

## Périmètre

### Inclus
- Parallélisme borné sur la lecture des ports par hôte.
- Délai par appel réglable par variable d'environnement.
- Une requête par cluster côté page, en nombre limité, avec l'état affiché ligne par ligne.

### Hors scope
- Clé d'API : l'authentification reste en identifiant et mot de passe, pour Prism Central
  comme pour Prism Element.
- Flux serveur (SSE, WebSocket).

## Étapes

- [x] Étape 1 — Parallélisme borné sur la lecture des ports par hôte (S · standard → Sonnet)
- [x] Étape 2 — Délai par appel réglable par variable d'environnement (XS · standard → Sonnet)
- [x] Étape 3 — Une requête par cluster côté page, en nombre limité, avec l'état par ligne (M · standard → Sonnet)
- [x] 🧪 Tests — Rédiger et exécuter la procédure de test (avant-dernière étape, obligatoire)
- [x] ✅ Validation — Vérifier les résultats des tests et clôturer (dernière étape, obligatoire)

## Décisions techniques

| Décision | Choix retenu | Justification |
|----------|-------------|---------------|
| Avancement | Une requête par cluster depuis la page | L'avancement par ligne vient sans flux serveur |
| Plafond de parallélisme | 8 lectures de ports en vol (`HOST_CONCURRENCY`), 3 clusters en vol côté page | Valeurs fixes : assez pour le débit, sans saturer Prism ; à rendre réglables si un parc réel le demande |
| Bundle final | Relu par un appel `/api/pe` sans identifiants une fois toutes les lignes finies | Les réponses par cluster peuvent se croiser ; la dernière reçue n'est pas forcément la plus complète |
| Délai | `ASBUILT_TIMEOUT_S`, en secondes, 60 par défaut ; une valeur invalide retombe sur 60 | Réglable sans recompiler |
| Authentification | Identifiant / mot de passe uniquement | Décision de cadrage du 2026-10-12 : pas de clé d'API |
| Mot de passe faux | Un appel d'authentification avant la collecte ; arrêt sur 401/403 | Les appels parallèles comptaient chacun comme un échec de connexion et verrouillaient le compte |
| Validation | Faux Prism des tests, puis Prism Central et Prism Element du lab | Un lab est joignable depuis la machine de développement |
| Ordre | Après le plan #3 | Le plan #3 modifie `server/bundle.js` |

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

echo "=== T2 Engine And Collection Tests ==="
npx bun test tests/asbuilt.test.js

echo "=== T3 Timeout Read From Environment ==="
ASBUILT_TIMEOUT_S=180 npx bun -e "import('./server/bundle.js').then(m => console.log(m.TIMEOUT_MS))"
npx bun -e "import('./server/bundle.js').then(m => console.log(m.TIMEOUT_MS))"

echo "=== T4 Timeout Is Documented ==="
grep -c "ASBUILT_TIMEOUT_S" README.md
```

**Résultats attendus :**
- T1 : `11 pass`, `0 fail`, sur 2 fichiers.
- T2 : `6 pass`, `0 fail` (dont « gros parc » : 30 hôtes, jamais plus de huit lectures de ports en même temps, côté Prism Central comme côté Prism Element).
- T3 : `180000` puis `60000`.
- T4 : `1`.

### Validation réelle sur le lab (à jouer par Julien)

```bash
echo "=== Start The App With A Longer Timeout ==="
cd /srv/dev/ultimate-ntnx-asbuilt
ASBUILT_TIMEOUT_S=120 npm start
```

Dans la page : collecter le Prism Central, puis lancer la collecte des Prism Element avec un mot
de passe juste sur une ligne et faux sur une autre (ou une seule ligne, d'abord fausse puis juste).

**Résultats attendus :**
- Chaque ligne passe par « En attente… », « Collecte en cours… », puis « Collecté » ou son erreur.
- Le message d'état compte les clusters terminés (`1/2`, `2/2`).
- La ligne en erreur se corrige et se relance sans perdre les saisies de l'étape 3.
- Le journal de collecte de l'étape 3 ne signale ni `v4_host_nics` ni `host_nics_v2` en erreur.

### Résultats joués et vérifiés

| Date | Test | Attendu | Observé | Verdict |
|------|------|---------|---------|---------|
| 2026-10-12 | Auto-check exécuteur : suite complète | 11 pass, 0 fail | 11 pass, 0 fail, 233 assertions | ✅ |
| 2026-10-12 | Auto-check exécuteur : parcours de la page en DOM simulé (jsdom, hors dépôt) | états par ligne, compteur, erreur 401 sur sa ligne, nouvelle tentative | « Collecte en cours… → Collecté », « 1/1 », erreur 401 affichée sur la ligne, relance réussie | ✅ |
| 2026-10-12 | T1 suite complète (vérificateur) | 11 pass, 0 fail, 2 fichiers | 11 pass, 0 fail, 233 assertions | ✅ |
| 2026-10-12 | T2 moteur et collecte, dont « gros parc » (vérificateur) | 6 pass, 0 fail | 6 pass, 0 fail, 178 assertions | ✅ |
| 2026-10-12 | T3 délai lu dans l'environnement (vérificateur) | 180000 puis 60000 | 180000 puis 60000 | ✅ |
| 2026-10-12 | T4 délai documenté (vérificateur) | 1 | 1 | ✅ |
| 2026-11-17 | Validation réelle sur le lab (Julien) | mot de passe faux : erreur sur la ligne, puis relance réussie | le mot de passe faux a été tenté au moins trois fois : compte du cluster verrouillé | ❌ |
| 2026-11-17 | Correction : un seul essai d'authentification | un mot de passe faux = une requête | aucune relance dans le code : chaque collecteur parallèle (et chaque sonde `unversioned/info`) s'authentifiait, soit 29 requêtes refusées côté PC. `checkAuth` fait un appel avant les autres (`/api/nutanix/v3/users/me` côté PC, `/PrismGateway/services/rest/v2.0/cluster/` côté PE) et s'arrête sur 401/403 ; test : 1 requête au lieu de 29, échoue sur l'ancien code ; suite 12 pass, 258 assertions | ✅ |
| 2026-11-17 | Lab : mot de passe faux puis juste (Julien, compte déverrouillé au préalable) | une seule tentative refusée, pas de verrouillage ; relance réussie | conformes | ✅ |

Verdict du vérificateur indépendant (sous-agent, 2026-10-12) : **PASS** sur T1 à T4.

## Journal de session

### Session 2026-10-12
- ✅ Fait : cadrage, création du plan et de l'issue #5.
- ✅ Fait : étapes 1 à 3 (`mapLimit` dans `server/prism/collect.js`, `ASBUILT_TIMEOUT_S`, une requête par cluster avec état par ligne).
- 🔄 En cours : validation réelle sur le lab, à jouer par Julien (procédure dans `## Tests`).

### Session 2026-11-17
- ❌ Lab : un mot de passe faux est rejoué au moins trois fois et verrouille le compte du cluster.
- ✅ Fait : contrôle d'authentification unique avant la collecte (PC et PE).
- ✅ Validation : lab conforme (une tentative refusée, pas de verrouillage, relance réussie) ; plan clôturé le 2026-11-17, débloque #7.
