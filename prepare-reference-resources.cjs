const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const codec=require('./reference-codecs.cjs');
const root=__dirname,base=path.join(root,'corpus/reference'),out=path.join(base,'derived/v2');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const gitHash=b=>crypto.createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
const write=(file,data)=>{const p=path.join(out,file);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(data)+'\n');};
function prepare(){
  const directory=JSON.parse(fs.readFileSync(path.join(base,'resource-directory.json')));
  const {books,verses}=codec.verseTable(root),lex=codec.lexiconMetadata(root);
  const catalog={schemaVersion:2,books,resources:[],sourceCommit:directory.sourceCommit},issues=[],ledger=[];
  const blocked=new Map([
    ['bibles-nasb','Protected/encoded Bible text; no documented decoding or full-edition redistribution permission supplied.'],
    ['bibles-nasb-1995','Protected/encoded Bible text; no documented decoding or full-edition redistribution permission supplied.'],
    ['bibles-niv','Protected/encoded Bible text; no documented decoding or full-edition redistribution permission supplied.'],
    ['bibles-nrsv','Protected/encoded Bible text; no documented decoding or full-edition redistribution permission supplied.']
  ]);
  const languages={'bibles-luther-1912':'de'};
  for(const original of directory.resources){
    const resource={id:original.id,title:original.title,category:original.category,files:original.files,readable:false,language:languages[original.id]||'en',sourceFiles:[],counts:{},search:[]};
    try{
      for(const f of original.files){
        const p=path.join(root,f.path);assert.ok(fs.existsSync(p),'Missing supplied file '+f.path);
        const b=fs.readFileSync(p);assert.equal(b.length,f.bytes);assert.equal(gitHash(b),f.gitBlobSha,'Source changed '+f.path);
        resource.sourceFiles.push({path:f.path,bytes:b.length,sha256:hash(b)});
      }
      if(blocked.has(resource.id))throw Error(blocked.get(resource.id));
      if(resource.id==='lexicons-strongs-index'){
        resource.kind='support';resource.displayTitle="Strong's Word Index";resource.readable=true;
        resource.integratedWith=['lexicons-strongs-hebrew','lexicons-strongs-greek'];resource.counts.entries=Object.keys(lex).length;
        catalog.resources.push(resource);ledger.push({id:resource.id,state:'integrated',purpose:'Supplied transliterations and pronunciations enrich both Strong dictionaries.',sourceFiles:resource.sourceFiles});continue;
      }
      const main=original.files.find(f=>/\.(?:bt|ct|dt|tt|gx|hx|xr)4$/i.test(f.path));
      if(!main)throw Error('No source text file supplied; header/index files cannot supply its missing contents.');
      const index=original.files.find(f=>/\.(?:bt|ct|dt|tt|gx|hx|xr)7$/i.test(f.path)),data=fs.readFileSync(path.join(root,main.path));
      resource.kind=original.category==='bibles'?'bible':original.category==='commentaries'?'commentary':original.category==='cross-references'?'crossrefs':original.category==='lexicons'?'lexicon':original.category==='devotionals'?'devotional':original.category==='topics'?'topic':'dictionary';
      const verseKind=['bible','commentary','crossrefs'].includes(resource.kind);
      let records;
      if(resource.kind==='bible')records=codec.bibleRecords(data,fs.readFileSync(path.join(root,index.path)),verses);
      else if(index)records=codec.records(data,fs.readFileSync(path.join(root,index.path)),verseKind);
      else if(resource.id==='commentaries-matthew-henry-concise'){records=codec.recoverCommentary(data);resource.recoveredIndex=true;}
      else throw Error('Required text index absent and no validated reconstruction is available.');
      const targets=new Map(records.map(r=>[r.id,r.title])),localIssues=[];
      const issue=(id,message)=>{localIssues.push({entry:id,message});};
      let words;
      if(resource.id==='bibles-kjv'){
        const file=original.files.find(f=>f.path.endsWith('.bt8'));
        words=codec.wordCodes(records,fs.readFileSync(path.join(root,file.path)),verses,m=>issue(null,m));
        resource.wordLinks=true;
      }
      const indexEntries=[],entryChunks=new Map(),chapters=new Map(),byBook=Object.fromEntries(books.map(b=>[b.key,{}]));
      let searchShard=[],searchSize=0,searchNumber=0;
      const flushSearch=()=>{if(!searchShard.length)return;const file=resource.id+'/search/'+searchNumber+++'.json';write(file,searchShard);resource.search.push(file);searchShard=[];searchSize=0;};
      const present=new Map();let count=0,citations=0;
      for(const record of records){
        if(resource.kind==='bible'&&record.raw.trim()==='-')continue;
        if(verseKind&&!record.raw.trim())continue;
        const raw=resource.kind==='bible'?record.raw.replace(/\x01/g,''):record.raw;
        const decoded=codec.decode(raw,{verses,kind:resource.kind,resourceId:resource.id,targets,onIssue:m=>issue(record.id,m)});
        const entry={id:record.id,title:record.title,segments:decoded.segments};
        if(record.unlabelled){entry.unlabelled=true;issue(record.id,'Body retained with no supplied headword.');}
        if(resource.kind==='lexicon'){
          const strong=(resource.id.endsWith('hebrew')?'H':'G')+Number(record.title);
          assert.ok(lex[strong],'Missing Strong metadata '+strong);
          Object.assign(entry,{strong,transliteration:lex[strong].transliteration,pronunciation:lex[strong].pronunciation});
          entry.title=strong+' · '+entry.transliteration;
        }
        if(verseKind){
          const v=verses[record.id+1];assert.ok(v);
          Object.assign(entry,{title:v.ref,ref:v.ref,verse:v.verse});
          if(words)entry.words=words.get(record.id);
          const chapter=v.key+'/'+v.chapter;
          if(!chapters.has(chapter))chapters.set(chapter,{book:v.book,chapter:v.chapter,entries:[]});
          chapters.get(chapter).entries.push(entry);
          if(!present.has(v.key))present.set(v.key,new Set());present.get(v.key).add(v.chapter);
        }else{
          const bucket=Math.floor(record.id/100);
          if(!entryChunks.has(bucket))entryChunks.set(bucket,[]);
          entryChunks.get(bucket).push(entry);
          indexEntries.push({id:entry.id,title:entry.title,...(entry.strong?{strong:entry.strong,transliteration:entry.transliteration,pronunciation:entry.pronunciation}:{})});
          for(const serial of decoded.serials){const v=verses[serial];(byBook[v.key][v.chapter+':'+v.verse]??=[]).push(entry.id);}
        }
        const text=codec.plain(entry.segments);
        const search={id:entry.id,title:entry.title,text,...(entry.ref?{ref:entry.ref}:{}),...(entry.strong?{strong:entry.strong}:{})};
        searchShard.push(search);searchSize+=text.length;if(searchSize>450000)flushSearch();
        citations+=decoded.segments.filter(s=>typeof s!=='string').length;count++;
      }
      flushSearch();
      for(const [chunk,entries]of entryChunks)write(resource.id+'/chunks/'+chunk+'.json',entries);
      for(const [chapter,value]of chapters)write(resource.id+'/chapters/'+chapter+'.json',value);
      if(!verseKind){
        write(resource.id+'/index.json',{entries:indexEntries,chunkSize:100});
        for(const book of books)write(resource.id+'/passages/'+book.key+'.json',byBook[book.key]);
      }
      resource.readable=true;resource.counts={entries:count,citationLinks:citations,sourceIssues:localIssues.length};
      if(verseKind)resource.books=books.filter(b=>present.has(b.key)).map(b=>({name:b.name,key:b.key,chapters:[...present.get(b.key)]}));
      resource.releaseReview=['bibles-nkjv','bibles-modern-king-james','bibles-bbe','commentaries-teachers-commentary'].includes(resource.id)?'edition-permission-review':'provenance-review';
      issues.push(...localIssues.map(i=>({resource:resource.id,...i})));
      ledger.push({id:resource.id,title:resource.title,state:'functional',kind:resource.kind,counts:resource.counts,sourceFiles:resource.sourceFiles,
        ...(resource.recoveredIndex?{qualification:'Missing .ct7 rebuilt only from strictly increasing supplied hexadecimal verse keys; text is not substituted.'}:{}),
        ...(resource.wordLinks?{qualification:'Every supplied KJV tag count matches its .bt8 code count; links belong to source KJV phrases, not other editions.'}:{}),
        releaseReview:resource.releaseReview});
      console.log(resource.id+': '+count+' entries');
    }catch(error){
      resource.readable=false;resource.blocker=error.message;
      ledger.push({id:resource.id,title:resource.title,state:'blocked',reason:error.message,sourceFiles:resource.sourceFiles});
      console.log(resource.id+': blocked — '+error.message);
    }
    catalog.resources.push(resource);
  }
  write('catalog.json',catalog);write('source-issues.json',issues);
  fs.writeFileSync(path.join(root,'REFERENCE-INTEGRATION-LEDGER.json'),JSON.stringify({schemaVersion:2,resources:ledger,issues,
    notes:['Original bytes preserved and checked against the reviewed Git blobs.','No protected Bible text was decrypted.','Original-script font reconstruction is not inferred; Strong transliterations and pronunciations are supplied data.','Local functionality does not grant redistribution rights. Review edition permissions before any publication.']},null,2)+'\n');
  return {functional:catalog.resources.filter(r=>r.readable).length,blocked:ledger.filter(r=>r.state==='blocked'),issues:issues.length};
}
if(require.main===module)console.log(JSON.stringify(prepare(),null,2));
module.exports={prepare};
