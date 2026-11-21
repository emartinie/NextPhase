// Actual Listen/Orbit UI, one real media element, synthetic WAV responses. No live services.
const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium,devices} = require(process.env.NEXTPHASE_PLAYWRIGHT || 'playwright');
const {createPreviewServer,startPagesCheck,pagesMount} = require('../../serve-preparedness.cjs');

async function main() {
  const server=createPreviewServer({mount:pagesMount}),url=await startPagesCheck(server);
  const wav=Buffer.alloc(960044);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
  let browser;
  try {
    browser=await chromium.launch({executablePath:process.env.NEXTPHASE_CHROME||undefined,args:['--disable-gpu','--renderer-process-limit=3','--disable-gpu-shader-disk-cache','--disk-cache-size=1048576']});
    for(const phone of process.argv.includes('--desktop-only')?[false]:[true]) {
      const context=await browser.newContext(phone?devices['iPhone 13']:{viewport:{width:1280,height:850}});
      try {
        const page=await context.newPage(),errors=[];page.setDefaultTimeout(12000);
        page.on('pageerror',error=>errors.push(error.message));
        await page.route('**/*',route=>{
          const request=new URL(route.request().url());
          if(request.pathname.endsWith('.mp3')) {
            if(request.pathname.includes('missing'))return route.fulfill({status:404,body:'Missing test recording'});
            const range=/^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range || '');
            const start=range?Number(range[1]):0,end=range&&range[2]?Math.min(Number(range[2]),wav.length-1):wav.length-1;
            const headers={'Content-Type':'audio/wav','Accept-Ranges':'bytes','Content-Length':String(end-start+1)};
            if(range)headers['Content-Range']=`bytes ${start}-${end}/${wav.length}`;
            return route.fulfill({status:range?206:200,headers,body:wav.subarray(start,end+1)});
          }
          return request.origin===new URL(url).origin?route.continue():route.abort();
        });
        const state=()=>page.evaluate(async()=>(await import('./audio-session.js')).audioSession.getState());
        async function openListen() {
          const summary=page.locator('#study summary').filter({hasText:/^Listen$/});
          if(!await summary.evaluate(node=>node.parentElement.open))await summary.click();
          await page.locator('#study').getByRole('button',{name:/^Scripture audio/}).click();
          await page.locator('#panel-body .rows button').first().waitFor();
        }
        async function control(title) {
          const point=await page.locator('#floatingPlayer button').evaluateAll((buttons,title)=>{
            const button=buttons.find(button=>button.title===title);
            if(!button||button.disabled)throw new Error('Unavailable control: '+title);
            const rect=button.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height/2;
            if(!button.contains(document.elementFromPoint(x,y)))throw new Error('Covered control: '+title);
            return {x,y};
          },title);
          if(phone)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
        }
        await page.goto(url+'?week=8');
        await page.locator('#floatingPlayer[data-audio-ready=true]').waitFor();
        await page.locator('#study-title').waitFor();
        assert.equal(await page.locator('audio').count(),1);assert.equal(await page.locator('#floatingPlayer audio').count(),0);
        assert.equal((await state()).status,'idle');assert.equal(await page.locator('#audio').getAttribute('src'),null,'No automatic page-load recording');
        // Move the existing surface away from the Listen rows before activating one.
        await control('Park player at screen edge');
        await openListen();
        await page.locator('#panel-body .rows button').first().click();
        await page.waitForFunction(()=>document.getElementById('audio').currentTime>.05);
        const started=await state();assert.equal(started.playing,true);assert.ok(started.title.endsWith('English'));
        assert.equal(await page.locator('#player').isVisible(),false,'Orbit is the primary controller');
        await page.evaluate(()=>{window.__sharedAudio=document.getElementById('audio');});
        await page.locator('#close').click();
        await page.getByRole('button',{name:'Restore Orbit player',exact:true}).click();
        await page.waitForFunction(()=>document.querySelector('.orbit-track-title').textContent===document.getElementById('playing').textContent);
        await control('Play / Pause');assert.equal((await state()).playing,false);
        const paused=(await state()).currentTime;
        await control('Play / Pause');await page.waitForFunction(()=>!document.getElementById('audio').paused);
        assert.ok((await state()).currentTime>=paused,'Resume preserves position');
        await control('Toggle Playback Speed');assert.equal((await state()).rate,1.25);
        await page.evaluate(()=>{document.getElementById('audio').currentTime=20;});
        await page.waitForFunction(()=>Number(document.querySelector('.orbit-progress').getAttribute('aria-valuenow'))>=33);
        if(phone)await page.screenshot({path:path.resolve('.pilot-tmp/orbit-audio-playing-phone.png')});
        await control('Park player at screen edge');
        const parkedTime=(await state()).currentTime;
        await page.locator('#workspace-switch').click();await page.locator('#workspace-track[data-workspace=learning]').waitFor();
        await page.waitForFunction(time=>document.getElementById('audio').currentTime>time+.1,parkedTime);
        await page.locator('#workspace-previous').click();await page.locator('#workspace-track[data-workspace=study]').waitFor();
        assert.equal(await page.evaluate(()=>window.__sharedAudio===document.getElementById('audio')),true);
        await page.getByRole('button',{name:'Restore Orbit player',exact:true}).click();

        // Exercise preserved legacy playlist/language controls using local synthetic tracks.
        await page.evaluate(()=>window.dispatchEvent(new CustomEvent('player:updatePlaylist',{detail:{playlist:[{label:'Synthetic reading one',src:'./one.mp3',heb:'./one-he.mp3'},{label:'Synthetic reading two',src:'./two.mp3'}]}})));
        await page.waitForFunction(()=>!document.getElementById('audio').paused&&document.getElementById('audio').currentTime>.02);
        assert.match((await state()).title,/Synthetic reading one/);
        await control('Language');assert.equal((await state()).language,'hebrew');assert.match((await state()).source,/one-he\.mp3$/);
        await control('Language');assert.equal((await state()).language,'english');
        await control('Next');assert.match((await state()).source,/two\.mp3$/);
        assert.equal(await page.locator('#floatingPlayer button[title="Language"]').isDisabled(),true,'Unavailable languages are not substituted');
        assert.equal(await page.locator('audio').count(),1);

        await page.evaluate(async()=>{
          const {audioSession}=await import('./audio-session.js');
          audioSession.pause();
          const audio=audioSession.audio,nativePlay=audio.play.bind(audio);let first=true;
          audio.play=()=>{if(first){first=false;return Promise.reject(new DOMException('Synthetic gesture restriction','NotAllowedError'));}return nativePlay();};
          audioSession.playRecording('./blocked.mp3','Synthetic blocked recording');
        });
        await page.locator('#floatingPlayer[data-audio-status=blocked]').waitFor();
        assert.match(await page.locator('.orbit-audio-status').textContent(),/Tap Play/);
        await control('Play / Pause');await page.waitForFunction(()=>!document.getElementById('audio').paused);
        await page.evaluate(async()=>{(await import('./audio-session.js')).audioSession.playRecording('./missing.mp3','Synthetic unavailable recording');});
        await page.locator('#floatingPlayer[data-audio-status=error]').waitFor();
        assert.match(await page.locator('.orbit-audio-status').textContent(),/unavailable/);
        await page.evaluate(async()=>{(await import('./audio-session.js')).audioSession.playRecording('./recovery.mp3','Synthetic recovered recording');});
        await page.waitForFunction(()=>!document.getElementById('audio').paused&&document.getElementById('audio').currentTime>.02);
        // Reach native seeking/stop controls through the existing Listen panel.
        await control('Park player at screen edge');
        await openListen();
        await page.locator('#panel-body .rows button').first().click();
        await page.waitForFunction(()=>!document.getElementById('audio').paused);
        await page.getByRole('button',{name:'Playback controls',exact:true}).click();
        await page.locator('#dialog').waitFor({state:'hidden'});
        assert.equal(await page.locator('#player').isVisible(),true);assert.equal(await page.locator('#audio').getAttribute('controls'),'');
        await page.locator('#stop-audio').click();assert.equal((await state()).status,'idle');assert.equal(await page.locator('#audio').getAttribute('src'),null);
        assert.equal(await page.locator('#player').isVisible(),false);
        assert.equal(await page.locator('audio').count(),1);
        await page.getByRole('button',{name:'Restore Orbit player',exact:true}).click();
        if(phone)await page.screenshot({path:path.resolve('.pilot-tmp/orbit-unified-audio-phone.png')});
        assert.deepEqual(errors,[]);
        console.log('Passed unified audio '+(phone?'phone-sized touch':'desktop')+': real Listen handoff, one media element, Orbit pause/resume/rate/progress, parked workspace continuity, playlist/language controls, blocked-play retry, unavailable/recovery feedback, native fallback and Stop. Recordings were synthetic local WAV responses; no provider or Firebase access.');
      } finally { await context.close(); }
    }
  } finally {
    if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
