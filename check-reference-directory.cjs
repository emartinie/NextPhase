const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,devices}=require(process.env.NEXTPHASE_PLAYWRIGHT||'playwright');
const {createPreviewServer,pagesMount,startPagesCheck}=require('./serve-preparedness.cjs');
async function run(){
 const original=JSON.parse(fs.readFileSync(path.join(__dirname,'corpus/reference/resource-directory.json')));
 const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'corpus/reference/derived/v2/catalog.json')));
 assert.equal(original.resources.length,36);assert.equal(catalog.resources.length,36);
 for(const r of original.resources){const current=catalog.resources.find(x=>x.id===r.id);assert.ok(current);assert.deepEqual(current.files,r.files);}
 const server=createPreviewServer({mount:pagesMount}),url=await startPagesCheck(server);let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.NEXTPHASE_CHROME||undefined,args:['--disk-cache-size=1048576','--media-cache-size=1048576']});
  const p=await browser.newPage({...devices['iPhone 13'],reducedMotion:'reduce'});await p.route('https://**/*',r=>r.abort());
  await p.goto(url+'?workspace=learning&card=sources');const d=p.getByRole('dialog');
  await d.getByRole('button',{name:/^Reference Library/}).click();await d.getByRole('status').filter({hasText:'29 resources'}).waitFor();
  assert.equal(await d.locator('[data-reference-category]').count(),7);
  for(const section of await d.locator('[data-reference-category]>summary').all())await section.click();
  assert.equal(await d.locator('.row').count(),29);
  assert.equal(await d.getByText(/conversion|Reader not connected|Original files stored|source index/i).count(),0);
  await d.getByText('Other editions',{exact:true}).click();assert.equal(await d.getByText(/ · Unavailable$/).count(),7);
  await d.getByLabel('Find a resource',{exact:true}).fill('Strong');await d.getByRole('status').filter({hasText:'3 resources'}).waitFor();
  await d.getByRole('button',{name:/^Strong's Word Index/}).click();await d.getByLabel('Find a word or Strong’s number').fill('G26');
  await d.getByRole('button',{name:/^G26 · agape/}).click();await d.getByRole('heading',{name:'G26 · agape',exact:true}).waitFor();
  await p.goto(url+'?workspace=learning&card=reference-library&q=Smith');await d.getByRole('status').filter({hasText:'1 resources'}).waitFor();await p.reload();assert.equal(await d.getByLabel('Find a resource',{exact:true}).inputValue(),'Smith');
  await p.setViewportSize({width:320,height:568});assert.equal(await p.locator('#panel-body').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
  console.log('Reference directory passed: original 36 groups preserved, 29 functional entries, seven unavailable editions accurately represented, seven compact categories, no development notices, working Strong index and retained search links.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
