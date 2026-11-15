"use strict";
const assert = require('node:assert/strict');
const {prepare, search} = require('../static/assets/js/site-search.js');
const entries = prepare([
  {name:'Image Compressor', category:'Tool', description:'Compress JPG JPEG photos', href:'/tools/image-compressor'},
  {name:'CapCut Pro', category:'Download', description:'Video editor', keywords:'Apps APK', href:'/downloads?item=capcut'},
  {name:'Electricity notes.pdf', category:'File', description:'Class 12 Physics album', href:'/downloads?item=notes&file=Electricity'},
  {name:'Admin · Site settings', category:'Admin', description:'Manage website settings', href:'/admin#settings'},
]);
for (const [query, name] of [
  ['compressor image','Image Compressor'], ['image compresor','Image Compressor'],
  ['image comperssor','Image Compressor'], ['pic compress','Image Compressor'],
  ['capcut apk','CapCut Pro'], ['physics pdf','Electricity notes.pdf'],
  ['settings admin','Admin · Site settings'],
]) assert.equal(search(entries, query)[0]?.name, name, query);
assert.equal(search(entries,'completely unrelated').length,0);
assert.equal(search(entries,'   ').length,4);
assert.equal(search(entries,'Image Compressor')[0].name,'Image Compressor');
assert.equal(search(prepare([{name:'Remote', category:'Download'}, {name:'GST', description:'Add or remove GST'}]), 'remote').length, 1);
console.log('site_search.test.cjs: all assertions passed');
