# Contexte de session — règles absolues

> Noyau chargé au début de chaque session (≤ 200 lignes / 15 Ko). Notes thématiques : `context/*.md`.

- ⚠️ [#13] Electrobun lit `../Resources/version.json` relativement au répertoire courant (dossier de `bun.exe`) et garde le résultat : tout `process.chdir` doit venir après `Updater.getLocalInfo()`, sinon le canal lu est vide et aucune mise à jour n'est trouvée. Le smoke test CI le contrôle.
