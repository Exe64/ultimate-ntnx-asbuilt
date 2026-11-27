---
plan:
  id: '18'
  name: 18-asbuilt-enrichi-v4.md
  link: https://github.com/Exe64/ultimate-ntnx-asbuilt/blob/main/doc/roadmap/18-asbuilt-enrichi-v4.md
status: active
date: 2026-11-27
description: >
  Compléter l'as-built avec des données à forte valeur lues sur le Prism Central : bonds, segmentation,
  placement et démarrage des VM, blocs, résilience du stockage, BIOS/BMC, droits d'accès, sauvegarde du PC, LCM.
priority: medium
complexity: L
intent: null
blocks: [19]
scope:
  modules:
    - server/prism/collect.js
    - server/prism/projection.js
    - engine/asbuilt/normalize.js
    - engine/asbuilt/sections.js
    - engine/asbuilt/asBuiltModel.js
    - tests/
issue:
  id: 18
  url: https://github.com/Exe64/ultimate-ntnx-asbuilt/issues/18
---

# [🧩] Plan #18 - As-built enrichi : réseau, placement des VM, matériel, accès

## Objectif

L'inventaire des API (dépôt NutanixAPISwaggers, codes HTTP relevés sur pc.7.6.0.10) montre des données
d'installation que le document ne dit pas encore : comment les uplinks sont agrégés, où les VM ont le droit de
tourner, dans quel ordre elles démarrent, quels blocs composent le cluster, qui a quels droits, où se sauvegarde
le Prism Central. Ce plan les ajoute, en lisant le PC.

## Périmètre

### Inclus
- **Déjà collecté, à afficher** : traps et transports SNMP (`v4_snmp`, la collecte ne gardait que les
  utilisateurs), liste blanche NFS (`v4_clusters.network.nfsSubnetWhitelist`).
- **Réseau** : `networking /config/uplink-bonds` (mode, état LACP, NICs par hôte), `clustermgmt
  /clusters/{id}/network-segments` (backplane, VLAN, MTU, interface CVM).
- **VM** : `vmm /ahv/policies/vm-host-affinity-policies`, `vm-anti-affinity-policies`,
  `legacy-vm-anti-affinity-policies`, `vm-startup-policies` (7.5+).
- **Matériel et stockage** : `clustermgmt /clusters/{id}/rackable-units`, `/clusters/{id}/storage-config`,
  `/clusters/{id}/hosts/{id}/bmc-info` (v4.4).
- **Prism Central** : `iam /authz/authorization-policies` et `/authn/user-groups`,
  `prism /management/domain-managers/{id}/backup-targets`, `lifecycle /resources/config`.

### Hors scope
- Sections de contexte et compléments du PE v1 : plan #19.
- Événements, alertes, audits, tâches, snapshots : de l'état, pas une décision d'installation.

## Étapes

- [x] Étape 1 — Collecte PC : bonds, segments, rackable units, storage-config, politiques VM (affinité, anti-affinité + legacy, démarrage), bmc-info en v4.4 (404 silencieux), backup-targets, authorization-policies + user-groups, configuration LCM ; rattachement au cluster, secrets filtrés (M · standard → Sonnet)
- [x] Étape 2 — Normalisation : BIOS/BMC depuis bmc-info d'abord, modèle et série des nœuds complétés par les blocs, bonds rattachés aux vSwitch (S · standard → Sonnet)
- [x] Étape 3 — Sections : « Bonds et uplinks », « Segmentation réseau », traps SNMP, liste blanche NFS, « Règles de placement des VM », « Ordre de démarrage », « Blocs », « Résilience du stockage », « Sauvegarde du Prism Central », « Droits d'accès » (décochée), « Configuration LCM » ; libellés fr/en (L · reasoning → Opus)
- [x] Étape 4 — Faux Prism et tests : formes de la spec pour chaque appel, un test par section, bmc-info 404 sans erreur au journal (M · standard → Sonnet)
- [x] Étape 5 — Documentation : README, `CONTEXT.md` (XS · standard → Sonnet)
- [ ] 🧪 Tests — `bun test`, recette lab PC seul et PC + PE
- [ ] ✅ Validation — Vérifier les résultats des tests et clôturer

## Décisions techniques

| Décision | Choix retenu | Justification |
|----------|-------------|---------------|
| Activation par défaut | Nouvelles sections activées, sauf « Droits d'accès » | Volume potentiel (centaines de lignes) |
| BIOS/BMC | **`bmc-info` abandonné** (décision prise à l'étape 1) | La spec (`BmcInfo`) ne porte que l'IP du BMC, un identifiant (`BasicAuth`, donc un secret) et son état : aucune version. L'IP IPMI est déjà lue sur l'hôte ; le trou BIOS/BMC reste couvert par LCM puis PE |
| Politiques d'autorisation | Champs utiles seulement, choisis à la collecte (`pick`) ; clé `v4_authz_policies` | Volume ; `clientName` et autres champs inutiles écartés ; le nom `authorization` aurait aussi déclenché la garde anti-fuite du test d'export |
| Traps SNMP | Clé `v4_snmp_traps` à part, sans `communityString` ni `engineId` | `scrub` ne reconnaît pas ces noms ; `v4_snmp` garde sa forme (utilisateurs) |
| Bonds | NICs résolues par l'extId des ports v4 (nom et vitesse) | `hostNicReferences` ne porte que des extId |
| Placement et démarrage des VM | Chapitre Prism Central ; catégories résolues en « Clé: valeur » | Politiques de niveau PC, définies par catégories |
| Liste blanche NFS | Ligne ajoutée à « Informations du cluster », seulement si configurée | Champ déjà collecté (`network.nfsSubnetWhitelist`) |
| Droits d'accès | Politiques créées par le client seulement, plus une ligne « N politiques système » | Les politiques système noient le tableau |
| Blocs | Nouvelle section « Blocs » ; complète modèle et série d'un nœud quand l'hôte ne les donne pas | Les rackable units portent modèle, série et rack |
| Recette | Faux Prism (formes de la spec) puis lab ; ce que le lab n'a pas configuré est marqué « validé sur la spec » | Lab un nœud, peu configuré |
| Séquencement | #18 entier (recette et commit compris) avant #19 | Mêmes fichiers touchés |

## Tests

### Prérequis pour les tests

```bash
(à renseigner à l'étape 🧪 Tests — les identifiants du lab ne sont jamais écrits dans ce fichier)
```

### Procédure de test

```bash
(à renseigner à l'étape 🧪 Tests)
```

**Résultats attendus :** à renseigner.

### Résultats joués et vérifiés

| Date | Test | Attendu | Observé | Verdict |
|------|------|---------|---------|---------|

## Journal de session

### Session 2026-11-27
- ✅ Fait : inventaire croisé avec le dépôt NutanixAPISwaggers (197 appels de liste v4 et 57 ressources v1 non lus) ; cadrage ; issue #18 et plan créés.
- ✅ Fait : étapes 1 à 5 ; `bmc-info` abandonné (aucune version dans la réponse) ; 39 tests verts.
- 📋 Prochain : 🧪 recette lab (identifiants PC et PE à redonner).
