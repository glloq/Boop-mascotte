const ICONS={'look-around':'👀','blink-clip':'😉',smile:'🙂','head-nod':'↕','friendly':'👋',curious:'🤨',angry:'😠','natural-blink':'😌',sleepy:'💤','simple-talk':'💬'};
/** Editor-only presentation derived from clips that really exist. */
export function availableExamples(state){return (state.animationClips||[]).filter(clip=>ICONS[clip.id]).map(clip=>({id:clip.id,name:clip.name,icon:ICONS[clip.id]}));}
