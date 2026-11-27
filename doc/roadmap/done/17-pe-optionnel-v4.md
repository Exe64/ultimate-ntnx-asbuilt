---
plan:
  id: '17'
  name: 17-pe-optionnel-v4.md
  link: https://github.com/Exe64/ultimate-ntnx-asbuilt/blob/main/doc/roadmap/done/17-pe-optionnel-v4.md
status: done
date: 2026-11-27
enriched: 2026-11-27
description: >
  As-built complet depuis le seul Prism Central : lire les API v4 (PC) d'abord, le Prism Element
  ne servant plus qu'à la HA, au nom et seuil ILM des pools et aux protection domains hérités.
priority: high
complexity: L
intent: null
scope:
  modules:
    - server/prism/collect.js
    - server/prism/projection.js
    - server/bundle.js
    - engine/asbuilt/normalize.js
    - engine/asbuilt/sections.js
    - web/app.js
    - web/index.html
    - web/i18n.js
    - tests/
issue:
  id: 17
  url: https://github.com/Exe64/ultimate-ntnx-asbuilt/issues/17
---

# [🔌] Plan #17 - As-built complet depuis le seul Prism Central

## Objectif

Aujourd'hui, sans identifiants Prism Element, une dizaine de sections restent vides alors que les API v4 du
Prism Central portent la même information. Ce plan fait du PC la source principale : le document est complet
avec ses seuls identifiants, et le PE devient un complément facultatif.

## Périmètre

### Inclus
- **Lot 1, v4 déjà collecté (aucun nouvel appel)** : vitesse et capacité des ports physiques (`v4_host_nics`),
  version NCC (`clusterSoftwareMap`), serveur de management (`network.managementServer`), disques
  auto-chiffrants (`diskAdvanceConfig.isSelfEncryptingDrive`), SMTP (`network.smtpServer`), proxy
  (`network.httpProxyList`, `httpProxyWhiteList`), chiffrement (`encryptionOption`, `encryptionScope`,
  `encryptionInTransitStatus`), Pulse (`pulseStatus`), capacité par nœud (somme des disques), pool de stockage
  (identifiant et capacité depuis `storagePoolExtId`).
- **Lot 2, nouveaux appels PC** : CVM (`clustermgmt /clusters/{id}/cvms`), email des alertes
  (`monitoring /serviceability/alerts/email-config`), licences par cluster (`licensing /config/entitlements`,
  `/config/compliances`), recovery plans (`datapolicies /config/recovery-plans`), KMS
  (`security /config/key-management-servers`), SAML (`iam /authn/saml-identity-providers`).
- Section HA expliquée sans PE (au lieu de disparaître).
- Étape Prism Element de l'interface : « Compléments Prism Element (HA, pools de stockage) » + bouton Passer.
- Tests (faux Prism étendu) et documentation.

### Hors scope
- Uplink bonds, affinités VM, politiques de démarrage, STIG, network segments, réglages LCM (relevés pendant
  l'inventaire, sans lien avec le PE ; à reprendre dans un plan dédié).
- Publication d'une release.
- HA et nom / seuil ILM des pools sans PE : aucune API v4 ne les expose (vérifié sur les 20 namespaces).

## Étapes

### Lot A — Données
- [x] Étape 1 — Collecte PC : `v4_cvms` (par cluster), `v4_alert_email_config`, `v4_license_entitlements`, `v4_license_compliances`, `v4_recovery_plans`, `v4_key_management_servers`, `v4_saml_identity_providers` ; appels isolés, rattachement au cluster dans `CLUSTER_REF_PATHS`, secrets filtrés (M · standard → Sonnet)
- [x] Étape 2 — Normalisation v4 d'abord : ports (vitesse + capacité) depuis `v4_host_nics` avec la v2 en secours, NCC, serveur de management, SED, CVM, capacité par nœud, pool dérivé ; corriger le commentaire de `normalize.js` sur la vitesse des liens (M · standard → Sonnet)

### Lot B — Document
- [x] Étape 3 — Sections : SMTP, proxy, chiffrement (+ KMS), Pulse, licences en tableau v4 (v1 en secours), protection des données PP + RP (PD si PE), authentification cluster si PE, HA expliquée, pools v4 ; côté PC : email des alertes et SAML ; libellés fr/en (L · reasoning → Opus)
- [x] Étape 4 — Faux Prism et tests : nouvelles clés dans le lab fictif ; test « PC seul » (tout sauf HA et nom/ILM des pools) ; test « v4 l'emporte sur v2 » (M · standard → Sonnet)

### Lot C — Interface et documentation
- [x] Étape 5 — Interface : étape « Compléments Prism Element (HA, pools de stockage) » + bouton Passer vers le document (S · standard → Sonnet)
- [x] Étape 6 — Documentation : README, note de priorité v4 → PE dans `CONTEXT.md` (XS · standard → Sonnet)

- [x] 🧪 Tests — `bun test`, puis recette lab PC seul et PC + PE, comparées avec le rapport d'écarts (#16)
- [x] ✅ Validation — Vérifier les résultats des tests et clôturer

## Décisions techniques

| Décision | Choix retenu | Justification |
|----------|-------------|---------------|
| Priorité des sources | v4 (PC) d'abord, v1/v2 (PE) en secours | Document identique avec ou sans PE, hors ce que seul le PE donne |
| Protection des données | Protection policies + recovery plans en contenu principal ; protection domains seulement si PE | Le besoin porte sur Leap ; les PD sont hérités |
| Licences | Tableau v4 par cluster (droit, type, échéance, conformité) ; lignes v1 en secours ; ligne NCM du plan conservée | Plus riche que la v1 (conformité, violations) |
| Alertes | `email-config` au chapitre PC (pas d'ID de cluster) ; section cluster réduite à Pulse (+ v1 si PE) | La donnée reste à sa vraie place |
| Authentification | SAML ajouté au chapitre PC ; section cluster seulement si PE | Les annuaires du PC sont déjà documentés côté PC |
| HA | Sans PE, la section dit qu'elle requiert les identifiants Prism Element | Aucune API v4 ne l'expose ; mieux qu'une section qui disparaît |
| Vitesse des liens | `linkSpeedInKbps` (négociée) + `linkCapacityInMbps` (capacité) en v4 | Mesuré sur le lab : eth7 10 000 000 kbps, ports débranchés 0, capacité 10 000 / 1 000 Mbps ; le commentaire actuel du code est faux |
| vCPU des CVM | v4 jamais repris ; vCPU lu par le PE en v1 (`/v1/vms?filterCriteria=is_cvm==1`) ; vide sans PE | Recette : v4 `numVcpus: 1`, v1 `numVCpus: 4` (valeur affichée par Prism) ; la v2 `/vms` exclut les CVM |
| Adresses des hôtes v4 (bug trouvé) | IP de la CVM et de l'hyperviseur lues sous `externalAddress` | Sur pc.7.6, `controllerVm.ip` / `hypervisor.ip` n'existent pas : sans PE, le tableau des adresses sortait vide |
| Recette | Lab PC seul puis PC + PE, comparés avec le rapport d'écarts de #16 | Prouve que seules HA et pools diffèrent |
| Collectes antérieures | Les écarts « ajoutés » entre une collecte d'avant et une d'après ce plan sont attendus | Nouvelles clés, pas de vrais changements : documenté, pas masqué |
| Versions d'API | Aucun changement d'apiCompat | `unversioned/info` répond 405 sur pc.7.6 (repli v4.0), mais le PC sert aussi les chemins récents (cvms, recovery-plans, licensing, email-config, KMS, SAML) sous le préfixe v4.0 — vérifié |
| Ports v4 jamais lus (bug trouvé) | Rattachement d'un hôte v4 par `cluster.extId` **ou** `cluster.uuid` | Sur pc.7.6, l'hôte ne porte que `cluster.uuid` : le filtre de `bundle.js` écartait tous les hôtes, d'où le commentaire « v4 ne donne jamais la vitesse ». Le faux Prism reprend désormais cette forme |
| Ports v4 : liste à plat | Non retenue, boucle hôte par hôte conservée | `/config/host-nics` n'existe qu'à partir de la spec v4.2 ; la boucle existe dès v4.0 |
| Chiffrement | Champ v4 présent → v4 ; absent → v2 si PE ; sinon « Non » | La v4 omet ce qui n'est pas configuré ; sans ce repli, un cluster chiffré en transit selon la v2 sortait « Non » (vu par le test existant) |
| Disques | v4 d'abord, v2 complète par numéro de série | L'usage d'un disque n'existe qu'en v2 |
| Licences, lignes v1 | Omises quand la v4 a répondu et que le PE est absent | Type, numéro de série du bloc, échéance resteraient vides |
| Chiffrement au repos | Dès que la v4 a répondu, elle seule fait foi ; `cluster_v2.encrypted` ne sert que sans v4 | Lab sans aucun chiffrement (confirmé par l'utilisateur) : v2 `encrypted: true`, v4 rien de configuré. Le faux Prism reprend cette forme |
| Raisons d'absence | Traduites dans le document (`REASONS`) | « identifiants Prism Element non fournis » sortait en français dans le document anglais |

### Mesures sur le lab (PC 7.6, 2026-11-27, lecture seule)

| Namespace | Version négociée | Endpoints vérifiés (HTTP 200) |
|---|---|---|
| clustermgmt | v4.3 (v4.4 → 404) | clusters, host-nics, cvms, storage-config, encryption-config, disks, vcenter-extensions |
| licensing | v4.4 | entitlements, compliances |
| monitoring | v4.3 | alerts/email-config |
| datapolicies | v4.3 | recovery-plans, protection-policies |
| security | v4.2 | key-management-servers |
| iam | v4.1.b3 | saml-identity-providers |

Vides sur le lab, donc non validables en réel : SMTP, proxy, serveur de management, KMS, SAML, recovery plans,
protection policies. Ils sont testés sur la forme décrite par la spec, avec le faux Prism.

## Tests

### Prérequis pour les tests

```bash
cd /srv/dev/ultimate-ntnx-asbuilt
BUN=/home/admin/.hutch/toolchains/bun/1.4.4/linux-x64/bun    # bun n'est pas dans le PATH de ce poste
# Recette lab : PC 192.168.84.201 (pc.7.6, cluster NTNX-LAB-1, un nœud). Identifiants « user:password »
# dans un fichier local hors dépôt, jamais écrits ici : CRED=<chemin du fichier>
```

### Procédure de test

```bash
# 1. Suite complète (faux Prism : collecte PC seul, PC + PE, v4 l'emporte, secrets filtrés)
$BUN test

# 2. Recette lab, PC seul : application lancée, étape 1 avec les identifiants du PC, puis
#    « Passer : document depuis le Prism Central seul », puis « Générer .docx » (fr puis en).

# 3. Recette lab, PC + PE : étape 2 avec les identifiants du PE, puis comparer les deux collectes
#    exportées avec « Comparer deux collectes » (#16).
```

**Résultats attendus :**
1. Tous les tests passent.
2. Sans PE : licences, conformité, NCC, CVM (mémoire), pool (identifiant, capacité), ports (vitesse), Pulse,
   alertes e-mail du PC présents ; HA, authentification du cluster et protection domains disent
   « Non collecté — disponible avec les identifiants Prism Element » (« available with Prism Element
   credentials » en anglais) ; aucun secret dans la collecte ni le document.
3. Avec PE : le rapport d'écarts ne diffère que sur HA, nom et seuil ILM du pool, protection domains,
   authentification du cluster, vCPU des CVM, et les sections que la v4 laisse vides sur ce lab (BIOS/BMC).

### Résultats joués et vérifiés

| Date | Test | Attendu | Observé | Verdict |
|------|------|---------|---------|---------|
| 2026-11-27 | Étape 1 — collecte réelle sur le lab | Nouvelles clés lues, aucune erreur | 31/31 collecteurs PC ; entitlements 2, compliances 2, email-config 1, CVM 1, ports v4 8 (après correctif `cluster.uuid`) ; RP, KMS, SAML : 0 (non configurés) | ✅ |
| 2026-11-27 | Étape 2 — normalisation sur la collecte réelle | NCC, CVM, pool, capacité nœud, ports v4 | NCC 6.0.0.1 ; CVM 20 Go, vCPU vide ; pool b12bc6db…, 4 disques, 2.56 To ; nœud 2.56 To ; eth7 10G actif, autres ports éteints ; uplink « eth7 (10G) » | ✅ |
| 2026-11-27 | Étapes 1–6 — `bun test` | 39 tests verts | 39 pass, 0 fail (dont le nouveau « PC seul : le document se passe du Prism Element ») | ✅ |
| 2026-11-27 | 🧪 Recette lab PC seul, .docx fr et en (script sur la collecte réelle) | Valeurs v4 présentes, raisons d'absence, aucun secret, aucun `{{` | Toutes les valeurs attendues présentes dans les deux langues ; 0 fuite ; 0 marqueur ; « non collecté » restants : cfg.ha, cfg.auth, cfg.dataprotection (attendus) et host.bios (LCM du lab sans BIOS/BMC, `bmc-info` v4.4 non servi par ce PC) | ✅ |
| 2026-11-27 | Validé sur la spec, pas en réel | SMTP, proxy, KMS, SAML, recovery plans, serveur de management | Non configurés sur le lab : couverts par le faux Prism uniquement | ⚠️ |
| 2026-11-27 | 🧪 Recette lab PC + PE, 1ʳᵉ passe (comparaison section par section des deux modèles) | Écarts limités à HA, pool, auth, PD, alerting v1, vCPU CVM | En plus : `host.addresses` vide sans PE (IP CVM/hôte v4 sous `externalAddress`) ; vCPU absent même avec PE (v2 `/vms` sans CVM) ; lignes v1 vides dans les licences ; chiffrement au repos divergent | ❌ |
| 2026-11-27 | 🧪 Recette lab PC + PE, 2ᵉ passe après correctifs | Idem | Écarts : cfg.ha, cfg.pools (nom, ILM 75), cfg.cvm (vCPU 4 avec PE), cfg.auth, cfg.dataprotection, cfg.alerts (alerting v1), annexe de collecte — et **cfg.encryption** (au repos : « Non » en v4, « Oui » selon `cluster_v2.encrypted`) ; `bun test` 39/39 ; .docx fr/en sans fuite ni marqueur | ⚠️ chiffrement à trancher |
| 2026-11-27 | 🧪 Recette lab PC + PE, 3ᵉ passe (chiffrement : v4 seule dès qu'elle répond ; lab confirmé sans chiffrement) | Écarts limités à ce que seul le PE donne | Écarts : cfg.ha, cfg.pools, cfg.cvm, cfg.auth, cfg.dataprotection, cfg.alerts, annexe de collecte — plus de divergence sur le chiffrement ; `bun test` 39/39 ; .docx fr/en : valeurs attendues présentes, 0 fuite, 0 marqueur | ✅ |

## Journal de session

### Session 2026-11-27
- ✅ Fait : inventaire des 20 namespaces v4 (dernière version de chacun) face aux champs v1/v2 lus aujourd'hui ; sondage du lab ; cadrage ; issue #17 et plan créés.
- ✅ Fait : étapes 1 à 6 (un seul passage) ; bug préexistant corrigé (ports v4 jamais collectés : hôte rattaché par `cluster.uuid`) ; recette lab PC seul en fr et en.
- ✅ Fait : recette PC + PE ; correctifs adresses v4 des hôtes, vCPU des CVM (v1), lignes v1 des licences.
- ✅ Fait : chiffrement au repos tranché (lab sans chiffrement : la v4 fait foi) ; ✅ Validation — plan clôturé.
- 📋 Hors plan, relevé : uplink bonds, affinités VM, STIG, network segments, réglages LCM (API v4 disponibles) ; BIOS/BMC quand le LCM ne les décrit pas (`bmc-info` v4.4).
