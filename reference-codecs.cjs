const fs = require('node:fs');
const assert = require('node:assert/strict');
const { verseTable } = require('./prepare-reference-library.cjs');
const NONE = 0xffffffff;
function records(data, index, verseMode = false) {
  const result = []; let cursor = 0;
  assert.equal(index.length % 8, 0);
  for (let i = 0; i < index.length / 8; i++) {
    const start = index.readUInt32LE(i*8), body = index.readUInt32LE(i*8+4);
    if (start === NONE && body === NONE) continue;
    const orphan = start === NONE;
    assert.equal(orphan ? body : start, cursor, 'Unaccounted source bytes at slot ' + i);
    if (body === NONE) {
      const end = data.indexOf(0,start); assert.ok(end >= start);
      const title = data.subarray(start,end).toString('latin1');
      if (verseMode) assert.equal(parseInt(title,16),i+1);
      result.push({id:i,title,raw:'',empty:true}); cursor=end+1; continue;
    }
    assert.ok(body <= data.length && (orphan || body > start));
    if (!orphan) assert.equal(data[body-1],0);
    let end=data.indexOf(0,body); if(end<0)end=data.length;
    const title=orphan ? 'Additional source text' : data.subarray(start,body-1).toString('latin1');
    if(verseMode)assert.equal(parseInt(title,16),i+1);
    result.push({id:i,title,raw:data.subarray(body,end).toString('latin1'),...(orphan?{unlabelled:true}:{})});
    cursor=Math.min(end+1,data.length);
  }
  assert.equal(cursor,data.length,'Trailing source bytes');
  return result;
}
function recoverCommentary(data) {
  const out=[]; let at=0, last=0;
  while(at<data.length) {
    const split=data.indexOf(0,at); assert.ok(split>at,'Missing source key');
    const title=data.subarray(at,split).toString('latin1');
    assert.match(title,/^[0-9A-F]+$/i); const serial=parseInt(title,16);
    assert.ok(serial>last&&serial<=31102,'Invalid recovered verse order');
    let end=data.indexOf(0,split+1); if(end<0)end=data.length;
    out.push({id:serial-1,title,raw:data.subarray(split+1,end).toString('latin1')});
    at=Math.min(end+1,data.length); last=serial;
  }
  assert.equal(at,data.length); return out;
}
function bibleRecords(data,index,verses) {
  assert.equal(index.length,(verses.length-1)*7);
  const out=[]; let cursor=0;
  for(let i=0;i<verses.length-1;i++) {
    const start=index.readUInt32LE(i*7), book=index[i*7+4],chapter=index[i*7+5],verse=index[i*7+6];
    const expected=verses[i+1]; assert.equal(start,cursor,'Bible offset mismatch');
    assert.equal(chapter,expected.chapter); assert.equal(verse,expected.verse);
    // Book checks are supplied below without quadratic scans.
    let end=data.indexOf(0,start); if(end<0)end=data.length;
    out.push({id:i,title:(i+1).toString(16),raw:data.subarray(start,end).toString('latin1'),bookNumber:book});
    cursor=Math.min(end+1,data.length);
  }
  let previous='',book=0;
  for(const r of out){const v=verses[r.id+1];if(v.key!==previous){book++;previous=v.key;}assert.equal(r.bookNumber,book);}
  assert.equal(cursor,data.length); return out;
}
function lexiconMetadata(root) {
  const path=require('node:path'),base=path.join(root,'corpus/reference/lexicons/strongs-index/');
  const counts=fs.readFileSync(base+'Strongs.sd0'),ix=fs.readFileSync(base+'Strongs.sd1'),text=fs.readFileSync(base+'Strongs.sd2');
  const greek=counts.readUInt32LE(0),hebrew=counts.readUInt32LE(4);
  assert.equal(greek,5625);assert.equal(hebrew,8675);assert.equal(ix.length,(greek+hebrew)*12);
  const get=n=>[0,4,8].map(offset=>{const start=ix.readUInt32LE(n*12+offset),end=text.indexOf(0,start);assert.ok(start<text.length&&end>=start);return text.subarray(start,end).toString('latin1');});
  const result={};
  for(const [prefix,count,offset] of [['H',hebrew,0],['G',greek,hebrew]]) for(let i=1;i<count;i++){
    const [encoded,transliteration,pronunciation]=get(offset+i);
    result[prefix+i]={transliteration,pronunciation,sourceSpelling:encoded};
  }
  assert.equal(result.H1.transliteration,"'ab");assert.equal(result.G26.transliteration,'agape');
  return result;
}
function verseRange(first,last,verses) {
  if(!(first>0&&last>=first&&last<verses.length))return null;
  const a=verses[first],b=verses[last];
  return first===last?a.ref:a.key===b.key?(a.chapter===b.chapter?a.ref+'-'+b.verse:a.ref+'-'+b.chapter+':'+b.verse):a.ref+'; '+b.ref;
}
function decode(raw, options) {
  const {verses,kind,resourceId,targets,onIssue=()=>{}}=options;
  const segments=[],serials=new Set();
  const clean=s=>s.replace(/\r\n?/g,'\n').replace(/\x02/g,'\n').replace(/\x14/g,'¶').replace(/\x15/g,'§').replace(/[\x04-\x07]/g,'');
  let cursor=0;
  for(const match of raw.matchAll(/\x03([^\x03]*)\x03|»(-?\d+)«/g)) {
    if(match.index>cursor)segments.push(clean(raw.slice(cursor,match.index)));
    if(match[1]!==undefined) {
      const m=/^([0-9A-F]+)(?:-([0-9A-F]+))?$/i.exec(match[1]);
      const first=m?parseInt(m[1],16):0,last=m?parseInt(m[2]||m[1],16):0,ref=verseRange(first,last,verses);
      if(ref){segments.push({ref});for(let n=first;n<=last;n++)serials.add(n);}
      else {segments.push({unavailableReference:match[1]});onIssue('Invalid Scripture token '+match[1]);}
    } else {
      const n=Number(match[2]);
      if(kind==='lexicon') {
        const code=(n<0?'H':'G')+Math.abs(n);
        if((n<0&&-n<=8674)||(n>0&&n<=5624))segments.push({strong:code});
        else {segments.push({unavailableReference:match[0]});onIssue('Unknown lexicon target '+match[2]);}
      } else if(kind==='commentary'||kind==='crossrefs') {
        if(verses[n])segments.push({resource:resourceId,ref:verses[n].ref,label:verses[n].ref});
        else {segments.push({unavailableReference:match[0]});onIssue('Unknown verse-note target '+match[2]);}
      } else if(targets?.has(n))segments.push({resource:resourceId,entry:n,label:targets.get(n)});
      else {segments.push({unavailableReference:match[0]});onIssue('Unknown entry target '+match[2]);}
    }
    cursor=match.index+match[0].length;
  }
  if(cursor<raw.length)segments.push(clean(raw.slice(cursor)));
  for(const s of segments)if(typeof s==='string')assert.ok(!/[\x00-\x09\x0b\x0c\x0e-\x1f]/.test(s),'Unrecognized source control byte');
  return {segments,serials:[...serials]};
}
const plain=segments=>segments.map(s=>typeof s==='string'?s:s.ref||s.strong||s.label||'').join(' ');
function wordCodes(records,data,verses,onIssue) {
  const header=records.length*4;assert.ok(data.length>=header);
  const map=new Map();let expected=0;
  for(const record of records){
    const start=data.readUInt32LE(record.id*4),end=record.id===records.length-1?data.length-header:data.readUInt32LE((record.id+1)*4);
    assert.equal(start,expected);assert.ok(end>=start&&(end-start)%2===0);
    const parts=record.raw.split('\x01');assert.equal(parts.length-1,(end-start)/2,'KJV word-code count mismatch '+(record.id+1));
    const words=[];
    for(let i=0;i<parts.length-1;i++){
      const n=data.readInt16LE(header+start+i*2),code=(n<0?'H':'G')+Math.abs(n);
      const valid=n<0?-n<=8674:n>0&&n<=5624;
      if(!valid)onIssue('Unmapped word code '+n+' at '+(record.id+1));
      words.push({text:parts[i],...(valid?{strong:code}:{})});
    }
    if(parts.at(-1))words.push({text:parts.at(-1)});
    map.set(record.id,words);expected=end;
  }
  assert.equal(header+expected,data.length);return map;
}
module.exports={records,recoverCommentary,bibleRecords,lexiconMetadata,decode,plain,wordCodes,verseTable};
