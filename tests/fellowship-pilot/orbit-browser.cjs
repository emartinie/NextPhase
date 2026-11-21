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
    for (const phone of [true,false]) {
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
      assert.equal(await page.locator('#floatingPlayer audio').count(),1);
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
      await clickControl('Open Video (popup)');
      await face('orbitLogo');
      assert.equal(await page.locator('#orbitVideo').evaluate(video=>video.paused),true);
      await page.evaluate(()=>window.toggleOrbitSonograph());
      await face('orbitSonograph');
      await page.evaluate(()=>window.toggleOrbitSonograph());
      await face('orbitLogo');
      const progress=await page.evaluate(()=>{
        const audio=document.querySelector('#floatingPlayer audio'),circle=document.querySelector('.orbit-progress circle[stroke-dasharray]');
        let current=0;
        Object.defineProperties(audio,{duration:{get:()=>100,configurable:true},currentTime:{get:()=>current,configurable:true}});
        return [0,.25,.75,1].map(value=>{current=value*100;audio.dispatchEvent(new Event('timeupdate'));return {value,offset:Number(circle.getAttribute('stroke-dashoffset')),length:Number(circle.getAttribute('stroke-dasharray'))};});
      });
      for(const item of progress)assert.ok(Math.abs(item.offset-item.length*(1-item.value))<.001);
      assert.equal(await page.locator('#audio').evaluate(audio=>audio.paused&&!audio.hasAttribute('src')),true);
      await page.getByRole('button',{name:'Open communications',exact:true}).click();
      assert.equal(await page.locator('.communication-surface').isVisible(),true,'Global conversation access stays available');
      await page.getByRole('button',{name:'Close communications',exact:true}).click();
      await page.locator('#week-button').click();
      await page.locator('#dialog').waitFor();
      await page.locator('#close').click();
      assert.equal(await page.locator('#dialog').isVisible(),false,'Reader/menu controls remain above Orbit');
      assert.equal(await page.locator('#floatingPlayer').count(),1);
    }
    assert.deepEqual(errors,[]);
    console.log('Passed Orbit phone/desktop: exclusive faces, exact image decoding, real muted inline video playback/pause, centered 170px progress ring at several values, local layering, preserved breathing/controls, unchanged native audio, global conversation/menu access, PNG/MP4 types and range delivery.');
    console.log('Physical Safari touch gestures, autoplay policy and audio interoperability remain unverified. No live Firebase access.');
  } finally {
    for(const context of contexts)await context.close().catch(()=>{});
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
