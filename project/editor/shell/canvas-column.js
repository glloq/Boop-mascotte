/**
 * The canvas and the two bars over it: the vector tools, and the view.
 *
 * The canvas is the one surface every screen shares (§5, Règle A), so what sits
 * on top of it belongs to the shell rather than to any workspace.
 *
 * **Behavior is the exception, and it is declared here rather than hidden in a
 * workspace** (docs/BEHAVIOR_STUDIO.md): on that one workspace the mascot is
 * not the subject — *when* it moves is — so the board takes the column and the
 * mascot becomes a stage docked in its corner, at Off / Small / Large. It is
 * still the same `#canvas`: the preview controller draws into it exactly as it
 * does everywhere else, and nothing about the runtime knows this happened.
 */

/**
 * The Behavior studio's two hosts: the board, and the table under it.
 *
 * They sit in the canvas column's own grid cell, beside `#canvas` rather than
 * inside it, and the stylesheet shows them on `data-workspace=reactions` only.
 */
export const behaviorStudioMarkup = () => `<div class="behavior-studio" data-behavior-studio>
      <div id="behavior-board" class="behavior-board-host" data-behavior-board></div>
      <div id="behavior-table" class="behavior-table-host"></div>
    </div>`;
export const canvasColumnMarkup = () => `<div class="canvas-column"><div class="canvas-tools"><div class="design-toolbar" role="toolbar" aria-label="Vector tools"><button data-design-tool="select" aria-label="Select" class="active" title="Select (V)">↖ <span>Select</span></button><button data-design-tool="node" aria-label="Node" title="Edit points and curve handles (N)">◇ <span>Node</span></button><button data-design-tool="pen" aria-label="Pen" title="Pen: click for corners, drag for curves (P)">✒ <span>Pen</span></button><button data-design-tool="line" aria-label="Line" title="Line (L)">╱ <span>Line</span></button><button data-design-tool="rect" aria-label="Rectangle" title="Rectangle (R)">□ <span>Rectangle</span></button><button data-design-tool="ellipse" aria-label="Ellipse" title="Ellipse (O)">○ <span>Ellipse</span></button><button data-design-tool="polygon" aria-label="Polygon" title="Polygon or star (S)">⬠ <span>Polygon</span></button><button data-design-tool="text" aria-label="Text" title="Text (T)">T <span>Text</span></button><button data-design-tool="hand" aria-label="Hand" title="Pan (H)">✋ <span>Hand</span></button></div><div id="artwork-scope" class="artwork-scope" aria-live="polite" hidden></div><div id="tool-options" class="tool-options" aria-label="Tool options" hidden></div><div class="canvas-toolbar" aria-label="Canvas view"><button data-puppet-toggle aria-pressed="true" title="Handles on the mascot: drag the face to pose it">✋ Handles</button><button data-zoom="fit">Fit</button><button data-zoom="selection" title="Fill the view with what is selected (Shift+F)" aria-label="Zoom to selection" hidden>Selection</button><button data-zoom="reset" id="zoom-value">100%</button><button data-zoom="out" aria-label="Zoom out">−</button><button data-zoom="in" aria-label="Zoom in">+</button></div></div><section id="canvas" tabindex="-1"></section>${behaviorStudioMarkup()}</div>`;

export function wireCanvasColumn({ root, q, qAll, preferences, savePreferences }) {
  let zoom = 1, designTool = 'select';
  let canvasViewHandler = () => 1, designToolHandler = () => {}, puppetToggleHandler = null;

  const setZoomValue = (value) => { zoom = Number(value) || 1; q('#zoom-value').textContent = `${Math.round(zoom * 100)}%`; };
  q('.canvas-toolbar').onclick = (event) => { const action = event.target.dataset.zoom; if (!action) return; zoom = canvasViewHandler(action); setZoomValue(zoom); };
  q('.design-toolbar').onclick = (event) => {
    const button = event.target.closest('[data-design-tool]'); if (!button) return;
    qAll('[data-design-tool]').forEach((item) => item.classList.toggle('active', item === button));
    designToolHandler(button.dataset.designTool);
  };

  /** Handles on the mascot: on unless the author turned them off. */
  const syncPuppetToggle = () => {
    const button = q('[data-puppet-toggle]'), on = !preferences.puppetHidden;
    button.setAttribute('aria-pressed', String(on));
    button.classList.toggle('active', on);
    button.title = on ? 'Hide the handles on the mascot' : 'Show handles on the mascot: drag the face to pose it';
  };
  q('[data-puppet-toggle]').onclick = () => { preferences.puppetHidden = !preferences.puppetHidden; syncPuppetToggle(); savePreferences(); puppetToggleHandler?.(!preferences.puppetHidden); };
  syncPuppetToggle();

  return {
    canvasEl: q('#canvas'),
    behaviorBoardEl: q('#behavior-board'),
    behaviorTableEl: q('#behavior-table'),
    /**
     * How much of the column the mascot keeps on Behavior. Read by the
     * stylesheet from the root, remembered for the session like every other
     * thing about how wide a panel is.
     */
    setBoardStage(id) {
      const stage = ['off', 'small', 'large'].includes(id) ? id : 'small';
      root.dataset.boardStage = stage;
      preferences.boardStage = stage;
      savePreferences();
      return stage;
    },
    getBoardStage: () => (['off', 'small', 'large'].includes(preferences.boardStage) ? preferences.boardStage : 'small'),
    /**
     * What the vector tools are open on, over the canvas (UIR-06).
     *
     * It is the one place that says which of a hand's states an author is
     * inside, so it is also the way back out of one.
     */
    setArtworkScope(markup) { const host = q('#artwork-scope'); host.innerHTML = markup || ''; host.hidden = !markup; },
    bindArtworkScopeBack(handler) { q('#artwork-scope').addEventListener('click', (event) => { const mode = event.target.closest('[data-artwork-scope-back]')?.dataset.artworkScopeBack; if (mode) handler(mode); }); },
    /** The zoom readout, for a zoom that did not come from the toolbar (wheel, fit). */
    setZoomValue,
    bindCanvasView(handler) { canvasViewHandler = handler; },
    /** *Selection* is offered only while there is one to zoom to. */
    setZoomToSelection(available) { q('[data-zoom="selection"]').hidden = !available; },
    bindDesignTools(handler) { designToolHandler = handler; },
    setDesignTool(tool) {
      designTool = tool; root.dataset.canvasTool = tool;
      qAll('[data-design-tool]').forEach((item) => { const active = item.dataset.designTool === tool; item.classList.toggle('active', active); item.setAttribute('aria-pressed', String(active)); });
    },
    /** Which vector tool is chosen, so Escape can leave it. */
    getDesignTool() { return designTool; },
    bindPuppetToggle(handler) { puppetToggleHandler = handler; },
    isPuppetVisible: () => !preferences.puppetHidden
  };
}
