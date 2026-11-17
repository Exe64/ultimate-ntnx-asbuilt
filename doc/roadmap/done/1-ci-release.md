---
plan:
  id: '1'
  name: 1-ci-release.md
  link: https://github.com/Exe64/ultimate-ntnx-asbuilt/blob/main/doc/roadmap/done/1-ci-release.md
status: done
date: 2026-10-12
description: >
  Tout push est testé ; tout tag v* produit une release GitHub avec les cinq
  exécutables. Pas de signature.
priority: high
complexity: S
intent: null
scope:
  modules:
    - .github/workflows/
    - scripts/build.js
    - README.md
issue:
  id: 1
  url: https://github.com/Exe64/ultimate-ntnx-asbuilt/issues/1
---

# [🚀] Plan #1 - CI de tests et release des exécutables sur tag

## Objectif

Aujourd'hui `dist/` est ignoré par git et aucune release n'existe : personne ne peut utiliser
l'outil sans cloner et builder. Tout push doit être testé, et tout tag `v*` doit publier les
cinq exécutables en release du dépôt.

## Périmètre

### Inclus
- Workflow GitHub Actions de tests (push et pull request).
- Workflow de release sur tag `v*` : `npm run build`, publication des cinq exécutables.
- README : où télécharger l'exécutable.

### Hors scope
- Notarisation macOS et signature Windows.
- Publication ailleurs que sur les releases GitHub.

## Étapes

- [x] Étape 1 — Workflow de tests à chaque push et pull request (S · standard → Sonnet)
- [x] Étape 2 — Workflow de release sur tag `v*` : build et publication des cinq exécutables (S · standard → Sonnet)
- [x] Étape 3 — README : où télécharger l'exécutable (XS · standard → Sonnet)
- [x] 🧪 Tests — Rédiger et exécuter la procédure de test (avant-dernière étape, obligatoire)
- [x] ✅ Validation — Vérifier les résultats des tests et clôturer (dernière étape, obligatoire)

## Décisions techniques

| Décision | Choix retenu | Justification |
|----------|-------------|---------------|
| Déclencheur de release | Tag `v*` | Décision de cadrage du 2026-10-12 |
| Signature | Aucune | Demande un compte développeur Apple et un certificat ; hors périmètre |
| Build multi-plateforme | Un seul runner Linux | `bun build --compile --target` compile les cinq cibles depuis une machine |

## Tests

### Prérequis pour les tests

```bash
echo "=== Go To Project ==="
cd /srv/dev/ultimate-ntnx-asbuilt

echo "=== Check GitHub Auth ==="
gh auth status
```

### Procédure de test

```bash
echo "=== T1 Latest CI Run On Main Is Green And Skips Release ==="
gh run list --branch main --workflow CI --limit 1 --json conclusion,headSha

echo "=== T2 Tag Run Tested Then Released ==="
gh run list --branch v0.1.0 --workflow CI --limit 1 --json databaseId,conclusion
gh run view $(gh run list --branch v0.1.0 --workflow CI --limit 1 --json databaseId --jq '.[0].databaseId') --json jobs --jq '[.jobs[] | {name, conclusion}]'

echo "=== T3 Release Carries The Five Executables ==="
gh release view v0.1.0 --json isDraft,assets --jq '{isDraft, assets: [.assets[].name]}'

echo "=== T4 Downloaded Linux Executable Serves The Page ==="
rm -rf /tmp/asbuilt-rel && mkdir -p /tmp/asbuilt-rel
gh release download v0.1.0 --pattern ultimate-asbuilt-linux-x64 --dir /tmp/asbuilt-rel
chmod +x /tmp/asbuilt-rel/ultimate-asbuilt-linux-x64
(PORT=18440 NO_OPEN=1 timeout 6 /tmp/asbuilt-rel/ultimate-asbuilt-linux-x64 >/dev/null 2>&1 &) ; sleep 2 ; curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:18440/

echo "=== T5 README Points To The Releases ==="
grep -c "releases/latest" README.md
```

**Résultats attendus :**
- T1 : `conclusion` = `success`.
- T2 : run `success` ; job `test` = `success`, job `release` = `success`.
- T3 : `isDraft` = `false` ; cinq fichiers : `ultimate-asbuilt-linux-arm64`, `-linux-x64`, `-macos-arm64`, `-macos-intel`, `-windows-x64.exe`.
- T4 : `200`.
- T5 : `1`.

### Résultats joués et vérifiés

| Date | Test | Attendu | Observé | Verdict |
|------|------|---------|---------|---------|
| 2026-10-12 | T1 CI sur main | `success` | `success` (run 38310389677 : `test` success, `release` skipped) | ✅ |
| 2026-10-12 | T2 run du tag v0.1.0 | `test` et `release` en `success` | les deux en `success` (run 38310448448) | ✅ |
| 2026-10-12 | T3 release v0.1.0 | publiée, cinq exécutables | `isDraft: false`, cinq fichiers attendus | ✅ |
| 2026-10-12 | T4 exécutable Linux téléchargé | `200` | `200` | ✅ |
| 2026-10-12 | T5 README | `1` | `1` | ✅ |

Verdict du vérificateur indépendant (sous-agent, 2026-10-12) : **PASS**. Sa remarque : T1 tel qu'écrit ne
vérifie pas que `release` est ignoré hors tag ; ce point a été observé par l'exécuteur sur le run 38310389677.

## Journal de session

### Session 2026-10-12
- ✅ Fait : cadrage, création du plan et de l'issue #1.
- ✅ Fait : étapes 1 à 3 (workflow `ci.yml`, README), tag `v0.1.0` poussé, release publiée.
- ✅ Clôture 2026-10-12 : CI de tests à chaque push ; release v0.1.0 publiée avec les cinq exécutables depuis un tag.
