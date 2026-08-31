import test from 'node:test'; import assert from 'node:assert/strict';
import { composeBehaviorParams, normalizeBehaviors } from '../../../runtime/behaviors.js';
test('legacy behaviors normalize and oscillator composes around base',()=>{const b=normalizeBehaviors({runtimeConfig:{idleMotion:.1}});assert.equal(b[0].type,'oscillator');assert.ok(Math.abs(composeBehaviorParams({headY:0},b,1/.3/4).headY-.1)<1e-9);});
test('blink is temporary and non destructive',()=>{const base={eyeOpen:.8}, b=[{type:'blink',enabled:true,parameter:'eyeOpen',closedValue:0}];assert.equal(composeBehaviorParams(base,b,0,{blinkActive:true}).eyeOpen,0);assert.equal(composeBehaviorParams(base,b,1,{blinkActive:false}).eyeOpen,.8);assert.equal(base.eyeOpen,.8);});
