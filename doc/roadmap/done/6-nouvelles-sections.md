---
plan:
  id: '6'
  name: 6-nouvelles-sections.md
  link: https://github.com/Exe64/ultimate-ntnx-asbuilt/blob/main/doc/roadmap/done/6-nouvelles-sections.md
status: done
date: 2026-10-12
description: >
  Ajouter au document les sujets encore absents après la mise à jour du moteur :
  syslog, proxy, certificats, chiffrement, Witness, images, Flow, Files,
  Objects, Volumes.
priority: medium
complexity: L
intent: null
scope:
  modules:
    - engine/asbuilt/
    - engine/i18n.dict.js
    - server/prism/collect.js
    - server/bundle.js
    - server/prism/projection.js
    - tests/
blockedBy:
  - '3'
issue:
  id: 6
  url: https://github.com/Exe64/ultimate-ntnx-asbuilt/issues/6
---

# [📑] Plan #6 - Nouvelles sections du document

## Objectif

Couvrir les sujets habituels d'un as-built encore absents après la mise à jour du
moteur (plan #3).

## Périmètre

### Inclus
- Lot 1, cluster : syslog, proxy, certificats, chiffrement.
- Lot 2, plateforme : Witness, images.
- Lot 3, services : Flow, Files, Objects, Volumes.
- Collecteurs, sections du catalogue, libellés français et anglais, jeux de données et tests.

### Hors scope
- Ce que le plan #3 couvre déjà (versions et firmwares, réseau détaillé,
  sécurité et accès).

## Étapes

- [x] Étape 1 — Inventaire : pour chaque sujet, l'endpoint qui le fournit et ce que le plan #3 couvre déjà (M · reasoning → Opus)
- [x] Étape 2 — Lot 1, cluster : syslog, proxy, certificats, chiffrement (L · reasoning → Opus)
- [x] Étape 3 — Lot 2, plateforme : Witness, images (M · standard → Sonnet) — images livrées ; Witness reporté, voir décisions
- [x] Étape 4 — Lot 3, services : Flow, Files, Objects, Volumes (L · reasoning → Opus)
- [x] Étape 5 — Jeux de données et tests par section (M · standard → Sonnet)
- [x] 🧪 Tests — Rédiger et exécuter la procédure de test (avant-dernière étape, obligatoire)
- [x] ✅ Validation — Vérifier les résultats des tests et clôturer (dernière étape, obligatoire)

## Décisions techniques

| Décision | Choix retenu | Justification |
|----------|-------------|---------------|
| Lieu de développement | Ce dépôt | Décision de cadrage du 2026-10-12 |
| Services absents du lab | Développés quand même, validés sur jeu de données et marqués « non vérifié en réel » | Le lot 3 ne se valide en réel que sur ce qui est déployé |
| Liste des sujets | Confirmée en étape 1 : aucun des dix sujets n'était couvert par #3 ni #10 | Inventaire ci-dessous |
| Sources (étape 1) | Syslog : `clustermgmt /config/clusters/{id}/rsyslog-servers` ; certificat : `clustermgmt /config/clusters/{id}/ssl-certificate` (v4.2+) ; proxy et chiffrement : `cluster_v2` déjà collecté (`http_proxies`, `encrypted`, `has_self_encrypting_drive`, `data_in_transit_encryption_dto`) et containers ; images : `vmm /content/images` ; Flow : `microseg /config/policies` et `networking /config/vpcs` ; Files : `files /config/file-servers` ; Objects : `objects /config/object-stores` ; Volumes : `volumes /config/volume-groups` | Chemins, pagination et forme de réponse relevés dans la spec officielle (developers.nutanix.com, v4.0 et clustermgmt v4.2) — la leçon de l'étape 7 de #3 |
| Witness | Reporté : aucun endpoint vérifié | Absent des specs clustermgmt v4.0 à v4.3 ; le chemin v1 supposé (`/cluster/metro_witness`) n'est confirmé nulle part, et le lab (un nœud) ne peut pas le valider. À reprendre avec un cluster deux nœuds ou Metro |
| Place des sections | Syslog, proxy, certificat, chiffrement au chapitre « Configuration Nutanix » de chaque cluster ; images, Flow, VPC, Files, Objects, Volumes au chapitre « Prism Central » | Les premiers sont des réglages du cluster ; les seconds sont des objets gérés par le PC, chacun avec sa colonne Cluster |
| Service non déployé | 404 ou 503 (et 403 pour `microseg`, Flow non activé) sur `microseg`, `networking` (VPC), `files`, `objects` → liste vide, « Non configuré » ; `vmm` et `volumes` restent en erreur sur 404 | Un PC sans Flow, Files ni Objects ne sert pas leur API ; `vmm` et `volumes` sont toujours servis, un 404 y trahirait un chemin faux (remarque du vérificateur) |
| Secrets | `scrub` retire du bundle toute chaîne sous une clé `password`, `passphrase`, `secret`, `privateKey`, PC et PE ; le certificat n'est gardé que lu (sujet, émetteur, dates, algorithme) | La spec montre `privateKey`/`passphrase` (certificat), `targetSecret` (CHAP des volume groups), mot de passe de proxy ; défense en profondeur pour le reste |
| Lecture par cluster | Fonction `perCluster` partagée par SNMP, syslog et certificat | Même règle : erreur seulement si aucun cluster ne répond |

## Tests

### Prérequis pour les tests

Dépendances installées (`npm install`) ; `openssl` pour le faux Prism.

### Procédure de test

```bash
echo "=== T1 Full Suite ==="
cd /srv/dev/ultimate-ntnx-asbuilt
npx bun test

echo "=== T2 Fake Prism Collection ==="
npx bun test -t "Prism auto-signé"

echo "=== T3 New Collectors Registered ==="
grep -c "v4_rsyslog\|v4_ssl_certificates\|v4_images\|v4_network_security_policies\|v4_vpcs\|v4_file_servers\|v4_object_stores\|v4_volume_groups" server/prism/collect.js server/prism/projection.js

echo "=== T4 New Sections In Catalog ==="
grep -c "id: 'cfg.syslog'\|id: 'cfg.proxy'\|id: 'cfg.certificate'\|id: 'cfg.encryption'\|id: 'pc.images'\|id: 'pc.flow'\|id: 'pc.vpcs'\|id: 'pc.files'\|id: 'pc.objects'\|id: 'pc.volumes'" engine/asbuilt/sections.js
```

**Résultats attendus :**
- T1 : `13 pass`, `0 fail`.
- T2 : `1 pass`, `0 fail` — syslog, proxy, certificat (sujet `CN=localhost`, date de fin), chiffrement, images, Flow (sans la politique système), Files, Volumes (sans le volume group caché) remplis ; VPC et Objects « Non configuré » (404) ; aucune trace de `k-sslkey`, `k-sslpass`, `k-chap`, `k-proxy` dans le bundle ; « Syslog », « Nutanix Volumes » et `vg-sql` dans le .docx.
- T3 : `collect.js:8` (6 endpoints, 2 lectures par cluster) ; `projection.js:4` (2 lignes de `PC_KEYS`, 2 rattachements par cluster).
- T4 : `10`.

### Validation réelle sur le lab (à jouer par Julien)

```bash
echo "=== Start The App With A Raw Dump ==="
cd /srv/dev/ultimate-ntnx-asbuilt
DUMP=/tmp/collecte-lab.json ASBUILT_TIMEOUT_S=120 npm start
```

**Résultats attendus :**
- Journal de l'étape 3 : aucune erreur sur `v4_rsyslog`, `v4_images`, `v4_network_security_policies`, `v4_vpcs`, `v4_file_servers`, `v4_object_stores`, `v4_volume_groups` ; `v4_ssl_certificates` lu si le PC sert clustermgmt v4.2.
- Chapitre « Configuration Nutanix » : Syslog, Proxy HTTP, Certificat SSL (le certificat du PE), Chiffrement (données au repos : Oui, d'après le dump actuel).
- Chapitre « Prism Central » : Images (celles du lab), Flow, VPC, Files, Objects, Volumes — remplis ou « Non configuré », jamais « Non collecté ».
- Lecture seule : si le compte du PC est en lecture seule, noter toute erreur 403 (le certificat est le plus exposé).

### Résultats joués et vérifiés

| Date | Test | Attendu | Observé | Verdict |
|------|------|---------|---------|---------|
| 2026-11-17 | Auto-check exécuteur : suite complète | 12 pass, 0 fail | 12 pass, 0 fail, 274 assertions | ✅ |
| 2026-11-17 | Dump lab rejoué hors ligne (collecte d'avant le plan) | proxy et chiffrement lus dans `cluster_v2` ; autres sections « Non collecté » faute de clé | proxy « Non configuré » ; chiffrement : au repos Oui, SED Non, containers Aucun, transit Non ; les huit autres « Non collecté — donnée absente » (attendu : nouvelle collecte nécessaire) | ✅ |
| 2026-11-17 | T1-T4 (vérificateur indépendant, sous-agent) | 12 pass ; 1 pass ; collect.js:8, projection.js:4 ; 10 | 12 pass, 274 assertions ; 1 pass, 45 assertions ; 8 et 4 ; 10 ; revue : aucun secret ne passe, `perCluster` et `absentOk` conformes | ✅ PASS |
| 2026-11-17 | Correction suite à la revue : `absentOk` retiré de `vmm` et `volumes` | 404 sur un namespace toujours servi = erreur | appliqué ; suite rejouée | ✅ |
| 2026-11-17 | Lab : nouvelle collecte (Julien) | aucune erreur sur les nouvelles clés | PC 21/24 : `v4_rsyslog`, `v4_ssl_certificates`, `v4_images`, `v4_vpcs`, `v4_volume_groups` lus ; `v4_file_servers` et `v4_object_stores` en 503 (« Http request to endpoint 127.0.0.1:7509 failed » : la passerelle ne trouve pas le service, non déployé) ; `v4_network_security_policies` en 403 | ❌ |
| 2026-11-17 | Lab, document (dump rejoué) | sections remplies ou « Non configuré » | certificat lu (CN=prism.nutanix.local, 2026-09-09 → 2036-09-09, RSA_2048) ; chiffrement lu ; syslog, proxy, images, VPC « Non configuré » ; Volumes « Non configuré » : les 3 volume groups du lab sont les PVC cachés du PC (`INTERNAL`), filtrés comme prévu | ✅ |
| 2026-11-17 | Correction : 503 d'un service optionnel | « Non configuré » | 503 traité comme 404 pour Flow, VPC, Files, Objects ; faux Prism : Objects en 503 → « Non configuré » ; suite 12 pass, 274 assertions | ✅ |
| 2026-11-17 | Flow : 403 sur `microseg /config/policies` | à qualifier | Julien : Flow Network Security non activé, compte admin → le 403 signifie « non activé » | ✅ |
| 2026-11-17 | Correction : 403 de `microseg` | « Non configuré » | 403 traité comme absent pour Flow seulement ; nouveau test « Flow non activé » ; suite 13 pass, 276 assertions | ✅ |
| 2026-11-17 | Lab : collecte finale (Julien) | PC sans erreur ; Flow, Files, Objects « Non configuré » | conformes | ✅ |

## Journal de session

### Session 2026-10-12
- ✅ Fait : cadrage, création du plan et de l'issue #6.
- 🚧 Blocages : attend le plan #3 (mise à jour du moteur).

### Session 2026-11-17
- ✅ Fait : plan #3 clôturé, plan débloqué ; exécution en one-shot demandée.
- ✅ Fait : étape 1 — inventaire sur les specs officielles (voir décisions) ; Witness sans endpoint vérifiable, reporté.
- ✅ Fait : étapes 2 à 5 — 8 collecteurs, `perCluster`, `scrub`, 10 sections, faux Prism et test étendus.
- ✅ Fait : vérification indépendante (PASS) ; `absentOk` restreint aux services optionnels.
- ✅ Fait : lab : Files et Objects (503) et Flow (403, non activé) corrigés en « Non configuré ».
- ✅ Validation : tests et collecte finale du lab conformes ; plan clôturé le 2026-11-17. Witness reporté (aucun endpoint vérifiable).
