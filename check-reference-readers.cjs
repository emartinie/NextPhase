const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {verseTable,records,recoverCommentary,bibleRecords,lexiconMetadata,wordCodes}=require('./reference-codecs.cjs');
const {chromium,devices}=require(process.env.NEXTPHASE_PLAYWRIGHT||'playwright');
const {createPreviewServer,pagesMount,startPagesCheck}=require('./serve-preparedness.cjs');
const dataRoot=path.join(__dirname,'corpus/reference/derived/v2');
const json=file=>JSON.parse(fs.readFileSync(path.join(dataRoot,file)));
async function run(){
  const catalog=json('catalog.json'),ready=catalog.resources.filter(r=>r.readable),invalid=0;
  const server=createPreviewServer({mount:pagesMount}),url=await startPagesCheck(server);let browser;const errors=[];
  try{
    browser=await chromium.launch({executablePath:process.env.NEXTPHASE_CHROME||undefined,args:['--disk-cache-size=1048576','--media-cache-size=1048576','--disable-gpu','--disable-features=BackForwardCache','--renderer-process-limit=2']});
    const phone=await browser.newPage({...devices['iPhone 13'],viewport:{width:390,height:760},reducedMotion:'reduce'});
    phone.setDefaultTimeout(12000);phone.on('pageerror',e=>errors.push(e.message));await phone.route('https://**/*',r=>r.abort());
    const dialog=phone.getByRole('dialog'),panel=phone.locator('#panel-body');
    async function visit(id,params=''){await phone.goto(url+'?workspace=learning&card=reference-resource&id='+id+params);try{await dialog.getByRole('heading',{level:3}).first().waitFor({timeout:30000});}catch(error){console.error('Reader failed to open',id,params,'pageErrors',errors,'body',(await phone.locator('body').innerText()).slice(0,1800));throw error;}}
    await phone.goto(url+'?workspace=learning&card=reference-library');
    await dialog.getByRole('status').filter({hasText:'29 resources'}).waitFor();
    assert.equal(await dialog.getByText(/awaiting|conversion|Reader not connected|Original files stored/i).count(),0);
    await dialog.getByLabel('Find a resource',{exact:true}).fill('Strong');
    await dialog.getByRole('button',{name:/^Strong's Greek Dictionary/}).click();
    await dialog.getByLabel('Find a word or Strong’s number').fill('G0026');
    await dialog.getByRole('button',{name:/^G26 · agape/}).click();
    await dialog.getByRole('heading',{name:'G26 · agape',exact:true}).waitFor();
    assert.ok((await dialog.locator('.reference-prose').innerText()).includes('love'));
    const strongUrl=phone.url();assert.equal(new URL(strongUrl).searchParams.get('entry'),'G26');
    await phone.reload();await dialog.getByRole('heading',{name:'G26 · agape',exact:true}).waitFor();
    await visit('lexicons-strongs-hebrew','&entry=H1');
    assert.ok((await dialog.locator('.reference-prose').innerText()).includes('father'));
    await visit('lexicons-strongs-index','&q=logos');
    await dialog.getByRole('button',{name:/^G3056 · logos/}).click();await dialog.getByRole('heading',{name:'G3056 · logos',exact:true}).waitFor();
    for(const id of ['dictionaries-american-tract-society','dictionaries-hitchcock-bible-names','dictionaries-smith']){
      await visit(id,'&q=Aaron');await dialog.getByRole('button',{name:/^Aaron\b/i}).first().click();await dialog.locator('.reference-prose').waitFor();
    }
    await visit('dictionaries-smith','&entry=0');await dialog.getByRole('button',{name:'Alpha',exact:true}).click();await dialog.getByRole('heading',{name:'Alpha',exact:true}).waitFor();
    for(const r of ready.filter(r=>r.kind==='commentary')){
      await visit(r.id,'&ref='+encodeURIComponent(r.books.some(b=>b.key==='genesis')?'Genesis 1:1':'Matthew 1:1'));
      await dialog.locator('.reference-prose').first().waitFor();assert.ok((await dialog.locator('.reference-prose').first().innerText()).length>20,r.id);
    }
    for(const r of ready.filter(r=>r.kind==='bible')){
      const ref=r.books.some(b=>b.key==='genesis')?'Genesis 1:1':'John 3:16';
      await visit(r.id,'&ref='+encodeURIComponent(ref));await dialog.locator('.reference-prose').first().waitFor();
      assert.ok((await dialog.locator('.reference-prose').first().innerText()).length>10,r.id);
    }
    await visit('bibles-luther-1912','&ref=Genesis%201%3A1');
    await dialog.getByLabel('Book',{exact:true}).selectOption('psalms');await dialog.getByLabel('Chapter',{exact:true}).selectOption('23');await dialog.getByRole('heading',{name:'Psalms 23:1',exact:true}).waitFor();
    for(const r of ready.filter(r=>['topic','devotional'].includes(r.kind))){
      await visit(r.id);await dialog.locator('.row').first().click();await dialog.locator('.reference-prose').waitFor();
    }
    await visit('cross-references-bcdxrefs','&ref=Genesis%201%3A1');
    const cite=dialog.locator('.reference-prose .reference-citation').first();await cite.click();await dialog.locator('.verse').first().waitFor();
    await dialog.getByRole('button',{name:'Back',exact:true}).click();await dialog.locator('.reference-prose').first().waitFor();
    await visit('lexicons-strongs-greek');await dialog.getByLabel('Find a word or Strong’s number').fill('benevolence');await dialog.getByRole('button',{name:'Search definitions',exact:true}).click();await dialog.getByRole('button',{name:/^G26 · agape/}).waitFor();
    await visit('bibles-asv','&q=heavens%20and%20the%20earth&view=search');await dialog.getByRole('button',{name:/^Genesis 1:1\b/}).first().click();await dialog.getByRole('heading',{name:'Genesis 1:1',exact:true}).waitFor();
    await dialog.getByRole('button',{name:'Next chapter',exact:true}).click();await dialog.getByRole('heading',{name:'Genesis 2:1',exact:true}).waitFor();
    await visit('bibles-montgomery-new-testament','&ref=Genesis%201%3A1');await dialog.getByText('This edition has no text for this verse.',{exact:true}).waitFor();

    // A complete Study -> tagged KJV -> Strong's -> Fellowship -> source -> reading round trip.
    await phone.goto(url+'?week=7');await phone.locator('#study-title').waitFor();
    await phone.getByRole('button',{name:'Tools',exact:true}).click();await dialog.getByRole('button',{name:/^Passage reader/}).click();
    await dialog.getByLabel('Scripture reference',{exact:true}).fill('Genesis 1');await dialog.getByRole('button',{name:'Open passage',exact:true}).click();
    const v=dialog.getByRole('button',{name:'Passage tools for Genesis 1:10',exact:true});await v.scrollIntoViewIfNeeded();
    const readingTop=await panel.evaluate(e=>e.scrollTop);await v.click();await dialog.getByRole('button',{name:/^Word study/}).click();
    await dialog.locator('.reference-prose button[title^=\"H\"]').first().click();await dialog.getByRole('heading',{level:3}).first().waitFor();
    const entryTop=await panel.evaluate(e=>{e.scrollTop=100;return e.scrollTop;});
    await dialog.getByRole('button',{name:'Discuss in Learning Fellowship'}).click();
    await phone.locator('#learning-fellowship').getByRole('button',{name:'Return to resource',exact:true}).click();
    await dialog.locator('.reference-prose').waitFor();assert.equal(new URL(phone.url()).searchParams.get('workspace'),'study');
    assert.equal(await panel.evaluate(e=>e.scrollTop),entryTop);
    for(const title of ['Reference resource','Passage tools','Passage reader']){await dialog.getByRole('button',{name:'Back',exact:true}).click();await dialog.locator('#panel-title').filter({hasText:title}).waitFor();}
    assert.equal(await panel.evaluate(e=>e.scrollTop),readingTop);
    const small=await browser.newPage({...devices['iPhone SE'],viewport:{width:320,height:568},reducedMotion:'reduce'});
    small.on('pageerror',e=>errors.push(e.message));await small.route('https://**/*',r=>r.abort());await small.goto(strongUrl);await small.locator('.reference-prose').waitFor();
    assert.equal(await small.locator('#panel-body').evaluate(e=>e.scrollWidth<=e.clientWidth),true);await small.close();
    assert.deepEqual(errors,[]);console.log('Functional reference readers passed: 29 resource groups, original hashes, all editions, Strong numbers and metadata, cross-links, full-text search, KJV word tags, exact Study/Fellowship return, deep links and narrow mobile layout. Unmapped source tags: '+invalid);
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
