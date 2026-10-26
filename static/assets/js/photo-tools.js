'use strict';
(() => {
  const $=id=>document.getElementById(id), core=PhotoCore;
  const presets={
    'passport-print':{name:'Passport print · 35 × 45 mm',width:413,height:531,dpi:300,kb:'',format:'image/jpeg',note:'35 × 45 mm print layout at 300 DPI (rounded to whole pixels). This is a print preset, not a universal online-upload specification.',source:'https://www.indembassyankara.gov.in/eoiank_pages/MTg2'},
    'passport-online':{name:'Passport mission upload · 630 × 810 px',width:630,height:810,dpi:300,kb:'',format:'image/jpeg',note:'630 × 810 px for the mission workflow described by the High Commission of India, London. Enter the KB limit shown on your own portal. Use an original, compliant photo; size conversion does not validate face or background rules.',source:'https://www.hcilondon.gov.in/page/general-guidelines-indian-passport-faqs/'},
    pan:{name:'PAN photo · Protean DSC',width:197,height:276,dpi:200,kb:20,format:'image/jpeg',note:'Protean DSC scanned-photo workflow: 25 × 35 mm, 200 DPI, JPEG up to 20 KB. Other PAN application methods may have different requirements.',source:'https://tin.tin.proteantech.in/pan/InstructionDSC.html'},
    'pan-signature':{name:'PAN signature · Protean DSC',width:354,height:157,dpi:200,kb:10,format:'image/jpeg',note:'Protean DSC scanned-signature workflow: 45 × 20 mm, 200 DPI, JPEG up to 10 KB. Check your application instructions.',source:'https://tin.tin.proteantech.in/pan/InstructionDSC.html'},
    'voter-print':{name:'Voter ID Form 6 print · 35 × 45 mm',width:413,height:531,dpi:300,kb:'',format:'image/jpeg',note:'ECI Form 6 specifies a 35 × 45 mm unsigned colour photograph with a white background. This print preset uses 300 DPI; for online upload, enter the size limit and dimensions shown on your portal.',source:'https://voters.eci.gov.in/formspdf/Form_6_English.pdf'},
    square:{name:'Square · 600 × 600 px',width:600,height:600,dpi:300,kb:'',format:'image/jpeg',note:'A general square image. Set your own KB limit if needed.'}
  };
  const fields=['width','height','dpi','kb','format'];
  let source=null, transformed=null, turn=0, flip=false, filename='photo', busy=false, drag=null, loadVersion=0;
  const canvas=$('photo-canvas'),ctx=canvas.getContext('2d'),savedKey='sanuwar.photo.presets.v1';
  let saved=[];
  function validSaved(p){try{return p&&typeof p.id==='string'&&/^saved-[a-z0-9-]+$/.test(p.id)&&typeof p.name==='string'&&p.name.length<=50&&!!core.settings(p);}catch{return false;}}
  try{const items=JSON.parse(localStorage.getItem(savedKey)||'[]');if(Array.isArray(items))saved=items.filter(validSaved).slice(0,20);}catch{}
  function savedOptions(){ $('photo-preset').querySelectorAll('[data-saved]').forEach(n=>n.remove());for(const p of saved){const option=document.createElement('option');option.value=p.id;option.textContent=p.name;option.dataset.saved='true';$('photo-preset').append(option);}}
  savedOptions();
  function message(text,error=false){for(const id of ['photo-status','photo-export-status']){const status=$(id);if(status){status.textContent=text;status.classList.toggle('error',error);}}}
  function values(){return core.settings(Object.fromEntries(fields.map(k=>[k,$('photo-'+k).value])));}
  function allButtonsDisabled(disabled){$('photo-editor').querySelectorAll('input,select').forEach(input=>input.disabled=disabled);for(const id of ['download-photo','download-sheet','print-sheet','save-preset','change-photo','clear-photo','rotate-left','rotate-right','flip-photo','reset-photo'])$(id).disabled=disabled;}
  function reset(){turn=0;flip=false;for(const [key,value] of Object.entries({zoom:100,x:50,y:50,brightness:100,contrast:100}))$('photo-'+key).value=value;$('photo-bg').value='#ffffff';transform();render();}
  function transform(){
    if(!source)return;
    transformed=document.createElement('canvas');const swap=turn%2;transformed.width=swap?source.height:source.width;transformed.height=swap?source.width:source.height;
    const context=transformed.getContext('2d');context.translate(transformed.width/2,transformed.height/2);context.rotate(turn*Math.PI/2);context.scale(flip?-1:1,1);context.drawImage(source,-source.width/2,-source.height/2);
  }
  function paint(target,w,h){
    const c=target.getContext('2d'),rect=core.crop(transformed.width,transformed.height,w,h,Number($('photo-zoom').value)/100,Number($('photo-x').value)/100,Number($('photo-y').value)/100);
    c.clearRect(0,0,w,h);c.fillStyle=$('photo-bg').value;c.fillRect(0,0,w,h);c.save();if('filter' in c)c.filter=`brightness(${$('photo-brightness').value}%) contrast(${$('photo-contrast').value}%)`;c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(transformed,rect.x,rect.y,rect.width,rect.height,0,0,w,h);c.restore();
    if(!('filter' in c)){
      const pixels=c.getImageData(0,0,w,h),brightness=Number($('photo-brightness').value)/100,contrast=Number($('photo-contrast').value)/100;
      for(let i=0;i<pixels.data.length;i+=4)for(let channel=0;channel<3;channel++)pixels.data[i+channel]=(pixels.data[i+channel]*brightness-127.5)*contrast+127.5;
      c.putImageData(pixels,0,0);
    }
    return rect;
  }
  function render(){
    if(!source)return;
    message('');
    try{
      const v=values(),scale=Math.min(640/v.width,640/v.height,1);canvas.width=Math.max(1,Math.round(v.width*scale));canvas.height=Math.max(1,Math.round(v.height*scale));paint(canvas,canvas.width,canvas.height);
      $('output-dimensions').textContent=`${v.width} × ${v.height} px`;$('output-print').textContent=`${(v.width/v.dpi*25.4).toFixed(1)} × ${(v.height/v.dpi*25.4).toFixed(1)} mm`;$('output-bytes').textContent=v.kb?`Target ≤ ${v.kb} KB`:'Generate to check';
      const rect=core.crop(transformed.width,transformed.height,v.width,v.height,Number($('photo-zoom').value)/100,Number($('photo-x').value)/100,Number($('photo-y').value)/100);
      $('photo-warning').textContent=v.width>rect.width||v.height>rect.height?'This enlarges the original crop. Use a higher-resolution photo for sharper results.':'';
      ['zoom','brightness','contrast'].forEach(k=>$(k+'-value').textContent=$('photo-'+k).value+'%');
    }catch(error){$('output-dimensions').textContent='Check dimensions';$('photo-warning').textContent=error.message;}
  }
  function preset(){
    const key=$('photo-preset').value,p=presets[key]||saved.find(p=>p.id===key);
    if(p){for(const k of fields)$('photo-'+k).value=p[k]||'';}
    else if(key==='original'&&source){$('photo-width').value=source.width;$('photo-height').value=source.height;$('photo-dpi').value=300;$('photo-kb').value='';}
    $('preset-description').textContent=p?.note||'Set dimensions, DPI and file size to match your form. A saved preset is stored only in this browser.';
    const officialSource=presets[key]?.source;$('preset-source').hidden=!officialSource;if(officialSource)$('preset-source').href=officialSource;$('delete-preset').hidden=!saved.some(p=>p.id===key);render();
  }
  function custom(){if($('photo-preset').value!=='custom'){$('photo-preset').value='custom';$('preset-description').textContent='Custom settings. Use the dimensions and size limit shown on your form.';$('preset-source').hidden=true;$('delete-preset').hidden=true;}render();}
  async function load(file){
    if(!file||busy)return;
    const version=++loadVersion;
    try{
      if(file.size>16*1024*1024)throw new Error('Choose an image smaller than 16 MB.');
      if(!['image/jpeg','image/png','image/webp','image/bmp','image/gif'].includes(file.type))throw new Error('Choose a JPG, PNG, WebP, BMP or GIF. Export HEIC/TIFF as JPG first.');
      message('Opening your photo on this device…');
      const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('This file could not be read.'));reader.readAsDataURL(file);});
      const img=new Image();img.src=data;await img.decode();if(version!==loadVersion)return;
      if(img.naturalWidth*img.naturalHeight>40_000_000)throw new Error('Choose an image under 40 megapixels to keep editing responsive.');
      if(img.naturalWidth<16||img.naturalHeight<16)throw new Error('Choose an image at least 16 × 16 pixels.');
      const factor=Math.min(1,4096/Math.max(img.naturalWidth,img.naturalHeight));source=document.createElement('canvas');source.width=Math.round(img.naturalWidth*factor);source.height=Math.round(img.naturalHeight*factor);source.getContext('2d').drawImage(img,0,0,source.width,source.height);
      filename=(file.name.replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,60)||'photo');
      $('photo-editor').hidden=false;$('photo-mobile-nav').hidden=false;$('photo-upload').hidden=true;reset();preset();
      message(`Photo ready · ${img.naturalWidth} × ${img.naturalHeight} px.${factor<1?' Editing copy scaled to a maximum of 4096 px.':''}`);
    }catch(error){if(version===loadVersion)message(error instanceof DOMException?'This image could not be decoded. Try exporting it as JPG.':error.message,true);}
    finally{$('photo-file').value='';$('photo-camera').value='';}
  }
  $('choose-photo').onclick=()=>$('photo-file').click();$('change-photo').onclick=()=>$('photo-file').click();$('camera-photo').onclick=()=>$('photo-camera').click();
  $('photo-file').onchange=e=>load(e.target.files[0]);$('photo-camera').onchange=e=>load(e.target.files[0]);
  ['dragenter','dragover'].forEach(type=>$('photo-upload').addEventListener(type,e=>{e.preventDefault();$('photo-upload').classList.add('dragging');}));
  ['dragleave','drop'].forEach(type=>$('photo-upload').addEventListener(type,e=>{e.preventDefault();$('photo-upload').classList.remove('dragging');if(type==='drop')load(e.dataTransfer.files[0]);}));
  // Prevent dropped files outside the target from navigating away from the editor.
  window.addEventListener('dragover',e=>e.preventDefault());window.addEventListener('drop',e=>e.preventDefault());
  $('clear-photo').onclick=()=>{loadVersion++;source=transformed=null;canvas.width=canvas.height=1;$('photo-editor').hidden=true;$('photo-mobile-nav').hidden=true;$('photo-upload').hidden=false;message('Photo cleared from the editor.');};
  $('rotate-left').onclick=()=>{turn=(turn+3)%4;transform();render();};$('rotate-right').onclick=()=>{turn=(turn+1)%4;transform();render();};$('flip-photo').onclick=()=>{flip=!flip;transform();render();};$('reset-photo').onclick=reset;
  for(const id of ['zoom','x','y','brightness','contrast','bg'])$('photo-'+id).addEventListener('input',render);
  for(const k of fields)$('photo-'+k).addEventListener('input',custom);
  $('photo-preset').onchange=preset;
  canvas.addEventListener('pointerdown',e=>{if(!source||busy)return;canvas.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,px:Number($('photo-x').value),py:Number($('photo-y').value)};});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;let v;try{v=values();}catch{return;}const box=canvas.getBoundingClientRect(),r=core.crop(transformed.width,transformed.height,v.width,v.height,Number($('photo-zoom').value)/100,0,0);
    const dx=transformed.width-r.width,dy=transformed.height-r.height;
    $('photo-x').value=Math.max(0,Math.min(100,drag.px-(e.clientX-drag.x)/box.width*r.width/(dx||1)*100));$('photo-y').value=Math.max(0,Math.min(100,drag.py-(e.clientY-drag.y)/box.height*r.height/(dy||1)*100));render();});
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>canvas.addEventListener(type,()=>{drag=null;}));
  canvas.addEventListener('keydown',e=>{const key={ArrowLeft:['x',-2],ArrowRight:['x',2],ArrowUp:['y',-2],ArrowDown:['y',2]}[e.key];if(!key)return;e.preventDefault();const input=$('photo-'+key[0]);input.value=Number(input.value)+key[1];render();});
  $('save-preset').onclick=()=>{try{values();if(saved.length>=20)throw new Error('You have 20 saved presets. Remove one before adding another.');$('preset-name').value='';$('preset-dialog').showModal();$('preset-name').focus();}catch(error){message(error.message,true);}};
  $('cancel-preset').onclick=()=>$('preset-dialog').close();
  $('preset-form').onsubmit=e=>{e.preventDefault();try{const name=$('preset-name').value.trim();if(!name)throw new Error('Give this preset a name.');const p={...values(),name,id:'saved-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7)};const next=[...saved,p];localStorage.setItem(savedKey,JSON.stringify(next));saved=next;savedOptions();$('photo-preset').value=p.id;preset();$('preset-dialog').close();message('Preset saved in this browser. Your photo was not saved.');}catch(error){$('preset-dialog').close();message('Could not save preset. '+error.message,true);}};
  $('delete-preset').onclick=()=>{try{const next=saved.filter(p=>p.id!==$('photo-preset').value);localStorage.setItem(savedKey,JSON.stringify(next));saved=next;savedOptions();$('photo-preset').value='custom';preset();message('Saved preset removed.');}catch{message('Browser storage is unavailable.',true);}};
  function download(blob,name){const link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  async function exportPhoto(enforceLimit){const v=values(),output=document.createElement('canvas');output.width=v.width;output.height=v.height;paint(output,v.width,v.height);const blob=await core.encode(output,{...v,kb:enforceLimit?v.kb:0});if(enforceLimit)$('output-bytes').textContent=`${(blob.size/1000).toFixed(2)} KB · ${v.dpi} DPI`;return {v,output,blob};}
  async function action(kind){
    if(!source||busy)return;busy=true;allButtonsDisabled(true);message('Preparing your image on this device…');
    try{
      // Let the busy state paint before running canvas work.
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const {v,output,blob}=await exportPhoto(kind==='photo');
      if(kind==='photo'){download(blob,`${filename}-${v.width}x${v.height}.${v.format==='image/png'?'png':'jpg'}`);message(`Photo ready · ${(blob.size/1000).toFixed(2)} KB · ${v.dpi} DPI. Download started.`);}
      else{
        const layout=core.sheetLayout(v,$('photo-sheet').value),sheet=document.createElement('canvas');sheet.width=layout.width;sheet.height=layout.height;const c=sheet.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,sheet.width,sheet.height);
        for(const pos of layout.positions){c.drawImage(output,pos.x,pos.y,layout.pw,layout.ph);c.strokeStyle='#d9d9d9';c.lineWidth=1;c.strokeRect(pos.x-.5,pos.y-.5,layout.pw+1,layout.ph+1);}
        const sheetBlob=await core.encode(sheet,{format:'image/jpeg',dpi:300,kb:0});
        if(kind==='sheet')download(sheetBlob,`${filename}-${$('photo-sheet').value}-print-sheet.jpg`);
        else{
          const img=new Image(),url=URL.createObjectURL(sheetBlob);img.src=url;await img.decode();img.style.width=layout.width/300+'in';img.style.height=layout.height/300+'in';
          const area=$('photo-print-area');area.replaceChildren(img);area.setAttribute('aria-hidden','false');document.body.classList.add('photo-printing');
          let style=$('photo-print-style');if(!style){style=document.createElement('style');style.id='photo-print-style';document.head.append(style);}style.textContent=`@page {size: ${layout.width/300}in ${layout.height/300}in; margin:0;}`;
          const cleanup=()=>{document.body.classList.remove('photo-printing');area.replaceChildren();area.setAttribute('aria-hidden','true');URL.revokeObjectURL(url);};window.addEventListener('afterprint',cleanup,{once:true});try{window.print();}catch(error){cleanup();throw error;}

        }
        message(`${layout.positions.length} copies arranged on a ${$('photo-sheet').value==='a4'?'A4':'4 × 6 inch'} sheet at 300 DPI. Print at actual size.`);
      }
    }catch(error){message(error.message||'The image could not be exported. Try smaller dimensions.',true);}
    finally{busy=false;allButtonsDisabled(false);}
  }
  $('download-photo').onclick=()=>action('photo');$('download-sheet').onclick=()=>action('sheet');$('print-sheet').onclick=()=>action('print');
})();
