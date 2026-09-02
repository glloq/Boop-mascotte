import { FACE_FEATURES, installFaceFeature, isFaceFeatureInstalled } from './face-features.js';
export const FACE_FEATURE_DOMAINS = ['artwork', 'layers', 'rig', 'stateMachine', 'semanticRig', 'animation'];
/** Install prepared plain artwork and semantic data as one document revision. */
export function installFaceFeatureCommand(store, history, featureId, artwork) {
  const feature=FACE_FEATURES[featureId], current=store.getDocument();
  if (!feature) throw new Error(`Unknown face feature "${featureId}".`);
  if (isFaceFeatureInstalled(current, featureId)) return false;
  const candidate=structuredClone(current);
  for (const id of [feature.id,...Object.values(feature.roles)]) if (current.elements[id] || current.layers.some?.(item=>item.id===id)) throw new Error(`SVG id collision: "${id}" already exists.`);
  if (current.semanticParts?.[featureId]) throw new Error(`Semantic part id collision: "${featureId}" already exists.`);
  for (const clip of feature.exampleClips) if (current.animationClips.some(item=>item.id===clip.id)) throw new Error(`Animation clip id collision: "${clip.id}" already exists.`);
  Object.assign(candidate, structuredClone(artwork));
  if (!installFaceFeature(candidate, featureId)) return false;
  history?.snapshot();
  store.execute({type:'feature/install',source:'feature',domains:FACE_FEATURE_DOMAINS,apply:document=>{
    for(const field of ['svgMarkup','layers','layerMetadata','elements','semanticParts','params','states','animationClips']) document[field]=structuredClone(candidate[field]);
  }});
  return true;
}
