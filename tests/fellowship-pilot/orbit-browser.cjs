// Preserved uploaded Orbit, real logo/video, local resources only; no live accounts.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium, devices } = require(process.env.NEXTPHASE_PLAYWRIGHT || 'playwright');
const { createPreviewServer, startPagesCheck, pagesMount } = require('../../serve-preparedness.cjs');

async function main() {
  const server = createPreviewServer({ mount: pagesMount });
  const url = await startPagesCheck(server);
  const contexts = [], errors = [];
  let browser;
  try {
    const range = await fetch(url + 'bg-motion.mp4', {headers:{Range:'bytes=0-31'}});
    assert.equal(range.status,206);
    assert.equal(range.headers.get('content-type'),'video/mp4');
    assert.equal((await range.arrayBuffer()).byteLength,32);
    const image = await fetch(url+'HGHousesnew.png',{method:'HEAD'});
    assert.equal(image.status,200);
    assert.equal(image.headers.get('content-type'),'image/png');
    browser = await chromium.launch({executablePath:process.env.NEXTPHASE_CHROME||undefined,args:['--disable-gpu','--renderer-process-limit=3','--disable-gpu-shader-disk-cache','--disk-cache-size=1048576']});
    for (const phone of process.argv.includes('--phone-only') ? [true] : process.argv.includes('--desktop-only') ? [false] : [true,false]) {
      const context = await browser.newContext(phone ? devices['iPhone 13'] : {viewport:{width:1280,height:850}});
      contexts.push(context);
      const page = await context.newPage();
      page.setDefaultTimeout(12000);
      page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(url).origin?route.continue():route.abort());
      await page.goto(url+'?week=8');
      await page.locator('#study .today').waitFor();
      await page.locator('#orbitLogo').waitFor();
      await page.waitForFunction(()=>document.querySelector('#orbitLogo').naturalWidth>0);
      const transparency=await page.locator('#orbitLogo').evaluate(image=>{
        const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
        const context=canvas.getContext('2d');context.drawImage(image,0,0);
        const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
        let transparent=0,opaque=0;
        for(let i=3;i<pixels.length;i+=4){if(pixels[i]===0)transparent++;if(pixels[i]===255)opaque++;}
        return {source:image.getAttribute('src'),corner:pixels[3],transparent,opaque};
      });
      assert.equal(transparency.source,'HGHouses-transparent.png');
      assert.equal(transparency.corner,0);
      assert.ok(transparency.transparent>0&&transparency.opaque>0,'Logo should retain artwork with real transparent surroundings');
      async function face(expected) {
        const values=await page.evaluate(()=>['orbitLogo','orbitVideo','orbitSonograph'].map(id=>({id,visible:getComputedStyle(document.getElementById(id)).display!=='none'})));
        assert.deepEqual(values.filter(item=>item.visible).map(item=>item.id),[expected]);
      }
      async function ringCentered() {
        const result=await page.locator('.orbit-progress').evaluate(svg=>{
          const size=getComputedStyle(svg), root=document.getElementById('floatingPlayer').getBoundingClientRect();
          const point=svg.createSVGPoint();point.x=85;point.y=85;
          const center=point.matrixTransform(svg.getScreenCTM());
          return {width:parseFloat(size.width),height:parseFloat(size.height),viewBox:svg.getAttribute('viewBox'),dx:center.x-(root.left+root.width/2),dy:center.y-(root.top+root.height/2),layers:['.orbit-face','.orbit-progress','.orbit-center'].map(selector=>Number(getComputedStyle(document.querySelector(selector)).zIndex))};
        });
        assert.equal(result.width,170);assert.equal(result.height,170);
        assert.equal(result.viewBox,'0 0 170 170');
        assert.ok(Math.abs(result.dx)<1&&Math.abs(result.dy)<1,JSON.stringify(result));
        assert.deepEqual(result.layers,[1,2,3]);
      }
      async function clickControl(title) {
        // The original face gently animates; use a fresh hit point instead of waiting for it to stop.
        const point=await page.locator('#floatingPlayer button').evaluateAll((buttons,title)=>{
          const button=buttons.find(button=>button.title===title);
          if(!button)throw new Error('Missing control '+title);
          const rect=button.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height/2;
          if(!button.contains(document.elementFromPoint(x,y)))throw new Error('Control is covered: '+title);
          return {x,y};
        },title);
        await page.mouse.click(point.x,point.y);
      }
      await face('orbitLogo');
      await ringCentered();
      assert.equal(await page.locator('.brand-icon svg').evaluate(svg=>getComputedStyle(svg).width),'23px');
      assert.equal(await page.locator('#floatingPlayer').evaluate(node=>getComputedStyle(node).animationName),'fpOrbit');
      assert.equal(await page.locator('#floatingPlayer audio').count(),0,'Orbit is a controller, not a second audio engine');
      assert.equal(await page.locator('audio').count(),1);
      assert.equal(await page.locator('#audio').count(),1,'Existing native audio remains');
      if(phone)await page.screenshot({path:path.resolve('.pilot-tmp/orbit-logo-phone.png')});
      const beforeControl=await page.locator('#floatingPlayer').boundingBox();
      await clickControl('Open Video (popup)');
      await face('orbitVideo');
      await page.waitForFunction(()=>document.getElementById('orbitVideo').currentTime>.05,{},{timeout:10000});
      assert.equal(await page.locator('#orbitVideo').evaluate(video=>video.muted&&video.playsInline&&video.loop),true);
      await ringCentered();
      const afterControl=await page.locator('#floatingPlayer').boundingBox();
      assert.ok(Math.abs((afterControl.x+afterControl.width/2)-(beforeControl.x+beforeControl.width/2))<12,'Clicking a control must not start dragging and snap the player');
      if(phone)await page.screenshot({path:path.resolve('.pilot-tmp/orbit-video-phone.png')});
      // A silent synthetic track exercises real HTML audio continuity without contacting a provider.
      const pcm=Buffer.alloc(960044);pcm.write('RIFF');pcm.writeUInt32LE(pcm.length-8,4);pcm.write('WAVEfmt ',8);pcm.writeUInt32LE(16,16);pcm.writeUInt16LE(1,20);pcm.writeUInt16LE(1,22);pcm.writeUInt32LE(8000,24);pcm.writeUInt32LE(16000,28);pcm.writeUInt16LE(2,32);pcm.writeUInt16LE(16,34);pcm.write('data',36);pcm.writeUInt32LE(pcm.length-44,40);
      await page.route('**/__orbit-parking.mp3',route=>{
        const range=/^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range||'');
        const start=range?Number(range[1]):0,end=range&&range[2]?Math.min(Number(range[2]),pcm.length-1):pcm.length-1;
        const headers={'Content-Type':'audio/wav','Accept-Ranges':'bytes','Content-Length':String(end-start+1)};
        if(range)headers['Content-Range']=`bytes ${start}-${end}/${pcm.length}`;
        return route.fulfill({status:range?206:200,headers,body:pcm.subarray(start,end+1)});
      });
      await page.evaluate(async()=>{
        const player=document.getElementById('floatingPlayer'),audio=document.getElementById('audio');
        window.__originalOrbit={player,audio,video:document.getElementById('orbitVideo')};
        (await import('./audio-session.js')).audioSession.playRecording('./__orbit-parking.mp3','Synthetic parking recording');
      });
      await page.waitForFunction(()=>document.getElementById('audio').currentTime>.05);
      await page.waitForFunction(()=>Boolean(document.getElementById('floatingPlayer').__edgeParking));
      await clickControl('Park player at screen edge');
      const restore=page.getByRole('button',{name:'Restore Orbit player',exact:true});
      await restore.waitFor();
      assert.equal(await page.locator('#floatingPlayer').isVisible(),false);
      assert.equal(await page.locator('#floatingPlayer').getAttribute('data-mode'),'minimized');
      assert.equal(await restore.getAttribute('data-side'),'right');
      assert.equal(await page.getByRole('button',{name:'Park Orbit player',includeHidden:true,exact:true}).textContent(),'›');
      const mediaState=await page.evaluate(()=>{
        const {player,audio,video}=window.__originalOrbit;
        return {same:player===document.getElementById('floatingPlayer')&&audio===document.getElementById('audio')&&video===document.getElementById('orbitVideo'),audioPlaying:!audio.paused,videoFace:!video.classList.contains('hidden'),videoPlaying:!video.paused,time:audio.currentTime};
      });
      assert.equal(mediaState.same,true);assert.equal(mediaState.audioPlaying,true);
      assert.equal(mediaState.videoFace,true);assert.equal(mediaState.videoPlaying,true);
      await page.waitForFunction(before=>document.getElementById('audio').currentTime!==before,mediaState.time);
      await page.getByRole('button',{name:'Open communications',exact:true}).click();
      assert.equal(await page.locator('#floatingPlayer').evaluate(node=>getComputedStyle(node).visibility),'hidden','Fullscreen communications must cover Orbit without stopping its audio');
      assert.equal(await page.locator('#audio').evaluate(audio=>audio.paused),false);
      await page.getByRole('button',{name:'Sidepark communications',exact:true}).click();
      await page.locator('.communication-surface').waitFor({state:'hidden'});
      const orbitHandle=await restore.boundingBox(),chatHandle=await page.locator('.communication-launcher:not(.orbit-edge-handle)').boundingBox();
      assert.equal(orbitHandle.width,44);assert.equal(orbitHandle.height,44);
      assert.ok(orbitHandle.y>=chatHandle.y+chatHandle.height+4,'Two parked activities need separate, predictable handles');
      if(phone) {
        await page.screenshot({path:path.resolve('.pilot-tmp/orbit-parked-phone.png')});
        await page.setViewportSize({width:390,height:360});
        await page.waitForFunction(()=>{
          const rect=document.querySelector('.orbit-edge-handle').getBoundingClientRect();
          return rect.top>=0&&rect.bottom<=innerHeight&&rect.right<=innerWidth;
        });
        await page.setViewportSize({width:390,height:664});
      }
      await restore.click();
      assert.equal(await page.locator('#floatingPlayer').isVisible(),true);
      await face('orbitVideo');
      assert.equal(await page.evaluate(()=>document.getElementById('audio')===window.__originalOrbit.audio&&!window.__originalOrbit.audio.paused),true);
      await page.getByRole('button',{name:'Reopen communications',exact:true}).click();
      await page.getByRole('button',{name:'Sidepark communications',exact:true}).click();
      await page.locator('.communication-surface').waitFor({state:'hidden'});
      // Put the retained player at a known left-side location; exercise the real button again.
      // Legacy animated body dragging is separate from this button-parking contract.
      await page.locator('#floatingPlayer').evaluate(player=>{player.style.left='60px';player.style.right='auto';});
      const leftPosition=await page.locator('#floatingPlayer').boundingBox();
      assert.ok(leftPosition.x+leftPosition.width/2<page.viewportSize().width/2,'Move player to the left before parking');
      await clickControl('Park player at screen edge');
      await restore.waitFor();
      assert.equal(await restore.getAttribute('data-side'),'left');
      assert.equal(await page.getByRole('button',{name:'Park Orbit player',includeHidden:true,exact:true}).textContent(),'‹');
      await restore.click();
      await ringCentered();
      await page.evaluate(async()=>{(await import('./audio-session.js')).audioSession.stop();});
      await clickControl('Open Video (popup)');
      await face('orbitLogo');
      assert.equal(await page.locator('#orbitVideo').evaluate(video=>video.paused),true);
      await page.evaluate(()=>window.toggleOrbitSonograph());
      await face('orbitSonograph');
      await page.evaluate(()=>window.toggleOrbitSonograph());
      await face('orbitLogo');
      const progress=await page.evaluate(()=>{
        const audio=document.getElementById('audio'),circle=document.querySelector('.orbit-progress circle[stroke-dasharray]');
        let current=0;
        Object.defineProperties(audio,{duration:{get:()=>100,configurable:true},currentTime:{get:()=>current,configurable:true}});
        return [0,.25,.75,1].map(value=>{current=value*100;audio.dispatchEvent(new Event('timeupdate'));return {value,offset:Number(circle.getAttribute('stroke-dashoffset')),length:Number(circle.getAttribute('stroke-dasharray'))};});
      });
      for(const item of progress)assert.ok(Math.abs(item.offset-item.length*(1-item.value))<.001);
      assert.equal(await page.locator('#audio').evaluate(audio=>audio.paused&&!audio.hasAttribute('src')),true);
      await page.getByRole('button',{name:'Reopen communications',exact:true}).click();
      assert.equal(await page.locator('.communication-surface').isVisible(),true,'Global conversation access stays available');
      await page.getByRole('button',{name:'Sidepark communications',exact:true}).click();
      await page.locator('.communication-surface').waitFor({state:'hidden'});
      await page.locator('#week-button').click();
      await page.locator('#dialog').waitFor();
      await page.locator('#close').click();
      assert.equal(await page.locator('#dialog').isVisible(),false,'Reader/menu controls remain above Orbit');
      assert.equal(await page.locator('#floatingPlayer').count(),1);
      await context.close();
    }
    assert.deepEqual(errors,[]);
    console.log('Passed Orbit '+(process.argv.includes('--phone-only')?'phone-sized':process.argv.includes('--desktop-only')?'desktop':'phone/desktop')+': exclusive transparent faces, real video, centered progress, original dock-button parking/retrieval on both sides, retained live silent audio/video and node identity, separate shared handles, viewport resizing, breathing/controls, native audio preservation, global conversation/menu access and media/range delivery.');
    console.log('Physical Safari touch gestures, autoplay policy and audio interoperability remain unverified. No live Firebase access.');
  } finally {
    for(const context of contexts)await context.close().catch(()=>{});
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
