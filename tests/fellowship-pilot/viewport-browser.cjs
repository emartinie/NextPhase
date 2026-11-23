// Visual viewport/browser-chrome fixtures, not physical Safari validation.
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium,devices}=require(process.env.NEXTPHASE_PLAYWRIGHT||'playwright');
const {createPreviewServer,startPagesCheck,pagesMount}=require('../../serve-preparedness.cjs');

async function main() {
  const server=createPreviewServer({mount:pagesMount}),url=await startPagesCheck(server);let browser;
  try {
    browser=await chromium.launch({executablePath:process.env.NEXTPHASE_CHROME||undefined,args:['--disable-gpu','--renderer-process-limit=3','--disk-cache-size=1048576']});
    const context=await browser.newContext({...devices['iPhone 13'],viewport:{width:390,height:780}});
    try {
      await context.addInitScript(()=>{
        const viewport=Object.assign(new EventTarget(),{width:390,height:640,offsetTop:0,offsetLeft:0,scale:1});
        Object.defineProperty(window,'visualViewport',{value:viewport,configurable:true});
        window.__setViewport=values=>{Object.assign(viewport,values);viewport.dispatchEvent(new Event('resize'));window.dispatchEvent(new Event('resize'));};
      });
      const page=await context.newPage(),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(url).origin?route.continue():route.abort());
      await page.goto(url+'?week=52');
      assert.equal(await page.locator('meta[name=viewport]').getAttribute('content'),'width=device-width, initial-scale=1','Let the browser inset its own safe area rather than opting into edge-to-edge cover');
      await page.locator('#floatingPlayer[data-audio-ready=true]').waitFor();await page.locator('#study-title').waitFor();
      async function layout(height,width=390,top=0,smallHeight) {
        await page.evaluate(({height,width,top,smallHeight})=>{
          if(smallHeight)document.documentElement.style.setProperty('--workspace-small-height',smallHeight+'px');
          else document.documentElement.style.removeProperty('--workspace-small-height');
          window.__setViewport({height,width,offsetTop:top,offsetLeft:0,scale:1});
        },{height,width,top,smallHeight});
        await page.waitForFunction(({height,width,top,smallHeight})=>{
          const app=document.querySelector('.app').getBoundingClientRect();
          return Math.abs(app.width-width)<1&&Math.abs(app.top)<1&&app.height<=Math.min(height+Math.max(0,top),smallHeight||innerHeight)+1;
        },{height,width,top,smallHeight});
      }
      async function chromeFits() {
        await page.waitForFunction(()=>{
          const app=document.querySelector('.app').getBoundingClientRect();
          return [...document.querySelectorAll('.dock nav button:not([hidden]),#week-button,#theme-button')].filter(node=>node.getClientRects().length).every(node=>{
            const box=node.getBoundingClientRect();return box.left>=Math.max(0,app.left-1)&&box.right<=Math.min(innerWidth,app.right+1)&&box.top>=Math.max(0,app.top-1)&&box.bottom<=Math.min(innerHeight,app.bottom+1);
          });
        });
        const result=await page.evaluate(()=>{
          const app=document.querySelector('.app').getBoundingClientRect(),dock=document.querySelector('.dock').getBoundingClientRect();
          return {app:{x:app.x,y:app.y,width:app.width,height:app.height,bottom:app.bottom},dockBottom:dock.bottom,overflow:document.documentElement.scrollWidth>innerWidth,scrollY};
        });
        assert.equal(result.overflow,false);assert.equal(result.scrollY,0);assert.ok(result.dockBottom<=result.app.bottom+1);
        assert.equal(await page.locator('#study .today h2').evaluate(node=>node.scrollWidth<=node.clientWidth+1),true,'Long passage labels must wrap inside their card');
        return result;
      }
      async function orbitControl(title) {
        const point=await page.locator('#floatingPlayer button').evaluateAll((buttons,title)=>{
          const button=buttons.find(button=>button.title===title),box=button.getBoundingClientRect();
          const x=box.x+box.width/2,y=box.y+box.height/2;
          if(!button.contains(document.elementFromPoint(x,y)))throw Error('Covered Orbit control '+title);
          return {x,y};
        },title);await page.touchscreen.tap(point.x,point.y);
      }
      await layout(640);await chromeFits();
      await page.evaluate(async()=>{
        window.__setViewport({offsetTop:-70,height:640});
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      });
      assert.ok((await page.locator('.top').boundingBox()).y>=0,'A transient negative viewport offset must not remove the header');
      await layout(640);
      await layout(640,390,70,640);await chromeFits();
      assert.equal((await page.locator('.top').boundingBox()).y,0,'A stale positive offset must not translate the header');
      await layout(640);
      await page.evaluate(async()=>{
        document.body.style.height='1100px';
        document.getElementById('study').scrollTop=41;
        window.scrollTo(0,70);
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      });
      await page.waitForFunction(()=>scrollY===0&&document.querySelector('.top').getBoundingClientRect().top>=0);
      assert.equal(await page.locator('#study').evaluate(node=>node.scrollTop),41,'Root scroll recovery preserves workspace reading position');
      await page.evaluate(()=>document.body.style.removeProperty('height'));
      await orbitControl('Park player at screen edge');
      await page.getByRole('button',{name:'Open communications',exact:true}).click();
      await page.getByRole('button',{name:'Sidepark communications',exact:true}).click();
      await page.evaluate(async()=>{
        const {audioSession}=await import('./audio-session.js');
        window.__viewportAudio=audioSession.audio;audioSession.audio.muted=true;
        audioSession.playRecording('./corpus/learning/alephbet-song.mp3','Alephbet song');
      });
      await page.waitForFunction(()=>document.getElementById('audio').currentTime>.05);
      const before=await page.locator('#audio').evaluate(audio=>audio.currentTime);
      await layout(300,390,120);await chromeFits();
      await page.waitForFunction(()=>[...document.querySelectorAll('.communication-launcher[data-docked=true]')].every(handle=>{
        const box=handle.getBoundingClientRect(),app=document.querySelector('.app').getBoundingClientRect(),dock=document.querySelector('.dock').getBoundingClientRect();
        return box.left>=app.left-1&&box.right<=app.right+1&&box.top>=app.top&&box.bottom<=dock.top+1;
      }));
      await page.getByRole('button',{name:'Reopen communications',exact:true}).click();
      await page.waitForFunction(()=>{
        const box=document.querySelector('.communication-surface').getBoundingClientRect(),app=document.querySelector('.app').getBoundingClientRect(),dock=document.querySelector('.dock').getBoundingClientRect();
        return box.top>=app.top&&box.bottom<=app.bottom+1&&Math.abs(box.width-app.width)<1;
      });
      await page.getByRole('button',{name:'Sidepark communications',exact:true}).click();

      await page.setViewportSize({width:320,height:640});await layout(560,320);await chromeFits();
      await page.evaluate(()=>{
        document.querySelector('.brand').style.fontSize='21px';
        for(const control of document.querySelectorAll('.top-actions button,.dock nav button'))control.style.fontSize='18px';
      });
      await chromeFits();
      await page.evaluate(()=>{for(const node of document.querySelectorAll('.brand,.top-actions button,.dock nav button'))node.style.removeProperty('font-size');});
      // Simulate a browser that reports a tall visual viewport while its small viewport is shorter.
      await layout(640,320,0,500);const conservative=await chromeFits();assert.equal(conservative.app.height,500);
      await page.evaluate(()=>{
        const strip=document.createElement('div');strip.id='synthetic-browser-toolbar';strip.textContent='Simulated Safari toolbar';
        Object.assign(strip.style,{position:'fixed',top:'500px',left:0,right:0,bottom:0,zIndex:100,background:'#253044',color:'#ffffff',padding:'20px',textAlign:'center',font:'14px system-ui'});
        document.body.append(strip);
      });
      await page.screenshot({path:path.resolve('.pilot-tmp/safari-viewport-phone.png')});
      // The normal launcher and both parked handles remain above the simulated browser controls.
      for(const handle of await page.locator('.communication-launcher:visible').all())assert.ok((await handle.boundingBox()).y+44<=500);
      await page.locator('#synthetic-browser-toolbar').evaluate(node=>node.remove());
      await layout(560,320);await page.getByRole('button',{name:'Read passage',exact:true}).click();
      await page.locator('#dialog .verse').first().waitFor();
      await page.locator('#panel-body').evaluate(node=>node.scrollTop=80);
      const readingTop=await page.locator('#panel-body').evaluate(node=>node.scrollTop);
      await layout(380,320,40);
      await page.waitForFunction(()=>{
        const box=document.getElementById('dialog').getBoundingClientRect(),app=document.querySelector('.app').getBoundingClientRect();
        return box.top>=app.top-1&&box.bottom<=app.bottom+1;
      });
      assert.equal(await page.locator('#panel-body').evaluate(node=>node.scrollTop),readingTop,'Viewport changes preserve the reader position');
      await page.locator('#close').click();
      const oldStyle=await page.locator('html').evaluate(node=>[node.style.getPropertyValue('--workspace-layout-width'),node.style.getPropertyValue('--workspace-layout-visible-height')]);
      await page.evaluate(()=>window.__setViewport({scale:1.6,width:200,height:260,offsetTop:80,offsetLeft:20}));
      await page.waitForTimeout(80);
      assert.deepEqual(await page.locator('html').evaluate(node=>[node.style.getPropertyValue('--workspace-layout-width'),node.style.getPropertyValue('--workspace-layout-visible-height')]),oldStyle,'Pinch zoom must not reflow the app under the user');
      await layout(560,320);
      assert.equal(await page.locator('#layout-check').count(),0,'Normal navigation has no diagnostic controls');
      assert.equal(await page.evaluate(()=>window.__viewportAudio===document.getElementById('audio')),true);
      assert.ok(await page.locator('#audio').evaluate((audio,time)=>!audio.paused&&audio.currentTime>=time,before),'Audio continues through viewport changes');
      await page.goto(url+'?week=7&layout=check');
      await page.getByRole('button',{name:'Copy layout details',exact:true}).waitFor();
      await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>{window.__layoutCopy=value;}},configurable:true}));
      await page.getByRole('button',{name:'Copy layout details',exact:true}).click();
      const report=JSON.parse(await page.evaluate(()=>window.__layoutCopy));
      assert.deepEqual(Object.keys(report),['build','device','viewportPolicy','safeArea','screen','visual','app','header','dock','week','appPosition','brandFont']);
      assert.equal(report.viewportPolicy,'width=device-width, initial-scale=1');
      assert.equal(report.device.pixelRatio,3);
      assert.equal(report.device.standalone,false);
      assert.deepEqual(report.safeArea,{top:0,right:0,bottom:0,left:0});
      assert.equal(report.appPosition,'relative');
      assert.equal(report.build,'local');
      assert.deepEqual(errors,[]);
      console.log('Passed header recovery: negative/stale positive offsets, restored root scrolling, simultaneous header/footer boundaries, retained workspace scroll, pinch zoom, and opt-in local layout copy.');
      console.log('Passed visible workspace: simulated toolbar/small-viewport caps, keyboard offsets, 320px/enlarged header controls, dock/launcher/handle reachability, conversation and reader bounds, retained reader/audio state, and preserved pinch-zoom layout. Physical Safari remains unverified.');
    } finally {await context.close();}
  } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
