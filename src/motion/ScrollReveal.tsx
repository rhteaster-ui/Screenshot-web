'use client';
import {useEffect} from 'react';
export function useScrollReveal(){
  useEffect(()=>{
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    if(media.matches || !('IntersectionObserver' in window))return;
    const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){entry.target.classList.add('scroll-resolved');observer.unobserve(entry.target);}}},{threshold:.08});
    const elements=document.querySelectorAll('.section-heading, .editorial-rows article, .steps > div, .brand-break, .developer-signature');
    elements.forEach(element=>{element.classList.add('scroll-acquire');observer.observe(element);});
    const restore=()=>elements.forEach(element=>element.classList.add('scroll-resolved'));
    media.addEventListener('change',restore);
    return()=>{observer.disconnect();media.removeEventListener('change',restore);elements.forEach(element=>element.classList.remove('scroll-acquire','scroll-resolved'));};
  },[]);
}
