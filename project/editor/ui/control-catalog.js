// Presentation-only metadata. Runtime and project schema continue to use parameter ids.
export const CONTROL_CATALOG = Object.freeze({
  headX:{label:'Move left / right',part:'head',group:'Head'}, headY:{label:'Move up / down',part:'head',group:'Head'},
  headTilt:{label:'Tilt',part:'head',group:'Head'}, lookX:{label:'Look left / right',part:'gaze',group:'Gaze'},
  lookY:{label:'Look up / down',part:'gaze',group:'Gaze'}, eyeOpen:{label:'Open / close',part:'eyes',group:'Eyes'},
  smile:{label:'Smile',part:'mouth',group:'Mouth'}, mouthOpen:{label:'Open / close',part:'mouth',group:'Mouth'}, mouthWidth:{label:'Width',part:'mouth',group:'Mouth'},
  browRaise:{label:'Raise',part:'eyebrows',group:'Eyebrows'}, browTilt:{label:'Tilt',part:'eyebrows',group:'Eyebrows'}
});

export const controlMeta = (parameter) => CONTROL_CATALOG[parameter] || { label: parameter, part: null, group: 'Other' };
export function availableControlGroups(params, excluded = []) {
  const groups = new Map();
  Object.keys(params).filter(id=>!excluded.includes(id)).forEach(id=>{const meta=controlMeta(id);if(!groups.has(meta.group))groups.set(meta.group,[]);groups.get(meta.group).push({id,...meta});});
  return groups;
}
