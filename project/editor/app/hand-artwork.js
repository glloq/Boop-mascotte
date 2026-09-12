/**
 * Putting hand artwork on the canvas, and rigging it (UIR-16).
 *
 * Five operations over one bargain: the artwork goes on the canvas first,
 * exactly as a face feature does, and the rig that follows is one command over
 * it, so one undo takes both back (docs/HAND_STYLES.md).
 *
 * They are their own module because they are nobody's screen. Design ▸ Hands
 * draws a state onto a hand, Rig ▸ Controls draws the pair in the first place,
 * and the canvas's own picker draws one the hand has not got yet — three
 * callers in two workspaces, which is exactly the shape that must not live
 * inside either of them (§16: what a hand is *drawn from* is Design, where it
 * *is* is Rig, and neither owns the other).
 */
import { addHandStyleCommand, addHandStylesCommand, addStyleHandsCommand, handStyleFrame, handStyleMarkupFor, handStylesMarkup, hasHandStyles, legacyHandPartIds, styleHandsMarkup } from '../core/hands/hand-style-install.js';
import { createHandCommands } from '../core/hands/hand-commands.js';
import { handsViewBox, installedHandLook } from '../core/sample/hand-feature.js';

/**
 * @param {object} deps
 * @param {object} deps.store
 * @param {object} deps.history
 * @param {object} deps.canvas
 * @param {(message: string, tone?: string) => void} deps.setStatus
 * @param {() => void} deps.applyPreview  the runtime redraws once the rig has moved
 */
export function createHandArtwork({ store, history, canvas, setStatus, applyPreview }) {
  /**
   * Draw a pair of hands rather than asking for an SVG of one
   * (docs/HAND_STYLES.md).
   *
   * The artwork goes onto the canvas first, exactly as a face feature does, and
   * the rig that follows is one command over it: one undo takes both back. A
   * new mascot has nothing to convert -- no six parts, no shape keys, no facing
   * axis -- because its hands are six whole drawings each from the start.
   */
  function drawHandPair(look){
    const before=store.getDocument();
    if(before.hands?.left||before.hands?.right)return false;
    try{
      // Measured once, before the pair is on the canvas: measuring afterwards
      // would include the hands in the body they are being placed around
      // (VNX-20). The same cache feeds the artwork and the rig, so the drawing
      // and the reach can never be computed from two different bodies.
      const measured=new Map();
      const placement={look,measure:(id)=>{if(!measured.has(id))measured.set(id,canvas.getElementBounds(id)||canvas.getArtworkBounds());return measured.get(id);}};
      const artwork=canvas.appendArtwork(styleHandsMarkup(before,placement),null,{updateStore:false,viewBox:handsViewBox(before,placement)});
      if(!artwork)return false;
      if(!addStyleHandsCommand(store,history,artwork,placement))return false;
      applyPreview();
      setStatus('Two hands drawn: six drawings each. Pick one beside the face, then move and turn the hand.');
      return true;
    }catch(error){
      canvas.loadSvgFromText(before.svgMarkup,before.layerMetadata,{recordHistory:false,updateStore:false});
      setStatus(`Could not draw the hands: ${error.message}`,'error');
      return false;
    }
  }
  /**
   * Wrap a hand drawn as one shape in a group of its own, and point the hand at
   * it (V3-11).
   *
   * A drawing rides *inside* the hand's group -- that is what makes a swap one
   * visibility and nothing else (docs/HAND_STYLES.md) -- so a hand whose
   * artwork is a single shape used to be turned away with "group this artwork
   * first". Grouping one shape is the editor's own one-liner, and a refusal
   * that names the fix the tool could have applied is a refusal for nothing.
   *
   * The caller holds the transaction, so the wrap and the drawings are one
   * undo step: a half-grouped hand is not a state to leave anyone in.
   */
  function groupHandArtwork(side){
    const element=store.getDocument().hands?.[side]?.element;
    if(!element||!canvas.group(element))return false;
    // `group` selects what it made, which is how the canvas reports the id it
    // generated; the hand has to follow the artwork it is now drawn by.
    const wrapped=store.getSession().selectedId;
    if(!wrapped||wrapped===element||store.getDocument().elements?.[wrapped]?.meta?.nodeType!=='g')return false;
    return createHandCommands(store,history).assign(side,{element:wrapped});
  }
  /**
   * Give a hand that still deforms its static drawings instead
   * (docs/HAND_STYLES.md, "Migration").
   *
   * The parts it used to deform are hidden rather than deleted -- a conversion
   * an author can undo by making them visible again is one they can try -- and
   * the drawings are appended *inside* the hand's own group, so the hand's
   * reach, anchor drift, turn and size carry them with nothing added. A hand
   * that has no group yet is given one first, in the same undo step.
   */
  function useHandStyles(side,{styles}={}){
    const start=store.getDocument();
    if(!start.hands?.[side]?.element){setStatus('Set the hand up first: choose its artwork, then give it drawings.','warn');return false;}
    if(hasHandStyles(start,side)){setStatus(`The ${side} hand already has drawings.`,'warn');return false;}
    const single=start.elements[start.hands[side].element]?.meta?.nodeType!=='g';
    // Opened only once there is something to do, because opening one takes the
    // snapshot: a refusal must not cost an undo step.
    const opened=single?history.beginTransaction():false;
    try{
      if(single&&!groupHandArtwork(side)){
        setStatus(`The ${side} hand's artwork could not be grouped, and a drawing has to sit inside a group. Draw a pair of hands instead.`,'warn');
        return false;
      }
      return giveHandStyles(side,{styles});
    }finally{ if(opened)history.commitTransaction(); }
  }
  /** The drawings themselves, onto a hand that is already a group. */
  function giveHandStyles(side,{styles}={}){
    const before=store.getDocument();
    const frame=handStyleFrame(before,side,(id)=>canvas.getElementBounds(id));
    if(!frame){setStatus('Set the hand up first: choose its artwork, then give it drawings.','warn');return false;}
    try{
      // A no-op inside the transaction the wrap opened, so the two are one step.
      history.snapshot();
      for(const id of legacyHandPartIds(before,side))canvas.setVisibility(id,false);
      // Inside the hand's own group, whatever that group is: a drawing that
      // is not a child of it would have to be carried, and carrying is the
      // thing this replaces.
      const artwork=canvas.appendArtwork(handStylesMarkup(before,side,{styles,frame,look:installedHandLook(before)}),before.hands[side].element,{updateStore:false});
      if(!artwork)return false;
      if(!addHandStylesCommand(store,history,side,artwork,{styles,frame}))return false;
      applyPreview();
      setStatus(`The ${side} hand shows drawings now: pick one beside the face instead of turning it.`);
      return true;
    }catch(error){
      canvas.loadSvgFromText(before.svgMarkup,before.layerMetadata,{recordHistory:false,updateStore:false});
      setStatus(`Could not give the hand its drawings: ${error.message}`,'error');
      return false;
    }
  }
  /**
   * Draw a style the hand has not got yet, from the picker beside the face.
   *
   * It is appended inside the hand's own group and rigged as one revision, so
   * pressing a hand nobody had drawn is one press and one undo -- the same
   * bargain as drawing the pair itself.
   */
  function addHandStyleDrawing(side,style){
    const before=store.getDocument();
    const frame=handStyleFrame(before,side,(id)=>canvas.getElementBounds(id));
    if(!frame)return false;
    const markup=handStyleMarkupFor(before,side,style,{frame,look:installedHandLook(before)});
    if(!markup)return false;
    try{
      const artwork=canvas.appendArtwork(markup,before.hands[side].element,{updateStore:false});
      if(!artwork)return false;
      if(!addHandStyleCommand(store,history,side,style,artwork,{frame}))return false;
      applyPreview();
      setStatus(`Drawn: the ${side} hand has a ${style} now.`);
      return true;
    }catch(error){
      canvas.loadSvgFromText(before.svgMarkup,before.layerMetadata,{recordHistory:false,updateStore:false});
      setStatus(`Could not draw that hand: ${error.message}`,'error');
      return false;
    }
  }

  return { drawPair: drawHandPair, useStyles: useHandStyles, addStyle: addHandStyleDrawing };
}
