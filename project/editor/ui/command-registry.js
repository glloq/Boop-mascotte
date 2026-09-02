// Command registry (UX-18): one place that knows every action and every
// searchable item, with a scope rule (enabled + reason) so nothing runs while
// unsafe. Static commands are registered once; entity indexes are rebuilt on
// each search from the current context. Search state is never persisted.
export const GROUP_ORDER = Object.freeze(['Go to', 'Actions', 'Expressions', 'Motions', 'Reactions', 'Face parts', 'States', 'Artwork', 'Advanced']);

const normalize = (value) => String(value ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const groupRank = (group) => { const index = GROUP_ORDER.indexOf(group); return index < 0 ? GROUP_ORDER.length : index; };

function score(item, query) {
  if (!query) return 1;
  const title = normalize(item.title), words = title.split(/[\s·/]+/);
  if (title === query) return 100;
  if (title.startsWith(query)) return 60;
  if (words.some((word) => word.startsWith(query))) return 40;
  if (title.includes(query)) return 25;
  if ((item.keywords || []).some((keyword) => normalize(keyword).startsWith(query))) return 20;
  if ((item.keywords || []).some((keyword) => normalize(keyword).includes(query))) return 10;
  if (normalize(item.subtitle).includes(query)) return 5;
  return 0;
}

export function createCommandRegistry() {
  const commands = new Map();
  const indexes = [];
  const complete = (item) => ({ group: 'Actions', keywords: [], subtitle: '', shortcut: null, enabled: () => ({ ok: true }), ...item });
  return {
    register(command) {
      if (!command?.id || !command.title || typeof command.run !== 'function') throw new Error('A command needs an id, a title and a run function.');
      if (commands.has(command.id)) throw new Error(`Command "${command.id}" is already registered.`);
      commands.set(command.id, complete(command));
      return command.id;
    },
    /** `build(context)` returns command-like items derived from the project (expressions, motions…). */
    registerIndex(build) { if (typeof build !== 'function') throw new Error('An index needs a build function.'); indexes.push(build); },
    list(context = {}) {
      const seen = new Set(), all = [];
      for (const item of [...commands.values(), ...indexes.flatMap((build) => build(context) || []).map(complete)]) { if (seen.has(item.id)) continue; seen.add(item.id); all.push(item); }
      return all;
    },
    search(query = '', context = {}, { limit = 14 } = {}) {
      const needle = normalize(query);
      return this.list(context)
        .map((item) => ({ item, score: score(item, needle) }))
        .filter(({ score: value }) => value > 0)
        .sort((a, b) => b.score - a.score || groupRank(a.item.group) - groupRank(b.item.group) || a.item.title.localeCompare(b.item.title))
        .slice(0, limit)
        .map(({ item }) => { const state = item.enabled(context) || { ok: true }; return { id: item.id, title: item.title, group: item.group, subtitle: item.subtitle, shortcut: item.shortcut, enabled: Boolean(state.ok), reason: state.ok ? null : state.reason || 'Not available right now.' }; });
    },
    run(id, context = {}) {
      const item = this.list(context).find((entry) => entry.id === id);
      if (!item) return { ok: false, reason: `Unknown command "${id}".` };
      const state = item.enabled(context) || { ok: true };
      if (!state.ok) return { ok: false, reason: state.reason || 'Not available right now.' };
      item.run(context);
      return { ok: true };
    }
  };
}
