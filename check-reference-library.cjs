const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {indexedRecords,decodeText,verseTable}=require('./prepare-reference-library.cjs');
const {chromium,devices}=require(process.env.NEXTPHASE_PLAYWRIGHT||'playwright');
const {createPreviewServer,pagesMount,startPagesCheck}=require('./serve-preparedness.cjs');
async function run(){
 const root=path.join(__dirname,'corpus/reference'),{verses}=verseTable(__dirname);
 assert.equal(decodeText('\x0377F2\x03',verses).segments[0].ref,'Revelation of John 1:8');
 assert.deepEqual(decodeText('\x0373E-72C\x03',verses).segments,[{unresolved:'73E-72C'}]);
 const invalid=Buffer.alloc(8);invalid.writeUInt32LE(1000,4);assert.throws(()=>indexedRecords(Buffer.from('A\0body\0'),invalid));
 const records=indexedRecords(fs.readFileSync(path.join(root,'dictionaries/easton/Easton.dt4')),fs.readFileSync(path.join(root,'dictionaries/easton/Easton.dt7')));
 assert.equal(records.length,3965);assert.equal(records[3613].unlabelled,true);
 const server=createPreviewServer({mount:pagesMount}),url=await startPagesCheck(server);let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.NEXTPHASE_CHROME||undefined,args:['--disk-cache-size=1048576','--media-cache-size=1048576']});
  const p=await browser.newPage({...devices['iPhone 13'],reducedMotion:'reduce'});await p.route('https://**/*',r=>r.abort());const d=p.getByRole('dialog');
  await p.goto(url+'?workspace=learning&card=dictionary&q=Aaron&view=all');
  await d.getByRole('button',{name:/^Aaron\b.*Easton/}).click();await d.getByRole('heading',{name:'Aaron',exact:true}).waitFor();
  assert.equal(new URL(p.url()).searchParams.get('card'),'reference-resource');
  const citation=d.locator('.reference-citation').first();await citation.scrollIntoViewIfNeeded();const top=await p.locator('#panel-body').evaluate(e=>e.scrollTop);await citation.click();await d.locator('.verse').first().waitFor();
  await d.getByRole('button',{name:'Back',exact:true}).click();await d.getByRole('heading',{name:'Aaron',exact:true}).waitFor();assert.equal(await p.locator('#panel-body').evaluate(e=>e.scrollTop),top);
  await p.goto(url+'?workspace=learning&card=dictionary-entry&id=1864');await d.getByRole('heading',{name:'Idolatry',exact:true}).waitFor();await d.getByText('[reference unavailable]',{exact:false}).waitFor();
  await p.goto(url+'?workspace=learning&card=reference-commentary&ref=John%203%3A16');await d.getByRole('heading',{name:'John 3:16',exact:true}).waitFor();assert.ok((await d.locator('.reference-prose').innerText()).includes('God so loved'));
  await p.goto(url+'?workspace=learning&card=reference-commentary&ref=Genesis%203%3A12');await d.getByText('No entry for this verse.',{exact:true}).waitFor();
  console.log('Reference compatibility passed: original index validation, historical dictionary/commentary URLs, source anomalies, canonical routes, exact citation return, and missing notes.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
