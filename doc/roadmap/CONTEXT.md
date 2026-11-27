# Contexte de session — règles absolues

> Noyau chargé au début de chaque session (≤ 200 lignes / 15 Ko). Notes thématiques : `context/*.md`.

- ⚠️ [#13] Electrobun lit `../Resources/version.json` relativement au répertoire courant (dossier de `bun.exe`) et garde le résultat : tout `process.chdir` doit venir après `Updater.getLocalInfo()`, sinon le canal lu est vide et aucune mise à jour n'est trouvée. Le smoke test CI le contrôle.
- ⚠️ [#17] Sources : la v4 du Prism Central fait foi, la v1/v2 du Prism Element ne sert qu'en secours (champ absent, PC qui ne répond pas). Seuls la HA, le nom et le seuil ILM des pools et les protection domains hérités restent propres au PE. Une section qui lit les deux sources doit garder cet ordre.
- ⚠️ [#17] Sur pc.7.6, un hôte v4 désigne son cluster par `cluster.uuid` (pas `cluster.extId`), et `unversioned/info` répond 405 : apiCompat retombe sur v4.0, que le PC sert aussi pour les chemins plus récents (cvms, recovery-plans, licensing…). `numVcpus` des CVM v4 n'est pas fiable (1 pour 20 Gio).
- ⚠️ [#18] `scrub` ne retire que les clés `password|passphrase|secret|privatekey` : un secret nommé autrement (`communityString` des traps SNMP, `engineId`, `clientName` des politiques d'autorisation…) doit être écarté à la collecte, par un `pick` explicite des champs utiles.

