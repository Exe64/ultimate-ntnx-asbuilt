---
plan:
  id: '3'
  name: 3-mise-a-jour-moteur.md
  link: https://github.com/Exe64/ultimate-ntnx-asbuilt/blob/main/doc/roadmap/done/3-mise-a-jour-moteur.md
status: done
date: 2026-10-12
description: >
  Mettre à jour le moteur as-built (sections vides qualifiées, versions et
  firmwares, réseau détaillé, sécurité et accès, couche apiCompat) et adapter
  le code propre à ce dépôt.
priority: high
complexity: L
intent: null
scope:
  modules:
    - engine/
    - server/prism/
    - server/nutanixV4.js
    - server/bundle.js
    - web/clean.js
    - web/diagrams.js
    - tests/
    - README.md
blocks:
  - '6'
issue:
  id: 3
  url: https://github.com/Exe64/ultimate-ntnx-asbuilt/issues/3
---

# [🔄] Plan #3 - Mise à jour du moteur

## Objectif

Faire évoluer le moteur : sections vides qualifiées (non configuré / non collecté), versions et
firmwares dont LCM, réseau détaillé, sécurité et accès, couche `apiCompat` ; puis adapter le code
propre à ce dépôt.

## Périmètre

### Inclus
- Mise à jour du moteur, de la collecte et de `apiCompat`.
- Adaptation de `server/bundle.js`, `web/clean.js`, `web/diagrams.js`, des tests et des jeux de données.
- Suppression de l'ancien script de synchronisation et réécriture de la section « Développement » du README.

### Hors scope
- Nouvelles sections (plan #6).

## Étapes

- [x] Étape 1 — Inventorier ce qui est propre à ce dépôt dans `i18n.dict.js` et `nutanixV4.js` (S · standard → Sonnet)
- [x] Étape 2 — Mettre à jour le moteur, la collecte et `apiCompat` (M · standard → Sonnet)
- [x] Étape 3 — Adapter `server/bundle.js` à la nouvelle collecte (M · reasoning → Opus)
- [x] Étape 4 — Adapter `web/clean.js` et `web/diagrams.js` aux sections vides qualifiées (L · reasoning → Opus)
- [x] Étape 5 — Mettre à jour les tests et les jeux de données (M · standard → Sonnet)
- [x] Étape 6 — Supprimer le script de synchro et réécrire la section « Développement » du README (XS · standard → Sonnet)
- [x] Étape 7 — Corriger les chemins de trois collecteurs relevés sur le lab : SNMP v4 par cluster, politiques de protection dans `datapolicies`, storage pools en v1 (S · standard → Sonnet)
- [x] 🧪 Tests — Rédiger et exécuter la procédure de test (avant-dernière étape, obligatoire)
- [x] ✅ Validation — Vérifier les résultats des tests et clôturer (dernière étape, obligatoire)

## Décisions techniques

| Décision | Choix retenu | Justification |
|----------|-------------|---------------|
| Script de synchro | Supprimé | Il écraserait le travail fait ici |
| Section vide sous « sans retouche » | Retirer « Non collecté », garder « Non configuré » | Une fonction lue mais non configurée est un fait sur la plateforme ; seul le manque de collecte est du bruit |
| Présentation | Champ « Intégrateur » ajouté à la page ; le client saisi alimente le texte | Le chapitre « Présentation » les attend |
| Chemins de collecteurs faux (étape 7) | Corrigés dans `collect.js` et `projection.js` | Relevés sur le lab |
| `apiCompat` | `index.js` et `matrix.json` seulement | Le reste n'est pas utilisé par la collecte |

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

echo "=== T3 Sync Script Is Gone ==="
ls scripts

echo "=== T4 Five Executables Build ==="
rm -rf dist
npm run build
ls dist | wc -l

echo "=== T5 Built Executable Serves The Page ==="
(PORT=18442 NO_OPEN=1 timeout 6 ./dist/ultimate-asbuilt-linux-x64 >/dev/null 2>&1 &) ; sleep 2 ; curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:18442/
```

**Résultats attendus :**
- T1 : `8 pass`, `0 fail`, sur 2 fichiers.
- T3 : `scripts` ne contient que `build.js`.
- T4 : `5`.
- T5 : `200`.

### Validation réelle sur le lab (à jouer par Julien)

```bash
echo "=== Start The App With A Raw Dump ==="
cd /srv/dev/ultimate-ntnx-asbuilt
DUMP=/tmp/collecte-lab.json npm start
```

Dans la page : collecter le Prism Central puis le Prism Element du lab, saisir client et
intégrateur, générer le document avec « Retirer les sections non collectées » coché.

**Résultats attendus :**
- Le document s'ouvre dans Word, avec les chapitres « Présentation », « Prism Central »,
  « Sécurité et accès », puis un chapitre par cluster.
- La présentation nomme le client et l'intégrateur saisis.
- « Versions et firmwares » (BIOS, firmwares) est rempli si le Prism Central expose LCM ; sinon la
  section est absente et le journal de collecte cite `v4_lcm_entities`.
- Une fonction non configurée sur le lab (SNMP, SMTP…) apparaît avec « Non configuré », jamais
  « Non collecté ».
- Les six schémas sont présents et cohérents avec le lab.

### Résultats joués et vérifiés

| Date | Test | Attendu | Observé | Verdict |
|------|------|---------|---------|---------|
| 2026-10-12 | Auto-check exécuteur : suite après mise à jour + imports de `bundle.js` | tout vert | 7 pass, 0 fail | ✅ |
| 2026-10-12 | Auto-check exécuteur : sonde des sections vides (deux jeux de données) | « Non configuré » conservé, « Non collecté » retiré | conforme sur `middleEarth` (74 → 46 sections) et `lab` (105 → 49) | ✅ |
| 2026-10-12 | Auto-check exécuteur : suite finale | 8 pass, 0 fail | 8 pass, 0 fail, 203 assertions | ✅ |
| 2026-10-12 | T1 suite complète (vérificateur) | 8 pass, 0 fail, 2 fichiers | 8 pass, 0 fail, 203 assertions | ✅ |
| 2026-10-12 | T3 script de synchro supprimé (vérificateur) | `build.js` seul | `build.js` seul | ✅ |
| 2026-10-12 | T4 build (vérificateur) | 5 | 5 | ✅ |
| 2026-10-12 | T5 exécutable servi (vérificateur) | 200 | 200 | ✅ |
| 2026-11-16 | Lab joué avec l'exécutable v0.1.0 (par erreur) | — | pas d'Intégrateur, pas de « Présentation » : version antérieure au plan, non probant | ⚠️ |
| 2026-11-17 | Lab, sources actuelles, page étape 3 (Julien) | champ Intégrateur, sections Présentation / Sécurité / Versions et firmwares | présents ; PC 13/15 collecteurs (v0.1.0 : 9/14), PE 16/17 | ✅ |
| 2026-11-17 | Lab, collecteurs en erreur (Julien) | aucun collecteur en erreur sur un endpoint valide | `v4_snmp`, `v4_protection_policies`, `storage_pools_v2` sans réponse : chemins faux. SNMP v4 se lit par cluster (`/config/clusters/{extId}/snmp`), les politiques de protection sont dans `datapolicies` et non `dataprotection`, les storage pools n'existent qu'en v1 | ❌ |
| 2026-11-17 | Étape 7, auto-check : suite complète avec les trois chemins sur le faux Prism | 11 pass, 0 fail | 11 pass, 0 fail, 237 assertions | ✅ |
| 2026-11-17 | Étape 7, relevé du vérificateur : clés SNMP v4 (`authKey`, `privKey`) conservées dans le bundle | aucune clé dans le bundle | corrigé (utilisateur, types seulement) ; test : 12 pass, 251 assertions, aucune clé dans le JSON du bundle | ✅ |
| 2026-11-17 | Lab, collecte rejouée après l'étape 7 (Julien, dump `/tmp/collecte-lab.json`) | plus aucune erreur sur `v4_snmp`, `v4_protection_policies`, `storage_pools_v2` | PC 15/16 (seul `v4_domain_managers` en erreur, plan #10), PE sans erreur ; politiques de protection lues, vides → « Non configuré » | ✅ |
| 2026-11-17 | Lab, document : chapitres et « Non configuré » | « Présentation », « Prism Central », « Sécurité et accès » ; fonctions absentes en « Non configuré » | conformes ; client et intégrateur nommés ; « Non configuré » sur politiques, licences, rôles, authentification | ✅ |
| 2026-11-17 | Dump lab : SNMP du PE | utilisateurs SNMP lus, sans clé | `/v1/snmp` range ses utilisateurs sous `snmpUsers`, que la section ignorait, et le bundle gardait les objets entiers : section et collecteur corrigés, test étendu (12 pass, 254 assertions) | ✅ |
| 2026-11-17 | Lab, schémas dans le document (Julien) | six, cohérents avec le lab | cinq vus et cohérents (vue d'ensemble PC, vue d'ensemble cluster, ports, câblage, conception logique) | ✅ |
| 2026-11-17 | Dump lab rejoué hors ligne : sixième schéma `cfg.vnet` | produit | produit, non vide (vs0, active-backup, 4 sous-réseaux), placé au chapitre « Configuration Nutanix » | ✅ |
| 2026-11-17 | Lab, « Schéma du réseau virtuel » vu dans le document (Julien) | présent | présent | ✅ |

Verdict du vérificateur indépendant (sous-agent, 2026-10-12) : **PASS** sur T1, T3, T4, T5.

## Journal de session

### Session 2026-10-12
- ✅ Fait : cadrage, création du plan et de l'issue #3.
- ✅ Fait : étape 1 — rien de propre à ce dépôt dans `i18n.dict.js` ni `nutanixV4.js`.
- ✅ Fait : étapes 2-3 — moteur, collecte et `apiCompat` mis à jour ; `server/bundle.js` passe par `listAll`.
- ✅ Fait : étapes 4-5 — `web/clean.js` ne retire que le non collecté ; les six schémas se dessinent sans changement ; champ « Intégrateur » ; jeu `lab` aligné sur la projection ; un test ajouté.
- ✅ Fait : étape 6 — script de synchro supprimé, README réécrit.
- 🔄 En cours : validation réelle sur le lab, à jouer par Julien (procédure dans `## Tests`).

### Session 2026-11-17
- ⚠️ Premier passage lab joué avec l'exécutable v0.1.0 : non probant.
- ✅ Fait : passage lab sur les sources actuelles, page conforme ; trois collecteurs en erreur.
- ✅ Fait : étape 7 — chemins corrigés (`collect.js`, `projection.js`), faux Prism et test étendus.
- ✅ Fait : collecte lab rejouée avec dump : trois collecteurs réparés confirmés ; SNMP du PE (`snmpUsers`, clés retirées) corrigé.
- ✅ Fait : six schémas confirmés sur le document du lab.
- ✅ Validation : tous les tests et le passage lab conformes ; plan clôturé le 2026-11-17, débloque #6.
