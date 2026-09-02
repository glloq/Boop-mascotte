/** ProjectDocument-only command boundary for authored Timeline edits. */
export function createTimelineCommands(store, history) {
  function mutate(type, apply) {
    history.snapshot();
    let result;
    store.mutateDocument({
      type: `animation/${type}`,
      domains: ['animation'],
      source: 'timeline',
      apply(document) { result = apply(document); }
    });
    return result;
  }

  return {
    mutate,
    create: apply => mutate('create', apply),
    rename: apply => mutate('rename', apply),
    duplicate: apply => mutate('duplicate', apply),
    remove: apply => mutate('remove', apply),
    setDuration: apply => mutate('set-duration', apply),
    setLoop: apply => mutate('set-loop', apply),
    addTrack: apply => mutate('add-track', apply),
    removeTrack: apply => mutate('remove-track', apply),
    editKeys: apply => mutate('edit-keys', apply),
    pasteKeys: apply => mutate('paste-keys', apply),
    autoKey: apply => mutate('auto-key', apply)
  };
}
