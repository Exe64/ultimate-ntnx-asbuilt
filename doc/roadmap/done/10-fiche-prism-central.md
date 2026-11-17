---
plan:
  id: '10'
  name: 10-fiche-prism-central.md
  link: https://github.com/Exe64/ultimate-ntnx-asbuilt/blob/main/doc/roadmap/done/10-fiche-prism-central.md
status: done
date: 2026-11-17
description: >
  Documenter le Prism Central lui-même dans son chapitre : informations,
  adressage, CPU et mémoire, versions et composants LCM, lus sur l'API v4
  domain-managers.
priority: medium
complexity: M
intent: null
scope:
  modules:
    - server/prism/collect.js
    - server/prism/projection.js
    - engine/asbuilt/sections.js
    - engine/asbuilt/asBuiltModel.js
    - engine/asbuilt/exportAsBuiltDocx.js
    - tests/
issue:
  id: 10
  url: https://github.com/Exe64/ultimate-ntnx-asbuilt/issues/10
---

# [🧭] Plan #10 - Fiche du Prism Central

## Objectif

Le chapitre « Prism Central » ne dit aujourd'hui que le nom, l'IP et la version du PC. Le
document doit décrire le PC comme il décrit un cluster : informations, adressage, CPU et
mémoire, versions.

## Périmètre

### Inclus
- Informations : nom, FQDN, taille (Small / Large / X-Large), une VM ou scale-out, cluster hôte.
- Adressage : IP virtuelle, IP de chaque VM du PC, DNS, NTP.
- CPU et mémoire : vCPU, RAM, disque de données par VM du PC.
- Versions et firmwares : version du PC et composants LCM du PC (NCC, MSP, Foundation…).
- Les quatre sections dans le chapitre « Prism Central », après « Vue d'ensemble ».

### Hors scope
- Firmware matériel (le PC est une VM).
- PC antérieurs à pc.2024.3 : sections « Non collecté », raison au journal.

## Étapes

- [x] Étape 1 — Collecter les domain-managers ; garder les entités LCM du PC au niveau PC (M · standard → Sonnet)
- [x] Étape 2 — Quatre sections au chapitre « Prism Central », libellés FR/EN (M · standard → Sonnet)
- [x] Étape 3 — Faux Prism et jeu `lab` complétés, tests (S · standard → Sonnet)
- [x] 🧪 Tests — Rédiger et exécuter la procédure de test (avant-dernière étape, obligatoire)
- [x] ✅ Validation — Vérifier les résultats des tests et clôturer (dernière étape, obligatoire)

## Décisions techniques

| Décision | Choix retenu | Justification |
|----------|-------------|---------------|
| Source | API v4 `prism/…/management/domain-managers`, complétée par l'entrée du PC dans `v4_clusters` | Seule API qui décrit le PC lui-même (taille, ressources, réseau) |
| Versions | Version du PC + entités LCM rattachées au PC | Pas de firmware matériel sur une VM ; validé le 2026-11-17 |
| Place | Chapitre « Prism Central », après « Vue d'ensemble » | Validé le 2026-11-17 |
| CPU et mémoire | Une ligne par VM du PC retrouvée dans `v4_vms` par son IP ; sinon la dotation du domain-manager | Le domain-manager ne détaille pas les VM une à une |
| Entités LCM du PC | Lues dans les données PC brutes, filtrées sur l'extId du PC | La répartition par cluster les écarte déjà sans les perdre : aucune modification de la projection |
| En-têtes de tableaux | Style de paragraphe `AsBuiltTableHeader` dans le template, pas de couleur dans le code | La couleur reste pilotée par le template ; un template client sans ce style retombe sur « Normal » |
| Libellés | Titres FR/EN dans le catalogue, `i18n.dict.js` inchangé | Les sections portent leurs titres, comme les autres |

## Tests

### Prérequis pour les tests

Dépendances installées (`npm install`) ; `openssl` pour le faux Prism.

### Procédure de test

```bash
echo "=== T1 Full Suite ==="
cd /srv/dev/ultimate-ntnx-asbuilt
npx bun test

echo "=== T2 Prism Central Sheet Tests ==="
npx bun test -t "Prism auto-signé|fiche du Prism Central"

echo "=== T3 Domain Managers Collected ==="
grep -c "v4_domain_managers" server/prism/collect.js server/prism/projection.js
```

**Résultats attendus :**
- T1 : `12 pass`, `0 fail`.
- T2 : `2 pass`, `0 fail` (faux Prism : quatre sections remplies, placées après « Vue d'ensemble », présentes dans le .docx ; jeu `lab` : scale-out 3 VM, plages d'IP, dotation du domain-manager, titre EN ; PC ancien : nom et version dits, ressources « Non collecté — v4_domain_managers »).
- T3 : `1` pour chaque fichier.

### Validation réelle sur le lab (à jouer par Julien)

```bash
echo "=== Start The App With A Raw Dump ==="
cd /srv/dev/ultimate-ntnx-asbuilt
DUMP=/tmp/collecte-lab.json ASBUILT_TIMEOUT_S=120 npm start
```

**Résultats attendus :**
- Le journal de l'étape 3 ne cite pas `v4_domain_managers`.
- Chapitre « Prism Central », après « Vue d'ensemble » : Informations (nom, FQDN, version, taille,
  « Une VM », cluster hôte NTNX-LAB-1), Adressage (192.168.84.201, IP de la VM, DNS, NTP),
  CPU et mémoire (la VM du PC avec ses vCPU et sa RAM), Versions (Prism Central 7.6.0.6 et composants LCM).

### Résultats joués et vérifiés

| Date | Test | Attendu | Observé | Verdict |
|------|------|---------|---------|---------|
| 2026-11-17 | Auto-check exécuteur : suite complète | 12 pass, 0 fail | 12 pass, 0 fail, 250 assertions | ✅ |
| 2026-11-17 | T1-T3 (vérificateur indépendant, sous-agent) | 12 pass ; 2 pass ; 1 et 1 | 12 pass, 250 assertions ; 2 pass, 31 assertions ; 1 et 1 ; aucun champ secret lu, ordre conforme | ✅ PASS |
| 2026-11-17 | Lab, premier passage (Julien) | quatre sections remplies | sections présentes, CPU et mémoire (VM du PC, 6 vCPU, 28 Go) et versions LCM conformes ; `v4_domain_managers` en 404 → FQDN, taille, cluster hôte, disque absents | ❌ |
| 2026-11-17 | Correction : chemin domain-managers | `/config/domain-managers`, sans pagination, sans identifiants | chemin vérifié dans la spec officielle prism v4.0 à v4.3 ; `credentials` et `bootstrapConfig` retirés du bundle ; test : aucun mot de passe dans le JSON | ✅ |
| 2026-11-17 | Lab : tableaux clé/valeur | pas de ligne d'en-tête | la première paire était habillée en en-tête (`tblLook firstRow` sur tous les tableaux) : corrigé dans `exportAsBuiltDocx.js`, test qui échoue sur l'ancien code | ✅ |
| 2026-11-17 | Lab : versions | une ligne par composant | « PC » (LCM) répétait « Prism Central » : retiré | ✅ |
| 2026-11-17 | Lab, second passage (Julien) | journal sans `v4_domain_managers` ; FQDN, taille, cluster hôte, disque remplis ; kv sans en-tête | conformes | ✅ |
| 2026-11-17 | Lab, second passage : en-têtes des tableaux (Julien) | lisibles | demande : texte d'en-tête en blanc | ❌ |
| 2026-11-17 | Correction : en-têtes en blanc | texte blanc sur la trame violette | le style de tableau du template met bien `FFFFFF`, mais la couleur de « Normal » (`1F1F24`) passe devant dans Word. Style de paragraphe `AsBuiltTableHeader` (blanc, gras, centré) ajouté au template, posé sur les cellules d'en-tête ; test : 21 en-têtes stylés, style blanc présent ; échoue sur l'ancien code ; suite 12 pass, 258 assertions | ✅ |
| 2026-11-17 | Lab, troisième passage : en-têtes en blanc (Julien) | texte d'en-tête blanc | conforme | ✅ |

## Journal de session

### Session 2026-11-17
- ✅ Fait : cadrage, création du plan et de l'issue #10.
- ✅ Fait : étapes 1-3 — collecteur `v4_domain_managers`, quatre sections, faux Prism, jeu `lab` et deux tests.
- ✅ Fait : vérification indépendante (PASS).
- ✅ Fait : premier passage lab ; chemin domain-managers, en-tête des tableaux clé/valeur et doublon « PC » corrigés.
- ✅ Fait : second passage lab conforme.
- ✅ Fait : en-têtes de tableaux en blanc (style `AsBuiltTableHeader` du template).
- ✅ Validation : tests et passages lab conformes ; plan clôturé le 2026-11-17.
