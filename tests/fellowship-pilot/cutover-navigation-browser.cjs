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
    // Known copied article permalinks reuse supplied text; unknown pages stay
    // unresolved, and outside-source URLs are not reclassified as local text.
    const locations=await page.evaluate(async()=>{
      const {articleLocation}=await import('./learning.js');
      return [
        'https://homegroups.org/the-remnant/#line%201',
        'http://www.homegroups.org/WHERE-DID-THE-SABBATH-GO/',
        'https://homegroups.org/equipping/the-story/',
        'https://homegroups.org/vision/',
        'https://homegroups.org.example.com/the-remnant/',
        'https://www.sefaria.org/Genesis.1',
      ].map(articleLocation);
    });
    assert.deepEqual(locations,[
      {file:'the_remnant.html',anchor:'line 1'},
      {file:'where_did_the_sabbath_go.html',anchor:''},
      {file:'the_story.html',anchor:''}, {file:''}, {file:''}, {file:''},
    ]);
    const articleCatalog=require('../../corpus/learning/index.json').articles;
    for(const file of ['where_did_the_sabbath_go.html','the_remnant.html','torah_commandments.html','the_law_is_dead.html','the_story.html']) {
      assert.ok(articleCatalog.some(item=>item.file===file),'Mapped permalink must name a supplied catalog article: '+file);
    }
    await page.goto(url+'?week=7&card=articles&file=torah_commandments.html');
    const localArticle=page.locator('.learning-article a[href*="file=the_remnant.html"]').first();
    await localArticle.waitFor();await localArticle.click();
    await page.waitForFunction(()=>new URL(location.href).searchParams.get('file')==='the_remnant.html');
    await page.locator('.learning-article').waitFor();
    assert.equal(new URL(page.url()).origin,new URL(url).origin);
    assert.equal(page.context().pages().length,1);
    await page.goto(url+'?week=46');
    await page.getByRole('button',{name:'Tools',exact:true}).click();
    await page.getByRole('button',{name:/^Weekly commentary/}).click();
    const commentaryLink=page.locator('#dialog a[href*="file=the_story.html"]').first();
    await commentaryLink.waitFor();await commentaryLink.click();
    await page.waitForFunction(()=>new URL(location.href).searchParams.get('file')==='the_story.html');
    await page.locator('.learning-article').waitFor();
    // Real production-host policy with a failed Firebase config request. All
    // requests are intercepted locally; this does not contact homegroups.org.
    const publicPage=await browser.newPage({...devices['iPhone 13'],viewport:{width:375,height:667}});
    publicPage.setDefaultTimeout(25000);
    let configRequests=0;
    await publicPage.route('**/*',async route=>{
      const address=new URL(route.request().url());
      if(address.hostname!=='homegroups.org')return route.abort();
      if(address.pathname==='/__/firebase/init.json'){
        configRequests++;
        return route.fulfill({status:503,contentType:'application/json',body:'{}'});
      }
      const local=new URL(address.pathname+address.search,new URL(url).origin);
      const response=await fetch(local,{headers:route.request().headers().range?{Range:route.request().headers().range}:{}});
      return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
    });
    await publicPage.goto('https://homegroups.org/NextPhase/?week=7');
    await publicPage.locator('#study .today').waitFor();
    await publicPage.getByRole('button',{name:'Read passage',exact:true}).click();
    await publicPage.locator('#dialog .verse').first().waitFor();
    assert.ok((await publicPage.locator('#dialog .verse-text').first().textContent()).trim());
    assert.ok(configRequests>0,'Exercise the real hosted Firebase path, not local demo mode');
    await publicPage.close();
    assert.deepEqual(errors,[]);
    console.log('Passed phone-sized cutover routes: exact local Ancient Library citations, Be Ready return, member discovery, supplied-article permalinks and public bundled Scripture despite Firebase config failure. External sources and unresolved legacy pages are not silently replaced. No live requests or writes.');
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
