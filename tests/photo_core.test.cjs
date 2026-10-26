const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const core=require('../static/assets/js/photo-core.js');
const base={width:197,height:276,dpi:200,kb:20,format:'image/jpeg'};
test('settings reject unbounded, non-integer and unsupported exports',()=>{
 for(const invalid of [{width:4097},{height:15},{width:NaN},{dpi:0},{width:197.5},{kb:-1},{kb:Infinity},{kb:.5},{format:'image/svg+xml'},{width:4096,height:16}])assert.throws(()=>core.settings({...base,...invalid}));
 assert.equal(core.settings({...base,kb:''}).kb,0);
});
test('crop remains inside image at extremes and preserves output aspect',()=>{
 for(const zoom of [1,1.5,3])for(const x of [0,.5,1])for(const y of [0,.5,1]){
  const r=core.crop(900,1200,197,276,zoom,x,y);
  assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=900.00001&&r.y+r.height<=1200.00001);
  assert.ok(Math.abs(r.width/r.height-197/276)<1e-10);
 }
 const wide=core.crop(1200,900,300,300,1,.5,.5);assert.deepEqual(wide,{x:150,y:0,width:900,height:900});
});
test('print layout uses physical photo size and bounded sheet pixels',()=>{
 const sheet=core.sheetLayout({width:413,height:531,dpi:300},'4x6');assert.equal(sheet.width,1200);assert.equal(sheet.height,1800);assert.equal(sheet.positions.length,6);
 for(const p of sheet.positions){assert.ok(p.x>=0&&p.x+sheet.pw<=sheet.width);assert.ok(p.y>=0&&p.y+sheet.ph<=sheet.height);}
 assert.throws(()=>core.sheetLayout({width:4096,height:4096,dpi:72},'a4'));
 assert.throws(()=>core.sheetLayout({width:16,height:16,dpi:1200},'a4'));
});
test('PNG resolution chunk follows IHDR, has valid CRC and replaces old density',()=>{
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGN8AAAAASUVORK5CYII=','base64');
 const bytes=Buffer.concat(core.pngDpi(png,300));assert.equal(bytes.subarray(12,16).toString(),'IHDR');assert.equal(bytes.subarray(37,41).toString(),'pHYs');assert.equal(bytes.readUInt32BE(41),11811);
 assert.equal(bytes.readUInt32BE(50),core.crc32(bytes.subarray(37,50)));
 assert.equal(Buffer.concat(core.pngDpi(bytes,200)).length,bytes.length);
});
test('JPEG resolution is replaced rather than appending conflicting JFIF',()=>{
 const sample=Uint8Array.from([255,216,255,224,0,16,74,70,73,70,0,1,1,0,0,1,0,1,0,0,255,217]);
 const bytes=Buffer.concat(core.jpegDpi(sample,300));assert.equal(bytes.length,sample.length);assert.equal(bytes[13],1);assert.equal(bytes.readUInt16BE(14),300);assert.equal(bytes.readUInt16BE(16),300);
});
test('encoder enforces final KB limit including density metadata',async()=>{
 const canvas={toBlob(callback,type,quality){callback(new Blob([new Uint8Array([255,216]),new Uint8Array(Math.round(quality*6000+100))],{type}));}};
 const blob=await core.encode(canvas,{...base,kb:1});assert.ok(blob.size<=1000);
 await assert.rejects(core.encode(canvas,{...base,kb:.05}),/too small/);
 const pngCanvas={toBlob(callback,type){const minimal=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGN8AAAAASUVORK5CYII=','base64');callback(new Blob([minimal,new Uint8Array(2000)],{type}));}};
 await assert.rejects(core.encode(pngCanvas,{...base,format:'image/png',kb:1}),/Choose JPG/);
});
