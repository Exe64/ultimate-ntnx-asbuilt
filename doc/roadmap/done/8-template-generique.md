---
plan:
  id: '8'
  name: 8-template-generique.md
  link: https://github.com/Exe64/ultimate-ntnx-asbuilt/blob/main/doc/roadmap/done/8-template-generique.md
status: done
date: 2026-11-16
enriched: 2026-11-17
description: >
  Le template Word livré et le code ne portent plus aucune trace de l'ancienne charte :
  palette bleu-gris sobre, police Aptos, sans logo ni métadonnées du tenant.
priority: medium
complexity: M
intent: null
scope:
  modules:
    - assets/asbuilt-default.docx
    - engine/i18n.dict.js
    - engine/asbuilt/sections.js
    - tests/asbuilt.test.js
issue:
  id: 8
  url: https://github.com/Exe64/ultimate-ntnx-asbuilt/issues/8
---

# [🎨] Plan #8 - Template générique

## Objectif

Le template Word livré vient d'une ancienne charte d'entreprise (logos, navy/magenta/jaune, Poppins
intégrée, étiquette MSIP du tenant, métadonnées SharePoint). L'outil doit servir à n'importe
quel intégrateur : le template et le code deviennent neutres.

## Périmètre

### Inclus
- `assets/asbuilt-default.docx` nettoyé en gardant sa mise en page : couverture, sommaire,
  styles, `AsBuiltTable`, marqueurs `{{…}}`.
- Chaînes de marque mortes de `engine/i18n.dict.js`, commentaire de `engine/asbuilt/sections.js`,
  exemple d'intégrateur du test.

### Hors scope
- Le champ « Intégrateur » de la page (déjà générique).
- Les binaires de `dist/` : reconstruits à la prochaine release.
- Une refonte de la mise en page du template.

## Étapes

- [x] Étape 1 — Nettoyer `asbuilt-default.docx` : retirer images des en-têtes/pieds, texte de marque, polices intégrées, `customXml`, `docMetadata`, propriétés MSIP/SharePoint ; thème et couleurs en dur passés en bleu-gris sobre + Aptos ; auteur et nom de modèle vidés (M · standard → Sonnet)
- [x] Étape 2 — Retirer les chaînes de marque mortes de `i18n.dict.js`, reformuler le commentaire de `sections.js:44`, intégrateur fictif à initiale voyelle dans le test (XS · standard → Sonnet)
- [x] Étape 3 — Image de fond pleine page en couverture : allée de datacenter générée (sans logo ni texte), compressée en JPEG (~390 Ko), placée entre le fond sombre et les coins (S · standard → Sonnet)
- [x] Étape 4 — Refonte après retour visuel : palette violet Nutanix `7855FA` (principal) + ancien vert Nutanix `B0D235` (accent) + anthracite `1F1F24` ; couverture claire avec l'image en bandeau pleine largeur en haut (~10,6 cm), liseré vert dessous, texte sur fond blanc ; voile, coins et barre dégradée supprimés (M · standard → Sonnet)
- [x] 🧪 Tests — Rédiger et exécuter la procédure de test (avant-dernière étape, obligatoire)
- [x] ✅ Validation — Vérifier les résultats des tests et clôturer (dernière étape, obligatoire)

## Décisions techniques

| Décision | Choix retenu | Justification |
|----------|-------------|---------------|
| Approche template | Nettoyer l'existant plutôt que repartir de zéro | Garde la mise en page et les styles déjà validés |
| Identité visuelle | ~~Bleu-gris sobre~~ → violet Nutanix + ancien vert Nutanix, anthracite, Aptos | Le bleu-gris n'a pas convaincu à l'usage ; les couleurs de l'éditeur documenté restent neutres vis-à-vis de l'intégrateur |
| Couverture | ~~Image plein page sous voile~~ → ~~colonne image à gauche~~ → bandeau image en haut (hauteur doublée à ~21 cm sur demande), texte sur fond blanc, date regroupée avec le client faute de place | Lisibilité garantie quel que soit le visuel, imprimable |
| Reproductibilité | Template reconstruit depuis le .docx d'origine (`84de4cf`) par deux scripts jetables | Évite d'empiler des remplacements de couleurs ambigus |

## Tests

### Prérequis pour les tests

```bash
cd /srv/dev/ultimate-ntnx-asbuilt
D=$(mktemp -d) && unzip -q assets/asbuilt-default.docx -d "$D"
```

### Procédure de test

| Test | Commande | Attendu |
|---|---|---|
| T1 Suite | `npx bun test` | 11 pass, 0 fail |
| T2 Dépôt | `git grep -nIi` de l'ancienne marque, hors `doc` et `graft` | aucune ligne |
| T3 Template | `grep -rliE 'poppins\|onedrive\|msip\|DA1984\|232D4B\|F5F340' "$D"` | aucun fichier ; ni `word/media`, `word/fonts`, `customXml`, `docMetadata` |
| T4 Contrat | `grep -c '{{corps}}' "$D/word/document.xml"` ; `grep -c 'w:styleId="AsBuiltTable"' "$D/word/styles.xml"` | 1 et 1 ; marqueurs `{{client}}`, `{{projet}}`, `{{prism_central}}`, `{{date}}` présents |
| T5 XML | parse `minidom` de chaque `.xml`/`.rels` | aucun fichier mal formé |
| T6 Relations | chaque `Target` interne des `.rels` existe | aucune cible manquante |
| T7 Taille | `ls -l assets/asbuilt-default.docx` | < 100 Ko (3,3 Mo avant) |
| Démo | as-built généré depuis la fixture MiddleEarth avec le nouveau template | aucune trace de marque, aucun `{{…}}` résiduel, pied de page `date \| client \| projet \| PC` |
| ✅ Visuel | ouvrir l'as-built généré dans Word | couverture sombre bleu-gris sans logo, sommaire, bandeau latéral, pied de page, tableaux `AsBuiltTable` lisibles |

### Résultats joués et vérifiés

| Date | Test | Attendu | Observé | Verdict |
|------|------|---------|---------|---------|
| 2026-11-16 | T1 Suite | 11 pass, 0 fail | 11 pass, 0 fail, 233 expect() | ✅ PASS |
| 2026-11-16 | T2 Dépôt | aucune ligne | aucune ligne | ✅ PASS |
| 2026-11-16 | T3 Template | aucune trace, dossiers absents | aucune trace ; `media`, `fonts`, `customXml`, `docMetadata` absents | ✅ PASS |
| 2026-11-16 | T4 Contrat | `{{corps}}` et `AsBuiltTable` présents une fois | 1 et 1 ; `{{prism_central}}` coupé en plusieurs morceaux par Word dans le pied de page (situation déjà présente avant ce plan), le moteur le remplace bien (voir Démo) | ✅ PASS |
| 2026-11-16 | T5 XML | aucun fichier mal formé | aucun | ✅ PASS |
| 2026-11-16 | T6 Relations | aucune cible manquante | 15 cibles, 0 manquante | ✅ PASS |
| 2026-11-16 | T7 Taille | < 100 Ko | 34 848 octets | ✅ PASS |
| 2026-11-16 | Démo | sans trace ni marqueur résiduel | aucune trace ; pied de page `date \| client \| Lab MiddleEarth \| 192.168.84.201` | ✅ PASS |
| 2026-11-16 | É3 Suite | 11 pass, 0 fail | 11 pass, 0 fail | ✅ PASS |
| 2026-11-16 | É3 Marque | aucune trace (template, dépôt, métadonnées JPEG) | aucune ; seul commentaire JPEG `Lavc61.3.100` (encodeur) | ✅ PASS |
| 2026-11-16 | É3 Image | un seul `media/cover.jpg`, ~1728×2464, < 500 Ko, relation et type déclarés | 399 605 octets, 1728×2464, `rIdCover` → `media/cover.jpg`, `image/jpeg` | ✅ PASS |
| 2026-11-16 | É3 XML / relations | bien formés, aucune cible manquante | conforme | ✅ PASS |
| 2026-11-16 | É3 Taille / contrat | < 600 Ko ; `{{corps}}` et `AsBuiltTable` présents | 430 175 octets ; 1 et 1 | ✅ PASS |
| 2026-11-16 | É3 Démo | image présente dans l'as-built généré | `word/media/cover.jpg` présent | ✅ PASS |
| 2026-11-16 | É4 Suite | 11 pass, 0 fail | 11 pass, 0 fail | ✅ PASS |
| 2026-11-16 | É4 Marque / ancienne palette | aucune trace (ancienne marque, bleu-gris) | aucune | ✅ PASS |
| 2026-11-16 | É4 Thème | dk1 `7855FA`, dk2 `1F1F24`, accent4 `B0D235`, accent6 et hlink `7855FA` | identique | ✅ PASS |
| 2026-11-16 | É4 Couverture | image `cover.jpg` en colonne 3024000×10692130 EMU recadrée, liseré `B0D235`, pied de couverture sans dessin | conforme | ✅ PASS |
| 2026-11-16 | É4 Texte de couverture | projet, client, date, sommaire, corps dans l'ordre ; marqueurs d'un seul tenant ; filet vert | conforme | ✅ PASS |
| 2026-11-16 | É4 Styles | titre `1F1F24` 28 pt, sous-titre `7855FA` 18 pt, `AsBuiltTable` `7855FA` / `F6F4FF`, Heading2 `7855FA` | conforme | ✅ PASS |
| 2026-11-16 | É4 XML / relations / espaces de noms | bien formés, 0 cible manquante | conforme, 16 cibles | ✅ PASS |
| 2026-11-16 | É4 Taille / contrat | < 600 Ko ; `{{corps}}` et `AsBuiltTable` présents | 422 229 octets ; 1 et 1 | ✅ PASS |
| 2026-11-16 | É4b Bandeau | image pleine largeur 7560310×3800000 EMU en haut, recadrage t 30 % / b 34,77 % sans déformation, liseré `B0D235` dessous | conforme ; écart de rapport 0,05 % | ✅ PASS |
| 2026-11-16 | É4b Texte / contrat / XML | ordre et marqueurs intacts, plus de retrait de colonne, 0 cible manquante, 11 pass | conforme ; 422 220 octets | ✅ PASS |
| 2026-11-16 | É4c Bandeau doublé | 7560310×7600000 EMU, recadrage t 12 % / b 17,51 % sans déformation, liseré à 7600000 | conforme ; écart de rapport 0,01 % | ✅ PASS |
| 2026-11-16 | É4c Tient sur la page | 2 paragraphes de couverture, texte sous le bandeau, budget vertical ≤ 15 420 twips | 15 037 twips (hypothèse prudente), reste ~0,7 cm | ✅ PASS |
| 2026-11-16 | É4c Suite / XML / contrat | 11 pass, paquet valide, `{{corps}}` et `AsBuiltTable` présents | conforme ; 422 217 octets | ✅ PASS |
| 2026-11-17 | ✅ Visuel Word | couverture et rendu validés | validé par l'opérateur (« impec ») | ✅ PASS |

Verdict rendu par un vérificateur indépendant (sous-agent sans accès au code) pour T1 à T7 ; la démo a été vérifiée par l'exécuteur.

## Journal de session

### Session 2026-11-16
- ✅ Fait : cadrage, création du plan et de l'issue #8.
- ✅ Fait : template nettoyé (3,3 Mo → 35 Ko). Logos, photo et logo vectoriel retirés, 4e de couverture supprimée, mention de copyright et classification retirées du pied de page, polices, MSIP, customXml et modèle OneDrive retirés, palette bleu-gris et Aptos. La couverture sombre et ses coins sont conservés, le bandeau latéral aussi. Côté code, chaînes mortes et exemple de test neutralisés.
- ✅ Fait : 🧪 tests T1 à T7 et démo passés.
- ✅ Fait : étape 3. Image de couverture ajoutée sous le voile noir, dont l'opacité passe de 40 à 20 % : sans photo, ce voile donnait une couverture grise. Tests rejoués par le vérificateur, tous PASS.
- 🚀 Release v0.2.0 publiée avec la couverture « image plein page » (étape 3).
- ✅ Fait : étape 4 après retour visuel négatif sur la couverture et les couleurs. Palette violet + vert Nutanix, couverture à colonne image (tests PASS), puis bascule sur la maquette « bandeau image en haut » à la demande (couleurs validées).
- ✅ Fait : commit `1adde49`, release v0.2.1 publiée ; anciennes releases et tags v0.1.0 / v0.2.0 supprimés à la demande.

### Session 2026-11-17
- ✅ Validation visuelle par l'opérateur, plan clôturé.
