/**
 * The advanced Behaviors catalogue: one card per runtime behaviour type.
 *
 * This list is also the add allow-list (`behavior-commands.js`) and, through
 * `BEHAVIOR_TITLES`, what a behaviour is called once it exists. Three separate
 * hand-kept tables is how `drift` came to be a type the runtime knew, the
 * Automatic presets shipped and the inspector could edit — and that nothing
 * here could add (V3-10).
 */
export const BEHAVIOR_CATALOG=[
 {type:'blink',title:'Blink Automatically',description:'Natural eye blinking at random intervals.'},
 {type:'randomIdle',title:'Random Idle',description:'Occasional random movement of one control.'},
 {type:'oscillator',title:'Oscillator',description:'Continuous repeating movement such as gentle breathing or sway.'},
 {type:'drift',title:'Drift',description:'A smooth random walk: it eases to a new place, rests there, then moves again.'}
];
/** What a behaviour is called once it exists, as opposed to the card that adds it. */
export const BEHAVIOR_TITLES={blink:'Automatic Blink',randomIdle:'Random Idle',oscillator:'Oscillation',drift:'Drift'};
export const renderBehaviorCatalog=()=>`<div class="behavior-catalog">${BEHAVIOR_CATALOG.map(x=>`<article><div><b>${x.title}</b><p>${x.description}</p></div><button data-add-behavior="${x.type}">Add</button></article>`).join('')}</div>`;
