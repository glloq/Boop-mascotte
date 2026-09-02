import SVG from 'svg.js';
import 'svg.select.js';
import 'svg.resize.js';
import 'svg.draggable.js';
import { sanitizeSvgMarkup } from '../core/security/sanitize-svg.js';
import { SvgDocument } from '../core/svg-document/svg-document.js';
import { lifecycleDiagnostics as diagnostics } from '../core/diagnostics/lifecycle-diagnostics.js';
import { createArtworkCommands } from '../core/commands/artwork-commands.js';

function parseTransform(element) {
  const matrix = element.transform();
  return { x: matrix.translateX || 0, y: matrix.translateY || 0, rotation: matrix.rotate || 0,
    scaleX: matrix.scaleX || 1, scaleY: matrix.scaleY || 1, pivotX: matrix.originX || 0, pivotY: matrix.originY || 0 };
}

export function createSvgCanvas(container, store, history, pluginRegistry) {
  const commands = createArtworkCommands(store, history);
  // SVG.js 2.x creates/attaches a drawing with SVG(container). addTo() is a
  // SVG.js 3 API and leaves the v2 plugins with an invalid parent (`put`).
  const draw = SVG(container).size('100%', '100%');
  let rootGroup = draw.group();
  const documentModel = new SvgDocument();
  let loadedMarkup = '';
  let workspace = 'create';
  let selectedId = null;
  let activeTool = 'select';
  let shapeStart = null;
  let rigTool = null;
  // Wrappers may be recreated, DOM nodes are stable. Weak collections neither
  // duplicate handlers nor retain removed/replaced artwork.
  const attachedNodes = new WeakSet();
  const lastApplied = new WeakMap();
  const lastRequested = new Map();

  const restoreRigNodes = (tool) => Object.entries(tool?.baseAttributes || {}).forEach(([id, attributes]) => {
    const node=documentModel.getNode(id);if(!node)return;
    for(const [name,value] of Object.entries(attributes))value==null?node.removeAttribute(name):node.setAttribute(name,value);
  });

  const wrapperFor = (id) => {
    const node = documentModel.getNode(id);
    return node ? SVG.adopt(node) : null;
  };

  function clearSelection() {
    if (!selectedId) return;
    const previous=wrapperFor(selectedId);
    previous?.node?.removeAttribute('data-editor-selected');
    // SVG.js selection plugins retain helper nodes and pointer hit areas until
    // explicitly disabled. Transform-pose owns its wrappers until that rig
    // session finishes; normal editor selection does not.
    if (!(rigTool?.kind === 'transform-pose' && rigTool.ids.includes(selectedId))) {
      previous?.selectize(false);
      previous?.resize(false);
      previous?.draggable(false);
    }
    selectedId=null;
  }

  function showSelection(id) {
    clearSelection();
    if (!id || workspace === 'animate' || workspace === 'preview') return;
    const element=wrapperFor(id);if(!element)return;
    selectedId=id;element.node.setAttribute('data-editor-selected','true');
    if (workspace === 'create' && activeTool === 'select' && !store.getDocument().layerMetadata[id]?.locked) element.selectize().resize().draggable();
  }

  function attachBehavior(element) {
    if (attachedNodes.has(element.node)) return false;
    attachedNodes.add(element.node);
    diagnostics.increment('canvas.interactionAttachments');
    diagnostics.increment('canvas.interactiveElements');
    element.selectize(false).draggable(false);
    element.on('mouseover', () => { if (rigTool?.kind === 'role') element.node.setAttribute('data-rig-candidate', 'true'); });
    element.on('mouseout', () => element.node.removeAttribute('data-rig-candidate'));
    element.on('click', (event) => {
      event.stopPropagation();
      if (rigTool?.kind === 'role') { rigTool.pick(element.id()); return; }
      store.mutateSession('selectedId', state => { state.selectedId = element.id(); });
    });
    element.on('dragstart resizestart', (event) => { if (store.getDocument().layerMetadata[element.id()]?.locked) event.preventDefault(); });
    element.on('dragend resize', () => {
      const id = element.id();
      if (store.getDocument().layerMetadata[id]?.locked) return;
      if(rigTool?.kind==='transform-pose'&&rigTool.ids.includes(id)){rigTool.temporary[id]=parseTransform(element);return;}
      documentModel.captureAuthoringNode(id);
      commands.syncSvg({elements:{...store.getDocument().elements,[id]:{...(store.getDocument().elements[id]||{}),baseTransform:parseTransform(element)}},svgMarkup:documentModel.serialize()}, {domains:['artwork'],source:'canvas'});
    });
    return true;
  }

  function updateElementInteractionState(id) {
    const element = wrapperFor(id); if (!element) return;
    const locked = Boolean(store.getDocument().layerMetadata[id]?.locked);
    element.draggable(!locked && workspace === 'create' && activeTool === 'select');
    showSelection(store.getSession().selectedId);
  }

  function loadSvgText(svgText, metadata = {}, options = {}) {
    const safeMarkup = sanitizeSvgMarkup(svgText);
    rootGroup.remove();
    rootGroup = draw.group().svg(safeMarkup);
    const svgRoot = rootGroup.node.querySelector('svg');
    const tree = documentModel.load(svgRoot, metadata);
    loadedMarkup = documentModel.serialize();
    if (options.recordHistory !== false) history.snapshot();
    const artwork = {
      layers: tree,
      layerMetadata: structuredClone(documentModel.metadata),
      elements: {},
      svgMarkup: documentModel.serialize(),
      svgWarnings: [...documentModel.warnings]
    };
    const visit = (items) => items.forEach((item) => {
        const node = wrapperFor(item.id);
        const plugin = pluginRegistry.getByNode(node);
        if (plugin) { artwork.elements[item.id] = plugin.createRigData(node, parseTransform(node)); attachBehavior(node); }
        visit(item.children);
    });
    visit(tree);
    if (options.updateStore !== false) store.mutateDocument({type:'artwork/load',source:'canvas',domains:['artwork','layers'],apply:state=>Object.assign(state,artwork)});
    return artwork;
  }

  function commitDocument(updateStore = true) {
    const markup = documentModel.serialize();
    loadedMarkup = markup;
    if (updateStore) commands.syncSvg({svgMarkup:markup,layers:documentModel.getTree(),layerMetadata:documentModel.metadata},{snapshot:false});
    return markup;
  }

  function refreshDocument(selectId = null) {
    const svgRoot = rootGroup.node.querySelector('svg');
    const tree = documentModel.load(svgRoot, documentModel.metadata);
    const state=structuredClone(store.getDocument());
      state.layers = tree;
      state.layerMetadata = structuredClone(documentModel.metadata);
      const valid = new Set();
      const visit = (items) => items.forEach((item) => { valid.add(item.id); const node=wrapperFor(item.id),plugin=pluginRegistry.getByNode(node); if(plugin&&!state.elements[item.id]) state.elements[item.id]=plugin.createRigData(node,parseTransform(node)); attachBehavior(node); visit(item.children); });
      visit(tree);
      Object.keys(state.elements).forEach((id)=>{if(!valid.has(id))delete state.elements[id];});
      state.svgMarkup = documentModel.serialize();
    commands.syncSvg({layers:state.layers,layerMetadata:state.layerMetadata,elements:state.elements,svgMarkup:state.svgMarkup},{snapshot:false});
    store.mutateSession('selectedId',session=>{session.selectedId=selectId;});
    loadedMarkup = documentModel.serialize();
  }

  function canvasPoint(event) {
    const svg = draw.node, point = svg.createSVGPoint(); point.x=event.clientX; point.y=event.clientY;
    const local = point.matrixTransform(rootGroup.node.getScreenCTM().inverse());
    return { x: Math.round(local.x), y: Math.round(local.y) };
  }

  container.addEventListener('pointerdown', (event) => {
    if (workspace !== 'create' || !['rect','ellipse','pen'].includes(activeTool) || event.button !== 0) return;
    event.preventDefault(); shapeStart = canvasPoint(event);
  });
  container.addEventListener('pointerup', (event) => {
    if (!shapeStart || workspace !== 'create') return;
    const end=canvasPoint(event),x=Math.min(shapeStart.x,end.x),y=Math.min(shapeStart.y,end.y),w=Math.max(2,Math.abs(end.x-shapeStart.x)),h=Math.max(2,Math.abs(end.y-shapeStart.y));
    history.snapshot(); const svgRoot=rootGroup.node.querySelector('svg'); let node;
    if(activeTool==='rect'){node=document.createElementNS('http://www.w3.org/2000/svg','rect');Object.entries({x,y,width:w,height:h,rx:8,fill:'#60a5fa'}).forEach(([k,v])=>node.setAttribute(k,v));}
    if(activeTool==='ellipse'){node=document.createElementNS('http://www.w3.org/2000/svg','ellipse');Object.entries({cx:x+w/2,cy:y+h/2,rx:w/2,ry:h/2,fill:'#60a5fa'}).forEach(([k,v])=>node.setAttribute(k,v));}
    if(activeTool==='pen'){node=document.createElementNS('http://www.w3.org/2000/svg','path');node.setAttribute('d',`M ${shapeStart.x} ${shapeStart.y} L ${end.x} ${end.y}`);node.setAttribute('fill','none');node.setAttribute('stroke','#60a5fa');node.setAttribute('stroke-width','3');}
    shapeStart=null;if(!node)return;svgRoot.appendChild(node);refreshDocument();const id=node.getAttribute('id');store.mutateSession('selectedId',state=>{state.selectedId=id;});
  });

  draw.on('click', () => { store.mutateSession('selectedId', state => { state.selectedId = null; }); });
  // One visible mode instruction for Canvas pick tools. It is transient UI only.
  const modeBanner = () => {
    let node = container.querySelector('.canvas-mode-banner');
    if (!node) {
      node = document.createElement('div'); node.className = 'canvas-mode-banner'; node.setAttribute('role', 'status'); node.hidden = true;
      node.innerHTML = '<span data-canvas-mode-text></span><button type="button" class="secondary" data-canvas-mode-cancel>Cancel (Esc)</button>';
      node.querySelector('[data-canvas-mode-cancel]').onclick = () => api.cancelRigTool();
      container.append(node);
    }
    return node;
  };
  const showMode = (text) => { const node = modeBanner(); node.querySelector('[data-canvas-mode-text]').textContent = text; node.hidden = false; };
  const hideMode = () => { const node = container.querySelector('.canvas-mode-banner'); if (node) node.hidden = true; };
  const api = {
    beginRolePick({ label, pick, cancel }) {
      this.cancelRigTool();
      rigTool={kind:'role',pick,cancel};
      container.classList.add('rig-role-picking');
      container.setAttribute('aria-label',`Pick artwork for ${label}. Press Escape to cancel.`);
      showMode(`Click the ${label} on the canvas.`);
    },
    beginPivotEdit(id, { commit, cancel }) {
      this.cancelRigTool();
      const element=wrapperFor(id);if(!element)return false;
      const handle=document.createElement('button');handle.className='rig-pivot-handle';handle.type='button';handle.textContent='⊕';handle.setAttribute('aria-label','Drag pivot');container.append(handle);
      const place=(clientX,clientY)=>{const box=container.getBoundingClientRect();handle.style.left=`${clientX-box.left}px`;handle.style.top=`${clientY-box.top}px`;};
      const transform=store.getDocument().elements[id]?.baseTransform||{}, box=element.node.getBoundingClientRect();
      let clientX=box.left+box.width/2,clientY=box.top+box.height/2;
      if(Number.isFinite(transform.pivotX)&&Number.isFinite(transform.pivotY)){const point=draw.node.createSVGPoint();point.x=transform.pivotX;point.y=transform.pivotY;const screen=point.matrixTransform(element.node.getScreenCTM());clientX=screen.x;clientY=screen.y;}
      place(clientX,clientY);
      const move=(event)=>{clientX=event.clientX;clientY=event.clientY;place(clientX,clientY);};
      handle.onpointerdown=(event)=>{handle.setPointerCapture(event.pointerId);};
      handle.onpointermove=(event)=>{if(handle.hasPointerCapture(event.pointerId))move(event);};
      handle.onpointerup=(event)=>{move(event);handle.releasePointerCapture(event.pointerId);const point=draw.node.createSVGPoint();point.x=clientX;point.y=clientY;const local=point.matrixTransform(element.node.getScreenCTM().inverse());commit({x:local.x,y:local.y});this.cancelRigTool(false);};
      rigTool={kind:'pivot',cancel,handle};container.classList.add('rig-pivot-editing');return true;
    },
    beginTransformPose(ids,{cancel}){
      this.cancelRigTool();const valid=ids.filter(id=>wrapperFor(id));if(!valid.length)return false;
      const baseAttributes=Object.fromEntries(valid.map(id=>[id,{transform:documentModel.getNode(id).getAttribute('transform')}]))
      rigTool={kind:'transform-pose',ids:valid,baseAttributes,temporary:{},cancel};
      container.classList.add('rig-transform-pose');container.setAttribute('aria-label','Calibration pose editing. Drag, resize, or rotate the selected artwork.');
      valid.forEach(id=>wrapperFor(id).selectize().resize().draggable());showSelection(valid[0]);return true;
    },
    captureTransformPose(){if(rigTool?.kind!=='transform-pose')return null;const current=rigTool;const poses=Object.fromEntries(current.ids.map(id=>[id,parseTransform(wrapperFor(id))]));restoreRigNodes(current);rigTool=null;container.classList.remove('rig-transform-pose');container.removeAttribute('aria-label');current.ids.forEach(id=>wrapperFor(id)?.selectize(false).draggable(false));showSelection(store.getSession().selectedId);return poses;},
    beginMorphPose(id,initialPath,{cancel}){
      this.cancelRigTool();const element=wrapperFor(id);if(element?.type!=='path')return false;
      const basePath=element.attr('d'),candidate=initialPath||basePath;element.attr('d',candidate);
      const numbers=[...candidate.matchAll(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)];const handles=[];
      for(let i=0;i+1<numbers.length;i+=2){const point=draw.node.createSVGPoint();point.x=Number(numbers[i][0]);point.y=Number(numbers[i+1][0]);const screen=point.matrixTransform(element.node.getScreenCTM());const box=container.getBoundingClientRect(),handle=document.createElement('button');handle.type='button';handle.className='rig-node-handle';handle.setAttribute('aria-label',`Path node ${i/2+1}`);handle.style.left=`${screen.x-box.left}px`;handle.style.top=`${screen.y-box.top}px`;container.append(handle);handles.push({handle,xIndex:i,yIndex:i+1});handle.onpointerdown=e=>handle.setPointerCapture(e.pointerId);handle.onpointermove=e=>{if(!handle.hasPointerCapture(e.pointerId))return;const p=draw.node.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const local=p.matrixTransform(element.node.getScreenCTM().inverse());const values=[...element.attr('d').matchAll(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)];const replacements=new Map([[i,local.x],[i+1,local.y]]);let cursor=0,index=0,next='';for(const match of values){next+=element.attr('d').slice(cursor,match.index)+(replacements.has(index)?Number(replacements.get(index).toFixed(3)):match[0]);cursor=match.index+match[0].length;index++;}next+=element.attr('d').slice(cursor);element.attr('d',next);const b=container.getBoundingClientRect();handle.style.left=`${e.clientX-b.left}px`;handle.style.top=`${e.clientY-b.top}px`;};}
      rigTool={kind:'morph-pose',id,baseAttributes:{[id]:{d:basePath}},handles,cancel};container.classList.add('rig-morph-pose');container.setAttribute('aria-label','Morph endpoint editing. Topology is locked.');return true;
    },
    captureMorphPose(){if(rigTool?.kind!=='morph-pose')return null;const current=rigTool,path=wrapperFor(current.id).attr('d');restoreRigNodes(current);current.handles.forEach(({handle})=>handle.remove());rigTool=null;container.classList.remove('rig-morph-pose');container.removeAttribute('aria-label');return path;},
    cancelRigTool(notify=true) { const current=rigTool;restoreRigNodes(current);rigTool=null;hideMode();container.classList.remove('rig-role-picking','rig-pivot-editing','rig-transform-pose','rig-morph-pose');container.removeAttribute('aria-label');container.querySelectorAll('[data-rig-candidate]').forEach(node=>node.removeAttribute('data-rig-candidate'));current?.handle?.remove();current?.handles?.forEach(({handle})=>handle.remove());current?.ids?.forEach(id=>wrapperFor(id)?.selectize(false).draggable(false));if(notify)current?.cancel?.(); },
    getElementBounds(id) { const node=wrapperFor(id);return node?node.bbox():null; },
    // Canvas-relative pixel frame, comparable across nested transforms. Hidden artwork yields null.
    getElementFrame(id) { const node=documentModel.getNode(id);if(!node?.getBoundingClientRect)return null;const box=node.getBoundingClientRect();if(!box.width&&!box.height)return null;const base=container.getBoundingClientRect();return {x:box.left-base.left,y:box.top-base.top,width:box.width,height:box.height,cx:box.left-base.left+box.width/2,cy:box.top-base.top+box.height/2}; },
    setSuggestedArtwork(id) { container.querySelectorAll('[data-face-suggested]').forEach(node=>node.removeAttribute('data-face-suggested'));const node=id?documentModel.getNode(id):null;if(node)node.setAttribute('data-face-suggested','true'); },
    prepareSvgImport(svgText) {
      const safeMarkup = sanitizeSvgMarkup(svgText);
      const candidate = new DOMParser().parseFromString(safeMarkup, 'image/svg+xml').documentElement;
      if (!candidate.querySelector('path,rect,circle,ellipse,line,polyline,polygon,text,image,use,g')) {
        throw new Error('The imported SVG contains no supported artwork.');
      }
      return safeMarkup;
    },
    async loadSvgFromFile(file) { loadSvgText(await file.text()); },
    loadSvgFromText: loadSvgText,
    serializeCurrentSvg() { return commitDocument(false); },
    getTree() { return documentModel.getTree(); },
    getWarnings() { return [...documentModel.warnings]; },
    setWorkspace(next) {
      workspace=next;clearSelection();
      Object.keys(store.getDocument().elements||{}).forEach((id)=>wrapperFor(id)?.draggable(false));
      showSelection(store.getSession().selectedId);
    },
    setTool(next) { activeTool=next; clearSelection(); Object.keys(store.getDocument().elements||{}).forEach((id)=>{const node=wrapperFor(id);node?.selectize(false).draggable(false);}); showSelection(store.getSession().selectedId); },
    syncSelection(id) { if(id!==selectedId)showSelection(id); },
    fitToCanvas(padding=.1) {
      if(!rootGroup?.node)return 1;
      rootGroup.transform({translateX:0,translateY:0,scaleX:1,scaleY:1});
      const box=rootGroup.node.getBBox(),width=container.clientWidth,height=container.clientHeight;
      if(!box.width||!box.height||!width||!height)return 1;
      const scale=Math.min(width*(1-padding*2)/box.width,height*(1-padding*2)/box.height);
      const x=(width-box.width*scale)/2-box.x*scale,y=(height-box.height*scale)/2-box.y*scale;
      rootGroup.transform({translateX:x,translateY:y,scaleX:scale,scaleY:scale,originX:0,originY:0});
      return scale;
    },
    resetView(){rootGroup.transform({translateX:0,translateY:0,scaleX:1,scaleY:1});return 1;},
    zoomView(factor){const matrix=rootGroup.transform();const scale=Math.max(.2,Math.min(5,(matrix.scaleX||1)*factor));rootGroup.transform({scaleX:scale,scaleY:scale,originX:container.clientWidth/2,originY:container.clientHeight/2});return scale;},
    appendArtwork(markup, mountPoint = null, { updateStore = true } = {}) {
      const svgRoot=rootGroup.node.querySelector('svg');if(!svgRoot)return false;
      const target=(mountPoint&&documentModel.getNode(mountPoint))||svgRoot;
      target.insertAdjacentHTML('beforeend',sanitizeSvgMarkup(`<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`).replace(/^<svg[^>]*>|<\/svg>$/g,''));
      const tree=documentModel.load(svgRoot,documentModel.metadata);loadedMarkup=documentModel.serialize();
      const elements=structuredClone(store.getDocument().elements);const visit=(items)=>items.forEach((item)=>{if(!elements[item.id]){const node=wrapperFor(item.id),plugin=pluginRegistry.getByNode(node);if(plugin){elements[item.id]=plugin.createRigData(node,parseTransform(node));attachBehavior(node);}}visit(item.children);});visit(tree);
      const artwork={layers:tree,layerMetadata:structuredClone(documentModel.metadata),elements,svgMarkup:loadedMarkup};
      if(updateStore)commands.syncSvg(artwork);
      return artwork;
    },
    reconcileState(state) {
      diagnostics.increment('canvas.reconciles');
      if (!state.svgMarkup || state.svgMarkup === loadedMarkup) return;
      rootGroup.remove(); rootGroup = draw.group().svg(sanitizeSvgMarkup(state.svgMarkup));
      const svgRoot = rootGroup.node.querySelector('svg');
      documentModel.load(svgRoot, state.layerMetadata || {}); loadedMarkup = documentModel.serialize();
      Object.keys(state.elements || {}).forEach((id) => { const node = wrapperFor(id); if (node) attachBehavior(node); });
    },
    reorder(id, direction) { const changed = documentModel.reorder(id, direction); if (changed) commitDocument(); return changed; },
    setVisibility(id, visible) { const changed = documentModel.setVisibility(id, visible); if (changed) commitDocument(); return changed; },
    setLocked(id, locked) { const changed = documentModel.setLocked(id, locked); if (changed) { commitDocument(); updateElementInteractionState(id); } return changed; },
    setName(id, name) { const changed = documentModel.setName(id, name); if (changed) commitDocument(); return changed; },
    setExpanded(id, expanded) { documentModel.setExpanded(id, expanded); commitDocument(); },
    setAppearance(id, property, value) { const node=wrapperFor(id);if(!node)return false;history.snapshot();if(value===''||value==null)node.attr(property,null);else node.attr(property,value);documentModel.captureAuthoringAttribute(id,property);commitDocument();return true; },
    duplicate(id) { const node=documentModel.getNode(id);if(!node)return false;history.snapshot();const clone=node.cloneNode(true);clone.removeAttribute('id');node.parentNode.insertBefore(clone,node.nextSibling);refreshDocument();store.mutateSession('selectedId',state=>{state.selectedId=clone.getAttribute('id');});return true; },
    delete(id) { const node=documentModel.getNode(id);if(!node)return false;history.snapshot();node.remove();delete documentModel.metadata[id];refreshDocument();return true; },
    group(id) { const node=documentModel.getNode(id);if(!node||node===documentModel.root)return false;history.snapshot();const group=document.createElementNS('http://www.w3.org/2000/svg','g');node.parentNode.insertBefore(group,node);group.appendChild(node);refreshDocument();store.mutateSession('selectedId',state=>{state.selectedId=group.getAttribute('id');});return true; },
    ungroup(id) { const node=documentModel.getNode(id);if(!node||node.localName!=='g'||!node.parentNode)return false;history.snapshot();const parent=node.parentNode;while(node.firstChild)parent.insertBefore(node.firstChild,node);node.remove();refreshDocument();return true; },
    frameDiagnostic(id) {
      const node=documentModel.getNode(id), applied=node ? lastApplied.get(node)?.transform : undefined;
      return { requested:lastRequested.get(id) ? [...lastRequested.get(id)] : null, applied:applied ? [...applied] : null, domTransform:node?.getAttribute('transform') || null };
    },
    applyFrame(frame) {
      Object.entries(frame.paths || {}).forEach(([id, d]) => { const wrapper=wrapperFor(id),node=wrapper?.node;if(node&&wrapper.type==='path'){const previous=lastApplied.get(node)||{};if(previous.path!==d){wrapper.attr('d',d);diagnostics.increment('canvas.domWrites');lastApplied.set(node,{...previous,path:d});}} });
      Object.entries(frame.transforms || {}).forEach(([id, transform]) => {const wrapper=wrapperFor(id),node=wrapper?.node;if(!node)return;const next=[transform.x,transform.y,transform.rotation,transform.scaleX,transform.scaleY,transform.pivotX,transform.pivotY].map((value,index)=>Number(value)||(index===3||index===4?1:0));lastRequested.set(id,[...next]);const previous=lastApplied.get(node)||{};if(!previous.transform||next.some((value,index)=>Math.abs(value-previous.transform[index])>1e-6)){const [x,y,rotation,scaleX,scaleY,pivotX,pivotY]=next;wrapper.attr('transform',`translate(${x} ${y}) rotate(${rotation} ${pivotX} ${pivotY}) translate(${pivotX} ${pivotY}) scale(${scaleX} ${scaleY}) translate(${-pivotX} ${-pivotY})`);diagnostics.increment('canvas.domWrites');lastApplied.set(node,{...previous,transform:next});}});
      Object.entries(frame.opacity || {}).forEach(([id, opacity]) => {const wrapper=wrapperFor(id),node=wrapper?.node;if(!node)return;const previous=lastApplied.get(node)||{},next=Number(opacity);if(!Number.isFinite(previous.opacity)||Math.abs(next-previous.opacity)>1e-6){wrapper.attr('opacity',next);diagnostics.increment('canvas.domWrites');lastApplied.set(node,{...previous,opacity:next});}});
    },
    applyElementTransform(id, element) {
      const node = wrapperFor(id); if (!node || store.getDocument().layerMetadata[id]?.locked) return;
      const transform = element.baseTransform || element;
      node.attr('transform', `translate(${Number(transform.x)||0} ${Number(transform.y)||0}) rotate(${Number(transform.rotation)||0} ${Number(transform.pivotX)||0} ${Number(transform.pivotY)||0}) translate(${Number(transform.pivotX)||0} ${Number(transform.pivotY)||0}) scale(${Number(transform.scaleX)||1} ${Number(transform.scaleY)||1}) translate(${-Number(transform.pivotX)||0} ${-Number(transform.pivotY)||0})`);
      documentModel.captureAuthoringNode(id);
    },
    applyPathData(id, d) { const node = wrapperFor(id); if (node?.type !== 'path') return; node.attr('d', d); documentModel.captureAuthoringNode(id); commitDocument(); },
    syncLayerOrder(tree) {
      documentModel.metadata = structuredClone(store.getDocument().layerMetadata || {});
      const sync = (items) => {
        items.forEach((item, index) => {
          const node = documentModel.getNode(item.id);
          const previous = index ? documentModel.getNode(items[index - 1].id) : null;
          if (node && previous && node.previousElementSibling !== previous) documentModel.moveAfter(item.id, items[index - 1].id);
          if (node) {
            item.visible === false ? node.setAttribute('display', 'none') : node.removeAttribute('display');
            documentModel.captureAuthoringAttribute(item.id, 'display');
          }
          sync(item.children || []);
        });
      };
      sync(Array.isArray(tree) ? tree : []);
    },
    getNode: wrapperFor
  };
  return api;
}
