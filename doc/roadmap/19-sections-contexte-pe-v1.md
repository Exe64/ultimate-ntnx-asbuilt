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

- [ ] Étape 1 — Collecte PE v1 : chiffrement au repos, Witness, support à distance, VM non protégées (S · standard → Sonnet)
- [ ] Étape 2 — Collecte PC : politiques de stockage, alertes personnalisées, STIG / security summaries / security profiles, Flow VN (seulement si des VPC existent), catalogue, iSCSI (M · standard → Sonnet)
- [ ] Étape 3 — Sections : chiffrement réel (ligne « Données au repos »), Witness, support à distance, VM non protégées, politiques de stockage, alertes personnalisées, conformité sécurité, Flow VN, catalogue, iSCSI ; contexte décoché par défaut (M · standard → Sonnet)
- [ ] Étape 4 — Faux Prism, tests et documentation (M · standard → Sonnet)
- [ ] 🧪 Tests — `bun test`, recette lab PC seul et PC + PE
- [ ] ✅ Validation — Vérifier les résultats des tests et clôturer

## Décisions techniques

| Décision | Choix retenu | Justification |
|----------|-------------|---------------|
| Chiffrement au repos | Avec PE : `/v1/data_at_rest_encryption` l'emporte sur la v4 ; sans PE : règle de #17 (v4 seule) | Seule exception à « v4 d'abord » : la v1 donne l'état réel |
| Activation par défaut | Sections de contexte décochées ; Witness et chiffrement réel activés | Le Witness fait partie de l'architecture dès qu'il existe ; le chiffrement remplace une ligne existante |
| Flow VN | Appels seulement si des VPC existent | Évite des appels inutiles sur un PC sans FVN |
| Recette | Faux Prism puis lab ; le non configuré est marqué « validé sur la spec » | Lab un nœud, sans VPC ni Witness |

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
- 📋 Prochain : attendre la clôture de #18, puis étape 1.
