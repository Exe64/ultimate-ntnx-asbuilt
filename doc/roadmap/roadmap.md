# Roadmap Ultimate As-Built

> Backlog actif. L'historique détaillé est archivé dans `_archives/`.
> Dernière mise à jour : 2026-11-27.

## Contexte

Backlog consolidé : plans nommés d'après leur issue GitHub (voir `doc/roadmap/`).
- « À faire » : travaux restants, triés par priorité.
- « Fait » : ce qui a été livré et validé.

---

## À faire

- **[Issue: #15] `#15` — Sauvegarde automatique avant une mise à jour** 🟢 medium · M — La collecte et les saisies survivent au redémarrage d'une mise à jour.
  [`15-sauvegarde-avant-mise-a-jour.md`](15-sauvegarde-avant-mise-a-jour.md)
- **[Issue: #16] `#16` — Comparaison de deux collectes** 🟢 medium · L — Rapport d'écarts .docx entre deux collectes exportées.
  [`16-comparaison-collectes.md`](16-comparaison-collectes.md)

---

## Fait

### Plans livrés (2026-10-12 → 2026-11-27)
- **[Issue: #1] `#1` — CI de tests et release des exécutables sur tag** (2026-10-12) 🔵 — CI de tests à chaque push ; release v0.1.0 publiée avec les cinq exécutables depuis un tag.
  [`1-ci-release.md`](done/1-ci-release.md)
- **[Issue: #2] `#2` — Tests du serveur et du template, correctif du téléchargement** (2026-10-12) 🔵 — Jeton, routes et contrôle du template couverts par quatre nouveaux tests ; URL de téléchargement révoquée après un délai.
  [`2-tests-serveur-template.md`](done/2-tests-serveur-template.md)
- **[Issue: #4] `#4` — Export / import de la collecte** (2026-10-12) 🔵 — Export de la collecte et des saisies en JSON sans identifiants, import sur page neuve avec rechargement du serveur, refus des fichiers invalides.
  [`4-export-import-collecte.md`](done/4-export-import-collecte.md)
- **[Issue: #8] `#8` — Template générique** (2026-11-17) 🔵 — Ancienne charte retirée du template et du code ; palette violet et vert Nutanix, couverture à bandeau image ; release v0.2.1.
  [`8-template-generique.md`](done/8-template-generique.md)
- **[Issue: #3] `#3` — Mise à jour du moteur** (2026-11-17) 🔵 — Moteur mis à jour avec apiCompat, code local adapté, script de synchro supprimé ; trois chemins de collecteurs corrigés ; lab validé (six schémas, chapitres Présentation / Prism Central / Sécurité).
  [`3-mise-a-jour-moteur.md`](done/3-mise-a-jour-moteur.md)
- **[Issue: #5] `#5` — Robustesse de collecte et avancement par cluster** (2026-11-17) 🔵 — Parallélisme borné, délai réglable, avancement par cluster ; un seul essai d'authentification avant la collecte (plus de verrouillage de compte) ; lab validé.
  [`5-robustesse-avancement.md`](done/5-robustesse-avancement.md)
- **[Issue: #10] `#10` — Fiche du Prism Central** (2026-11-17) 🔵 — Informations, adressage, CPU et mémoire, versions LCM du PC (API v4 domain-managers) ; tableaux clé/valeur sans en-tête, en-têtes en blanc ; lab validé.
  [`10-fiche-prism-central.md`](done/10-fiche-prism-central.md)
- **[Issue: #6] `#6` — Nouvelles sections du document** (2026-11-17) 🔵 — Syslog, proxy, certificat, chiffrement, images, Flow (politiques, VPC), Files, Objects, Volumes ; secrets retirés du bundle ; services non déployés en « Non configuré » ; lab validé. Witness reporté.
  [`6-nouvelles-sections.md`](done/6-nouvelles-sections.md)
- **[Issue: #7] `#7` — Interface bilingue** (2026-11-17) 🔵 — Page en français ou en anglais (langue du navigateur par défaut, mémorisée), bascule liée à la langue du document, messages du serveur traduits ; test de couverture des libellés.
  [`7-interface-bilingue.md`](done/7-interface-bilingue.md)
- **[Issue: #11] `#11` — Thème sombre et habillage de l'interface** (2026-11-17) 🔵 — Sombre par défaut avec bascule Clair ; en-tête à bannière fine et nouveau logo ; étapes, cartes, champs et états dans la palette du template ; contraste AA testé ; revue visuelle validée.
  [`11-theme-sombre-habillage.md`](done/11-theme-sombre-habillage.md)
- **[Issue: #12] `#12` — Pied de page, Ko-fi et nouveau nom** (2026-11-18) 🔵 — Pied de page (version, signature, © Tous droits réservés, non-affiliation Nutanix, liens GitHub et Blog selon la langue) ; bouton Ko-fi avec logo officiel ; application renommée « Ultimate As-Built Generator » (page, fenêtre, build, README).
  [`12-copyright-pied-de-page.md`](done/12-copyright-pied-de-page.md)
- **[Issue: #9] `#9` — Application desktop Windows (Electrobun)** (2026-11-18) 🔵 — Fenêtre native WebView2 sans console ni navigateur, fermer la fenêtre arrête le serveur ; installeur et exe portable à icône joints à la release (v0.2.2) ; validé sur Windows 11. « Bun » dans le Gestionnaire des tâches : cache Windows des prototypes, pas le binaire.
  [`9-app-desktop-windows.md`](done/9-app-desktop-windows.md)
- **[Issue: #13] `#13` — Mise à jour depuis l'application** (2026-11-18) 🔵 — Vérification au lancement (5 s, silencieuse hors ligne, `NO_UPDATE_CHECK=1`) ; application Windows : bandeau et mise à jour en un clic (Updater Electrobun, fichiers joints à la release) ; exécutables portables : lien vers la release ; journal `%TEMP%\ultimate-asbuilt-update.log` ; dépôt public ; validé sur Windows 11 (v0.3.2). Mise à jour automatique à partir de v0.3.2.
  [`13-mise-a-jour-application.md`](done/13-mise-a-jour-application.md)
- **[Issue: #14] `#14` — Pied de page : mention de licence** (2026-11-18) 🔵 — « © 2026 · Licence GPL-3.0 » avec lien vers `LICENSE`, à la place de « Tous droits réservés ».
  [`14-pied-de-page-licence.md`](done/14-pied-de-page-licence.md)
- **[Issue: #17] `#17` — As-built complet depuis le seul Prism Central** (2026-11-27) 🔵 — Document complet avec les seuls identifiants du PC (licences et conformité, CVM, NCC, ports, pools, SMTP, proxy, chiffrement, KMS, Pulse, alertes, recovery plans, SAML) ; étape Prism Element facultative avec bouton Passer, réservée à la HA, au nom et seuil ILM des pools, aux protection domains, à l'authentification du cluster et au vCPU des CVM ; ports v4 et adresses d'hôtes v4 corrigés ; lab pc.7.6 validé avec et sans PE.
  [`17-pe-optionnel-v4.md`](done/17-pe-optionnel-v4.md)
- **[Issue: #18] `#18` — As-built enrichi : réseau, placement des VM, matériel, accès** (2026-11-27) 🔵 — Bonds et uplinks, segmentation, règles de placement et ordre de démarrage des VM, blocs, résilience du stockage, sauvegarde du PC, LCM, droits d'accès (décochés), traps SNMP, liste blanche NFS ; `bmc-info` abandonné (aucune version) ; lab pc.7.6 validé.
  [`18-asbuilt-enrichi-v4.md`](done/18-asbuilt-enrichi-v4.md)
- **[Issue: #19] `#19` — Sections de contexte et compléments Prism Element v1** (2026-11-27) 🔵 — Chiffrement réel via le PE v1, Witness, support à distance, VM non protégées ; politiques de stockage, alertes personnalisées, STIG, Flow VN (seulement avec des VPC), catalogue, iSCSI, décochés par défaut ; lab validé, écarts spec / pc.7.6 corrigés ; v0.4.1.
  [`19-sections-contexte-pe-v1.md`](done/19-sections-contexte-pe-v1.md)

---

## Archivé
