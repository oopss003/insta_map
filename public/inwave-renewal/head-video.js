// Same single-in-flight seek strategy as the working Wavy player.
// All targets belong to one curated left-to-right sweep from the same source video.
export function createHeadVideo(video, {left, center, right, fps=24}, motion) {
  let desired=0, current=0, rendered=0, ready=false, failed=false;
  let frame=0, watchdog=0;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const timeFor=x=>x<0?center+(center-left)*x:center+(right-center)*x;
  function fail(){failed=true;ready=false;clearTimeout(watchdog);cancelAnimationFrame(frame);frame=0;video.classList.remove('is-ready');video.dataset.state='error';}
  function schedule(){if(!frame&&!failed&&!document.hidden)frame=requestAnimationFrame(seek);}
  function seek(){
    frame=0;
    if(!ready||failed||video.seeking||document.hidden)return;
    current+=(desired-current)*(motion.matches?1:.25);
    if(Math.abs(desired-current)<.005)current=desired;
    const next=clamp(Math.round(timeFor(current)*fps)/fps,0,video.duration-1/fps);
    video.dataset.targetTime=next.toFixed(4);
    if(Math.abs(next-video.currentTime)<.5/fps){if(current!==desired)schedule();return;}
    try{video.currentTime=next;clearTimeout(watchdog);watchdog=setTimeout(fail,5000);}catch{fail();}
  }
  function initialize(){
    if(ready||failed)return;
    if(!Number.isFinite(video.duration)||Math.max(left,center,right)>=video.duration)return fail();
    ready=true;
    video.currentTime=center;
    watchdog=setTimeout(fail,5000);
  }
  video.addEventListener('loadeddata',initialize,{once:true});
  video.addEventListener('seeked',()=>{
    clearTimeout(watchdog);if(failed)return;
    // Use the frame that completed, not a newer pointer event, for the graph/timer.
    const t=video.currentTime;rendered=t<center?(t-center)/(center-left):(t-center)/(right-center);
    video.dataset.lookX=clamp(rendered,-1,1).toFixed(4);
    video.dataset.state='ready';video.classList.add('is-ready');schedule();
  });
  video.addEventListener('error',fail);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else schedule();});
  motion.addEventListener('change',schedule);
  if(video.readyState>=2)initialize();
  return {look(x,state){desired=state==='tracking'?clamp(x,-1,1):0;schedule();}};
}
