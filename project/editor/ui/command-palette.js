const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/**
 * Command palette (UX-18): a modal search over the command registry. Query
 * and selection live only while the dialog is open; runs go through the
 * registry's scope rule, so disabled items explain themselves and never run.
 */
export function createCommandPalette(host, registry, { context = () => ({}), onStatus = () => {} } = {}) {
  let query = '', selected = 0, results = [];
  const input = () => host.querySelector('[data-palette-input]');
  const canOpen = () => ![...document.querySelectorAll('dialog[open]')].some((dialog) => dialog !== host);

  function renderResults() {
    results = registry.search(query, context());
    if (selected >= results.length) selected = Math.max(0, results.length - 1);
    const list = host.querySelector('[data-palette-results]');
    list.innerHTML = results.length ? results.map((item, index) => `<li role="option" id="palette-option-${index}" data-palette-result="${esc(item.id)}" data-palette-enabled="${item.enabled}" aria-selected="${index === selected}" aria-disabled="${!item.enabled}"><span class="palette-group">${esc(item.group)}</span><span class="palette-title">${esc(item.title)}${item.subtitle ? `<small>${esc(item.subtitle)}</small>` : ''}</span>${item.enabled ? (item.shortcut ? `<kbd>${esc(item.shortcut)}</kbd>` : '') : `<small class="palette-reason">${esc(item.reason)}</small>`}</li>`).join('') : `<li class="palette-empty" data-palette-empty>Nothing matches “${esc(query)}”.</li>`;
    input()?.setAttribute('aria-activedescendant', results.length ? `palette-option-${selected}` : '');
    const hint = host.querySelector('[data-palette-hint]');
    if (hint) hint.textContent = results[selected]?.enabled === false ? results[selected].reason : '↑↓ to choose · Enter to run · Esc to close';
  }
  function render() {
    host.innerHTML = `<form data-palette-form><input type="text" data-palette-input aria-label="Search actions and items" placeholder="Type an action or a name (Happy, Nod, Export…)" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="palette-results" value="${esc(query)}"><ol id="palette-results" role="listbox" data-palette-results aria-label="Results"></ol><p class="small" data-palette-hint></p></form>`;
    renderResults();
  }
  function runSelected(id = results[selected]?.id) {
    if (!id) return;
    const outcome = registry.run(id, context());
    if (!outcome.ok) { onStatus(outcome.reason, 'warn'); const hint = host.querySelector('[data-palette-hint]'); if (hint) hint.textContent = outcome.reason; return; }
    close();
  }
  function open() {
    if (!canOpen()) { onStatus('Close the open dialog first.', 'warn'); return false; }
    query = ''; selected = 0;
    render();
    if (!host.open) host.showModal();
    input()?.focus();
    return true;
  }
  function close() { if (host.open) host.close(); query = ''; selected = 0; }

  host.addEventListener('submit', (event) => { event.preventDefault(); runSelected(); });
  host.addEventListener('input', (event) => { if (event.target.dataset.paletteInput === undefined) return; query = event.target.value; selected = 0; renderResults(); });
  host.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { if (!results.length) return; event.preventDefault(); selected = (selected + (event.key === 'ArrowDown' ? 1 : results.length - 1)) % results.length; renderResults(); }
    if (event.key === 'Escape') { event.preventDefault(); close(); }
  });
  host.addEventListener('click', (event) => { const option = event.target.closest('[data-palette-result]'); if (option) runSelected(option.dataset.paletteResult); else if (event.target === host) close(); });
  host.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
  host.addEventListener('close', () => { query = ''; selected = 0; });
  return { open, close, isOpen: () => Boolean(host.open), snapshot: () => ({ open: Boolean(host.open), query, selected, results: results.map(({ id, enabled, reason }) => ({ id, enabled, reason })) }) };
}
