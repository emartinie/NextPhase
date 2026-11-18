import { getFunctionalReferenceData as load } from './corpus.js';
import { createReferenceReaders, normalize, isPassage } from './reference-readers.js';

const categories=[
  ['lexicons','Hebrew & Greek'],['dictionaries','Dictionaries'],['commentaries','Commentaries'],
  ['bibles','Bible translations'],['topics','Topical references'],['cross-references','Cross-references'],['devotionals','Daily readings']
];
export function createReferenceLibraryViews(helpers) {
  const {node,text,button,row,disclosure,open,defaultRef,updateUrl}=helpers;
  const readers=createReferenceReaders(helpers);
  const views={
    async referenceLibrary(target,frame) {
      frame.data.ref||=defaultRef();
      const catalog=await load('catalog.json');
      const field=node('label','Find a resource'),input=node('input');input.type='search';input.maxLength=120;input.value=frame.data.q||'';input.placeholder="Strong’s, commentary, translation…";field.append(input);
      const status=text(''),results=node('div','','rows');status.setAttribute('role','status');
      const expanded=new Set();
      function render(){
        const q=normalize(input.value);
        const matched=catalog.resources.filter(r=>r.readable&&(!q||normalize(r.title+' '+(r.displayTitle||'')+' '+r.id).includes(q)));
        const sections=categories.map(([id,label])=>{
          const entries=matched.filter(r=>r.category===id);if(!entries.length)return null;
          const list=node('div','','rows');
          list.append(...entries.map(r=>row(r.displayTitle||r.title,
            r.kind==='lexicon'?'Definitions, transliteration & pronunciation':r.kind==='bible'?r.language==='de'?'Deutsch':'Scripture':r.kind==='commentary'?'Passage notes':r.kind==='support'?'Find Hebrew and Greek words':'Read & explore',
            ()=>open('referenceResource',{id:r.id,ref:frame.data.ref,...(['dictionary','topic'].includes(r.kind)?{view:'related'}:{})}))));
          const section=disclosure(label+' · '+entries.length,list);section.dataset.referenceCategory=id;
          section.open=Boolean(q||expanded.has(id));section.addEventListener('toggle',()=>{if(!section.isConnected||input.value)return;if(section.open)expanded.add(id);else expanded.delete(id);});
          return section;
        }).filter(Boolean);
        results.replaceChildren(...sections);status.textContent=matched.length?matched.length+' resources':'No matching resources.';
        const unavailable=catalog.resources.filter(r=>!r.readable&&(!q||normalize(r.title+' '+r.id).includes(q)));
        if(unavailable.length)results.append(disclosure('Other editions',...unavailable.map(r=>text(r.title+' · Unavailable'))));
      }
      input.addEventListener('input',()=>{frame.data.q=input.value;updateUrl(frame);render();});
      readers.context(target,frame,()=>{});
      target.append(field,status,results);render();
    },
    referenceResource:readers.resourceView,
  };
  // Keep existing saved reader links usable while they adopt the shared resource routes.
  function legacy(target,frame,id,entry) {
    const data={...frame.data,id,...(entry!==undefined?{entry:String(entry)}:{})};
    if(data.view==='passage')data.view='related';
    frame.type='referenceResource';frame.data=data;updateUrl(frame);
    return readers.resourceView(target,frame);
  }
  return {...views,
    dictionary:(target,frame)=>legacy(target,frame,'dictionaries-easton'),
    dictionaryEntry:(target,frame)=>legacy(target,frame,'dictionaries-easton',frame.data.id),
    referenceCommentary:(target,frame)=>legacy(target,frame,'commentaries-john-wesley'),
  };
}
