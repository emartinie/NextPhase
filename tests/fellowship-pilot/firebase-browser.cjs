// Browser contract tests: real UI + shared reader, synthetic Auth/Firestore adapters.
// This is NOT a Firestore rules emulator and cannot establish deployed access safety.
const assert = require('node:assert/strict');
const { chromium, devices } = require(process.env.NEXTPHASE_PLAYWRIGHT || 'playwright');
const { createPreviewServer, startPagesCheck, pagesMount } = require('../../serve-preparedness.cjs');

const accounts = { miriam: 'Miriam Ellis', daniel: 'Daniel Brooks', ruth: 'Ruth', ezra: 'Ezra', outsider: 'Outside Tester' };
const publishedBaseline = process.argv.includes('--published-baseline');
const year = new Date().getFullYear();
const prefix = 'groups/pilot-group';
const householdPrefix = 'groups/household-pilot';
const enrolled = new Set(['miriam', 'daniel', 'ruth', 'ezra']);
const profiles = new Map();
const posts = new Map();
const privateRooms = new Map();
const family = ['miriam', 'daniel', 'ruth', 'ezra'];
const householdProfiles = new Map(family.map(uid=>[uid,{displayName:accounts[uid]}]));
for (let i=0;i<family.length;i++) for(let j=i+1;j<family.length;j++) {
  const pair=[family[i],family[j]];
  privateRooms.set('pair-'+i+'-'+j,{participantIds:pair,title:pair.map(uid=>accounts[uid]).join(' & ')});
}
let sequence = 0;
let sendDelay = 0;
let rejectSend = false;
let profileAccess = publishedBaseline ? 'none' : 'full';
const deniedMembershipReads = new Set(publishedBaseline ? Object.keys(accounts) : []);
const deniedThreadReads = new Set();
const deniedWeeklyReads = new Set();
const membershipReads = [];
const conversationReads = [];
const permission = () => { throw Object.assign(new Error('Synthetic permission rejection'), { code: 'permission-denied' }); };

async function backend(op, ref, uid, value) {
  const path = ref.path;
  const parts = path.split('/');
  if (parts[2] === 'studyThreads') conversationReads.push({ uid, path });
  if (parts[2] === 'members') {
    membershipReads.push(uid);
    if (parts[3] !== uid || deniedMembershipReads.has(uid)) permission();
    return { exists: enrolled.has(uid), data: { role: 'member' } };
  }
  if (parts[2] === 'studyThreads' && deniedThreadReads.has(uid)) permission();
  if (parts[2] === 'studyThreads' && path.startsWith(prefix+'/') && deniedWeeklyReads.has(uid)) permission();
  if (!enrolled.has(uid) || ![prefix,householdPrefix].some(prefix=>path.startsWith(prefix + '/'))) permission();
  if (parts[2] === 'profiles') {
    if (profileAccess === 'none' || profileAccess === 'no-list' && ref.kind === 'query') permission();
    const profileStore=path.startsWith(householdPrefix+'/')?householdProfiles:profiles;
    if (op === 'set') {
      if (parts[3] !== uid) permission();
      profileStore.set(uid, value);
      return {};
    }
    if (ref.kind === 'query') return { docs: [...profileStore].map(([id, data]) => ({ id, data })) };
    return { exists: profileStore.has(parts[3]), data: profileStore.get(parts[3]) || {} };
  }
  if (parts[2] === 'privateChats') {
    if (publishedBaseline||!path.startsWith(householdPrefix+'/')) permission();
    if (ref.kind === 'query' && parts.length === 3) {
      if (!ref.constraints.some(item=>item.where?.[0]==='participantIds'&&item.where[1]==='array-contains'&&item.where[2]===uid)) permission();
      return { docs: [...privateRooms].filter(([,data])=>data.participantIds.includes(uid)).map(([id,data])=>({id,data})) };
    }
    const room=privateRooms.get(parts[3]);
    if (!room?.participantIds.includes(uid)) permission();
    if (parts.length===4) return {exists:true,data:room};
  }
  const thread = parts.slice(0, 4).join('/');
  if (!['studyThreads','privateChats'].includes(parts[2])) permission();
  if (parts.length === 4) return { exists: /week-0[78]$/.test(path)||path.endsWith('/household'), data: {
    open: path.includes('/' + year + '-')||path.endsWith('/household'),
    ...(path.endsWith('/household')&&{memberLabels:Object.fromEntries(family.map(uid=>[uid,accounts[uid]]))}),
  } };
  if (op === 'set') {
    if (rejectSend) throw Object.assign(new Error('Synthetic write failure'), { code: 'unavailable' });
    if (sendDelay) await new Promise(resolve => setTimeout(resolve, sendDelay));
    const list = posts.get(thread) || [];
    list.push({ id: parts[5], data: { ...value, createdAt: ++sequence } });
    posts.set(thread, list);
    return {};
  }
  return { docs: [...(posts.get(thread) || [])].reverse().slice(0, 50) };
}

const appSdk = 'const apps=[]; export const getApps=()=>apps; export function initializeApp(config,name){const app={config,name};apps.push(app);return app;}';
const fs = require('node:fs');
const path = require('node:path');
const authSdk = fs.readFileSync(path.join(__dirname, 'sdk-auth.fixture.js'), 'utf8');
const storeSdk = fs.readFileSync(path.join(__dirname, 'sdk-firestore.fixture.js'), 'utf8');

async function main() {
  const server = createPreviewServer({ mount: pagesMount, handleRequest(req, res) {
    if (req.url !== pagesMount + '/__fellowship-firebase/config') return false;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ projectId: 'homegroups-fellowship', authDomain: 'synthetic.invalid', apiKey: 'synthetic', appId: 'synthetic' }));
    return true;
  } });
  const url = await startPagesCheck(server);
  let browser;
  const contexts = [];
  const pageErrors = [];
  try {
    browser = await chromium.launch({ executablePath: process.env.NEXTPHASE_CHROME || undefined,
      args: ['--disable-gpu', '--renderer-process-limit=3', '--disable-gpu-shader-disk-cache', '--disk-cache-size=1048576'] });
    async function open(uid, phone = false, week = 7, room = null) {
      const context = await browser.newContext(phone ? devices['iPhone 13'] : {});
      contexts.push(context);
      await context.addInitScript(({ uid, accounts }) => { window.__testAuthChoice=uid;window.__testNames=accounts; }, { uid, accounts });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      page.on('pageerror', error => pageErrors.push(error.message));
      await page.exposeFunction('__testStore', async ({op,ref,uid,data}) => {
        try { return await backend(op,ref,uid,data); }
        catch(e) { return {error:e.message,code:e.code}; }
      });
      await page.route('**/*', async route => {
        const request = new URL(route.request().url());
        if (request.origin === new URL(url).origin) return route.continue();
        const module = request.pathname.split('/').at(-1);
        const source = { 'firebase-app.js': appSdk, 'firebase-auth.js': authSdk, 'firebase-firestore.js': storeSdk }[module];
        if (request.hostname === 'www.gstatic.com' && source) return route.fulfill({ contentType:'text/javascript', body:source });
        return route.abort();
      });
      await page.goto(url + '?pilot=firebase&face=fellowship&week=' + week + (room ? '&room='+room : ''));
      await page.getByRole('button', {name:'Sign in with Google',exact:true}).click();
      await page.getByText('Signed in as ' + accounts[uid] + '.', {exact:true}).waitFor();
      return page;
    }
    async function profile(page, uid) {
      await page.getByLabel('Your community display name').waitFor();
      assert.equal(await page.getByLabel('Your community display name').inputValue(), accounts[uid]);
      await page.getByRole('button',{name:'Use this name',exact:true}).click();
      await page.getByRole('button',{name:'Post reply',exact:true}).waitFor();
    }
    async function send(page, body, reference) {
      await page.getByRole('textbox',{name:'Reply',exact:true}).fill(body);
      if(reference) {
        await page.getByText('Share Scripture',{exact:true}).click();
        await page.getByLabel('Scripture reference (optional)',{exact:true}).fill(reference);
      }
      await page.getByRole('button',{name:'Post reply',exact:true}).click();
      await page.getByText('Reply sent · saved to the community.',{exact:true}).waitFor();
    }

    if (publishedBaseline) {
      const first=await open('miriam',true);
      const second=await open('daniel');
      await first.getByText('Your community membership is confirmed. Member profiles are not available yet.',{exact:true}).waitFor();
      await send(first,'Using the published membership-protected conversation.','John 1:1–5');
      await second.getByText('Using the published membership-protected conversation.',{exact:true}).waitFor();
      const draft=second.getByRole('textbox',{name:'Reply',exact:true});
      await draft.fill('Draft retained with the published rules');
      const ref=second.locator('#fellowship .message').getByRole('button',{name:'John 1:1–5',exact:true});
      await ref.scrollIntoViewIfNeeded();
      const top=await second.locator('#fellowship').evaluate(el=>el.scrollTop);
      await ref.click();
      await second.locator('[data-reference="John 1:1"]').waitFor();
      await second.getByRole('button',{name:'Close',exact:true}).click();
      await second.getByRole('dialog').waitFor({state:'hidden'});
      assert.equal(await draft.inputValue(),'Draft retained with the published rules');
      assert.ok(Math.abs(top-await second.locator('#fellowship').evaluate(el=>el.scrollTop))<3);
      const outsider=await open('outsider');
      await outsider.getByText('This account does not have access to Wednesday HomeGroup.',{exact:false}).waitFor();
      assert.equal(await outsider.locator('#fellowship .message').count(),0);
      assert.equal(conversationReads.filter(item=>item.uid==='outsider'&&item.path.endsWith('/messages')).length,0);
      assert.deepEqual(membershipReads,[]);
      assert.equal(profiles.size,0);
      await first.getByRole('button',{name:'Household conversation',exact:true}).click();
      await first.getByText('Community members: Miriam Ellis, Daniel Brooks, Ruth, Ezra',{exact:true}).waitFor();
      await send(first,'The household room works under the existing group rules.');
      await second.getByRole('button',{name:'Household conversation',exact:true}).click();
      await second.getByText('The household room works under the existing group rules.',{exact:true}).waitFor();
      assert.deepEqual(pageErrors,[]);
      console.log('Passed published-rules contract: direct membership/profile reads denied, authorized replies and Scripture return work, nonmembers remain blocked.');
      console.log('Synthetic adapters only; this does not execute the actual Firestore rules engine.');
      return;
    }

    const miriam = await open('miriam',true);
    await profile(miriam,'miriam');
    const daniel = await open('daniel');
    await profile(daniel,'daniel');
    for(const uid of ['ruth','ezra']){
      const page=await open(uid);
      await profile(page,uid);
      await page.context().close();
    }
    await miriam.getByText('Community members: Miriam Ellis, Daniel Brooks, Ruth, Ezra',{exact:true}).waitFor();
    await send(miriam,'Let us read this together.','John 1:1–5');
    await daniel.locator('#fellowship .message').filter({hasText:'Miriam Ellis'}).getByRole('button',{name:'John 1:1–5',exact:true}).waitFor();
    await send(daniel,'I can see the shared passage.');
    await miriam.locator('#fellowship .message').filter({hasText:'Daniel Brooks'}).getByText('I can see the shared passage.',{exact:true}).waitFor();
    console.log('Passed: four synthetic profiles and two independently signed-in sessions exchange confirmed replies.');

    await miriam.getByRole('textbox',{name:'Reply',exact:true}).fill('Draft while visiting conversation menus');
    const localOrigin=new URL(miriam.url()).origin;
    await miriam.getByRole('button',{name:'Conversations',exact:true}).click();
    await miriam.getByRole('dialog').getByRole('button',{name:/^Chat with…/}).waitFor();
    await miriam.getByRole('dialog').getByRole('button',{name:/^Week 7 ·/}).click();
    await miriam.getByRole('dialog').waitFor({state:'hidden'});
    assert.equal(new URL(miriam.url()).origin,localOrigin);
    assert.equal(await miriam.getByRole('textbox',{name:'Reply',exact:true}).inputValue(),'Draft while visiting conversation menus');
    await miriam.getByRole('button',{name:'Communities',exact:true}).click();
    await miriam.getByRole('dialog').getByRole('button',{name:/^Wednesday HomeGroup/}).click();
    await miriam.getByRole('dialog').waitFor({state:'hidden'});
    assert.equal(new URL(miriam.url()).origin,localOrigin);
    assert.equal(await miriam.locator('a[href*="homegroups.org/?card=fellowship"]').count(),0);
    console.log('Passed: Conversations and Communities stay in NextPhase and preserve the existing reply.');

    const key=prefix+'/studyThreads/'+year+'-week-07';
    for(let i=0;i<14;i++)posts.get(key).push({id:'seed-'+i,data:{authorId:'daniel',body:'Earlier study thought '+i+': '+('Reading together. '.repeat(10)),createdAt:++sequence}});
    await miriam.getByText('Earlier study thought 13:',{exact:false}).waitFor();
    const draft=miriam.getByRole('textbox',{name:'Reply',exact:true});
    await draft.fill('My unfinished private draft');
    const passage=miriam.locator('#fellowship .message').getByRole('button',{name:'John 1:1–5',exact:true});
    await passage.scrollIntoViewIfNeeded();
    const before=await miriam.locator('#fellowship').evaluate(el=>el.scrollTop);
    await passage.click();
    await miriam.locator('[data-reference="John 1:1"]').waitFor();
    await miriam.getByLabel('Scripture reference',{exact:true}).fill('John 1');
    await miriam.getByRole('button',{name:'Open passage',exact:true}).click();
    await miriam.locator('[data-reference="John 1:15"]').waitFor();
    await miriam.getByRole('button',{name:'Passage tools for John 1:15',exact:true}).click();
    await miriam.getByRole('dialog').getByRole('heading',{name:'John 1:15',exact:true}).waitFor();
    await miriam.getByRole('button',{name:'Close',exact:true}).click();
    await miriam.getByRole('dialog').waitFor({state:'hidden'});
    assert.equal(await draft.inputValue(),'My unfinished private draft');
    const after=await miriam.locator('#fellowship').evaluate(el=>el.scrollTop);
    assert.ok(Math.abs(before-after)<3,'Fellowship scroll changed '+before+' → '+after);
    await miriam.getByRole('button',{name:'Week 7',exact:false}).click();
    await miriam.getByRole('dialog').getByRole('button',{name:/^8 ·/}).click();
    await miriam.getByRole('textbox',{name:'Reply',exact:true}).waitFor();
    assert.equal(await miriam.getByRole('textbox',{name:'Reply',exact:true}).inputValue(),'');
    await miriam.getByRole('button',{name:'Week 8',exact:false}).click();
    await miriam.getByRole('dialog').getByRole('button',{name:/^7 ·/}).click();
    await miriam.getByRole('textbox',{name:'Reply',exact:true}).waitFor();
    assert.equal(await miriam.getByRole('textbox',{name:'Reply',exact:true}).inputValue(),'My unfinished private draft');
    await miriam.getByText('Earlier study thought 13:',{exact:false}).waitFor();
    assert.equal(await miriam.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    console.log('Passed: shared Scripture reader, nested passage tools, exact conversation return and week-scoped drafts.');

    sendDelay=3500;
    await draft.fill('A reply with a visible pending state');
    await miriam.getByRole('button',{name:'Post reply',exact:true}).click();
    await miriam.getByText('Sending reply · awaiting server confirmation…',{exact:true}).waitFor();
    assert.equal(await miriam.getByRole('button',{name:'Post reply',exact:true}).isDisabled(),true);
    await draft.fill('Another thought while the first reply is pending');
    await miriam.getByRole('button',{name:'Week 7',exact:false}).click();
    await miriam.getByRole('dialog').getByRole('button',{name:/^8 ·/}).click();
    await miriam.getByRole('textbox',{name:'Reply',exact:true}).waitFor();
    await miriam.getByRole('button',{name:'Week 8',exact:false}).click();
    await miriam.getByRole('dialog').getByRole('button',{name:/^7 ·/}).click();
    await miriam.getByText('Reply sent · saved to the community.',{exact:true}).waitFor();
    assert.equal(await draft.inputValue(),'Another thought while the first reply is pending');
    assert.equal(posts.get(key).filter(item=>item.data.body==='A reply with a visible pending state').length,1);
    sendDelay=0;
    rejectSend=true;
    await draft.fill('Keep this when sending fails');
    await miriam.getByRole('button',{name:'Post reply',exact:true}).click();
    await miriam.getByText('Reply was not sent. Your draft is preserved.',{exact:true}).waitFor();
    assert.equal(await draft.inputValue(),'Keep this when sending fails');
    rejectSend=false;
    await miriam.evaluate(()=>{window.__testOffline=true;});
    await miriam.getByText('Reconnecting · new replies are not yet confirmed.',{exact:true}).waitFor();
    assert.equal(await miriam.getByRole('button',{name:'Post reply',exact:true}).isDisabled(),true);
    await miriam.evaluate(()=>{window.__testOffline=false;});
    await miriam.getByText('Connected · replies are saved to this community.',{exact:true}).waitFor();
    const countBefore=posts.get(key).length;
    await miriam.getByText('Share Scripture',{exact:true}).click();
    await miriam.getByLabel('Scripture reference (optional)',{exact:true}).fill('John 999:1');
    await miriam.getByRole('button',{name:'Post reply',exact:true}).click();
    await miriam.getByText('The exact range “John 999:1” is unavailable',{exact:false}).waitFor();
    assert.equal(posts.get(key).length,countBefore);
    await miriam.getByLabel('Scripture reference (optional)',{exact:true}).fill('John 1:1');
    await draft.fill('x'.repeat(1600));
    await miriam.getByRole('button',{name:'Post reply',exact:true}).click();
    await miriam.getByText('Use up to 1,600 characters, including the Scripture reference.',{exact:true}).waitFor();
    assert.equal(posts.get(key).length,countBefore);
    await miriam.getByRole('button',{name:'Sign out',exact:true}).click();
    assert.equal(await miriam.locator('#fellowship .message').count(),0);
    await miriam.evaluate(()=>{window.__testAuthChoice='daniel';});
    await miriam.getByRole('button',{name:'Sign in with Google',exact:true}).click();
    await miriam.getByRole('textbox',{name:'Reply',exact:true}).waitFor();
    assert.equal(await miriam.getByRole('textbox',{name:'Reply',exact:true}).inputValue(),'');
    const outsider=await open('outsider');
    await outsider.getByText('This account does not have access to Wednesday HomeGroup.',{exact:false}).waitFor();
    assert.equal(await outsider.locator('#fellowship .message').count(),0);
    assert.equal(await outsider.getByRole('textbox',{name:'Reply',exact:true}).isVisible(),false);
    enrolled.delete('daniel');
    // Either the protected-thread or message listener may report revocation first.
    await daniel.getByText(/This account does not have access to Wednesday HomeGroup\.|Your community access was confirmed, but these messages are not permitted/).waitFor();
    assert.equal(await daniel.locator('#fellowship .message').count(),0);
    profileAccess='none';
    const limited=await open('ruth');
    await limited.getByText('Your community membership is confirmed. Member profiles are not available yet.',{exact:true}).waitFor();
    await limited.getByText('Let us read this together.',{exact:true}).waitFor();
    await send(limited,'Profile access did not block an authorized conversation.');
    assert.equal(await limited.locator('#fellowship .message').filter({hasText:'Let us read this together.'}).locator('strong').textContent(),'Member · profile unavailable');
    await limited.context().close();
    profileAccess='no-list';
    const namesDenied=await open('ezra');
    await namesDenied.getByText('Your community membership is confirmed. Member profiles are not available yet.',{exact:true}).waitFor();
    await namesDenied.getByText('Let us read this together.',{exact:true}).waitFor();
    await namesDenied.context().close();
    profileAccess='full';
    deniedMembershipReads.add('miriam');
    const membershipPrivate=await open('miriam');
    await membershipPrivate.getByText('Let us read this together.',{exact:true}).waitFor();
    await membershipPrivate.context().close();
    assert.deepEqual(membershipReads,[]);
    deniedThreadReads.add('ezra');
    const readsBefore=conversationReads.filter(item=>item.uid==='ezra'&&item.path.endsWith('/messages')).length;
    const accessDenied=await open('ezra');
    await accessDenied.getByText('This account does not have access to Wednesday HomeGroup.',{exact:false}).waitFor();
    assert.equal(await accessDenied.locator('#fellowship .message').count(),0);
    assert.equal(conversationReads.filter(item=>item.uid==='ezra'&&item.path.endsWith('/messages')).length,readsBefore);
    await accessDenied.context().close();
    console.log('Passed: optional profiles, private membership records, and mandatory server-authorized thread access.');

    deniedThreadReads.clear();
    enrolled.add('daniel');
    const householdPages=[];
    for (const account of family) householdPages.push(await open(account,account==='miriam'));
    const [first,second,third,fourth]=householdPages;
    const choosePerson=async(page,name)=>{
      await page.locator('.fellowship-links').getByRole('button',{name:'Chat with…',exact:true}).click();
      const hub=page.locator('#fellowship details').filter({has:page.getByText('People & chats',{exact:true})});
      await hub.getByRole('button',{name,exact:true}).click();
      await page.getByRole('textbox',{name:'Reply',exact:true}).waitFor();
    };
    await choosePerson(first,'Daniel Brooks');
    await send(first,'Only Miriam and Daniel should see this.','John 1:1–5');
    await choosePerson(second,'Miriam Ellis');
    await second.getByText('Only Miriam and Daniel should see this.',{exact:true}).waitFor();
    await choosePerson(third,'Miriam Ellis');
    assert.equal(await third.getByText('Only Miriam and Daniel should see this.',{exact:true}).count(),0);
    const privateDraft=first.getByRole('textbox',{name:'Reply',exact:true});
    await privateDraft.fill('Keep my private draft');
    await first.locator('#fellowship .message').getByRole('button',{name:'John 1:1–5',exact:true}).click();
    await first.locator('[data-reference="John 1:1"]').waitFor();
    await first.getByRole('button',{name:'Close',exact:true}).click();
    await first.getByRole('dialog').waitFor({state:'hidden'});
    assert.equal(await privateDraft.inputValue(),'Keep my private draft');
    const chooseHousehold=async page=>{
      await page.locator('.fellowship-links').getByRole('button',{name:'Chat with…',exact:true}).click();
      await page.getByRole('button',{name:'Household conversation',exact:true}).click();
      await page.getByRole('textbox',{name:'Reply',exact:true}).waitFor();
    };
    for(const page of householdPages) await chooseHousehold(page);
    await send(first,'Welcome to the household room.');
    for(const page of [second,third,fourth]) await page.getByText('Welcome to the household room.',{exact:true}).waitFor();
    deniedWeeklyReads.add('ruth');
    const weeklyReadsBefore=conversationReads.filter(item=>item.uid==='ruth'&&item.path.startsWith(prefix+'/')).length;
    const directHousehold=await open('ruth',false,7,'household');
    await directHousehold.getByText('Welcome to the household room.',{exact:true}).waitFor();
    assert.equal(conversationReads.filter(item=>item.uid==='ruth'&&item.path.startsWith(prefix+'/')).length,weeklyReadsBefore);
    await directHousehold.context().close();
    deniedWeeklyReads.clear();
    for(const page of householdPages) assert.equal(await page.getByText('Only Miriam and Daniel should see this.',{exact:true}).count(),0);
    await choosePerson(first,'Daniel Brooks');
    assert.equal(await first.getByRole('textbox',{name:'Reply',exact:true}).inputValue(),'Keep my private draft');
    await first.getByRole('button',{name:'Sign out',exact:true}).click();
    assert.equal(await first.locator('#fellowship .message').count(),0);
    await first.getByRole('button',{name:'Sign in with Google',exact:true}).click();
    await choosePerson(first,'Daniel Brooks');
    await first.getByText('Only Miriam and Daniel should see this.',{exact:true}).waitFor();
    assert.equal(await first.getByRole('textbox',{name:'Reply',exact:true}).inputValue(),'');
    console.log('Passed: six saved private pairings, four-person household room, separate histories, Scripture return, drafts and sign-in recovery.');
    assert.deepEqual(pageErrors,[]);
    console.log('Passed: pending/error/offline UI, retained drafts, account switching, access-denial and revocation rendering.');
    console.log('Contract harness only: live Google, actual Firestore rules, and physical Safari remain unverified.');
  } finally {
    for(const context of contexts)await context.close().catch(()=>{});
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
