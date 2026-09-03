const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const NODE_Y=70, NODE_STEP=150, LANE_HEIGHT=16;

/**
 * Give every edge a free horizontal lane above the node row.
 *
 * The nodes sit on one line, so an edge is a bar spanning the gap between two
 * of them. Drawn at a single height, `A→B` and `B→A` land on exactly the same
 * rectangle (only one of the pair is ever clickable) and `A→C` is drawn across
 * `B`. Each edge now takes the lowest lane no overlapping edge already holds.
 *
 * @param {{from:string,to:string,left:number,right:number}[]} edges
 * @returns {number[]} lane index per edge, in the order given
 */
export function assignEdgeLanes(edges){
  const lanes=[];
  return edges.map(edge=>{
    let lane=0;
    // Touching ends do not overlap: two edges that only share an endpoint may share a lane.
    while(lanes.some(placed=>placed.lane===lane&&placed.left<edge.right&&edge.left<placed.right))lane++;
    lanes.push({lane,left:edge.left,right:edge.right});
    return lane;
  });
}

export function renderTransitionGraph(rig, selectedState, selectedEdge) {
 const names=Object.keys(rig.states||{}), width=Math.max(360,names.length*NODE_STEP);
 const pos=Object.fromEntries(names.map((name,i)=>[name,{x:75+i*NODE_STEP,y:NODE_Y}]));
 const pairs=Object.entries(rig.transitions||{}).flatMap(([from,targets])=>(targets||[]).filter(to=>pos[from]&&pos[to]).map(to=>{
   const a=pos[from],b=pos[to];
   return {from,to,key:`${from}->${to}`,forward:b.x>a.x,left:Math.min(a.x,b.x)+35,right:Math.max(a.x,b.x)-35};
 }));
 const lanes=assignEdgeLanes(pairs);
 const depth=lanes.length?Math.max(...lanes)+1:0;
 // The node row moves down by the height of the lane stack, so the topmost lane
 // always lands inside the canvas however many edges pile up.
 const band=Math.max(0,depth-1)*LANE_HEIGHT, nodeY=NODE_Y+band;
 const edges=pairs.map((edge,index)=>`<button class="graph-edge ${selectedEdge===edge.key?'selected':''}" data-select-transition="${esc(edge.key)}" data-edge-lane="${lanes[index]}" style="left:${edge.left}px;top:${nodeY-20-lanes[index]*LANE_HEIGHT}px;width:${Math.max(12,edge.right-edge.left)}px" aria-label="${esc(edge.from)} to ${esc(edge.to)}"><span>${edge.forward?'→':'←'}</span></button>`);
 for(const name of names)pos[name].y=nodeY;
 return `<section class="transition-graph" aria-label="Directed State graph"><h3>Transition graph</h3><div class="graph-canvas" style="width:${width}px;height:${Math.max(145,nodeY+75)}px" data-edge-lanes="${depth}"><div class="graph-edges">${edges.join('')}</div>${names.map(name=>{const p=pos[name],inc=Object.values(rig.transitions||{}).filter(x=>x?.includes(name)).length,out=(rig.transitions?.[name]||[]).length;return `<button class="graph-node ${name===selectedState?'selected':''}" style="left:${p.x}px;top:${p.y}px" data-select-state="${esc(name)}"><b>${name===rig.activeState?'● ':''}${esc(name)}</b><small>${inc} in · ${out} out</small></button>`}).join('')}</div></section>`;
}
export function renderTransitionList(rig, from, selectedEdge){return `<section><div class="section-heading"><h3>From ${esc(from||'State')}</h3><button data-action="add-transition">+ Transition</button></div><div class="transition-list" role="list">${(rig.transitions?.[from]||[]).map(to=>{const key=`${from}->${to}`,set=rig.transitionSettings?.[key]||{};return `<button data-select-transition="${esc(key)}" class="${selectedEdge===key?'selected':''}"><span>→ <b>${esc(to)}</b></span><small>${set.duration??300} ms · ${({'easeIn':'Ease In','easeOut':'Ease Out','easeInOut':'Ease In Out','linear':'Linear'})[set.easing||'easeInOut']}</small></button>`}).join('')||'<p class="empty">No explicit outgoing transitions. Legacy projects remain unrestricted until you add one.</p>'}</div></section>`}
