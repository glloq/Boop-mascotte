export const BEHAVIOR_CATALOG=[
 {type:'blink',title:'Blink Automatically',description:'Natural eye blinking at random intervals.'},
 {type:'randomIdle',title:'Random Idle',description:'Occasional random movement of one control.'},
 {type:'oscillator',title:'Oscillator',description:'Continuous repeating movement such as gentle breathing or sway.'}
];
export const renderBehaviorCatalog=()=>`<div class="behavior-catalog">${BEHAVIOR_CATALOG.map(x=>`<article><div><b>${x.title}</b><p>${x.description}</p></div><button data-add-behavior="${x.type}">Add</button></article>`).join('')}</div>`;
