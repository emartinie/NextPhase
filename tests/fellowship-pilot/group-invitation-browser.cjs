// Real application + synthetic Auth/store adapters. Not a rules emulator.
const assert=require('node:assert/strict');
const {chromium,devices}=require(process.env.NEXTPHASE_PLAYWRIGHT||'playwright');
const {createPreviewServer,startPagesCheck,pagesMount}=require('../../serve-preparedness.cjs');
const fixture=require('./firebase-browser.cjs');
const artifacts=require('node:path').resolve(__dirname,'../../.pilot-tmp/group-invitations');
require('node:fs').mkdirSync(artifacts,{recursive:true});
const emails={miriam:'host@example.test',daniel:'member@example.test',daughter:'relative@example.test',wrong:'different@example.test'};
Object.assign(fixture.accounts,{miriam:'Eddie (test)',daniel:'Member (test)',daughter:'Daughter (test)',wrong:'Wrong account (test)'});
const originalMembers=new Set(fixture.enrolled),invites=new Map(),recipients=new Map(),groupDirectory=new Map([['miriam/neighbors',{threadId:'shared',title:'Neighbors'}]]);
const neighborMembers=new Set(['miriam']),neighborNames=new Map([['miriam',{displayName:'Eddie (test)'}]]);
const members=g=>g==='household-pilot'?fixture.enrolled:g==='neighbors'?neighborMembers:originalMembers;
const deny=()=>{throw Object.assign(new Error('Synthetic permission rejection'),{code:'permission-denied'});};
const now=()=>Date.now();let pauseCreate,releaseCreate,sequence=0;
async function backend(op,ref,uid,data){
  if(ref.path?.includes('/memberNames'))ref={...ref,path:ref.path.replace('/memberNames','/profiles')};
  const parts=ref.path?.split('/')||[],gid=parts[1];
  if(op==='group-commit'){
    if(pauseCreate){await pauseCreate;pauseCreate=null;}
    const first=data[0],segments=first.ref.path.split('/');
    if(data.length===1&&segments[0]==='fellowshipMembers'){
      if(segments[1]!==uid||!members(segments[3]).has(uid))deny();groupDirectory.set(uid+'/'+segments[3],first.data);return{};
    }
    const group=segments[1],id=group+'/'+segments.at(-1),currentMembers=members(group);
    if(data.length===2){
      if(!currentMembers.has(uid)||first.data.creatorId!==uid||invites.has(id)||!/^[a-f0-9]{64}$/.test(segments.at(-1)))deny();
      const binding=data[1].data;if(binding.creatorId!==uid||binding.email!==binding.email.toLowerCase())deny();
      invites.set(id,{...first.data,createdAt:{__millis:now()}});recipients.set(id,binding);return{};
    }
    const existing=invites.get(id),binding=recipients.get(id);
    if(data.length!==4||!existing||existing.status!=='open'||existing.expiresAt.__millis<=now()||!currentMembers.has(existing.creatorId)||binding.email!==emails[uid]||currentMembers.has(uid))deny();
    const member=data[1],profile=data[2],index=data[3];
    if(member.ref.path!=='groups/'+group+'/members/'+uid||member.data.role!=='member'||member.data.inviteId!==segments.at(-1)||first.data.acceptedBy!==uid||profile.ref.path!=='groups/'+group+(group==='household-pilot'?'/profiles/':'/memberNames/')+uid||index.ref.path!=='fellowshipMembers/'+uid+'/groups/'+group)deny();
    invites.set(id,{...existing,...first.data});currentMembers.add(uid);(group==='neighbors'?neighborNames:fixture.householdProfiles).set(uid,profile.data);groupDirectory.set(uid+'/'+group,index.data);return{};
  }
  if(op==='group-update'){
    const id=gid+'/'+parts[3],item=invites.get(id);if(!item||item.status!=='open')deny();
    if(data.status==='revoked'){if(item.creatorId!==uid||!members(gid).has(uid))deny();}
    else if(data.status==='declined'){if(recipients.get(id).email!==emails[uid])deny();}
    else deny();Object.assign(item,data);return{};
  }
  if(parts[0]==='fellowshipMembers'){
    if(parts[1]!==uid)deny();return{docs:[...groupDirectory].filter(([key])=>key.startsWith(uid+'/')).map(([key,data])=>({id:key.split('/')[1],data}))};
  }
  if(parts[2]==='groupInvites'){
    const id=gid+'/'+parts[3],item=invites.get(id);if(!item||!(members(gid).has(uid)&&item.creatorId===uid||recipients.get(id).email===emails[uid]))deny();return{exists:true,data:item};
  }
  if(parts[2]==='profiles'&&parts[3]===uid&&op==='get'){const names=gid==='neighbors'?neighborNames:fixture.householdProfiles;return{exists:names.has(uid),data:names.get(uid)||{}};}
  if(gid==='neighbors'){
    if(parts[2]==='members'){if(parts[3]!==uid)deny();return{exists:neighborMembers.has(uid),data:{role:'member'}};}
    if(!neighborMembers.has(uid))deny();
    if(parts[2]==='profiles'){
      if(op==='set'){if(parts[3]!==uid)deny();neighborNames.set(uid,data);return{};}
      if(ref.kind==='query')return{docs:[...neighborNames].map(([id,data])=>({id,data}))};
      return{exists:neighborNames.has(parts[3]),data:neighborNames.get(parts[3])};
    }
    if(parts[2]!=='studyThreads'||parts[3]!=='shared')deny();
    if(parts.length===4)return{exists:true,data:{open:true,title:'Neighbors'}};
    if(op==='set'){const list=fixture.posts.get('groups/neighbors/studyThreads/shared')||[];list.push({id:parts[5],data:{...data,createdAt:++sequence}});fixture.posts.set('groups/neighbors/studyThreads/shared',list);return{};}
    return{docs:[...(fixture.posts.get('groups/neighbors/studyThreads/shared')||[])].reverse().slice(0,50)};
  }
  if(ref.path?.startsWith('groups/pilot-group/')&&!originalMembers.has(uid))deny();
  return fixture.backend(op,ref,uid,data);
}
const sdk=fixture.storeSdk.replace('data: () => data.data,','data: () => hydrate(data.data),')+`
function hydrate(value){if(value&&typeof value==='object'){if('__millis'in value)return{toMillis:()=>value.__millis};if(Array.isArray(value))return value.map(hydrate);return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,hydrate(item)]));}return value;}
export const Timestamp={fromMillis:ms=>({__millis:ms})};
export async function getDocsFromServer(ref){const data=await call('get',ref);return{docs:(data.docs||[]).map(d=>({id:d.id,data:()=>hydrate(d.data)}))};}
export function writeBatch(){const writes=[];return{set(ref,data){writes.push({ref,data});},commit(){return call('group-commit',{path:''},writes).finally(()=>{window.__groupWritesSettled=(window.__groupWritesSettled||0)+1;});}};}
export const updateDoc=(ref,data)=>call('group-update',ref,data);
export async function runTransaction(db,work){const writes=[];const result=await work({get:getDocFromServer,set(ref,data){writes.push({ref,data});},update(ref,data){writes.push({ref,data});}});if(writes.length)await call('group-commit',{path:''},writes);return result;}
`;
const auth=fixture.authSdk.replace('return uid ? { uid, displayName: window.__testNames[uid] } : null;',
  'return uid ? { uid, displayName: window.__testNames[uid],email:window.__testEmails[uid],emailVerified:true } : null;');
async function main(){
  const server=createPreviewServer({mount:pagesMount,handleRequest(req,res){
    const file=req.url.split('/').at(-1);if(process.env.NEXTPHASE_ONLINE_OVERLAY&&['app.js','learning-enrichment.js','reference-readers.js'].includes(file)){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(require('node:fs').readFileSync(require('node:path').join(process.env.NEXTPHASE_ONLINE_OVERLAY,file)));return true;}
    if(req.url!==pagesMount+'/__fellowship-firebase/config')return false;
    res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({projectId:'homegroups-fellowship',apiKey:'synthetic',appId:'synthetic'}));return true;
  }});
  const url=await startPagesCheck(server),contexts=[],errors=[];let browser;
  const surface=page=>page.locator('.communication-surface');
  async function open(uid,address=url+'?pilot=firebase&week=7'){
    const context=await browser.newContext({...devices['iPhone 13'],viewport:{width:375,height:667}});contexts.push(context);
    await context.addInitScript(({uid,names,emails})=>{window.__testAuthChoice=uid;window.__testNames=names;window.__testEmails=emails;
      Object.defineProperty(navigator,'share',{value:async packet=>{window.__sharedInvitation=packet;},configurable:true});
      Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__copiedInvite=text;}},configurable:true});
    },{uid,names:fixture.accounts,emails});
    const page=await context.newPage();page.setDefaultTimeout(25000);page.on('pageerror',e=>errors.push(e.message));
    await page.exposeFunction('__testStore',async args=>{try{return await backend(args.op,args.ref,args.uid,args.data);}catch(error){return{error:error.message,code:error.code};}});
    await page.route('**/*',route=>{
      const request=new URL(route.request().url());if(request.origin===new URL(url).origin)return route.continue();
      const source={'firebase-app.js':fixture.appSdk,'firebase-auth.js':auth,'firebase-firestore.js':sdk}[request.pathname.split('/').at(-1)];
      return request.hostname==='www.gstatic.com'&&source?route.fulfill({contentType:'text/javascript',body:source}):route.abort();
    });
    await page.goto(address);await page.locator('#study .today').waitFor({state:'attached'});
    if(!new URL(address).hash)await page.getByRole('button',{name:'Open communications',exact:true}).click();
    await surface(page).getByRole('button',{name:'Sign in with Google',exact:true}).click();
    return page;
  }
  try{
    browser=await chromium.launch({executablePath:process.env.NEXTPHASE_CHROME||undefined,args:['--disable-gpu','--renderer-process-limit=2','--disk-cache-size=1048576']});
    const host=await open('miriam');
    await surface(host).getByText('Invite to Family',{exact:true}).click();
    await surface(host).getByLabel('Recipient’s sign-in email',{exact:true}).fill('relative@example.test');
    pauseCreate=new Promise(resolve=>{releaseCreate=resolve;});
    await surface(host).getByRole('button',{name:'Create invitation',exact:true}).click();
    await surface(host).getByText('Creating invitation · awaiting confirmation…',{exact:true}).waitFor();
    assert.equal(await surface(host).getByLabel('Group invitation link',{exact:true}).count(),0,'Never share a local/unconfirmed invitation');
    releaseCreate();
    const generated=surface(host).getByLabel('Group invitation link',{exact:true});await generated.waitFor();
    const address=await generated.inputValue();assert.match(new URL(address).hash,/^#group-invite=[a-f0-9]{64}&group=household-pilot$/);
    assert.equal(address.includes('relative@example.test'),false);
    assert.equal(await surface(host).getByLabel('Recipient’s sign-in email',{exact:true}).inputValue(),'');
    await surface(host).getByRole('button',{name:'Copy invitation',exact:true}).click();
    assert.equal(await host.evaluate(()=>window.__copiedInvite),address);
    await surface(host).getByRole('button',{name:'Share invitation',exact:true}).click();assert.equal(await host.evaluate(()=>window.__sharedInvitation.url),address);
    await host.getByRole('button',{name:'Sidepark communications',exact:true}).click();
    await surface(host).waitFor({state:'hidden'});
    await host.locator('#flip').click();
    await host.locator('#fellowship-more').click();
    await host.getByRole('button',{name:/^Invitations/}).click();
    await surface(host).waitFor();
    assert.equal(await surface(host).getByText('Invite to Family',{exact:true}).locator('..').getAttribute('open'),'');
    assert.equal(await surface(host).getByLabel('Group invitation link',{exact:true}).inputValue(),address,'Navigator uses the same invitation surface');
    const wrong=await open('wrong',address);
    await surface(wrong).getByText('This invitation is unavailable for this account. Check your sign-in account or ask for a new invitation.',{exact:true}).waitFor();
    assert.equal(await surface(wrong).getByRole('button',{name:'Join Family',exact:true}).count(),0);
    assert.equal(fixture.enrolled.has('wrong'),false);await wrong.context().close();
    const daughter=await open('daughter',address);
    await surface(daughter).getByRole('button',{name:'Join Family',exact:true}).waitFor();
    await daughter.setViewportSize({width:375,height:420});await surface(daughter).getByRole('button',{name:'Join Family',exact:true}).scrollIntoViewIfNeeded();
    const shortJoin=await surface(daughter).getByRole('button',{name:'Join Family',exact:true}).boundingBox();assert.ok(shortJoin.y>=0&&shortJoin.y+shortJoin.height<=421);await daughter.setViewportSize({width:375,height:667});
    await daughter.screenshot({path:artifacts+'/01-join-family-phone.png'});
    assert.equal(fixture.enrolled.has('daughter'),false,'Sign-in and link preview must not grant membership');
    await surface(daughter).getByLabel('Your name in the group',{exact:true}).fill('Daughter (test)');
    await surface(daughter).getByRole('button',{name:'Join Family',exact:true}).click();
    await daughter.getByRole('heading',{name:'Family',exact:true}).waitFor();
    assert.equal(new URL(daughter.url()).hash,'');assert.equal(fixture.enrolled.has('daughter'),true);
    await surface(daughter).getByRole('textbox',{name:'Message',exact:true}).fill('Hello Family — a real saved reply in the test store.');
    await surface(daughter).getByRole('button',{name:'Send reply',exact:true}).click();
    await surface(daughter).getByText('Hello Family — a real saved reply in the test store.',{exact:true}).waitFor();
    await surface(host).getByRole('button',{name:'Family',exact:true}).click();
    await surface(host).getByText('Hello Family — a real saved reply in the test store.',{exact:true}).waitFor();
    await daughter.screenshot({path:artifacts+'/02-family-group-phone.png'});
    assert.equal(await surface(host).getByText('Daughter (test)',{exact:true}).count(),1);
    await daughter.reload();await daughter.locator('#study .today').waitFor();
    await daughter.getByRole('button',{name:'Open communications',exact:true}).click();
    await surface(daughter).getByRole('button',{name:'Family',exact:true}).click();
    await surface(daughter).getByText('Hello Family — a real saved reply in the test store.',{exact:true}).waitFor();
    assert.equal(fixture.posts.get('groups/household-pilot/studyThreads/household').length,1);
    await surface(daughter).getByRole('button',{name:'Back to conversations',exact:true}).click();
    await surface(daughter).getByText('Invite to Family',{exact:true}).click();
    await surface(daughter).getByLabel('Recipient’s sign-in email',{exact:true}).fill('next-relative@example.test');
    await surface(daughter).getByRole('button',{name:'Create invitation',exact:true}).click();
    await surface(daughter).getByLabel('Group invitation link',{exact:true}).waitFor();
    assert.equal(invites.size,2,'A newly authorized ordinary member can invite another relative');
    await surface(daughter).getByRole('button',{name:'Revoke invitation',exact:true}).click();
    await surface(daughter).getByText('Invitation revoked.',{exact:true}).waitFor();
    assert.equal([...invites.values()].filter(item=>item.status==='revoked').length,1);
    assert.equal(fixture.privateRooms.size,6,'Enrollment must not grant or create private pair conversations');

    // The same window and invitation service work for a distinct existing group.
    await surface(host).getByRole('button',{name:'Back to conversations',exact:true}).click();
    try{await surface(host).getByLabel('Group',{exact:true}).selectOption({label:'Neighbors'});}catch(error){console.error('Host invitation list:',await surface(host).innerText());throw error;}
    await surface(host).getByLabel('Recipient’s sign-in email',{exact:true}).fill('relative@example.test');
    await surface(host).getByRole('button',{name:'Create invitation',exact:true}).click();
    const neighborLink=surface(host).getByLabel('Group invitation link',{exact:true});await neighborLink.waitFor();const neighborAddress=await neighborLink.inputValue();
    assert.equal(new URLSearchParams(new URL(neighborAddress).hash.slice(1)).get('group'),'neighbors');
    await daughter.goto(neighborAddress);
    try{await surface(daughter).getByRole('button',{name:'Join Neighbors',exact:true}).click();}catch(error){console.error('Recipient review:',await surface(daughter).innerText(),'URL',daughter.url(),'records',[...invites], 'members',[...neighborMembers]);throw error;}
    await daughter.getByRole('heading',{name:'Neighbors',exact:true}).waitFor();
    await surface(daughter).getByRole('textbox',{name:'Message',exact:true}).fill('Hello neighbors');
    await surface(daughter).getByRole('button',{name:'Send reply',exact:true}).click();
    await surface(daughter).getByText('Hello neighbors',{exact:true}).waitFor();
    await surface(daughter).getByRole('textbox',{name:'Message',exact:true}).fill('Neighbors unfinished draft');
    await surface(daughter).getByRole('button',{name:'Back to conversations',exact:true}).click();
    await surface(daughter).getByRole('button',{name:'Family',exact:true}).click();await surface(daughter).getByRole('textbox',{name:'Message',exact:true}).fill('Family unfinished draft');
    await surface(daughter).getByRole('button',{name:'Back to conversations',exact:true}).click();await surface(daughter).getByRole('button',{name:'Neighbors',exact:true}).click();assert.equal(await surface(daughter).getByRole('textbox',{name:'Message',exact:true}).inputValue(),'Neighbors unfinished draft');
    await surface(daughter).getByRole('button',{name:'Back to conversations',exact:true}).click();
    await surface(daughter).getByRole('button',{name:'Neighbors',exact:true}).waitFor();
    assert.equal(fixture.posts.get('groups/household-pilot/studyThreads/household').length,1,'Second-group message never enters Family');
    await daughter.reload();await daughter.locator('#study .today').waitFor();await daughter.getByRole('button',{name:'Open communications',exact:true}).click();
    await surface(daughter).getByRole('button',{name:'Neighbors',exact:true}).click();await surface(daughter).getByText('Hello neighbors',{exact:true}).waitFor();
    assert.ok(groupDirectory.has('daughter/neighbors'),'Membership directory is persisted per identity and group');
    await daughter.context().close();const otherDevice=await open('daughter');await surface(otherDevice).getByRole('button',{name:'Neighbors',exact:true}).click();await surface(otherDevice).getByText('Hello neighbors',{exact:true}).waitFor();await otherDevice.screenshot({path:artifacts+'/03-other-group-phone.png'});await otherDevice.context().close();
    await surface(host).getByLabel('Group',{exact:true}).selectOption({label:'Family'});
    // A delayed sender operation must not reveal its result to a different account.
    await surface(host).getByLabel('Recipient’s sign-in email',{exact:true}).fill('private-next@example.test');
    const settled=await host.evaluate(()=>window.__groupWritesSettled||0);
    pauseCreate=new Promise(resolve=>{releaseCreate=resolve;});
    await surface(host).getByRole('button',{name:'Create invitation',exact:true}).click();
    await surface(host).getByText('Creating invitation · awaiting confirmation…',{exact:true}).waitFor();
    await surface(host).locator('.fellowship-account summary').click();
    await surface(host).getByRole('button',{name:'Sign out',exact:true}).click();
    await host.evaluate(()=>{window.__testAuthChoice='daniel';});
    await surface(host).getByRole('button',{name:'Sign in with Google',exact:true}).click();
    await surface(host).getByRole('button',{name:'Family',exact:true}).waitFor();
    releaseCreate();
    await host.waitForFunction(count=>(window.__groupWritesSettled||0)>count,settled);
    await host.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(await surface(host).getByLabel('Group invitation link',{exact:true}).count(),0);
    assert.equal(await surface(host).getByLabel('Recipient’s sign-in email',{exact:true}).inputValue(),'');
    assert.deepEqual(errors,[]);
    console.log('Passed operational Family + second-group invitation UI with synthetic identities: native share, persisted cross-device directory, group isolation; acknowledged invite, private email omitted from link, auto-open/sign-in, wrong-account denial, deliberate join, existing Family room/name, persisted group reply received/reloaded, member-issued/revoked invites, retained private-pair boundaries and sign-out isolation. Actual Firestore rule/emulator and physical-device verification remain separate.');
  }finally{releaseCreate?.();for(const context of contexts)await context.close().catch(()=>{});if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
