export const PART_PRESETS = {
  head: {
    label: 'Head Nod',
    appliesTo: ['head'],
    apply(element) {
      element.constraints = { ...(element.constraints || {}), rotate: true, translate: true, scale: false };
      element.bindings = { ...(element.bindings || {}), translateX: 'headX * 8' };
      element.bindingCurves = { ...(element.bindingCurves || {}), translateX: 'easeInOut' };
      element.rotation = element.rotation || 0;
    }
  },
  eye: {
    label: 'Eye Follow',
    appliesTo: ['eye'],
    apply(element) {
      element.constraints = { ...(element.constraints || {}), translate: true, rotate: false, scale: true };
      element.bindings = { ...(element.bindings || {}), translateX: 'headX * 4' };
      element.bindingCurves = { ...(element.bindingCurves || {}), translateX: 'linear' };
      element.scaleY = element.scaleY || 1;
    }
  },
  mouth: {
    label: 'Mouth Talk',
    appliesTo: ['mouth'],
    apply(element) {
      element.constraints = { ...(element.constraints || {}), translate: true, rotate: false, scale: true };
      element.bindings = { ...(element.bindings || {}), translateX: 'mouthOpen * 1.5' };
      element.bindingCurves = { ...(element.bindingCurves || {}), translateX: 'easeInOut' };
      element.morph = {
        ...(element.morph || {}),
        enabled: true,
        param: 'mouthOpen',
        min: -1,
        max: 1,
        pathA: element.morph?.pathA || '',
        pathB: element.morph?.pathB || ''
      };
    }
  }
};

export function suggestPresetForElement(id = '') {
  const lowered = id.toLowerCase();
  return Object.entries(PART_PRESETS).find(([, preset]) => preset.appliesTo.some((token) => lowered.includes(token)))?.[0] || 'head';
}
