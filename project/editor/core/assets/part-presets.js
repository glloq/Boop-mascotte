export const PART_PRESETS = {
  head: {
    label: 'Head Nod',
    appliesTo: ['head'],
    apply(element) {
      element.constraints = { ...(element.constraints || {}), rotate: true, translate: true, scale: false };
      element.bindings = { ...(element.bindings || {}), translateX: { enabled: true, expression: 'headX', curve: 'easeInOut', amplitude: 8, offset: 0 } };
    }
  },
  eye: {
    label: 'Eye Follow',
    appliesTo: ['eye'],
    apply(element) {
      element.constraints = { ...(element.constraints || {}), translate: true, rotate: false, scale: true };
      element.bindings = { ...(element.bindings || {}), translateX: { enabled: true, expression: 'headX', curve: 'linear', amplitude: 4, offset: 0 } };
    }
  },
  mouth: {
    label: 'Mouth Talk',
    appliesTo: ['mouth'],
    apply(element) {
      element.constraints = { ...(element.constraints || {}), translate: true, rotate: false, scale: true };
      element.bindings = { ...(element.bindings || {}), translateX: { enabled: true, expression: 'mouthOpen', curve: 'easeInOut', amplitude: 1.5, offset: 0 } };
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
