---
plan:
  id: '19'
  name: 19-sections-contexte-pe-v1.md
  link: https://github.com/Exe64/ultimate-ntnx-asbuilt/blob/main/doc/roadmap/19-sections-contexte-pe-v1.md
status: active
date: 2026-11-27
description: >
  Sections utiles selon le contexte (décochées par défaut) et compléments que seul le Prism Element expose :
  état réel du chiffrement, Witness, support à distance, VM non protégées.
priority: low
complexity: M
intent: null
blockedBy: [18]
scope:
  modules:
    - server/prism/collect.js
    - server/prism/projection.js
    - engine/asbuilt/sections.js
    - tests/
issue:
  id: 19
  url: https://github.com/Exe64/ultimate-ntnx-asbuilt/issues/19
---

# [🗂️] Plan #19 - Sections de contexte et compléments Prism Element v1

## Objectif

Certaines informations ne valent que dans un contexte précis (Flow Virtual Networking, STIG, catalogue, iSCSI) :
le document doit pouvoir les dire, sans les imposer. D'autres ne sont exposées que par le Prism Element en v1,
dont l'état réel du chiffrement au repos (`cluster_v2.encrypted` est faux, cf. #17) et le Witness, reporté
depuis #6.

## Périmètre

### Inclus
- **Prism Element v1** : `/v1/data_at_rest_encryption`, `/v1/cluster/metro_witness`, `/v1/cluster/remote_support`,
  `/v1/protection_domains/unprotected_vms`.
- **Prism Central** : `datapolicies /config/storage-policies`, `monitoring /serviceability/alerts/user-defined-policies`,
  `security /report/stigs`, `/report/security-summaries`, `/config/security-profiles`, Flow Virtual Networking
  (`networking /config/gateways`, `vpn-connections`, `bgp-sessions`, `floating-ips`, `route-tables`,
  `layer2-stretches`), catalogue (`vmm /content/templates`, `/ahv/config/vm-guest-customization-profiles`,
  `/images/config/placement-policies`), `volumes /config/iscsi-clients`.

### Hors scope
- Sous-ressources Files et Objects (antivirus, quotas, buckets) : relèvent d'un document par service.

## Étapes

- [x] Étape 1 — Collecte PE v1 : chiffrement au repos, Witness, support à distance, VM non protégées (S · standard → Sonnet)
- [x] Étape 2 — Collecte PC : politiques de stockage, alertes personnalisées, STIG / security summaries / security profiles, Flow VN (seulement si des VPC existent), catalogue, iSCSI (M · standard → Sonnet)
- [x] Étape 3 — Sections : chiffrement réel (ligne « Données au repos »), Witness, support à distance, VM non protégées, politiques de stockage, alertes personnalisées, conformité sécurité, Flow VN, catalogue, iSCSI ; contexte décoché par défaut (M · standard → Sonnet)
- [x] Étape 4 — Faux Prism, tests et documentation (M · standard → Sonnet)
- [ ] 🧪 Tests — `bun test`, recette lab PC seul et PC + PE
- [ ] ✅ Validation — Vérifier les résultats des tests et clôturer

## Décisions techniques

| Décision | Choix retenu | Justification |
|----------|-------------|---------------|
| Chiffrement au repos | Avec PE : `/v1/data_at_rest_encryption` l'emporte sur la v4 ; sans PE : règle de #17 (v4 seule) | Seule exception à « v4 d'abord » : la v1 donne l'état réel |
| Activation par défaut | Sections de contexte décochées ; Witness et chiffrement réel activés | Le Witness fait partie de l'architecture dès qu'il existe ; le chiffrement remplace une ligne existante |
| Flow VN | Appels seulement si des VPC existent | Évite des appels inutiles sur un PC sans FVN |
| Recette | Faux Prism puis lab, en une recette commune avec #18 ; le non configuré est marqué « validé sur la spec » | Lab un nœud, sans VPC ni Witness ; identifiants donnés une fois |
| Séquencement | #19 implémenté avant la recette de #18 (entorse validée par l'utilisateur) | #18 commité et poussé ; #19 n'ajoute que des clés |
| Champs choisis à la collecte | `pick` sur chaque appel v1 du PE et sur les objets PC de contexte | Witness (`username`/`password`), proxy du tunnel de support, IPsec des VPN, `clientSecret` iSCSI, mot de passe BGP, textes de correction STIG, VM (dizaines de champs) |
| Tables de routage | Non lues | Les routes demandent un appel par table ; peu d'information pour un as-built |
| Flow VN sans VPC | Clés FVN posées vides | La section dit « Non configuré » au lieu de « Non collecté » |
| STIG | Deux sections : synthèse par cluster (`security-summaries` + profils) et contrôles non conformes (`stigs`) | Le détail de tous les contrôles noierait le document |
| Flow VN | Une seule section, colonne « Type » | Plus compact qu'une section par type d'objet |

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
- ✅ Fait : cadrage commun avec #18 ; issue #19 et plan créés.
- ✅ Fait : étapes 1 à 4 (une seule passe) ; 40 tests verts (dont « Flow Virtual Networking : interrogé seulement avec des VPC, sans secret »).
- 📋 Prochain : recette commune #18 + #19 sur le lab (identifiants PC et PE à redonner).
