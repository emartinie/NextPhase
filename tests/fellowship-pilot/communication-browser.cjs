// Real UI/readers; synthetic identities and Firestore adapter only. No live writes.
const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium,devices} = require(process.env.NEXTPHASE_PLAYWRIGHT || 'playwright');
const {createPreviewServer,startPagesCheck,pagesMount} = require('../../serve-preparedness.cjs');
const fixture = require('./firebase-browser.cjs');

async function main() {
  Object.assign(fixture.accounts,{miriam:'Eddie (test)',daniel:'Daniel (test)',ruth:'Dorothy (test)',ezra:'Lisa (test)'});
  for(const [uid,displayName] of Object.entries(fixture.accounts)) if(fixture.enrolled.has(uid)) {
    fixture.profiles.set(uid,{displayName});fixture.householdProfiles.set(uid,{displayName});
  }
  const dorothy='groups/household-pilot/privateChats/pair-0-2';
  fixture.posts.set(dorothy,Array.from({length:30},(_,i)=>({id:'history-'+i,data:{authorId:i%3?'ruth':'miriam',body:'Earlier message '+i+' about the weekly reading and a question we want to revisit.',createdAt:i}})));
  const server=createPreviewServer({mount:pagesMount,handleRequest(req,res){
    if(req.url!==pagesMount+'/__fellowship-firebase/config')return false;
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({projectId:'homegroups-fellowship',authDomain:'synthetic.invalid',apiKey:'synthetic',appId:'synthetic'}));return true;
  }});
  const url=await startPagesCheck(server),contexts=[],errors=[];
  let browser;
  const surface=page=>page.locator('.communication-surface');
  const field=page=>surface(page).getByRole('textbox',{name:'Message',exact:true});
  const launcher=page=>page.locator('.communication-launcher:not(.orbit-edge-handle)');
  const back=page=>page.getByRole('button',{name:'Back to conversations',exact:true}).click();
  async function open(uid,phone=false,entry='?pilot=firebase&week=7') {
    const context=await browser.newContext({...phone?devices['iPhone 13']:{viewport:{width:1280,height:850}},permissions:['clipboard-read','clipboard-write']});
    contexts.push(context);
    await context.addInitScript(({uid,names})=>{
      window.__testAuthChoice=uid;window.__testNames=names;
      Object.defineProperty(navigator,'share',{value:undefined,configurable:true});
      // Assert the external-link handoff without depending on the Windows clipboard.
      Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__testClipboard=text;},readText:async()=>window.__testClipboard},configurable:true});
    },{uid,names:fixture.accounts});
    const page=await context.newPage();page.setDefaultTimeout(12000);
    page.on('pageerror',error=>errors.push(error.message));
    await page.exposeFunction('__testStore',async({op,ref,uid,data})=>{
      try{return await fixture.backend(op,ref,uid,data);}catch(error){return {error:error.message,code:error.code};}
    });
    await page.route('**/*',route=>{
      const request=new URL(route.request().url());
      if(request.origin===new URL(url).origin)return route.continue();
      const source={'firebase-app.js':fixture.appSdk,'firebase-auth.js':fixture.authSdk,'firebase-firestore.js':fixture.storeSdk}[request.pathname.split('/').at(-1)];
      return request.hostname==='www.gstatic.com'&&source?route.fulfill({contentType:'text/javascript',body:source}):route.abort();
    });
    await page.goto(url+entry);
    await page.locator('#study .today').waitFor();
    await page.getByRole('button',{name:'Open communications',exact:true}).click();
    await surface(page).getByRole('button',{name:'Sign in with Google',exact:true}).click();
    await surface(page).getByRole('button',{name:'Household',exact:true}).waitFor();
    return page;
  }
  async function drag(page,dx,dy,touch=false,cancel=false) {
    const handle=await page.locator('.communication-drag').boundingBox();
    const start={x:handle.x+Math.min(20,handle.width/2),y:handle.y+handle.height/2};
    if(touch){
      const cdp=await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+dx,y:start.y+dy}]});
      await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});
      await cdp.detach();
    }else{
      await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+dx,start.y+dy,{steps:8});await page.mouse.up();
    }
  }
  async function bounded(page) {
    const box=await surface(page).boundingBox(),viewport=page.viewportSize();
    const visual=await page.evaluate(()=>({height:visualViewport?.height,width:visualViewport?.width,top:visualViewport?.offsetTop,left:visualViewport?.offsetLeft,scrollY,innerHeight}));
    assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1,JSON.stringify({box,viewport,visual}));
    const dock=await page.locator('.dock').boundingBox();
    assert.ok(box.y+box.height<=dock.y+1,'Window should leave workspace navigation accessible');
  }
  async function dockAtEdge(page,side,touch=false,cancel=false) {
    const grip=await page.locator('.communication-drag').boundingBox();
    const start=grip.x+Math.min(20,grip.width/2);
    await drag(page,(side==='left'?2:page.viewportSize().width-2)-start,0,touch,cancel);
  }
  async function docked(page,side) {
    assert.equal(await surface(page).isVisible(),false);
    assert.equal(await surface(page).getAttribute('data-mode'),'minimized','Edge docking is the existing minimized state');
    assert.equal(await launcher(page).getAttribute('data-docked'),'true');
    assert.equal(await launcher(page).getAttribute('data-side'),side);
    const box=await launcher(page).boundingBox(),viewport=page.viewportSize();
    assert.equal(box.width,44);assert.equal(box.height,44);
    assert.ok(box.y>=0&&box.y+44<=viewport.height);
    assert.ok(Math.abs(box.x-(side==='left'?0:viewport.width-44))<2);
    assert.equal(await launcher(page).locator('.communication-edge-arrow').innerText(),side==='left'?'›':'‹');
    assert.equal(await launcher(page).locator('.communication-launcher-icon').isVisible(),false);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Dragging must not create horizontal page overflow');
    return box;
  }
  async function checkThemeContrast(page,theme) {
    const result=await page.evaluate(theme=>{
      document.documentElement.dataset.theme=theme;
      const style=getComputedStyle(document.querySelector('.communication-surface'));
      const colors=['--communication-bg','--communication-layer','--communication-own','--communication-text','--communication-muted','--communication-green','--communication-blue','--communication-on-accent'].map(name=>style.getPropertyValue(name).trim());
      function luminance(hex){const rgb=hex.replace('#','').match(/../g).map(value=>parseInt(value,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
      function contrast(a,b){const values=[luminance(a),luminance(b)].sort((a,b)=>b-a);return (values[0]+.05)/(values[1]+.05);}
      return {background:style.backgroundColor,ratios:[...colors.slice(0,3).flatMap(background=>[contrast(colors[3],background),contrast(colors[4],background)]),contrast(colors[5],colors[0]),contrast(colors[6],colors[0]),contrast(colors[7],colors[5])]};
    },theme);
    assert.ok(result.ratios.every(ratio=>ratio>=4.5),JSON.stringify({theme,ratios:result.ratios}));
    return result;
  }
  try {
    browser=await chromium.launch({executablePath:process.env.NEXTPHASE_CHROME||undefined,args:['--disable-gpu','--renderer-process-limit=3','--disable-gpu-shader-disk-cache','--disk-cache-size=1048576']});
    const phone=await open('miriam',true);
    assert.equal(await phone.locator('#stage').getAttribute('data-face'),'study','Communication must open directly from Study');
    assert.equal(await surface(phone).getAttribute('data-view'),'list');
    assert.equal(await phone.locator('#fellowship').getByRole('button',{name:'Dorothy (test)',exact:true}).count(),0,'No duplicate Fellowship selector');
    for(const theme of ['cosmic','sapphire','parchment','olam-haba','diagnostic','nextphase'])await checkThemeContrast(phone,theme);
    assert.equal(await surface(phone).evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(27, 34, 44)','Default activity surface should be charcoal/slate');
    assert.ok((await surface(phone).boundingBox()).width<350,'Reduced phone footprint');
    await phone.screenshot({path:path.resolve('.pilot-tmp/communication-list-phone.png')});
    await surface(phone).getByRole('button',{name:'Dorothy (test)',exact:true}).click();
    await surface(phone).getByText('Earlier message 29',{exact:false}).waitFor();
    await field(phone).fill('My unfinished reply to Dorothy');
    await phone.locator('.conversation-stream').evaluate(node=>{node.scrollTop=100;});
    const savedTop=await phone.locator('.conversation-stream').evaluate(node=>node.scrollTop);
    await back(phone);
    assert.equal(await phone.locator('#workspace-share').textContent(),'Share','List must have no implicit recipient');
    await surface(phone).getByRole('button',{name:'Lisa (test)',exact:true}).click();
    assert.equal(await field(phone).inputValue(),'');
    await field(phone).fill('A different unfinished reply to Lisa');
    await back(phone);
    await surface(phone).getByRole('button',{name:'Dorothy (test)',exact:true}).click();
    assert.equal(await field(phone).inputValue(),'My unfinished reply to Dorothy');
    await phone.waitForFunction(top=>Math.abs(document.querySelector('.conversation-stream').scrollTop-top)<3,savedTop);
    await phone.locator('#workspace-switch').click();
    await phone.locator('#workspace-track[data-workspace=learning]').waitFor();
    assert.equal(await surface(phone).isVisible(),true,'Workspace navigation must keep the conversation open');
    assert.equal(await field(phone).inputValue(),'My unfinished reply to Dorothy');
    await phone.locator('#workspace-previous').click();
    await phone.locator('#workspace-track[data-workspace=study]').waitFor();
    assert.equal(await surface(phone).isVisible(),true);
    const beforeDrag=await surface(phone).boundingBox();
    await drag(phone,-30,-120,true);
    const afterDrag=await surface(phone).boundingBox();
    assert.ok(afterDrag.y<beforeDrag.y-40,'Touch header drag must actually move the window');
    await bounded(phone);
    assert.equal(await field(phone).inputValue(),'My unfinished reply to Dorothy');
    assert.equal(await phone.locator('.communication-drag').evaluate(node=>getComputedStyle(node).touchAction),'none');
    assert.equal(await phone.locator('.conversation-stream').evaluate(node=>getComputedStyle(node).touchAction),'pan-y');
    // Native-like touch endpoints inside the screen, not synthetic off-screen coordinates.
    await dockAtEdge(phone,'left',true,true);
    assert.equal(await surface(phone).isVisible(),true,'Cancelled drag must restore the open window');
    await bounded(phone);
    await dockAtEdge(phone,'left',true);
    const leftHandle=await docked(phone,'left');
    await phone.screenshot({path:path.resolve('.pilot-tmp/communication-docked-left-phone.png')});
    await phone.locator('#workspace-switch').click();
    assert.ok(Math.abs((await docked(phone,'left')).y-leftHandle.y)<2,'Dock handle position must not follow workspace content');
    await phone.locator('#workspace-previous').click();
    await phone.getByRole('button',{name:'Reopen communications',exact:true}).click();
    assert.equal(await field(phone).inputValue(),'My unfinished reply to Dorothy');
    await phone.waitForFunction(top=>Math.abs(document.querySelector('.conversation-stream').scrollTop-top)<3,savedTop);
    await dockAtEdge(phone,'right',true);
    await docked(phone,'right');
    await fixture.backend('set',{path:dorothy+'/messages/docked-answer'},'ruth',{authorId:'ruth',body:'An update while docked.',createdAt:1000});
    await phone.screenshot({path:path.resolve('.pilot-tmp/communication-docked-right-phone.png')});
    await phone.setViewportSize({width:390,height:360});
    await phone.waitForTimeout(80);
    await docked(phone,'right');
    await phone.setViewportSize({width:390,height:664});
    await phone.waitForTimeout(80);
    await phone.getByRole('button',{name:'Reopen communications',exact:true}).click();
    await surface(phone).getByText('An update while docked.',{exact:true}).waitFor();
    assert.equal(await field(phone).inputValue(),'My unfinished reply to Dorothy');
    await bounded(phone);
    await phone.getByRole('button',{name:'Minimize communications',exact:true}).click();
    await docked(phone,'right');
    await phone.getByRole('button',{name:'Reopen communications',exact:true}).click();
    assert.equal(await surface(phone).getAttribute('data-view'),'conversation');
    assert.equal(await field(phone).inputValue(),'My unfinished reply to Dorothy');
    const closingTop=await phone.locator('.conversation-stream').evaluate(node=>node.scrollTop);
    await phone.getByRole('button',{name:'Close communications',exact:true}).click();
    assert.equal(await surface(phone).isVisible(),false);
    assert.equal(await phone.locator('#dialog').isVisible(),false,'Closing must not create a second panel');
    assert.equal(await phone.locator('#workspace-share').textContent(),'Share');
    await phone.getByRole('button',{name:'Open communications',exact:true}).click();
    assert.equal(await surface(phone).getAttribute('data-view'),'list');
    await surface(phone).getByRole('button',{name:'Dorothy (test)',exact:true}).click();
    assert.equal(await field(phone).inputValue(),'My unfinished reply to Dorothy');
    await phone.waitForFunction(top=>Math.abs(document.querySelector('.conversation-stream').scrollTop-top)<3,closingTop);
    // Move aside rather than minimize to reach the underlying Scripture entry.
    const read=phone.getByRole('button',{name:'Read passage',exact:true});
    const readBox=await read.boundingBox(),grip=phone.locator('.communication-drag');
    const box=await surface(phone).boundingBox(),targetY=readBox.y+readBox.height/2;
    const topBar=await phone.locator('.top').boundingBox(),dock=await phone.locator('.dock').boundingBox();
    const desired=targetY>topBar.y+topBar.height+6+box.height ? topBar.y+topBar.height+6 : dock.y-8-box.height;
    await drag(phone,0,desired-box.y,true);
    await read.click();
    await phone.locator('#dialog .verse').first().waitFor();
    assert.equal(await surface(phone).isVisible(),true,'Exploring Scripture must not automatically minimize the conversation');
    assert.equal(await phone.locator('#dialog').evaluate(node=>node.matches(':modal')),false);
    // Keep the conversation open, moving it below the reader's passage controls.
    const readerWindow=await surface(phone).boundingBox();
    await drag(phone,0,dock.y-8-readerWindow.height-readerWindow.y,true);
    await phone.getByLabel('Scripture reference',{exact:true}).fill('Ezekiel 37:1–5');
    await phone.getByRole('button',{name:'Open passage',exact:true}).click();
    await phone.locator('.verse[data-reference="Ezekiel 37:5"]').waitFor();
    await phone.locator('.verse[data-reference="Ezekiel 37:1"] .verse-text').evaluate(node=>{const range=document.createRange();range.selectNodeContents(node);const s=getSelection();s.removeAllRanges();s.addRange(range);});
    const before=fixture.posts.get(dorothy).length;
    await phone.locator('#share-resource').click();
    await surface(phone).getByText('Ready to share · not sent',{exact:true}).waitFor();
    assert.equal(await phone.locator('#panel-title').textContent(),'Passage reader','Sharing must not add a chooser panel');
    assert.equal(await surface(phone).getByLabel('Scripture reference (optional)',{exact:true}).inputValue(),'Ezekiel 37:1');
    assert.equal(fixture.posts.get(dorothy).length,before);
    await phone.screenshot({path:path.resolve('.pilot-tmp/communication-scripture-phone.png')});
    await phone.setViewportSize({width:390,height:360});
    await phone.waitForTimeout(80);
    await bounded(phone);
    const composer=await surface(phone).locator('.conversation-composer').boundingBox();
    assert.ok(composer.y>=0&&composer.y+composer.height<=360);
    assert.ok((await phone.locator('.conversation-stream').boundingBox()).height>=30,'Keyboard-sized layout must retain message space');
    await phone.screenshot({path:path.resolve('.pilot-tmp/communication-keyboard-sized.png')});
    await phone.setViewportSize({width:390,height:664});
    await phone.getByRole('button',{name:'Expand communications',exact:true}).click();
    await bounded(phone);
    await phone.getByRole('button',{name:'Reduce communications',exact:true}).click();
    await phone.waitForTimeout(80);
    await bounded(phone);
    await surface(phone).getByRole('button',{name:'Send reply',exact:true}).click();
    await surface(phone).getByText('My unfinished reply to Dorothy',{exact:true}).waitFor();
    assert.ok(fixture.posts.get(dorothy).at(-1).data.body.includes('[Scripture: Ezekiel 37:1]'));
    const peer=await open('ruth');
    await surface(peer).getByRole('button',{name:'Eddie (test)',exact:true}).click();
    await surface(peer).getByText('My unfinished reply to Dorothy',{exact:true}).waitFor();
    await fixture.backend('set',{path:dorothy+'/messages/peer-answer'},'ruth',{authorId:'ruth',body:'Yes, let’s read that together.',createdAt:2000});
    await surface(phone).getByText('Yes, let’s read that together.',{exact:true}).waitFor();
    await phone.locator('.conversation-stream').evaluate(node=>{node.scrollTop=node.scrollHeight;});
    await phone.screenshot({path:path.resolve('.pilot-tmp/communication-conversation-phone.png')});
    const desktopBefore=await surface(peer).boundingBox();
    await drag(peer,-220,-100);
    assert.ok((await surface(peer).boundingBox()).x<desktopBefore.x-100);
    await dockAtEdge(peer,'left');
    await docked(peer,'left');
    await peer.getByRole('button',{name:'Reopen communications',exact:true}).click();
    await dockAtEdge(peer,'right');
    await docked(peer,'right');
    await peer.getByRole('button',{name:'Reopen communications',exact:true}).click();
    await peer.locator('.communication-drag').focus();
    await peer.keyboard.press('Alt+ArrowLeft');
    await docked(peer,'left');
    await peer.getByRole('button',{name:'Reopen communications',exact:true}).click();
    await peer.locator('.communication-drag').focus();
    await peer.keyboard.press('Home');
    await bounded(peer);
    // Message text remains selectable; drag behavior belongs only to the header.
    await surface(peer).locator('.message p').first().evaluate(node=>{const r=document.createRange();r.selectNodeContents(node);const s=getSelection();s.removeAllRanges();s.addRange(r);});
    assert.ok((await peer.evaluate(()=>getSelection().toString())).length>0);
    await peer.screenshot({path:path.resolve('.pilot-tmp/communication-desktop.png')});
    await peer.context().close();
    await phone.getByRole('button',{name:'Close communications',exact:true}).click();
    await phone.locator('#share-resource').click();
    await phone.getByText('Passage link copied.',{exact:true}).waitFor();
    const publicLink=await phone.evaluate(()=>navigator.clipboard.readText());
    assert.equal(new URL(publicLink).searchParams.has('pilot'),false);
    assert.equal(new URL(publicLink).searchParams.has('room'),false);
    await phone.getByRole('button',{name:'Open communications',exact:true}).click();
    await surface(phone).getByRole('button',{name:'Lisa (test)',exact:true}).click();
    assert.equal(await field(phone).inputValue(),'A different unfinished reply to Lisa');
    await back(phone);
    await surface(phone).locator('.fellowship-account summary').click();
    await surface(phone).getByRole('button',{name:'Sign out',exact:true}).click();
    await surface(phone).getByRole('button',{name:'Sign in with Google',exact:true}).waitFor();
    assert.equal(await surface(phone).getByRole('textbox',{name:'Message',exact:true}).count(),0);
    await surface(phone).getByRole('button',{name:'Sign in with Google',exact:true}).click();
    await surface(phone).getByRole('button',{name:'Lisa (test)',exact:true}).click();
    assert.equal(await field(phone).inputValue(),'','Sign-out must clear private drafts');
    assert.equal(await phone.locator('.communication-surface').count(),1);
    await phone.context().close();
    const outsider=await open('outsider');
    await surface(outsider).getByRole('button',{name:'Household',exact:true}).click();
    await surface(outsider).getByText('This account does not have access to Household conversation.',{exact:false}).waitFor();
    assert.equal(await field(outsider).isVisible(),false);
    assert.equal(await surface(outsider).locator('.message').count(),0);
    assert.deepEqual(errors,[]);
    console.log('Passed: global list/chat, independent drafts/positions, direct close, shared edge/minimize state, left/right touch/mouse docking and retrieval, cancelled drag, keyboard docking, predictable resized handles, background receipt, no horizontal overflow, theme contrast, visible workspace/reader continuity, keyboard-sized composer, Scripture review/send, external links and account isolation.');
    console.log('Synthetic browser contracts only. No live records, rules or Authentication configuration changed; physical Safari remains unverified.');
  } finally {
    for(const context of contexts)await context.close().catch(()=>{});
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
