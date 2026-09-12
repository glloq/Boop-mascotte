/**
 * RIG — how can its face move? (UIR-16, docs/UIR_REFACTOR_BASELINE.md)
 *
 * Four screens over one column of nine sections: assign the parts, turn on and
 * calibrate the movements, capture the 2.5D turn, and the expert bench for
 * artwork that has to bend rather than move whole. They share a surface, a
 * selection and the canvas they all pose the mascot on, which is why they are
 * one module.
 *
 * `applyPoseValues` is what they all reach for, and the reason it is here:
 * posing the mascot is animating it when Auto Key is on, so every one of these
 * panels ends a gesture the same way the canvas handles do (VNX-35).
 */
import { createHandleBoard } from '../../ui/handle-board.js';
import { createHandleCommands } from '../../core/puppet/handle-commands.js';
import { handleBoardModel } from '../../core/puppet/handle-model.js';
import { rigControlGroups } from '../../core/puppet/control-groups.js';
import { controlMeta } from '../../ui/control-catalog.js';
import { createRigPanel } from '../../rig-editor/semantic-parts/rig-panel.js';
import { createFaceSetupPanel } from '../../rig-editor/semantic-parts/face-setup-panel.js';
import { createFaceMovementsPanel } from '../../rig-editor/semantic-parts/face-movements-panel.js';
import { createGazePanel } from '../../rig-editor/gaze/gaze-panel.js';
import { createHoldingPanel } from '../../rig-editor/holding/holding-panel.js';
import { createHeadPosePanel } from '../../rig-editor/head-pose/head-pose-panel.js';
import { createHandSetupPanel } from '../../rig-editor/hands/hand-setup-panel.js';
import { createWarpPanel } from '../../rig-editor/warp/warp-panel.js';
import { readArtboard } from '../../core/artwork/artboard.js';
import { areHandsInstalled } from '../../core/sample/hand-feature.js';

/**
 * @param {object} deps
 * @param {(name: string, value: number, options?: object) => void} deps.autoKey
 * @param {(values: object) => void} deps.autoKeyMany
 * @param {() => void} deps.refreshPreviewPanel  Preview reads the live values these panels write
 * @param {object} deps.handArtwork              app/hand-artwork.js
 */
export function createRigWorkspace({
  store, history, shell, canvas, preview, editorContext, navigate, setStatus,
  revealInspector, autoKey, autoKeyMany, refreshPreviewPanel, handArtwork
}) {
  const handleCommands = createHandleCommands(store, history);
  const handleBoard = createHandleBoard(shell.leftSidebarEl.querySelector('#handle-board'), {
    model: () => handleBoardModel(store.getDocument(), preview.getEffectiveParams()),
    // The same controls, gathered into the part of the face they belong to,
    // with the links that decide what moves together (docs/FACE_CONTROL_RIG.md).
    groups: () => rigControlGroups(store.getDocument(), preview.getEffectiveParams()),
    commands: handleCommands,
    movements: () => Object.entries(store.getDocument().params || {}).map(([id]) => ({ id, label: controlMeta(id).label })),
    artwork: () => Object.keys(store.getDocument().elements || {}).map((id) => ({ id, name: store.getDocument().layerMetadata?.[id]?.name || id })),
    // Wrapped, not passed: `applyPoseValues` is declared further down the file,
    // and naming it here would read it before it exists.
    applyPose: (values) => applyPoseValues(values),
    selected: () => selectedHandles,
    onSelect: (id, { additive } = {}) => {
      selectedHandles = additive ? (selectedHandles.includes(id) ? selectedHandles.filter((item) => item !== id) : [...selectedHandles, id]) : [id];
      canvas.setSelectedHandles(selectedHandles);
    },
    onStatus: setStatus
  });
  let selectedHandles = [];
  const rigPanel = createRigPanel(shell.rigEl, store, history, preview, autoKey, canvas, editorContext, shell.rigPartsEl);
  const faceSetup=createFaceSetupPanel(shell.faceSetupEl,store,history,canvas,editorContext,{openPart:(id,tab)=>{rigPanel.openPart(id,tab);revealInspector();},geometry:id=>canvas.getElementFrame(id),highlight:id=>canvas.setSuggestedArtwork(id)});
  const applyPoseValues=(values)=>{const posed={};for(const [name,value] of Object.entries(values||{}))if(store.getDocument().params?.[name]){preview.setLiveParam(name,value);posed[name]=value;}if(Object.keys(posed).length)autoKeyMany(posed);refreshPreviewPanel();canvas.refreshPuppetHandles();};
  // Pins are placed on the canvas and edited in the panel, so the panel knows
  // the selection, can start a placement, mirror about the working area's
  // middle, turn a shape into a path, and hand a new movement a control.
  const holdingPanel=createHoldingPanel(shell.holdingPanelEl,store,history,{
    measure:(id)=>canvas.measureElement?.(id)||null,
    onStatus:setStatus,
    selectedId:()=>store.getSession().selectedId,
    select:(id)=>store.mutateSession('selectedId',state=>{state.selectedId=id;}),
    elementKind:(id)=>canvas.elementKind?.(id)||null,
    authoredPath:(id)=>canvas.authoredPath?.(id)||null,
    placePin:(options)=>canvas.beginPinPlacement?.(options),
    convertToPath:(id)=>canvas.convertToPath?.(id)||{ok:false,message:'Select a shape first.'},
    mirrorAxis:()=>{const box=readArtboard(store.getDocument().svgMarkup||'');return box?box.x+box.width/2:null;},
    createHandle:({id,name,elements,x,y})=>handleCommands.create(id,{name,elements,x,y})
  });
  const gazePanel=createGazePanel(shell.gazePanelEl,store,history,{onStatus:setStatus});
  const faceMovements=createFaceMovementsPanel(shell.faceMovementsEl,store,history,editorContext,{openMovement:(id,control)=>{rigPanel.openMovement(id,control);revealInspector();},applyPose:applyPoseValues,liveValues:()=>preview.getEffectiveParams()});
  // V2 head pose and hands (docs/HEAD_POSE_2_5D.md, docs/HAND_RIGGING.md).
  const headPosePanel=createHeadPosePanel(shell.headPoseEl,store,history,{onRoute:(mode)=>navigate({mode}),
    // Capture is a transient canvas pose session: nothing is authored until the
    // author presses Capture, and Cancel restores the artwork exactly.
    beginPose:(ids,{capture,cancel})=>canvas.beginTransformPose(ids,{instruction:'Move the artwork into the head position, then press Capture.',capture:()=>capture(canvas.captureTransformPose()||{}),cancel}),
    measure:(id)=>canvas.getElementBounds(id),
    cancelPose:()=>canvas.cancelRigTool(),
    // The same bargain for an outline (3D-06): node handles on one path with
    // its topology locked, so what comes back is a shape and never an artwork
    // edit that would strand every delta measured against the old point count.
    beginShapePose:(id,path,{capture,cancel})=>canvas.beginMorphPose(id,path,{instruction:'Drag the outline\u2019s points into the shape this head position needs, then press Capture.',capture:()=>capture(canvas.captureMorphPose()),cancel}),
    pathOf:(id)=>canvas.getPathData?.(id)||null,
    selectedId:()=>store.getSession().selectedId,
    onPreview:(values)=>{for(const [name,value] of Object.entries(values))if(store.getDocument().params?.[name])preview.setLiveParam(name,value);},
    // Posing the mascot is animating it when Auto Key is on (VNX-35). The head
    // pad, the test bench and the handle board all end a gesture the same way
    // the canvas handles do, and land in the same one-step-per-gesture keying.
    onCommit:autoKeyMany,
    pairs:()=>{const parts=Object.values(store.getDocument().semanticParts||{});const map={};for(const part of parts){const roles=part.roles||{};for(const [left,right] of [['leftEye','rightEye'],['leftPupil','rightPupil'],['leftBrow','rightBrow'],['leftEar','rightEar']])if(roles[left]&&roles[right])map[roles[left]]=roles[right];}return map;}
  });

  const handSetupPanel=createHandSetupPanel(shell.handSetupEl,store,history,{
    useHandStyles: (side, options) => handArtwork.useStyles(side, options),
    onSelect:(id)=>{if(id)editorContext.update({selectedId:id});},
    artboardWidth:()=>Number(canvas.getElementBounds?.(Object.keys(store.getDocument().elements||{})[0])?.width)||0,
    measure:(id)=>canvas.getElementBounds(id),
    applyPose:applyPoseValues,
    liveValues:()=>preview.getEffectiveParams(),
    drawHands: (look) => handArtwork.drawPair(look),
    // "Already drawn" is "this mascot has hands", whichever kind: a pair of
    // drawings is not a pair of six parts, and offering to draw a second pair
    // over one is offering an id collision.
    showHandRig: (side) => canvas.showHandRig(side), handsDrawn:()=>{const state=store.getDocument();return Boolean(state.hands?.left||state.hands?.right)||areHandsInstalled(state);}
  });
  const warpPanel=createWarpPanel(shell.warpPanelEl,store,history,{
    selectedId:()=>store.getSession().selectedId,
    geometry:(id)=>canvas.getElementBounds(id),
    pathOf:(id)=>store.getDocument().elements?.[id]?.restPath||canvas.getPathData?.(id)||null
  });

  return {
    id: 'rig',
    surfaces: ['rig'],
    panels: { rigPanel, faceSetup, faceMovements, gazePanel, holdingPanel, headPosePanel, handSetupPanel, warpPanel, handleBoard },
    targets: {
      rigPanel: () => rigPanel.render(),
      faceSetup: () => faceSetup.render(),
      faceMovements: () => faceMovements.render(),
      gazePanel: () => gazePanel.render(),
      holdingPanel: () => holdingPanel.render(),
      headPose: () => headPosePanel.render(),
      handSetup: () => handSetupPanel.render(),
      warpPanel: () => warpPanel.render(),
      handleBoard: () => handleBoard.render()
    },
    /** The one way anything else poses the mascot, Auto Key included. */
    applyPose: applyPoseValues,
    enter() {},
    /**
     * A pin being placed and a part half-assigned are both transient: a gesture
     * the author walked away from is over.
     */
    leave() { rigPanel.cancelTransient(); faceSetup.cancelTransient(); },
    render() {
      rigPanel.render(); faceSetup.render(); gazePanel.render(); holdingPanel.render();
      faceMovements.render(); headPosePanel.render(); handSetupPanel.render(); warpPanel.render(); handleBoard.render();
    },
    destroy() { for (const panel of [rigPanel, faceSetup, faceMovements, gazePanel, holdingPanel, headPosePanel, handSetupPanel, warpPanel, handleBoard]) panel.destroy?.(); }
  };
}
