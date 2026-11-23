const assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const path = require('node:path');

async function main() {
  const {fellowshipRuntime} = await import(pathToFileURL(path.resolve(__dirname,'../../site-runtime.js')));
  for (const host of ['homegroups.org','www.homegroups.org','homegroups-fellowship.web.app','homegroups-fellowship.firebaseapp.com','homegroups-fellowship--iphone-pilot-xenvabqm.web.app']) {
    for (const query of ['', '?pilot=firebase', '?pilot=fellowship']) {
      const mode=fellowshipRuntime('https://'+host+'/NextPhase/'+query);
      assert.equal(mode.firebaseCommunication,true,host+query);
      assert.equal(mode.configPath,'/__/firebase/init.json');
    }
  }
  for (const query of ['', '?pilot=firebase', '?pilot=fellowship']) {
    const mode=fellowshipRuntime('https://emartinie.github.io/NextPhase/'+query);
    assert.equal(mode.firebaseCommunication,true);
    assert.equal(mode.configPath,'/NextPhase/fellowship-web-config.json');
  }
  assert.equal(fellowshipRuntime('https://emartinie.github.io/NextPhase').configPath,'/NextPhase/fellowship-web-config.json');
  const webConfig=require('../../fellowship-web-config.json');
  assert.deepEqual(Object.keys(webConfig).sort(),['apiKey','appId','authDomain','projectId']);
  assert.equal(webConfig.projectId,'homegroups-fellowship');
  assert.equal(webConfig.authDomain,'homegroups-fellowship.firebaseapp.com');
  assert.ok(Object.values(webConfig).every(value=>typeof value==='string'&&value.length>0));
  for (const address of ['https://example.com/?pilot=firebase','https://homegroups.org.example.com/?pilot=firebase','http://homegroups.org/?pilot=firebase',
    'http://emartinie.github.io/NextPhase/','https://emartinie.github.io/HGBibleApp/?pilot=firebase',
    'https://emartinie.github.io/NextPhase-lookalike/','https://emartinie.github.io.example.com/NextPhase/',
    'https://someone.github.io/NextPhase/?pilot=firebase']) {
    assert.equal(fellowshipRuntime(address).firebaseCommunication,false,address);
  }
  assert.equal(fellowshipRuntime('http://localhost:8770/NextPhase/?pilot=firebase').firebaseCommunication,true);
  assert.equal(fellowshipRuntime('http://127.0.0.1:8770/NextPhase/?pilot=fellowship').pilotMode,'fellowship');
  assert.equal(fellowshipRuntime('http://localhost:8770/NextPhase/').firebaseCommunication,false);
  console.log('Passed exact GitHub Pages app path with same-origin public config, Firebase Hosting reserved config, lookalike/untrusted-host rejection and retained local review modes. No live configuration or data changes.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
