import { DEFAULT_SAMPLE_SVG } from '../sample/default-mascot.js';

export const PRESET_LIBRARY = {
  classic: {
    id: 'classic',
    label: 'Classic Mascot',
    svg: DEFAULT_SAMPLE_SVG
  },
  chill: {
    id: 'chill',
    label: 'Chill Mascot',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
      <rect id="head" x="24" y="24" width="192" height="192" rx="60" fill="#93c5fd"/>
      <ellipse id="eyeLeft" cx="85" cy="102" rx="12" ry="10" fill="#0f172a"/>
      <ellipse id="eyeRight" cx="155" cy="102" rx="12" ry="10" fill="#0f172a"/>
      <path id="mouth" d="M 80 160 Q 120 150 160 160" stroke="#0f172a" stroke-width="7" fill="none" stroke-linecap="round"/>
    </svg>`
  }
};
