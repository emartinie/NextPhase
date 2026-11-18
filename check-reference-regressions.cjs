const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=__dirname,folder='F:/Development/Iteration-Archives/reference-readers-start-2026-11-17/regression';
fs.mkdirSync(folder,{recursive:true});
const defaultTests=['check-reference-source-integrity.cjs','check-reference-readers.cjs','check-reference-directory.cjs','check-reference-library.cjs','check.cjs','check-study-tools.cjs','check-people.cjs','check-learning.cjs','check-learning-workspace.cjs','check-workspaces.cjs','check-calendar.cjs','check-preparedness.cjs','check-preparedness-migration.cjs','check-common-ground.cjs','check-fellowship-games.cjs','check-fellowship-home.cjs','check-fellowship-email.cjs','check-theme.cjs','check-olam-haba.cjs'];
const tests=process.argv.length>2?process.argv.slice(2):defaultTests;
const results=fs.existsSync(path.join(folder,'results.json'))?JSON.parse(fs.readFileSync(path.join(folder,'results.json'))):[];
for(const test of tests){
 const previous=results.findIndex(r=>r.test===test);if(previous>=0)results.splice(previous,1);
 const oldLog=path.join(folder,test+'.log');if(fs.existsSync(oldLog)&&!fs.existsSync(oldLog+'.initial'))fs.copyFileSync(oldLog,oldLog+'.initial');
 const started=Date.now();process.stdout.write('Running '+test+'\n');
 try{const output=execFileSync(process.execPath,[path.join(root,test)],{cwd:root,env:process.env,timeout:240000,maxBuffer:4000000,windowsHide:true,encoding:'utf8'});fs.writeFileSync(path.join(folder,test+'.log'),output);results.push({test,status:'passed',milliseconds:Date.now()-started});console.log('PASS '+test);}
 catch(e){const output=String(e.stdout||'')+'\n'+String(e.stderr||e.message);fs.writeFileSync(path.join(folder,test+'.log'),output);results.push({test,status:'failed',milliseconds:Date.now()-started,exitCode:e.status});console.log('FAIL '+test+'\n'+output.slice(-2200));}
 fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify(results,null,2)+'\n');
}
console.log(JSON.stringify({passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').map(r=>r.test),folder}));
if(results.some(r=>r.status==='failed'))process.exitCode=1;
