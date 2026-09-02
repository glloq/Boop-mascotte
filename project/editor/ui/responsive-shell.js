// Responsive shell (UX-19): the composition changes with the viewport, not
// the product. Desktop keeps two panels; tablet and mobile get a navigation
// drawer and one contextual bottom sheet with detents, never both overlays at
// once. State is session-only UI preference; ProjectDocument never sees it.
export const LAYOUTS = Object.freeze(['desktop', 'tablet', 'mobile']);
export const SHEET_DETENTS = Object.freeze(['collapsed', 'half', 'full']);

export function layoutForWidth(width) { return width < 600 ? 'mobile' : width < 900 ? 'tablet' : 'desktop'; }

export function createResponsiveShell(root, { matchMedia = globalThis.matchMedia?.bind(globalThis), width = () => globalThis.innerWidth || 1280, onChange = () => {} } = {}) {
  let drawerOpen = false, sheet = 'collapsed', layout = layoutForWidth(width());
  const sync = () => {
    root.dataset.layout = layout;
    root.classList.toggle('drawer-open', drawerOpen && layout !== 'desktop');
    root.dataset.sheet = layout === 'desktop' ? 'pinned' : sheet;
    onChange({ layout, drawerOpen: drawerOpen && layout !== 'desktop', sheet: root.dataset.sheet });
  };
  const queries = matchMedia ? [matchMedia('(max-width: 599px)'), matchMedia('(max-width: 899px)')] : [];
  const relayout = () => { const next = layoutForWidth(width()); if (next !== layout) { layout = next; if (layout === 'desktop') { drawerOpen = false; } sync(); } };
  for (const query of queries) query.addEventListener?.('change', relayout);
  const api = {
    get layout() { return layout; },
    isCompact: () => layout !== 'desktop',
    isDrawerOpen: () => drawerOpen && layout !== 'desktop',
    getSheet: () => (layout === 'desktop' ? 'pinned' : sheet),
    openDrawer() { if (layout === 'desktop') return false; drawerOpen = true; sheet = 'collapsed'; sync(); return true; },
    closeDrawer() { if (!drawerOpen) return false; drawerOpen = false; sync(); return true; },
    toggleDrawer() { return api.isDrawerOpen() ? api.closeDrawer() : api.openDrawer(); },
    setSheet(detent) { if (!SHEET_DETENTS.includes(detent)) return false; sheet = detent; if (detent !== 'collapsed') drawerOpen = false; sync(); return true; },
    /** A deep link or selection wants the Inspector: raise the sheet, close the drawer. */
    revealInspector() { if (layout === 'desktop') return false; if (sheet === 'collapsed') sheet = 'half'; drawerOpen = false; sync(); return true; },
    /** Escape / Back closes the topmost surface first: drawer, then an expanded sheet. */
    closeTopmost() { if (layout === 'desktop') return false; if (drawerOpen) { drawerOpen = false; sync(); return true; } if (sheet !== 'collapsed') { sheet = 'collapsed'; sync(); return true; } return false; },
    relayout,
    snapshot: () => ({ layout, drawerOpen: api.isDrawerOpen(), sheet: api.getSheet() })
  };
  sync();
  return api;
}
