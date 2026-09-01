export const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
export function createTimelineLayout({duration=1,pixelsPerSecond=160,scrollLeft=0}={}){
  const safeDuration=Math.max(.01,Number(duration)||1),pps=Math.max(20,Number(pixelsPerSecond)||160);
  return {duration:safeDuration,pixelsPerSecond:pps,scrollLeft,
    timeToX(time){return clamp(Number(time)||0,0,safeDuration)*pps-scrollLeft;},
    xToTime(x){return clamp((Number(x)+scrollLeft)/pps,0,safeDuration);},
    contentWidth:Math.max(1,safeDuration*pps)};
}
export function rulerStep(pixelsPerSecond){const target=70/Math.max(1,pixelsPerSecond);return [1/30,.05,.1,.2,.5,1,2,5,10].find(step=>step>=target)||10;}
export function rulerTicks(duration,pixelsPerSecond){const step=rulerStep(pixelsPerSecond),ticks=[];for(let time=0;time<=duration+1e-6;time+=step)ticks.push(Number(time.toFixed(6)));return ticks;}
export function snapTime(time,{fps=30,keyTimes=[],threshold=.06,frames=true,keys=true}={}){
  const candidates=[];if(frames)candidates.push(Math.round(time*fps)/fps);if(keys)candidates.push(...keyTimes);
  let result=time,distance=Infinity;for(const candidate of candidates){const d=Math.abs(candidate-time);if(d<distance&&d<=threshold){result=candidate;distance=d;}}
  return {time:result,snapped:distance<Infinity};
}
