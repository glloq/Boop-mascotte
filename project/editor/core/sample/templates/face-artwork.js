const shell = (content) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" role="img" aria-label="Simplified riggable face">
  ${content}
</svg>`;

const head = '<circle id="head" data-name="Head" cx="120" cy="120" r="100" fill="#f6d6ad" stroke="#9a6544" stroke-width="4" />';
const eyes = `<g id="eye-whites" data-name="Eye whites">
    <ellipse id="eyeLeft" data-name="Left eye" cx="82" cy="104" rx="25" ry="20" fill="#ffffff" stroke="#9a6544" stroke-width="3" />
    <ellipse id="eyeRight" data-name="Right eye" cx="158" cy="104" rx="25" ry="20" fill="#ffffff" stroke="#9a6544" stroke-width="3" />
  </g>`;
const pupils = `<g id="pupils" data-name="Pupils">
    <circle id="pupilLeft" data-name="Left pupil" cx="82" cy="104" r="9" fill="#263238" />
    <circle id="pupilRight" data-name="Right pupil" cx="158" cy="104" r="9" fill="#263238" />
  </g>`;
const brows = `<g id="eyebrows" data-name="Eyebrows" fill="none" stroke="#57382b" stroke-width="7" stroke-linecap="round">
    <path id="browLeft" data-name="Left eyebrow" d="M58 76 Q82 62 106 76" />
    <path id="browRight" data-name="Right eyebrow" d="M134 76 Q158 62 182 76" />
  </g>`;
const smile = '<path id="mouth" data-name="Mouth" d="M82 160 Q120 160 158 160" fill="none" stroke="#9f3d46" stroke-width="9" stroke-linecap="round" />';

export const BASIC_FACE_SVG = shell(`${head}\n  ${eyes}\n  ${pupils}\n  ${smile}`);

export const EXPRESSIVE_FACE_SVG = shell(`${head}
  <path id="hairBack" data-name="Hair back" d="M30 91 Q35 20 98 17 Q170 -2 210 83 L195 67 Q166 44 122 50 Q70 42 43 88 Z" fill="#57382b" />
  ${eyes}
  ${pupils}
  <g id="eyelids" data-name="Eyelids" fill="none" stroke="#9a6544" stroke-linecap="round">
    <path id="upperLidLeft" data-name="Left upper eyelid" d="M61 100 Q85 78 109 100" stroke-width="5" />
    <path id="upperLidRight" data-name="Right upper eyelid" d="M131 100 Q155 78 179 100" stroke-width="5" />
    <path id="lowerLidLeft" data-name="Left lower eyelid" d="M61 103 Q85 119 109 103" stroke-width="3" />
    <path id="lowerLidRight" data-name="Right lower eyelid" d="M131 103 Q155 119 179 103" stroke-width="3" />
  </g>
  ${brows}
  <path id="nose" data-name="Nose" d="M120 108 Q112 137 124 139" fill="none" stroke="#b77954" stroke-width="4" stroke-linecap="round" />
  ${smile}
  <path id="jaw" data-name="Jaw" d="M78 177 Q120 215 162 177" fill="none" stroke="#b77954" stroke-width="5" stroke-linecap="round" />
  <path id="moustache" data-name="Moustache" d="M120 148 Q101 136 83 151 Q101 157 120 148 Q139 157 157 151 Q139 136 120 148 Z" fill="#57382b" />
  <path id="hair" data-name="Hair front" d="M39 79 Q60 25 105 30 L92 58 Q116 31 139 35 L132 58 Q166 35 198 78 Q163 55 120 59 Q75 53 39 79 Z" fill="#684334" />`);

export const TALKING_FACE_SVG = shell(`${head}
  ${eyes}
  ${pupils}
  <path id="nose" data-name="Nose" d="M120 111 Q114 135 124 138" fill="none" stroke="#b77954" stroke-width="4" stroke-linecap="round" />
  <path id="mouthBase" data-name="Mouth base" d="M76 156 Q120 145 164 156 Q120 211 76 156 Z" fill="#6f2932" opacity=".18" />
  <path id="mouth" data-name="Morphing mouth" d="M80 158 Q120 166 160 158 Q120 178 80 158 Z" fill="#9f3d46" stroke="#702832" stroke-width="3" />
  <path id="jaw" data-name="Jaw" d="M78 177 Q120 215 162 177" fill="none" stroke="#b77954" stroke-width="5" stroke-linecap="round" />`);
