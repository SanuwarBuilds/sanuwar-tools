/* Pure image geometry and metadata helpers, shared with the export tests. */
(function (root) {
  'use strict';
  function settings(values) {
    const width = Number(values.width), height = Number(values.height), dpi = Number(values.dpi);
    const kb = values.kb === '' || values.kb == null ? 0 : Number(values.kb);
    if (![width,height,dpi].every(Number.isInteger) || width < 16 || height < 16 || width > 4096 || height > 4096 || dpi < 72 || dpi > 1200)
      throw new Error('Use whole-number dimensions from 16–4096 px and DPI from 72–1200.');
    if (width/height < .05 || width/height > 20) throw new Error('Use an aspect ratio between 1:20 and 20:1.');
    if (!Number.isFinite(kb) || kb < 0 || kb > 20000 || (kb > 0 && kb < 1)) throw new Error('Maximum size must be 1–20,000 KB, or leave it blank.');
    if (!['image/jpeg','image/png'].includes(values.format)) throw new Error('Choose JPG or PNG.');
    return {width,height,dpi,kb,format:values.format};
  }
  function crop(sw, sh, tw, th, zoom, x, y) {
    const scale = Math.max(tw/sw,th/sh) * zoom;
    const width = tw/scale, height = th/scale;
    return {x:Math.max(0,sw-width)*Math.max(0,Math.min(1,x)), y:Math.max(0,sh-height)*Math.max(0,Math.min(1,y)), width,height};
  }
  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) { crc ^= byte; for(let bit=0;bit<8;bit++) crc=(crc>>>1)^((crc&1)?0xedb88320:0); }
    return (crc^0xffffffff)>>>0;
  }
  function pngDpi(bytes,dpi) {
    const ppm=Math.round(dpi/0.0254), chunk=new Uint8Array(21), v=new DataView(chunk.buffer);
    v.setUint32(0,9); chunk.set([112,72,89,115],4);v.setUint32(8,ppm);v.setUint32(12,ppm);chunk[16]=1;v.setUint32(17,crc32(chunk.subarray(4,17)));
    const parts=[bytes.subarray(0,8)]; let at=8;
    while(at+12<=bytes.length){const n=new DataView(bytes.buffer,bytes.byteOffset+at,4).getUint32(0),end=at+n+12;
      if(end>bytes.length) throw new Error('Invalid PNG data.');
      const type=String.fromCharCode(...bytes.subarray(at+4,at+8));
      if(type!=='pHYs') parts.push(bytes.subarray(at,end));
      if(type==='IHDR') parts.push(chunk);at=end;}
    return parts;
  }
  function jpegDpi(bytes,dpi) {
    // New canvas encodes have no EXIF. Replace/add JFIF with physical DPI units.
    if (bytes[0]!==255 || bytes[1]!==216) throw new Error('Invalid JPEG data.');
    const header=new Uint8Array([255,224,0,16,74,70,73,70,0,1,1,1,dpi>>8,dpi&255,dpi>>8,dpi&255,0,0]);
    const jfif=bytes[2]===255&&bytes[3]===224&&String.fromCharCode(...bytes.subarray(6,11))==='JFIF\0';
    const skip=jfif?4+((bytes[4]<<8)|bytes[5]):2;
    return [bytes.subarray(0,2),header,bytes.subarray(skip)];
  }
  async function withDpi(blob,dpi) {
    const bytes=new Uint8Array(await blob.arrayBuffer());
    return new Blob(blob.type==='image/png'?pngDpi(bytes,dpi):jpegDpi(bytes,dpi),{type:blob.type});
  }
  async function encode(canvas, options) {
    const encodeAt=quality=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('This browser could not create the image.')),options.format,quality));
    const limit=options.kb?Math.floor(options.kb*1000):Infinity;
    let blob=await withDpi(await encodeAt(.95),options.dpi);
    if(blob.size<=limit) return blob;
    if(options.format==='image/png') throw new Error('PNG is larger than your KB limit. Choose JPG or increase the limit.');
    let best=await withDpi(await encodeAt(.03),options.dpi);
    if(best.size>limit) throw new Error('This KB limit is too small for these dimensions. Increase the limit or reduce width and height.');
    let low=.03,high=.95;
    for(let i=0;i<9;i++){const mid=(low+high)/2,candidate=await withDpi(await encodeAt(mid),options.dpi);if(candidate.size<=limit){best=candidate;low=mid;}else high=mid;}
    return best;
  }
  function sheetLayout(options, paper) {
    const width=paper==='a4'?2480:1200,height=paper==='a4'?3508:1800;
    const pw=Math.round(options.width/options.dpi*300),ph=Math.round(options.height/options.dpi*300),margin=35,gap=24;
    if(pw<24||ph<24) throw new Error('Photo is too small to arrange on a print sheet at this DPI.');
    const cols=Math.floor((width-margin*2+gap)/(pw+gap)),rows=Math.floor((height-margin*2+gap)/(ph+gap));
    if(cols<1||rows<1) throw new Error('Photo is larger than this paper. Choose A4, reduce dimensions or increase DPI.');
    const count=Math.min(cols*rows,60), positions=[];
    const usedCols=Math.min(cols,count), startX=(width-(usedCols*pw+(usedCols-1)*gap))/2;
    for(let i=0;i<count;i++) positions.push({x:Math.round(startX+(i%cols)*(pw+gap)),y:margin+Math.floor(i/cols)*(ph+gap)});
    return {width,height,pw,ph,positions};
  }
  const api={settings,crop,crc32,pngDpi,jpegDpi,withDpi,encode,sheetLayout};
  if(typeof module==='object'&&module.exports) module.exports=api;else root.PhotoCore=api;
})(typeof window==='object'?window:globalThis);
