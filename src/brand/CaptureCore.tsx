'use client';
import {useEffect,useRef} from 'react';
export function CaptureCore({compact=false}:{compact?:boolean}){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const el=ref.current;if(!el)return;
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');let raf=0;let visible=true;
  const observer=new IntersectionObserver(([e])=>{visible=e.isIntersecting;el.dataset.paused=String(!visible);},{threshold:.05});observer.observe(el);
  const move=(e:PointerEvent)=>{if(reduce.matches||!visible||e.pointerType!=='mouse')return;cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{const box=el.getBoundingClientRect();el.style.setProperty('--rx',`${(e.clientY-box.top-box.height/2)/70}deg`);el.style.setProperty('--ry',`${(e.clientX-box.left-box.width/2)/60}deg`);});};
  const reset=()=>{el.style.setProperty('--rx','0deg');el.style.setProperty('--ry','0deg');};
  el.addEventListener('pointermove',move);el.addEventListener('pointerleave',reset);
  return()=>{observer.disconnect();cancelAnimationFrame(raf);el.removeEventListener('pointermove',move);el.removeEventListener('pointerleave',reset);};
 },[]);
 return <div ref={ref} className={`capture-core ${compact?'core-compact':''}`} aria-hidden="true"><div className="core-ruler ruler-top"/><div className="core-ruler ruler-bottom"/><span className="core-coordinate">X / 1920<br/>Y / 1080</span><div className="core-perspective"><div className="core-stack">{Array.from({length:7},(_,i)=><div key={i} className={`core-frame core-frame-${i}`} style={{'--index':i} as React.CSSProperties}><div className="core-browser"><span/><span/><span/><b>F / {String(i+1).padStart(3,'0')}</b></div>{i===6&&<div className="core-front"><div className="core-cross"/><span className="core-title">THE<br/>WEB.</span><div className="core-reticle"/><span className="core-resolution">1920 × 1080</span><span className="core-counter">01—07</span></div>}</div>)}</div></div><span className="core-label">CAPTURE CORE / V.01</span><span className="core-scale">[ VIEWPORT STUDY ]</span></div>;
}
