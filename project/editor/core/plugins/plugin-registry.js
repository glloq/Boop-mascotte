export function createPluginRegistry() {
  const plugins = new Map();
  const enabled = new Map();

  return {
    register(plugin) {
      plugins.set(plugin.type, plugin);
      if (!enabled.has(plugin.type)) enabled.set(plugin.type, true);
    },
    setEnabled(type, value) {
      if (!plugins.has(type)) return;
      enabled.set(type, Boolean(value));
    },
    isEnabled(type) {
      return enabled.get(type) !== false;
    },
    getByNode(node) {
      const plugin = plugins.get(node.type);
      if (plugin && enabled.get(node.type) !== false) return plugin;
      return plugins.get('default');
    },
    list() {
      return [...plugins.keys()].map((type) => ({ type, enabled: enabled.get(type) !== false }));
    }
  };
}
