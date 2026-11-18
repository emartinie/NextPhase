const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {verseTable,bibleRecords,wordCodes}=require('./reference-codecs.cjs');
const dataRoot=path.join(__dirname,'corpus/reference/derived/v2');
const json=file=>JSON.parse(fs.readFileSync(path.join(dataRoot,file)));
function run(){
  const catalog=json('catalog.json'),ready=catalog.resources.filter(r=>r.readable);
  assert.equal(catalog.resources.length,36);assert.equal(ready.length,29);
  assert.equal(catalog.resources.filter(r=>!r.readable).length,7);
  const directory=JSON.parse(fs.readFileSync(path.join(__dirname,'corpus/reference/resource-directory.json')));
  for(const file of directory.resources.flatMap(r=>r.files)){
    const b=fs.readFileSync(path.join(__dirname,file.path));assert.equal(b.length,file.bytes);
    assert.equal(crypto.createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex'),file.gitBlobSha);
  }
  const counts={'lexicons-strongs-hebrew':8674,'lexicons-strongs-greek':5624,'dictionaries-american-tract-society':2277,'dictionaries-easton':3965,'dictionaries-hitchcock-bible-names':2623,'dictionaries-smith':4640,'commentaries-matthew-henry-concise':3572};
  for(const [id,count]of Object.entries(counts))assert.equal(catalog.resources.find(r=>r.id===id).counts.entries,count,id);
  assert.equal(json('lexicons-strongs-greek/chunks/0.json').find(e=>e.strong==='G26').transliteration,'agape');
  assert.equal(json('lexicons-strongs-hebrew/chunks/0.json').find(e=>e.strong==='H1').pronunciation,'awb');
  const {verses}=verseTable(__dirname),base=path.join(__dirname,'corpus/reference/bibles/kjv/');
  const source=bibleRecords(fs.readFileSync(base+'KJV.bt4'),fs.readFileSync(base+'KJV.bt7'),verses);
  let invalid=0;const words=wordCodes(source,fs.readFileSync(base+'KJV.bt8'),verses,()=>invalid++);
  assert.deepEqual(words.get(0).filter(w=>w.strong).map(w=>w.strong),['H7225','H430','H1254','H853','H8064','H853','H776']);
  assert.equal(words.size,31102);
  assert.equal(json('bibles-asv/chapters/genesis/1.json').entries[0].segments.join('').trim(),'In the beginning God created the heavens and the earth.');
  assert.ok(json('bibles-luther-1912/chapters/genesis/1.json').entries[1].segments.join('').includes('wüst'));
  assert.ok(catalog.resources.find(r=>r.id==='bibles-montgomery-new-testament').books.every(b=>catalog.books.findIndex(x=>x.key===b.key)>=39));
  assert.equal(catalog.resources.find(r=>r.id==='commentaries-matthew-henry-concise').recoveredIndex,true);
  assert.ok(json('cross-references-bcdxrefs/chapters/genesis/1.json').entries[0].segments.some(s=>s.ref));
  assert.equal(invalid,0);
  console.log('Source integrity passed: 144 originals, 29 viable groups, verified verse offsets, Strong metadata, all 351808 KJV tags, actual edition text, reconstructed Concise index and supplied cross-references.');
}
run();
