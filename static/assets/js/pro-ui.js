'use strict';
(() => {
  const button=document.getElementById('theme-toggle');
  const update=()=>{if(button){const dark=document.documentElement.dataset.theme==='dark';button.setAttribute('aria-label',dark?'Switch to light theme':'Switch to dark theme');button.title=button.getAttribute('aria-label');}};
  update();new MutationObserver(update).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  if('IntersectionObserver' in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('pro-in-view');observer.unobserve(entry.target);}});},{threshold:.08});
    document.querySelectorAll('.pro-reveal').forEach(node=>observer.observe(node));
  }
  const nav=document.getElementById('site-nav'),menu=document.querySelector('.menu-toggle');
  const closeMenu=restore=>{const returnFocus=restore&&nav?.contains(document.activeElement);nav?.classList.remove('open');menu?.setAttribute('aria-expanded','false');if(returnFocus)menu.focus();};
  if(menu)new MutationObserver(()=>menu.setAttribute('aria-label',menu.getAttribute('aria-expanded')==='true'?'Close navigation':'Open navigation')).observe(menu,{attributes:true,attributeFilter:['aria-expanded']});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu(true);});
  document.addEventListener('focusin',event=>{if(nav?.classList.contains('open')&&!nav.contains(event.target)&&!menu?.contains(event.target))closeMenu(false);});
  document.addEventListener('click',event=>{if(nav?.classList.contains('open')&&!nav.contains(event.target)&&!menu?.contains(event.target))closeMenu(false);});
})();
