// « Sans retouche » : ce que la collecte n'a pas rendu sort du document au lieu d'y laisser un
// « Non collecté » à effacer à la main. Le journal de collecte, en annexe, dit toujours ce qui a manqué.
// Une section lue mais vide (« Non configuré ») reste : c'est un fait sur la plateforme, pas un manque.
export function cleanModel(model) {
  const has = (v) => v != null && v !== '';
  return {
    ...model,
    sections: model.sections
      .map(s => (s.kind === 'kv' ? { ...s, rows: s.rows.filter(r => has(r.value)) } : s))
      .filter(s => !(s.empty && s.emptyKind === 'uncollected') && !(s.kind === 'kv' && !s.rows.length && !s.empty)),
  };
}
