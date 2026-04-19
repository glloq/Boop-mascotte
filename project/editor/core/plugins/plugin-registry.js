export function createPluginRegistry() {
  const plugins = new Map();

  return {
    register(plugin) {
      plugins.set(plugin.type, plugin);
    },
    getByNode(node) {
      return plugins.get(node.type) || plugins.get('default');
    },
    list() {
      return [...plugins.keys()];
    }
  };
}
