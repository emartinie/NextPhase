// Real UI/readers; synthetic identities and Firestore adapter only. No live writes.
const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium,devices} = require(process.env.NEXTPHASE_PLAYWRIGHT || 'playwright');
const {createPreviewServer,startPagesCheck,pagesMount} = require('../../serve-preparedness.cjs');
const fixture = require('./firebase-browser.cjs');

async function main() {
  Object.assign(fixture.accounts,{miriam:'Eddie (test)',daniel:'Admin (test)',ruth:'Dorothy (test)',ezra:'Lisa (test)'});
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
    const context=await browser.newContext({...(phone?{...devices['iPhone 13'],viewport:{width:375,height:481},deviceScaleFactor:2}:{viewport:{width:1280,height:850}}),permissions:['clipboard-read','clipboard-write']});
    contexts.push(context);
    await context.addInitScript(({uid,names})=>{
      window.__testAuthChoice=uid;window.__testNames=names;
      Object.defineProperty(navigator,'share',{value:undefined,configurable:true});
      // Assert the external-link handoff without depending on the Windows clipboard.
      Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__testClipboard=text;},readText:async()=>window.__testClipboard},configurable:true});
    },{uid,names:fixture.accounts});
    const page=await context.newPage();page.setDefaultTimeout(Number(process.env.NEXTPHASE_CHECK_TIMEOUT)||20000);
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
  async function checkThemeContrast(page,theme) {
    const result=await page.evaluate(theme=>{
      document.documentElement.dataset.theme=theme;
      const style=getComputedStyle(document.querySelector('.communication-surface'));
      const colors=['--communication-bg','--communication-layer','--communication-own','--communication-text','--communication-muted','--communication-green','--communication-blue','--communication-on-accent'].map(name=>style.getPropertyValue(name).trim());
      function luminance(hex){const rgb=hex.replace('#','').match(/../g).map(value=>parseInt(value,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
      function contrast(a,b){const values=[luminance(a),luminance(b)].sort((a,b)=>b-a);return (values[0]+.05)/(values[1]+.05);}
      const surfaces=[...colors.slice(0,3),...['--communication-top','--communication-blue-depth','--communication-green-depth','--communication-own-depth'].map(name=>style.getPropertyValue(name).trim())];
      return {background:style.backgroundColor,ratios:[...surfaces.flatMap(background=>[contrast(colors[3],background),contrast(colors[4],background)]),contrast(colors[5],colors[0]),contrast(colors[6],colors[0]),contrast(colors[7],colors[5])]};
    },theme);
    assert.ok(result.ratios.every(ratio=>ratio>=4.5),JSON.stringify({theme,ratios:result.ratios}));
    return result;
  }
  const artifacts=path.resolve('.pilot-tmp/communicator-fullscreen');
  require('node:fs').mkdirSync(artifacts,{recursive:true});
  async function full(page) {
    await page.waitForFunction(()=>{
      const root=document.querySelector('.communication-surface'),app=document.querySelector('.app');
      if(root.dataset.mode!=='fullscreen'||root.hidden||root.inert||!app.inert)return false;
      const a=root.getBoundingClientRect(),b=app.getBoundingClientRect(),v=visualViewport;
      return Math.abs(a.left-b.left)<1&&Math.abs(a.width-b.width)<1&&Math.abs(a.height-Math.min(b.height,v.height))<1&&a.top>=0&&a.bottom<=innerHeight+1;
    });
    await page.evaluate(()=>Promise.all(document.querySelector('.communication-surface').getAnimations().map(animation=>animation.finished.catch(()=>{}))));
    assert.equal(await page.locator('.app').evaluate(node=>getComputedStyle(node).visibility),'hidden','Background workspace must not compete with the communicator');
    assert.equal(await surface(page).getByRole('button',{name:/Expand communications|Reduce communications|Close communications/}).count(),0);
    assert.equal(await surface(page).locator('.communication-drag').count(),0,'There is no floating presentation or move grip');
    const box=await surface(page).boundingBox(),v=page.viewportSize();
    assert.ok(box.width===v.width&&box.height<=v.height+1,JSON.stringify({box,v}));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  async function park(page,side='right') {
    if(side==='left') {await page.locator('#active-conversation-name').focus();await page.keyboard.press('Alt+ArrowLeft');}
    else await page.getByRole('button',{name:'Sidepark communications',exact:true}).click();
    await surface(page).waitFor({state:'hidden'});
    assert.equal(await page.locator('.communication-viewport').evaluate(node=>node.hidden),true,'Parked wrapper must not affect document bounds');
    assert.equal(await surface(page).getAttribute('data-mode'),'minimized');
    assert.equal(await page.locator('.app').evaluate(node=>node.inert),false);
    assert.equal(await launcher(page).getAttribute('data-docked'),'true');
    const box=await launcher(page).boundingBox();
    assert.equal(box.width,44);assert.equal(box.height,44);
    assert.equal(await launcher(page).getAttribute('data-side'),side);
    assert.ok(box.x>=0&&box.x+44<=page.viewportSize().width+1);
    assert.ok(box.y>=0&&box.y+44<=page.viewportSize().height+1);
  }
  async function restore(page) {
    await page.getByRole('button',{name:'Reopen communications',exact:true}).click();await full(page);
  }
  async function keyboardViewportChecks(page) {
    // Reproduce the geometry failure, not the physical iOS keyboard engine.
    // WebKit may pan the document while an editor is focused. The covered
    // workspace must not be used as a clipping boundary for communications.
    await page.setViewportSize({width:375,height:667});
    await field(page).fill('Keep this draft through keyboard panning.');
    await field(page).focus();
    await page.evaluate(async()=>{
      const {audioSession}=await import('./audio-session.js');
      window.__keyboardAudio=audioSession.audio;audioSession.audio.muted=true;
      audioSession.playRecording('./corpus/learning/alephbet-song.mp3','Keyboard continuity check');
    });
    await page.waitForFunction(()=>window.__keyboardAudio.currentTime>.05);
    const audioTime=await page.evaluate(()=>window.__keyboardAudio.currentTime);
    await page.evaluate(async()=>{
      window.__nativeKeyboardViewport=visualViewport;
      const viewport=Object.assign(new EventTarget(),{width:375,height:240,offsetTop:300,offsetLeft:0,pageLeft:0,scale:1});
      Object.defineProperty(viewport,'pageTop',{get(){return this.__omitPageTop?undefined:scrollY+this.offsetTop;}});
      Object.defineProperty(window,'visualViewport',{value:viewport,configurable:true});
      document.body.style.height='1800px';
      window.scrollTo(0,300);
      viewport.dispatchEvent(new Event('resize'));window.dispatchEvent(new Event('resize'));
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    });
    const result=await page.evaluate(()=>({
      app:document.querySelector('.app').getBoundingClientRect().toJSON(),
      communicator:document.querySelector('.communication-surface').getBoundingClientRect().toJSON(),
      layer:document.querySelector('.communication-viewport').getBoundingClientRect().toJSON(),
      mode:document.querySelector('.communication-surface').dataset.mode,
      hidden:document.querySelector('.communication-surface').hidden,
      inert:document.querySelector('.communication-surface').inert,
      workspaceVisibility:getComputedStyle(document.querySelector('.app')).visibility,
      scrollY,visual:{height:visualViewport.height,offsetTop:visualViewport.offsetTop,pageTop:visualViewport.pageTop},
    }));
    console.log('Focused document-pan geometry: '+JSON.stringify(result));
    await page.screenshot({path:path.join(artifacts,'10-keyboard-document-pan.png')});
    assert.ok(result.communicator.height>=239,'A panned hidden workspace must not collapse the full-screen Communicator');
    async function usable(label) {
      await page.waitForFunction(()=>{
        const root=document.querySelector('.communication-surface'),box=root.getBoundingClientRect(),viewport=visualViewport;
        const header=root.querySelector('.conversation-window-header').getBoundingClientRect();
        const composer=root.querySelector('.conversation-composer').getBoundingClientRect();
        const send=root.querySelector('.conversation-composer > button'),button=send.getBoundingClientRect();
        const messages=root.querySelector('.conversation-stream').getBoundingClientRect();
        return root.dataset.mode==='fullscreen'&&!root.hidden&&!root.inert&&box.height>=239&&
          Math.abs(box.top-((viewport.pageTop??scrollY+viewport.offsetTop)-scrollY))<1&&box.height<=viewport.height+1&&
          header.top>=box.top&&composer.bottom<=box.bottom+1&&messages.height>=20&&
          send.contains(document.elementFromPoint(button.x+button.width/2,button.y+button.height/2));
      }).catch(async error=>{
        console.log('Keyboard layout failure '+label+': '+JSON.stringify(await page.evaluate(()=>{
          const root=document.querySelector('.communication-surface'),form=root.querySelector('.conversation-composer'),send=form.querySelector('button.primary');
          const b=send.getBoundingClientRect(),v=visualViewport;
          return {frame:root.getBoundingClientRect().toJSON(),form:form.getBoundingClientRect().toJSON(),header:root.querySelector('header').getBoundingClientRect().toJSON(),messages:root.querySelector('.conversation-stream').getBoundingClientRect().toJSON(),scrollY,visual:{height:v.height,offsetTop:v.offsetTop,pageTop:v.pageTop},hit:document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.outerHTML.slice(0,200)};
        })));
        throw error;
      });
      assert.equal(await field(page).inputValue(),'Keep this draft through keyboard panning.');
      console.log('Usable keyboard layout: '+label);
    }
    await usable('document scroll + visual viewport pan');
    // Opening attachments, focusing their field and dismissal keep the same view.
    await surface(page).locator('.conversation-attachment > summary').click();
    const tray=surface(page).locator('.conversation-attachment-panel');
    const ref=surface(page).getByLabel('Scripture reference (optional)',{exact:true});
    await ref.fill('Genesis 32:4–32:13');
    await usable('attachment input focused');
    await page.waitForFunction(()=>{
      const panel=document.querySelector('.conversation-attachment-panel').getBoundingClientRect();
      const input=document.querySelector('.conversation-attachment-panel input').getBoundingClientRect();
      return input.top>=panel.top&&input.bottom<=panel.bottom;
    });
    await page.keyboard.press('Escape');await tray.waitFor({state:'hidden'});
    // WebKit also reports visual pan with no document scroll. Exercise the
    // pageTop coordinate directly, and the offsetTop + scroll fallback.
    for(const fallback of [false,true]) {
      await field(page).focus();
      await page.evaluate(async fallback=>{
        window.scrollTo(0,0);
        Object.assign(visualViewport,{offsetTop:220,__omitPageTop:fallback,height:260});
        // Move only the covered workspace as another independent constraint.
        document.querySelector('.app').style.transform='translateY(-350px)';
        visualViewport.dispatchEvent(new Event('scroll'));
        window.dispatchEvent(new Event('resize'));
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      },fallback);
      await usable(fallback?'offset fallback / unscrolled document':'visual-only pan / unscrolled document');
    }
    const beforeZero=await surface(page).boundingBox();
    await page.evaluate(async()=>{
      visualViewport.height=0;visualViewport.dispatchEvent(new Event('resize'));window.dispatchEvent(new Event('resize'));
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    });
    assert.ok((await surface(page).boundingBox()).height>=beforeZero.height-1,'Transient zero metrics must keep the last valid surface');
    // Restore the native viewport after blur, as keyboard dismissal does.
    await page.evaluate(async()=>{
      document.activeElement.blur();window.scrollTo(0,0);
      document.body.style.removeProperty('height');document.querySelector('.app').style.removeProperty('transform');
      Object.defineProperty(window,'visualViewport',{value:window.__nativeKeyboardViewport,configurable:true});
      delete window.__nativeKeyboardViewport;window.dispatchEvent(new Event('resize'));
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    });
    await full(page);
    assert.equal(await field(page).inputValue(),'Keep this draft through keyboard panning.');
    assert.equal(await ref.inputValue(),'Genesis 32:4–32:13');
    await surface(page).getByRole('button',{name:'Remove attached Scripture',exact:true}).click();
    await park(page);await restore(page);
    assert.equal(await field(page).inputValue(),'Keep this draft through keyboard panning.');
    await page.waitForFunction(time=>window.__keyboardAudio===document.getElementById('audio')&&!window.__keyboardAudio.paused&&window.__keyboardAudio.currentTime>time,audioTime);
    await page.evaluate(async()=>{const {audioSession}=await import('./audio-session.js');audioSession.stop();delete window.__keyboardAudio;});
    await page.setViewportSize({width:375,height:481});await full(page);
    if (await surface(page).getByRole('button',{name:'Copy communication layout details',exact:true}).count()) {
      await surface(page).getByRole('button',{name:'Copy communication layout details',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('.communication-layout-copy').textContent==='Copied');
      const details=JSON.parse(await page.evaluate(()=>window.__testClipboard));
      assert.equal(details.communication.mode,'fullscreen');
      assert.ok(details.communicationTrace.length>0&&details.communicationTrace.length<=40);
      assert.ok(!JSON.stringify(details).includes('Keep this draft'),'Layout capture must omit private draft contents');
    }
    console.log('Passed keyboard geometry regression: document/visual pan, moved covered workspace, zero-metric transient, usable header/messages/composer/send and attachments, dismissal/sideparking, retained draft/reference and continued Orbit audio. This is not physical iOS verification.');
  }
  async function attachmentChecks(page) {
    const draft='Keep this reply while choosing a passage.\n'+'An unfinished thought worth preserving.\n'.repeat(5);
    await field(page).fill(draft);
    await park(page);
    await page.getByRole('button',{name:'Read passage',exact:true}).click();
    await page.locator('#dialog .verse').first().waitFor();
    await page.getByLabel('Scripture reference',{exact:true}).fill('Genesis 32:4–32:13');
    await page.getByRole('button',{name:'Open passage',exact:true}).click();
    await page.locator('.verse[data-reference="Genesis 32:13"]').waitFor();
    await restore(page);
    const tray=surface(page).locator('.conversation-attachment-panel');
    const toggle=surface(page).locator('.conversation-attachment > summary');
    const refField=surface(page).getByLabel('Scripture reference (optional)',{exact:true});
    const count=fixture.posts.get(dorothy).length;
    const baseComposer=(await surface(page).locator('.conversation-composer').boundingBox()).height;
    async function readable(label) {
      await page.waitForFunction(()=>{
        const root=document.querySelector('.communication-surface'),panel=root.querySelector('.conversation-attachment-panel');
        const box=panel.getBoundingClientRect(),frame=root.getBoundingClientRect(),header=root.querySelector('.conversation-window-header').getBoundingClientRect(),form=root.querySelector('.conversation-composer').getBoundingClientRect();
        const field=root.querySelector('textarea').getBoundingClientRect(),button=panel.querySelector('button').getBoundingClientRect();
        return getComputedStyle(panel).position==='absolute'&&box.width>=Math.min(300,frame.width-40)&&button.width>=220&&box.top>=header.bottom+4&&box.bottom<=form.top-3&&field.bottom<=frame.bottom+1;
      });
      const result=await page.evaluate(()=>{
        const root=document.querySelector('.communication-surface'),panel=root.querySelector('.conversation-attachment-panel'),form=root.querySelector('.conversation-composer');
        const box=panel.getBoundingClientRect(),reply=form.querySelector('textarea').getBoundingClientRect();
        return {width:box.width,height:box.height,top:box.top,replyBottom:reply.bottom,frameBottom:root.getBoundingClientRect().bottom,scrolls:panel.scrollHeight>panel.clientHeight,overflow:getComputedStyle(panel).overflowY,offsetParent:panel.offsetParent.className,actionHeights:[...panel.querySelectorAll('.conversation-context-actions button')].map(item=>item.getBoundingClientRect().height)};
      });
      assert.equal(result.offsetParent,'conversation-composer');
      assert.equal(result.overflow,'auto');
      assert.ok(result.actionHeights.every(height=>height<=84),'Long passage labels must wrap as ordinary readable lines');
      assert.equal(await field(page).inputValue(),draft,'Opening and resizing must preserve the entire unfinished reply');
      assert.equal(fixture.posts.get(dorothy).length,count,'Attachment actions must not send a message');
      console.log('Readable attachment '+label+': '+JSON.stringify(result));
      return result;
    }
    await toggle.click();
    await surface(page).getByRole('button',{name:/^Attach Genesis 32/}).waitFor();
    await readable('Genesis / 375px');
    assert.ok((await surface(page).locator('.conversation-composer').boundingBox()).height<=baseComposer,'Opening the chooser must not grow the composer');
    await page.screenshot({path:path.join(artifacts,'06-attachment-phone.png')});
    await toggle.click();
    await tray.waitFor({state:'hidden'});
    assert.equal(await field(page).inputValue(),draft);
    // Reopen/select through actual UI, retaining review-before-send and the attached reference.
    await toggle.click();
    await surface(page).getByRole('button',{name:/^Attach Genesis 32/}).click();
    await tray.waitFor({state:'hidden'});
    assert.equal(await refField.inputValue(),'Genesis 32:4–32:13');
    assert.equal(await field(page).inputValue(),draft);
    await toggle.click();
    for(const size of [{width:320,height:481},{width:375,height:300},{width:320,height:260},{width:375,height:240}]) {
      await page.setViewportSize(size);await full(page);
      const result=await readable(size.width+'x'+size.height+' / existing attachment');
      if(size.height<=300)assert.equal(result.scrolls,true,'A short viewport must scroll the tray internally');
      if(size.width===320&&size.height===260)await page.screenshot({path:path.join(artifacts,'07-attachment-keyboard-sized.png')});
    }
    // Focus and scroll the reference field inside the bounded tray, not the outer page.
    await refField.fill('Ezekiel 37:1–5');
    await readable('reference input focused');
    await page.waitForFunction(()=>{
      const panel=document.querySelector('.conversation-attachment-panel'),input=panel.querySelector('input'),a=input.getBoundingClientRect(),b=panel.getBoundingClientRect();
      return a.top>=b.top&&a.bottom<=b.bottom;
    });
    assert.equal(await page.evaluate(()=>scrollY),0);
    await page.keyboard.press('Escape');await tray.waitFor({state:'hidden'});
    assert.equal(await surface(page).getAttribute('data-mode'),'fullscreen','Escape closes attachments before sideparking');
    assert.equal(await refField.inputValue(),'Ezekiel 37:1–5');
    // A longer real book label, reached using the existing public reader.
    await park(page);
    await page.getByLabel('Scripture reference',{exact:true}).fill('1 Thessalonians 4:13–5:11');
    await page.getByRole('button',{name:'Open passage',exact:true}).click();
    await page.locator('.verse[data-reference="I Thessalonians 5:11"]').waitFor();
    await page.setViewportSize({width:375,height:481});await restore(page);
    await toggle.click();
    await surface(page).getByRole('button',{name:/^Attach 1 Thessalonians/}).waitFor();
    await readable('long book / portrait');
    // Safari can shrink/pan its visual viewport without changing the layout viewport.
    await page.evaluate(()=>{
      window.__nativeAttachmentViewport=visualViewport;
      const viewport=Object.assign(new EventTarget(),{width:375,height:260,offsetTop:40,offsetLeft:0,scale:1});
      Object.defineProperty(window,'visualViewport',{value:viewport,configurable:true});
      window.dispatchEvent(new Event('resize'));
    });
    await full(page);await readable('visual viewport 260px / offset 40px');
    await page.screenshot({path:path.join(artifacts,'08-attachment-visual-viewport.png')});
    await refField.fill('Genesis 32:4–32:13');await readable('visual viewport / input focus');
    await page.evaluate(()=>{
      Object.defineProperty(window,'visualViewport',{value:window.__nativeAttachmentViewport,configurable:true});
      delete window.__nativeAttachmentViewport;window.dispatchEvent(new Event('resize'));
    });
    await full(page);
    await surface(page).getByRole('button',{name:'Share passage link…',exact:true}).click();
    await surface(page).getByText('Passage link copied.',{exact:true}).waitFor();
    const link=await page.evaluate(()=>window.__testClipboard);
    assert.equal(new URL(link).searchParams.has('room'),false);
    assert.equal(new URL(link).searchParams.has('pilot'),false);
    await readable('external share / no send');
    await surface(page).getByRole('button',{name:/^Attach 1 Thessalonians/}).click();
    await tray.waitFor({state:'hidden'});
    assert.equal(await refField.inputValue(),'1 Thessalonians 4:13–5:11');
    assert.equal(await field(page).inputValue(),draft);
    assert.equal(fixture.posts.get(dorothy).length,count);
    await surface(page).getByRole('button',{name:'Remove attached Scripture',exact:true}).click();
    await park(page);await page.locator('#close').click();await restore(page);
    console.log('Passed attachments: full-width long labels, bounded internally scrolling tray, accessible composer, compact/editing focus, viewport resize/offset, toggle/Escape/select, external sharing and preserved unsent draft.');
  }
  try {
    browser=await chromium.launch({executablePath:process.env.NEXTPHASE_CHROME||undefined,args:['--disable-gpu','--renderer-process-limit=2','--disable-gpu-shader-disk-cache','--disk-cache-size=1048576']});
    const phone=await open('miriam',true,process.argv.includes('--keyboard-repro')?'?pilot=firebase&week=7&layout=check':'?pilot=firebase&week=7');
    await full(phone);
    assert.equal(await surface(phone).getAttribute('data-view'),'list');
    assert.equal(await phone.locator('#stage').getAttribute('data-face'),'study');
    for(const theme of ['cosmic','sapphire','parchment','olam-haba','diagnostic','nextphase'])await checkThemeContrast(phone,theme);
    await checkThemeContrast(phone,'cosmic');
    await phone.screenshot({path:path.join(artifacts,'01-conversations-phone.png')});
    await surface(phone).getByRole('button',{name:'Dorothy (test)',exact:true}).click();
    await surface(phone).getByText('Earlier message 29',{exact:false}).waitFor();
    await keyboardViewportChecks(phone);
    if (process.argv.includes('--keyboard-repro') || process.argv.includes('--keyboard-only')) { assert.deepEqual(errors,[]); return; }
    await attachmentChecks(phone);
    if (process.argv.includes('--attachments-only')) { assert.deepEqual(errors,[]); return; }
    await field(phone).fill('My unfinished reply to Dorothy');
    await phone.locator('.conversation-stream').evaluate(node=>{node.scrollTop=100;});
    const savedTop=await phone.locator('.conversation-stream').evaluate(node=>node.scrollTop);
    await back(phone);
    assert.equal(await phone.locator('#workspace-share').textContent(),'Share','List must clear the implicit recipient');
    await surface(phone).getByRole('button',{name:'Lisa (test)',exact:true}).click();
    assert.equal(await field(phone).inputValue(),'');
    await field(phone).fill('A different unfinished reply to Lisa');
    await back(phone);
    await surface(phone).getByRole('button',{name:'Dorothy (test)',exact:true}).click();
    assert.equal(await field(phone).inputValue(),'My unfinished reply to Dorothy');
    await phone.waitForFunction(top=>Math.abs(document.querySelector('.conversation-stream').scrollTop-top)<3,savedTop);
    // Sideparking is the only route back to the existing workspace.
    await park(phone);
    await phone.locator('#workspace-switch').click();
    await phone.locator('#workspace-track[data-workspace=learning]').waitFor();
    await phone.locator('#workspace-previous').click();
    await phone.locator('#workspace-track[data-workspace=study]').waitFor();
    await restore(phone);
    assert.equal(await field(phone).inputValue(),'My unfinished reply to Dorothy');
    await phone.waitForFunction(top=>Math.abs(document.querySelector('.conversation-stream').scrollTop-top)<3,savedTop);
    await park(phone,'left');await restore(phone);
    // Keyboard-size and landscape layouts fill their usable area without hiding the composer.
    await phone.setViewportSize({width:375,height:300});await full(phone);
    const composer=await surface(phone).locator('.conversation-composer').boundingBox();
    assert.ok(composer.y>=0&&composer.y+composer.height<=300);
    assert.ok((await phone.locator('.conversation-stream').boundingBox()).height>=60);
    await phone.screenshot({path:path.join(artifacts,'03-keyboard-sized-phone.png')});
    await phone.setViewportSize({width:667,height:320});await full(phone);
    await phone.setViewportSize({width:375,height:481});await full(phone);
    assert.equal(await field(phone).inputValue(),'My unfinished reply to Dorothy');
    // Return to the workspace to prepare selected Scripture; sharing remains review-before-send.
    await park(phone,'left');
    await phone.getByRole('button',{name:'Read passage',exact:true}).click();
    await phone.locator('#dialog .verse').first().waitFor();
    await phone.getByLabel('Scripture reference',{exact:true}).fill('Ezekiel 37:1–5');
    await phone.getByRole('button',{name:'Open passage',exact:true}).click();
    await phone.locator('.verse[data-reference="Ezekiel 37:5"]').waitFor();
    await phone.locator('.verse[data-reference="Ezekiel 37:1"] .verse-text').evaluate(node=>{const range=document.createRange();range.selectNodeContents(node);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);});
    const before=fixture.posts.get(dorothy).length;
    await phone.locator('#share-resource').click();
    await full(phone);
    await surface(phone).getByText('Ready to share · not sent',{exact:true}).waitFor();
    assert.equal(await surface(phone).getByLabel('Scripture reference (optional)',{exact:true}).inputValue(),'Ezekiel 37:1');
    assert.equal(fixture.posts.get(dorothy).length,before);
    await surface(phone).getByRole('button',{name:'Send reply',exact:true}).click();
    await surface(phone).getByText('My unfinished reply to Dorothy',{exact:true}).waitFor();
    assert.ok(fixture.posts.get(dorothy).at(-1).data.body.includes('[Scripture: Ezekiel 37:1]'));
    await field(phone).fill('Let’s keep exploring this passage.');
    await phone.locator('.conversation-stream').evaluate(node=>{node.scrollTop=node.scrollHeight;});
    await phone.screenshot({path:path.join(artifacts,'02-conversation-phone.png')});
    // A received reference exposes the existing reader and returns directly to this chat.
    await surface(phone).getByRole('button',{name:'Ezekiel 37:1',exact:true}).last().click();
    await surface(phone).waitFor({state:'hidden'});
    await phone.locator('#dialog .verse').first().waitFor();
    assert.equal(await phone.locator('#dialog').evaluate(node=>node.matches(':modal')),false);
    await phone.locator('#panel-body').evaluate(node=>node.scrollTop=70);
    await phone.locator('#close').click();
    await full(phone);
    assert.equal(await field(phone).inputValue(),'Let’s keep exploring this passage.');
    assert.equal(await surface(phone).getAttribute('data-view'),'conversation');
    // Reduced motion, rapid toggles and focus remain bounded to the one surface.
    await phone.emulateMedia({reducedMotion:'reduce'});
    await park(phone,'left');await restore(phone);
    assert.equal(await surface(phone).evaluate(node=>node.getAnimations().length),0);
    assert.equal(await surface(phone).locator('.communication-list').isVisible(),false,'Conversation view keeps the retained list out of view');
    await phone.emulateMedia({reducedMotion:'no-preference'});
    await phone.getByRole('button',{name:'Sidepark communications',exact:true}).click();
    await phone.getByRole('button',{name:'Reopen communications',exact:true}).click();
    await full(phone);
    assert.equal(await field(phone).inputValue(),'Let’s keep exploring this passage.','Reopening during the exit animation retains the active draft');
    await field(phone).focus();await phone.keyboard.press('Tab');await phone.keyboard.press('Tab');
    assert.equal(await surface(phone).evaluate(node=>node.contains(document.activeElement)),true);
    await surface(phone).locator('.message p').first().evaluate(node=>{const range=document.createRange();range.selectNodeContents(node);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);});
    assert.ok((await phone.evaluate(()=>getSelection().toString())).length>0);
    await park(phone,'left');await restore(phone);
    assert.equal(await field(phone).inputValue(),'Let’s keep exploring this passage.');
    // Desktop uses the identical full-screen state, not a floating-width alternative.
    const peer=await open('ruth');
    await surface(peer).getByRole('button',{name:'Eddie (test)',exact:true}).click();
    await surface(peer).getByText('My unfinished reply to Dorothy',{exact:true}).waitFor();
    await full(peer);
    await surface(peer).locator('.conversation-attachment > summary').click();
    const desktopTray=surface(peer).locator('.conversation-attachment-panel');
    await desktopTray.waitFor();
    assert.ok((await desktopTray.boundingBox()).width>=700,'Desktop attachments use the readable composer width');
    assert.ok((await desktopTray.boundingBox()).y>=(await surface(peer).locator('.conversation-window-header').boundingBox()).height);
    await surface(peer).getByLabel('Scripture reference (optional)',{exact:true}).fill('Genesis 32:4–32:13');
    await peer.keyboard.press('Escape');
    await desktopTray.waitFor({state:'hidden'});
    await surface(peer).getByRole('button',{name:'Remove attached Scripture',exact:true}).click();
    await field(peer).fill('Yes, let’s read that together.');
    await surface(peer).getByRole('button',{name:'Send reply',exact:true}).click();
    await surface(phone).getByText('Yes, let’s read that together.',{exact:true}).waitFor();
    await peer.screenshot({path:path.join(artifacts,'04-conversation-desktop.png')});
    await park(peer,'left');await restore(peer);await park(peer,'left');
    await peer.context().close();
    // Back to the list clears sharing; public sharing stays external and account-free.
    await back(phone);await park(phone,'left');
    await phone.getByRole('button',{name:'Read passage',exact:true}).click();
    await phone.locator('#dialog .verse').first().waitFor();
    await phone.locator('#share-resource').click();
    await phone.getByText('Passage link copied.',{exact:true}).waitFor();
    const publicLink=await phone.evaluate(()=>navigator.clipboard.readText());
    assert.equal(new URL(publicLink).searchParams.has('pilot'),false);
    assert.equal(new URL(publicLink).searchParams.has('room'),false);
    await phone.locator('#close').click();await restore(phone);
    await surface(phone).getByRole('button',{name:'Lisa (test)',exact:true}).click();
    assert.equal(await field(phone).inputValue(),'A different unfinished reply to Lisa');
    await back(phone);await surface(phone).locator('.fellowship-account summary').click();
    await surface(phone).getByRole('button',{name:'Sign out',exact:true}).click();
    await surface(phone).getByRole('button',{name:'Sign in with Google',exact:true}).waitFor();
    assert.equal(await surface(phone).locator('.message').count(),0);
    await surface(phone).getByRole('button',{name:'Sign in with Google',exact:true}).click();
    await surface(phone).getByRole('button',{name:'Lisa (test)',exact:true}).click();
    assert.equal(await field(phone).inputValue(),'','Account sign-out must erase private drafts');
    await phone.context().close();
    const outsider=await open('outsider');
    await surface(outsider).getByRole('button',{name:'Household',exact:true}).click();
    await surface(outsider).getByText('This account does not have access to Household conversation.',{exact:false}).waitFor();
    assert.equal(await field(outsider).isVisible(),false);
    assert.equal(await surface(outsider).locator('.message').count(),0);
    assert.deepEqual(errors,[]);
    console.log('Passed fullscreen Communicator: exactly full-screen/sideparked on phone and desktop, hidden/inert workspace, independent drafts/positions, both edge handles, keyboard-size/landscape bounds, composer access, selected Scripture review/send, direct reader return, peer receipt, external sharing, reduced motion/focus, six-theme contrast, sign-out isolation and unauthorized access.');
    console.log('Synthetic identities only. Physical iPhone Safari keyboard, safe areas and native sharing remain review steps.');
  } finally {
    for(const context of contexts)await context.close().catch(()=>{});
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
