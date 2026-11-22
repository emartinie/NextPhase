// Real Language Lab and article speech helper; synthetic device voice, no live providers.
const assert=require('node:assert/strict');
const {chromium,devices}=require(process.env.NEXTPHASE_PLAYWRIGHT||'playwright');
const {createPreviewServer,startPagesCheck,pagesMount}=require('../../serve-preparedness.cjs');

async function main() {
  const server=createPreviewServer({mount:pagesMount}),url=await startPagesCheck(server);let browser;
  try {
    browser=await chromium.launch({executablePath:process.env.NEXTPHASE_CHROME||undefined,args:['--disable-gpu','--renderer-process-limit=3','--disk-cache-size=1048576']});
    const context=await browser.newContext(devices['iPhone 13']);
    try {
      await context.addInitScript(()=>{
        window.__voice={speaking:false,starts:0,stops:0,speak(){this.speaking=true;this.starts++;},cancel(){this.speaking=false;this.stops++;},pause(){},resume(){}};
        Object.defineProperty(window,'speechSynthesis',{value:window.__voice,configurable:true});
        Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class {constructor(text){this.text=text;}},configurable:true});
      });
      const page=await context.newPage(),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(url).origin?route.continue():route.abort());
      await page.goto(url+'?week=8&card=language-lab');
      await page.getByRole('button',{name:'Play Alephbet song',exact:true}).click();
      await page.waitForFunction(()=>!document.getElementById('audio').paused&&document.getElementById('audio').currentTime>.05);
      assert.equal(await page.locator('audio').count(),1);
      assert.match(await page.locator('#audio').getAttribute('src'),/alephbet-song\.mp3$/);
      await page.locator('#close').click();
      await page.waitForTimeout(100);
      assert.equal(await page.locator('#audio').evaluate(audio=>audio.paused),false,'Closing the lesson keeps the persistent recording available');
      const retained=await page.locator('#audio').evaluate(audio=>audio.currentTime);
      // Mount the same article speech control with clearly synthetic article text.
      await page.evaluate(async()=>{
        const {speechControl}=await import('./learning.js');
        const content=document.createElement('section');content.id='synthetic-speech-controls';Object.assign(content.style,{position:'fixed',top:'100px',left:'8px',zIndex:30,width:'160px'});
        const article=document.createElement('p');article.textContent='Synthetic article for the shared-audio ownership test.';
        function button(label,action){const item=document.createElement('button');item.textContent=label;item.addEventListener('click',action);return item;}
        function text(value){const item=document.createElement('p');item.textContent=value;return item;}
        content.append(article,...speechControl(content,article,button,text,{canPause:true}));document.body.append(content);
      });
      await page.getByRole('button',{name:'Read aloud',exact:true}).click();
      assert.equal(await page.locator('#audio').evaluate(audio=>audio.paused),true);
      assert.equal(await page.evaluate(()=>window.__voice.speaking),true);
      // Native fallback controls must participate in the same ownership rule.
      await page.evaluate(()=>document.getElementById('audio').play());
      await page.getByRole('button',{name:'Read aloud',exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>window.__voice.speaking),false);
      assert.ok(await page.locator('#audio').evaluate((audio,time)=>audio.currentTime>=time,retained));
      assert.match(await page.locator('.orbit-track-title').textContent(),/Alephbet/);
      await page.locator('#synthetic-speech-controls').evaluate(node=>node.remove());

      // Re-enter the actual Greek controls and exercise their ownership handoff.
      await page.goto(url+'?week=8&card=language-lab');
      await page.getByRole('button',{name:'Greek',exact:true}).click();
      await page.getByRole('button',{name:'Speak letter',exact:true}).waitFor();
      await page.evaluate(async()=>{
        const {audioSession}=await import('./audio-session.js');
        audioSession.playRecording('./corpus/learning/alephbet-song.mp3','Alephbet song');
      });
      await page.waitForFunction(()=>!document.getElementById('audio').paused);
      await page.getByRole('button',{name:'Speak letter',exact:true}).click();
      assert.equal(await page.locator('#audio').evaluate(audio=>audio.paused),true);
      assert.equal(await page.evaluate(()=>window.__voice.speaking),true);
      await page.evaluate(()=>document.getElementById('audio').play());
      assert.equal(await page.evaluate(()=>window.__voice.speaking),false);
      assert.equal(await page.locator('audio').count(),1);
      assert.deepEqual(errors,[]);
      console.log('Passed Learning audio: supplied Alephbet recording uses the shared element, lesson-close continuity, article and Greek device-voice ownership, native-control cancellation, retained position and Orbit identity. Voice output was synthetic; no Firebase access.');
    } finally {await context.close();}
  } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
