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
  for (const address of ['https://example.com/?pilot=firebase','https://homegroups.org.example.com/?pilot=firebase','http://homegroups.org/?pilot=firebase','https://emartinie.github.io/NextPhase/?pilot=firebase']) {
    assert.equal(fellowshipRuntime(address).firebaseCommunication,false,address);
  }
  assert.equal(fellowshipRuntime('http://localhost:8770/NextPhase/?pilot=firebase').firebaseCommunication,true);
  assert.equal(fellowshipRuntime('http://127.0.0.1:8770/NextPhase/?pilot=fellowship').pilotMode,'fellowship');
  assert.equal(fellowshipRuntime('http://localhost:8770/NextPhase/').firebaseCommunication,false);
  console.log('Passed production/preview host selection, reserved Hosting config path, lookalike/untrusted-host rejection and retained local review modes. No live configuration or data changes.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
