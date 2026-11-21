// Focused UI contracts with synthetic identities; no live accounts or rule writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, devices } = require(process.env.NEXTPHASE_PLAYWRIGHT || 'playwright');
const { createPreviewServer, startPagesCheck, pagesMount } = require('../../serve-preparedness.cjs');
const fixture = require('./firebase-browser.cjs');

async function main() {
  const server = createPreviewServer({ mount: pagesMount, handleRequest(req, res) {
    if (req.url !== pagesMount + '/__fellowship-firebase/config') return false;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ projectId: 'homegroups-fellowship', authDomain: 'synthetic.invalid', apiKey: 'synthetic', appId: 'synthetic' }));
    return true;
  } });
  const url = await startPagesCheck(server);
  const shared = 'groups/household-pilot/studyThreads/household';
  fixture.posts.set(shared, Array.from({length:35},(_,i)=>({id:'seed-'+i,data:{authorId:'daniel',body:`Earlier message ${i}: a household conversation with enough history to retain a reading position.`,createdAt:i}})));
  for (const [uid, name] of Object.entries(fixture.accounts)) if (fixture.enrolled.has(uid)) fixture.profiles.set(uid, {displayName:name});
  const contexts = [];
  const errors = [];
  let browser;
  async function person(uid, phone = false, entry = '?pilot=firebase&face=fellowship&week=7') {
    const context = await browser.newContext({ ...(phone ? devices['iPhone 13'] : {viewport:{width:1280,height:850}}), permissions:['clipboard-read','clipboard-write'] });
    contexts.push(context);
    await context.addInitScript(({uid,names})=>{window.__testAuthChoice=uid;window.__testNames=names;}, {uid,names:fixture.accounts});
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    page.on('pageerror',e=>errors.push(e.message));
    await page.exposeFunction('__testStore',async({op,ref,uid,data})=>{
      try { return await fixture.backend(op,ref,uid,data); }
      catch(e) { return {error:e.message,code:e.code}; }
    });
    await page.route('**/*',route=>{
      const request = new URL(route.request().url());
      if (request.origin === new URL(url).origin) return route.continue();
      const source = {'firebase-app.js':fixture.appSdk,'firebase-auth.js':fixture.authSdk,'firebase-firestore.js':fixture.storeSdk}[request.pathname.split('/').at(-1)];
      return request.hostname === 'www.gstatic.com' && source ? route.fulfill({contentType:'text/javascript',body:source}) : route.abort();
    });
    await page.goto(url + entry);
    await page.locator('#week-button').filter({hasText:'Week'}).waitFor();
    if (entry.includes('pilot=firebase')) {
      await page.getByRole('button',{name:'Sign in with Google',exact:true}).click();
      await page.getByRole('button',{name:'Household',exact:true}).waitFor();
    }
    return page;
  }
  const activity = page=>page.locator('.conversation-window');
  const minimize = page=>page.getByRole('button',{name:'Minimize conversation and explore HomeGroups',exact:true}).click();
  const reopen = (page,name)=>page.getByRole('button',{name:`Reopen conversation with ${name}`,exact:true}).click();
  async function home(page) {
    if(await page.locator('#dialog').isVisible()) await page.locator('#close').click();
    if(await activity(page).isVisible() && await activity(page).getAttribute('data-mode')!=='minimized') await minimize(page);
    for(let step=0;step<2 && await page.locator('#workspace-track').getAttribute('data-workspace')!=='study';step++) await page.locator('#workspace-previous').click();
    const face=await page.locator('#stage').getAttribute('data-face');
    if(face!=='fellowship') await page.locator('#flip').click();
  }
  try {
    browser = await chromium.launch({executablePath:process.env.NEXTPHASE_CHROME||undefined,args:['--disable-gpu','--renderer-process-limit=3','--disable-gpu-shader-disk-cache','--disk-cache-size=1048576']});
    const phone=await person('miriam',true);
    await phone.getByRole('button',{name:'Household',exact:true}).click();
    await activity(phone).getByText('Earlier message 34:',{exact:false}).waitFor();
    assert.equal(await phone.locator('#dialog').isVisible(),false);
    await activity(phone).getByRole('textbox',{name:'Message',exact:true}).fill('Keep this unfinished reply');
    await phone.locator('.conversation-stream').evaluate(node=>{node.scrollTop=110;});
    const top=await phone.locator('.conversation-stream').evaluate(node=>node.scrollTop);
    await phone.locator('#flip').click();
    assert.equal(await activity(phone).getAttribute('data-mode'),'minimized');
    // A background update must not reset the hidden stream or erase the draft.
    fixture.posts.get(shared).push({id:'background',data:{authorId:'daniel',body:'Background arrival',createdAt:1000}});
    await phone.getByRole('button',{name:'Read passage',exact:true}).click();
    await phone.locator('#dialog .verse').first().waitFor();
    assert.equal(await phone.locator('#dialog').evaluate(node=>node.matches(':modal')),false);
    await phone.getByLabel('Scripture reference',{exact:true}).fill('Ezekiel 37:1–5');
    await phone.getByRole('button',{name:'Open passage',exact:true}).click();
    await phone.locator('.verse[data-reference="Ezekiel 37:5"]').waitFor();
    await phone.locator('.verse[data-reference="Ezekiel 37:1"] .verse-text').evaluate(node=>{
      const range=document.createRange();range.selectNodeContents(node);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
    });
    const before=fixture.posts.get(shared).length;
    await phone.locator('#share-resource').click();
    await phone.getByRole('button',{name:'Add to Household',exact:true}).click();
    await activity(phone).getByText('Ready to share · not sent',{exact:true}).waitFor();
    assert.equal(await activity(phone).getByRole('textbox',{name:'Message',exact:true}).inputValue(),'Keep this unfinished reply');
    assert.equal(await activity(phone).getByLabel('Scripture reference (optional)',{exact:true}).inputValue(),'Ezekiel 37:1');
    assert.equal(fixture.posts.get(shared).length,before,'Preparing a reference must not send');
    assert.ok(Math.abs(await phone.locator('.conversation-stream').evaluate(node=>node.scrollTop)-top)<5,'Hidden history position should survive');
    await phone.screenshot({path:path.resolve('.pilot-tmp/modeless-scripture-phone.png')});
    await minimize(phone);
    await phone.locator('#close').click();
    // Changes of week and workspace must retain the same connected activity.
    await phone.locator('#week-button').click();
    await phone.locator('#panel-body .row').filter({hasText:/^8\b/}).click();
    await phone.locator('#week-button').filter({hasText:'Week 8'}).waitFor();
    await phone.locator('#study .today').waitFor();
    await phone.locator('#workspace-switch').click();
    await phone.locator('#workspace-track[data-workspace=learning]').waitFor();
    await reopen(phone,'Household');
    assert.equal(await activity(phone).getByRole('textbox',{name:'Message',exact:true}).inputValue(),'Keep this unfinished reply');
    assert.equal(await activity(phone).getByLabel('Scripture reference (optional)',{exact:true}).inputValue(),'Ezekiel 37:1');
    await phone.getByRole('button',{name:'Expand conversation',exact:true}).click();
    assert.equal(await activity(phone).getAttribute('data-mode'),'expanded');
    await phone.getByRole('button',{name:'Reduce conversation window',exact:true}).click();
    const geometry=await activity(phone).evaluate(node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom,height:r.height,width:innerWidth,viewport:innerHeight};});
    assert.ok(geometry.left>=0 && geometry.right<=geometry.width+1 && geometry.bottom<=geometry.viewport && geometry.height<geometry.viewport*.8);
    await activity(phone).getByRole('button',{name:'Send reply',exact:true}).click();
    await activity(phone).getByText('Keep this unfinished reply',{exact:true}).waitFor();
    assert.equal(fixture.posts.get(shared).length,before+1);
    assert.ok(fixture.posts.get(shared).at(-1).data.body.includes('[Scripture: Ezekiel 37:1]'));
    const desktop=await person('daniel');
    await desktop.getByRole('button',{name:'Household',exact:true}).click();
    await activity(desktop).getByText('Keep this unfinished reply',{exact:true}).waitFor();
    await activity(desktop).getByRole('button',{name:'Ezekiel 37:1',exact:true}).click();
    await desktop.locator('.verse[data-reference="Ezekiel 37:1"]').waitFor();
    assert.equal(await activity(desktop).getAttribute('data-mode'),'minimized');
    await desktop.screenshot({path:path.resolve('.pilot-tmp/modeless-scripture-desktop.png')});
    await desktop.locator('#share-resource').click();
    await desktop.getByRole('button',{name:'Copy passage link',exact:true}).click();
    await desktop.getByText('Passage link copied.',{exact:true}).waitFor();
    const publicUrl=await desktop.evaluate(()=>navigator.clipboard.readText());
    assert.equal(new URL(publicUrl).searchParams.get('card'),'reader');
    assert.equal(new URL(publicUrl).searchParams.has('pilot'),false);
    assert.equal(new URL(publicUrl).searchParams.has('room'),false);
    await person('outsider',false,new URL(publicUrl).search);
    console.log('Passed: public Scripture link opens without sign-in or a conversation.');
    await home(phone);
    await phone.getByRole('button',{name:'Daniel Brooks',exact:true}).click();
    await activity(phone).getByRole('textbox',{name:'Message',exact:true}).fill('Private draft retained');
    await home(phone);
    await phone.getByRole('button',{name:'Ruth',exact:true}).click();
    assert.equal(await activity(phone).getByRole('textbox',{name:'Message',exact:true}).inputValue(),'');
    await home(phone);
    await phone.getByRole('button',{name:'Daniel Brooks',exact:true}).click();
    assert.equal(await activity(phone).getByRole('textbox',{name:'Message',exact:true}).inputValue(),'Private draft retained');
    assert.equal(await phone.locator('.conversation-window').count(),1);
    await home(phone);
    await phone.locator('.fellowship-account summary').click();
    await phone.getByRole('button',{name:'Sign out',exact:true}).click();
    await phone.getByRole('button',{name:'Sign in with Google',exact:true}).waitFor();
    assert.equal(await activity(phone).isVisible(),false);
    assert.equal(await activity(phone).getByRole('textbox').count(),0);
    await phone.getByRole('button',{name:'Sign in with Google',exact:true}).click();
    await phone.getByRole('button',{name:'Daniel Brooks',exact:true}).click();
    assert.equal(await activity(phone).getByRole('textbox',{name:'Message',exact:true}).inputValue(),'');
    const outsider=await person('outsider');
    await outsider.getByRole('button',{name:'Household',exact:true}).click();
    await activity(outsider).getByText('This account does not have access to Household conversation.',{exact:false}).waitFor();
    assert.equal(await activity(outsider).getByRole('textbox',{name:'Message',exact:true}).isVisible(),false);
    assert.equal(await activity(outsider).locator('.message').count(),0);
    assert.deepEqual(errors,[]);
    await phone.screenshot({path:path.resolve('.pilot-tmp/modeless-conversation-phone.png')});
    console.log('Passed: modeless phone/desktop panel, minimize/expand/reopen, independent room drafts, workspace/week continuity, background position, reviewed Scripture attachment, persisted two-identity delivery and sign-out/nonmember boundaries.');
    console.log('Synthetic browser contracts only; rules unchanged. Physical Safari and live Hosting publication are separate.');
  } finally {
    for(const context of contexts) await context.close().catch(()=>{});
    if(browser) await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
