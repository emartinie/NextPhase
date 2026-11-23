// Focused cutover routes only. No live accounts, writes or outside requests.
const assert=require('node:assert/strict');
const {chromium,devices}=require(process.env.NEXTPHASE_PLAYWRIGHT||'playwright');
const {createPreviewServer,startPagesCheck,pagesMount}=require('../../serve-preparedness.cjs');
async function main(){
  const server=createPreviewServer({mount:pagesMount}),url=await startPagesCheck(server);
  let browser;
  try{
    browser=await chromium.launch({executablePath:process.env.NEXTPHASE_CHROME||undefined,args:['--disable-gpu','--renderer-process-limit=2','--disk-cache-size=1048576']});
    const page=await browser.newPage({...devices['iPhone 13'],viewport:{width:375,height:667}});
    page.setDefaultTimeout(25000);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(url).origin?route.continue():route.abort());
    // Use the source's actual covenant ID rather than an invented route alias.
    const covenants=require('../../corpus/study-tools/covenants/covenants.json');
    const source=covenants.find(item=>JSON.stringify(item.relatedSources).includes('book=josephus'));
    assert.ok(source);
    await page.goto(url+'?week=7&card=commandments&covenant='+encodeURIComponent(source.id));
    await page.locator('#dialog').getByText('Primary covenant passages',{exact:true}).waitFor();
    await page.locator('#panel-body').evaluate(node=>node.querySelectorAll('details').forEach(item=>{item.open=true;}));
    const read=page.getByRole('button',{name:'Read in Ancient Library',exact:true}).first();
    await read.waitFor();await read.click();
    await page.waitForFunction(()=>new URL(location.href).searchParams.get('card')==='ancient-library');
    await page.locator('#dialog h3').first().waitFor();
    const address=new URL(page.url());
    assert.equal(address.origin,new URL(url).origin);
    assert.equal(address.searchParams.get('book'),'josephus');
    assert.equal(address.searchParams.get('work'),'antiquities');
    assert.equal(address.searchParams.get('volume'),'book-1');
    assert.equal(address.searchParams.get('chapter'),'7');
    assert.equal(page.context().pages().length,1);
    // The source catalog remains available in NextPhase, including document return.
    await page.goto(url+'?week=7&card=beready');
    const record=page.locator('.prep-list li button').first();
    await record.waitFor();await record.click();
    const browse=page.getByRole('button',{name:'Browse Be Ready catalog',exact:true});
    await browse.waitFor();await browse.click();
    await page.locator('.prep-list li button').first().waitFor();
    assert.equal(await page.locator('a[href*="emartinie.github.io/MainStage/2-prepper/"]').count(),0);
    // Discovery uses the already-integrated member map, without a legacy escape.
    await page.goto(url+'?week=7&face=fellowship');
    await page.getByRole('button',{name:'Find members',exact:true}).waitFor();
    await page.getByRole('button',{name:'Find members',exact:true}).click();
    assert.equal(await page.getByRole('link',{name:'Original member map',exact:true}).count(),0);
    assert.equal(await page.locator('.fellowship-map-picker').isVisible(),true);
    assert.deepEqual(errors,[]);
    console.log('Passed phone-sized cutover routes: covenant source → local Ancient Library with exact work/volume/chapter, local Be Ready catalog return, and member discovery without legacy-map navigation. External source citations remain intentional.');
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
