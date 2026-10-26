'use strict';
(() => {
  const script=document.getElementById('visitor-metrics');
  const optKey='sanuwar-analytics-optout', idKey='sanuwar-analytics-browser-v1';
  const optButton=document.getElementById('analytics-optout');
  let optedOut=false;
  try{optedOut=localStorage.getItem(optKey)==='1';}catch{}
  const renderPreference=()=>{if(optButton){optButton.textContent=optedOut?'Enable visitor measurement':'Disable visitor measurement on this browser';optButton.removeAttribute('aria-pressed');}};
  renderPreference();
  optButton?.addEventListener('click',()=>{try{optedOut=!optedOut;localStorage.setItem(optKey,optedOut?'1':'0');if(optedOut)localStorage.removeItem(idKey);renderPreference();const notice=document.getElementById('analytics-preference-status');if(notice)notice.textContent=optedOut?'Visitor measurement is disabled on this browser.':'Visitor measurement will resume from the next page.';}catch{const notice=document.getElementById('analytics-preference-status');if(notice)notice.textContent='Browser storage is unavailable. Do Not Track and Global Privacy Control are also respected.';}});
  if(script?.dataset.track!=='1'||optedOut||navigator.doNotTrack==='1'||window.doNotTrack==='1'||navigator.globalPrivacyControl===true)return;
  let identity=crypto.randomUUID();
  try{const saved=JSON.parse(localStorage.getItem(idKey)||'null');if(saved&&/^[a-f0-9-]{36}$/.test(saved.id)&&saved.expires>Date.now())identity=saved.id;else localStorage.setItem(idKey,JSON.stringify({id:identity,expires:Date.now()+180*86400000}));}catch{}
  let source='direct';
  try{
    const previous=JSON.parse(sessionStorage.getItem('sanuwar-analytics-source')||'null');
    let hostname='';if(document.referrer)hostname=new URL(document.referrer).hostname;
    if(hostname&&hostname!==location.hostname){source=/(^|\.)google\.[a-z.]+$/.test(hostname)?'google':/(^|\.)bing\.com$/.test(hostname)?'bing':/(^|\.)(facebook\.com|instagram\.com|t\.co|twitter\.com|x\.com|youtube\.com|linkedin\.com|t\.me)$/.test(hostname)?'social':'referral';}
    else if(previous&&previous.expires>Date.now()&&['direct','google','bing','social','referral'].includes(previous.source))source=previous.source;
    sessionStorage.setItem('sanuwar-analytics-source',JSON.stringify({source,expires:Date.now()+30*60000}));
  }catch{}
  const device=/iPad|Tablet/i.test(navigator.userAgent)?'tablet':/Mobi|Android|iPhone/i.test(navigator.userAgent)?'mobile':'desktop';
  const send=(kind,item='')=>{
    if(optedOut)return;
    const event={event_id:crypto.randomUUID(),visitor_id:identity,kind,page:location.pathname,source,device,...(item?{item}:{})};
    // A failed measurement must never block navigation, checkout or downloads.
    fetch('/api/analytics/collect',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':document.querySelector('meta[name="csrf-token"]').content},body:JSON.stringify(event),keepalive:true}).catch(()=>{});
  };
  let measured=false;
  const pageview=()=>{if(!measured&&document.visibilityState==='visible'){measured=true;send('pageview');}};
  pageview();document.addEventListener('visibilitychange',pageview);
  window.addEventListener('pageshow',event=>{if(event.persisted){measured=false;pageview();}});
  document.addEventListener('click',event=>{const target=event.target.closest('[data-analytics-kind][data-analytics-item]');if(target)send(target.dataset.analyticsKind,target.dataset.analyticsItem);});
})();
