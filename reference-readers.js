import { getFunctionalReferenceData as load, readPassage } from './corpus.js';
export const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().replace(/\s+/g,' ').trim();
export const isPassage = r => ['bible','commentary','crossrefs'].includes(r.kind);
export function createReferenceReaders({node,text,button,row,cluster,disclosure,link,open,defaultRef,updateUrl}) {
  const key = name => name.toLowerCase().replace(/[^a-z0-9]/g,'');
  const catalog = () => load('catalog.json');
  const openResource = (id,data={}) => open('referenceResource',{id,...data});
  function strongLink(code,ref) { openResource(code.startsWith('H')?'lexicons-strongs-hebrew':'lexicons-strongs-greek',{entry:code,ref}); }
  function prose(parts,ref,words=false) {
    const body=node('div','','reference-prose');
    for(const part of parts) {
      if(typeof part==='string')body.append(document.createTextNode(part));
      else if(part.strong) {
        const label=words?(part.text||' '+part.strong+' '):part.strong;
        const control=button(label,()=>strongLink(part.strong,ref),'reference-citation');
        control.title=part.strong; body.append(control);
      }else if(part.resource)body.append(button(part.label||part.ref,()=>openResource(part.resource,{ref:part.ref||ref,...(part.entry!==undefined?{entry:String(part.entry)}:{})}),'reference-citation'));
      else if(part.ref)body.append(button(part.ref,()=>open('reader',{ref:part.ref}),'reference-citation'),document.createTextNode(' '));
      else if(part.unavailableReference)body.append(document.createTextNode(' [reference unavailable] '));
      else if(part.text)body.append(document.createTextNode(part.text));
    }
    return body;
  }
  function edition(resource) {
    const source='https://github.com/emartinie/NextPhase/tree/9379053401b299d7975acbc1e85474a17c91c390/'+resource.files[0].path.split('/').slice(0,-1).join('/');
    const notice=resource.id==='bibles-nkjv'?'New King James Version © 1982 Thomas Nelson. All rights reserved.':resource.title;
    return disclosure('About this edition',text(notice),link('Source reference ↗',source));
  }
  function context(target,frame,go) {
    const label=node('label','Scripture passage'),input=node('input');input.value=frame.data.ref||defaultRef();input.maxLength=180;input.required=true;label.append(input);
    const form=node('form'),submit=node('button','Open passage','button');submit.type='submit';form.append(label,submit);
    const details=disclosure('Passage · '+input.value+' · Change',form);
    form.addEventListener('submit',e=>{e.preventDefault();frame.data.ref=input.value.trim();details.querySelector('summary').textContent='Passage · '+frame.data.ref+' · Change';updateUrl(frame);go();});
    target.append(details);return input;
  }
  function searchForm(target,resource,frame,expanded=false,run) {
    const form=node('form'),label=node('label','Search this resource'),input=node('input');input.type='search';input.maxLength=120;input.value=frame.data.q||'';input.required=true;label.append(input);
    const submit=node('button','Search text','button');submit.type='submit';form.append(label,submit);
    form.addEventListener('submit',e=>{e.preventDefault();if(run)run(input.value);else openResource(resource.id,{ref:frame.data.ref,q:input.value,view:'search'});});
    if(expanded)target.append(form);else target.append(disclosure('Search this resource',form));
    return input;
  }
  async function fullSearch(target,resource,frame) {
    target.append(node('h3',resource.displayTitle||resource.title));
    const status=text(''),results=node('div','','rows');status.setAttribute('role','status');
    let generation=0,limit=40,searching=false,resumeSearch=false;
    frame.onLeave=()=>{if(searching){generation++;searching=false;resumeSearch=true;}};
    frame.refresh=()=>{if(resumeSearch){resumeSearch=false;search();}};
    const more=button('Show more results',()=>{limit+=40;search();});more.hidden=true;
    async function search(q=frame.data.q) {
      const version=++generation,query=normalize(q);frame.data.q=q;updateUrl(frame);results.replaceChildren();more.hidden=true;
      if(!query){status.textContent='Enter a word or phrase.';return;}
      status.textContent='Searching…';searching=true;let found=0,stopped=false;
      try{
        for(const file of resource.search){
          const entries=await load(file);if(version!==generation)return;
          for(const entry of entries)if(normalize(entry.title+' '+entry.text).includes(query)){
            found++;if(found<=limit)results.append(row(entry.title,entry.text.replace(/\s+/g,' ').slice(0,145),
              ()=>openResource(resource.id,entry.ref?{ref:entry.ref}:{entry:String(entry.id),ref:frame.data.ref})));
            if(found>limit){stopped=true;break;}
          }
          if(stopped)break;
        }
        if(version!==generation)return;
        status.textContent=found?(stopped?'More than '+limit:found)+' results':'No matching text.';
        more.hidden=!stopped;
      }catch{if(version===generation)status.textContent='Search is unavailable. Try again.';}
      finally{if(version===generation)searching=false;}
    }
    searchForm(target,resource,frame,true,q=>{limit=40;search(q);});target.append(status,results,more);await search();
  }
  async function entryIndex(resource) {
    if(resource.kind!=='support')return load(resource.id+'/index.json');
    const values=await Promise.all(resource.integratedWith.map(id=>load(id+'/index.json')));
    return {entries:values.flatMap((v,i)=>v.entries.map(entry=>({...entry,resource:resource.integratedWith[i]})))};
  }
  async function entries(target,resource,frame) {
    const index=await entryIndex(resource);let limit=40,generation=0;
    target.append(node('h3',resource.displayTitle||resource.title));
    if(resource.kind==='lexicon'||resource.kind==='support')target.append(text('Search a Strong’s number, transliteration, or word.'));
    const field=node('label',resource.kind==='lexicon'||resource.kind==='support'?'Find a word or Strong’s number':'Find an entry'),input=node('input');input.type='search';input.maxLength=120;input.value=frame.data.q||'';field.append(input);
    const status=text(''),results=node('div','','rows'),more=button('Show more entries',()=>{limit+=40;render();});status.setAttribute('role','status');
    const controls=cluster(button('Browse all',()=>{frame.data.view='';updateUrl(frame);render();},'quiet'));
    if(['dictionary','topic','devotional'].includes(resource.kind))controls.append(button('For this passage',()=>{frame.data.view='related';input.value='';frame.data.q='';updateUrl(frame);render();},'quiet'));
    const searchText=resource.kind==='support'?null:button(resource.kind==='lexicon'?'Search definitions':'Search full text',()=>{if(input.value.trim())openResource(resource.id,{ref:frame.data.ref,q:input.value,view:'search'});},'quiet');
    if(searchText){searchText.disabled=!input.value.trim();controls.append(searchText);}
    async function render(){
      const version=++generation,q=normalize(input.value).replace(/^([hg])0+(\d+)$/,'$1$2');let ids;
      status.textContent='Finding entries…';more.hidden=true;results.replaceChildren();
      try{
        if(frame.data.view==='related'&&!q){
          ids=new Set();const groups=await readPassage(frame.data.ref||defaultRef());
          for(const group of groups){
            const references=await load(resource.id+'/passages/'+key(group.book)+'.json');
            for(const chapter of group.chapters)for(const verse of chapter.verses)for(const id of references[chapter.chapter+':'+verse.verse]||[])ids.add(id);
          }
        }
        if(version!==generation)return;
        let matches=index.entries.filter(e=>(!ids||ids.has(e.id))&&(!q||normalize(e.title+' '+(e.transliteration||'')+' '+(e.pronunciation||'')).includes(q)));
        const code=/^(?:[hg]\s*)?\d+$/i.test(q)?q.replace(/\s/g,'').toUpperCase():null;
        if(code)matches.sort((a,b)=>Number((b.strong||'')===code||String(b.id+1)===code)-Number((a.strong||'')===code||String(a.id+1)===code));
        results.replaceChildren(...matches.slice(0,limit).map(entry=>row(entry.title,entry.pronunciation||resource.title,
          ()=>openResource(entry.resource||resource.id,{entry:entry.strong||String(entry.id),ref:frame.data.ref}))));
        status.textContent=matches.length+' entries'+(ids?' citing this passage':'');
        if(!matches.length)status.textContent+=' · Try another word or browse all.';
        more.hidden=matches.length<=limit;
      }catch{if(version===generation)status.textContent='These entries could not be opened. Try another passage or browse all.';}
    }
    input.addEventListener('input',()=>{frame.data.q=input.value;limit=40;if(searchText)searchText.disabled=!input.value.trim();updateUrl(frame);render();});
    target.append(field,controls);
    if(resource.kind!=='lexicon'&&resource.kind!=='support')context(target,frame,render);
    target.append(status,results,more,edition(resource));await render();
  }
  async function entry(target,resource,frame) {
    const index=await entryIndex(resource),value=String(frame.data.entry).replace(/^([HG])0+(\d+)$/i,'$1$2');
    const meta=/^[HG]\d+$/i.test(value)?index.entries.find(e=>e.strong===value.toUpperCase()):index.entries.find(e=>String(e.id)===value);
    if(!meta){target.append(text('This entry is unavailable.'));return;}
    if(meta.resource){openResource(meta.resource,{entry:meta.strong||String(meta.id),ref:frame.data.ref});return;}
    const chunk=await load(resource.id+'/chunks/'+Math.floor(meta.id/100)+'.json'),entry=chunk.find(e=>e.id===meta.id);
    if(!entry)throw Error('Missing reference entry');
    target.append(node('h3',entry.title));
    if(entry.pronunciation)target.append(text(entry.pronunciation));
    target.append(text(resource.title),entry.segments.length?prose(entry.segments,frame.data.ref):text('No entry text is available.'),edition(resource));
  }
  async function passage(target,resource,frame) {
    target.append(node('h3',resource.title));frame.data.ref||=defaultRef();
    const status=text(''),results=node('div','','rows');status.setAttribute('role','status');let generation=0,limit=40,current;
    const locationInput=context(target,frame,()=>{limit=40;render();});
    const pickers=node('div','','assessment-pickers'),bookLabel=node('label','Book'),chapterLabel=node('label','Chapter');
    const bookPicker=node('select'),chapterPicker=node('select');bookPicker.setAttribute('aria-label','Book');chapterPicker.setAttribute('aria-label','Chapter');
    bookPicker.append(new Option('Choose book',''),...resource.books.map(b=>new Option(b.name,b.key)));bookLabel.append(bookPicker);chapterLabel.append(chapterPicker);pickers.append(bookLabel,chapterLabel);
    function choose(book,chapter){frame.data.ref=book.name+' '+chapter;locationInput.value=frame.data.ref;locationInput.closest('details').querySelector('summary').textContent='Passage · '+frame.data.ref+' · Change';limit=40;updateUrl(frame);render();}
    bookPicker.addEventListener('change',()=>{const b=resource.books.find(b=>b.key===bookPicker.value);if(b)choose(b,b.chapters[0]);});
    chapterPicker.addEventListener('change',()=>{const b=resource.books.find(b=>b.key===bookPicker.value);if(b&&chapterPicker.value)choose(b,Number(chapterPicker.value));});
    const prev=button('Previous chapter',()=>move(-1),'quiet'),next=button('Next chapter',()=>move(1),'quiet');
    const controls=cluster(prev,next,button('Resources',()=>open('referenceLibrary',{ref:frame.data.ref}),'quiet'));
    if(resource.wordLinks){
      const words=button('Word study',()=>{frame.data.view=frame.data.view==='words'?'':'words';words.setAttribute('aria-pressed',String(frame.data.view==='words'));updateUrl(frame);render();},'quiet');
      words.setAttribute('aria-pressed',String(frame.data.view==='words'));controls.append(words);
    }
    function move(offset){if(!current)return;const book=resource.books.find(b=>b.key===key(current.book));const i=book.chapters.indexOf(current.chapter);const chapter=book.chapters[i+offset];if(chapter){frame.data.ref=current.book+' '+chapter;locationInput.value=frame.data.ref;locationInput.closest('details').querySelector('summary').textContent='Passage · '+frame.data.ref+' · Change';limit=40;updateUrl(frame);render();}}
    const more=button('Show more verses',()=>{limit+=40;render();});more.hidden=true;
    async function render(){
      const version=++generation;status.textContent='Opening passage…';results.replaceChildren();more.hidden=true;
      try{
        const groups=await readPassage(frame.data.ref);if(version!==generation)return;
        current={book:groups[0].book,chapter:groups[0].chapters[0].chapter};
        const book=resource.books.find(b=>b.key===key(current.book)),at=book?.chapters.indexOf(current.chapter);
        bookPicker.value=book?.key||'';chapterPicker.replaceChildren(new Option('Choose chapter',''),...(book?.chapters||[]).map(c=>new Option(String(c),String(c))));chapterPicker.value=book?.chapters.includes(current.chapter)?String(current.chapter):'';
        prev.disabled=!book||at<=0;next.disabled=!book||at<0||at>=book.chapters.length-1;
        const selected=groups.flatMap(g=>g.chapters.flatMap(c=>c.verses.map(v=>({book:g.book,key:key(g.book),chapter:c.chapter,verse:v.verse}))));
        const shown=selected.slice(0,limit),chapters=new Map();
        await Promise.all(shown.map(v=>{const id=v.key+'/'+v.chapter;if(!chapters.has(id))chapters.set(id,resource.books.some(b=>b.key===v.key&&b.chapters.includes(v.chapter))?load(resource.id+'/chapters/'+id+'.json'):Promise.resolve({entries:[]}));return chapters.get(id);}));
        if(version!==generation)return;let available=0;
        for(const v of shown){
          const chapter=await chapters.get(v.key+'/'+v.chapter),e=chapter.entries.find(e=>e.verse===v.verse),ref=v.book+' '+v.chapter+':'+v.verse;
          const block=node('section','','reference-entry'),heading=node('h4');
          heading.append(button(ref,()=>open('reader',{ref}),'reference-citation'));block.append(heading);
          if(e){available++;block.append(prose(resource.wordLinks&&frame.data.view==='words'?e.words:e.segments,ref,resource.wordLinks&&frame.data.view==='words'));}
          else block.append(text(resource.kind==='bible'?'This edition has no text for this verse.':'No entry for this verse.'));
          results.append(block);
        }
        status.textContent=frame.data.ref+' · '+available+' entries';more.hidden=shown.length>=selected.length;
      }catch{if(version===generation)status.textContent='This passage could not be opened. Check the reference and try again.';}
    }
    target.append(pickers,controls);searchForm(target,resource,frame);target.append(status,results,more,edition(resource));await render();
  }
  async function resourceView(target,frame){
    const r=(await catalog()).resources.find(r=>r.id===frame.data.id);
    target.lang=r?.language||'en';
    if(!r?.readable){target.append(node('h3',r?.title||'Reference Library'),text('This edition is unavailable.'));return;}
    if(frame.data.entry!==undefined&&frame.data.entry!=='')return entry(target,r,frame);
    if(frame.data.view==='search'&&r.kind!=='support')return fullSearch(target,r,frame);
    return isPassage(r)?passage(target,r,frame):entries(target,r,frame);
  }
  return {resourceView,context,edition,prose};
}
