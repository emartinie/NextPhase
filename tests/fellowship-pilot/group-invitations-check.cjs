// Real Firestore rules assertions against a loopback demo emulator only.
const assert=require('node:assert/strict');
const path=require('node:path');
const {startEmulator,testToken}=require('./emulator.cjs');
let group='groups/household-pilot', room=group+'/studyThreads/household';
const documentRoot='projects/demo-homegroups-fellowship-pilot/databases/(default)/documents/';
const value=data=>Object.fromEntries(Object.entries(data).map(([key,item])=>[key,
  typeof item==='boolean'?{booleanValue:item}:typeof item==='string'?{stringValue:item}:{timestampValue:item.date}]));
const stamp={fieldPath:'createdAt',setToServerValue:'REQUEST_TIME'};
const identity=(uid,email,verified=true)=>testToken(uid,{email,email_verified:verified});
const invitation=id=>group+'/groupInvites/'+id;
const recipient=id=>group+'/groupInviteRecipients/'+id;
const makeWrites=(id,creator,email,expires=Date.now()+86400000)=>[
  {update:{name:documentRoot+invitation(id),fields:value({creatorId:creator,threadId:room.split('/').at(-1),title:'Group conversation',status:'open',expiresAt:{date:new Date(expires).toISOString()}})},currentDocument:{exists:false},updateTransforms:[stamp]},
  {update:{name:documentRoot+recipient(id),fields:value({creatorId:creator,email})},currentDocument:{exists:false},updateTransforms:[stamp]},
];
const joinWrites=(id,uid,role='member')=>[
  {update:{name:documentRoot+invitation(id),fields:value({status:'accepted',acceptedBy:uid})},updateMask:{fieldPaths:['status','acceptedBy']},currentDocument:{exists:true},updateTransforms:[{fieldPath:'acceptedAt',setToServerValue:'REQUEST_TIME'}]},
  {update:{name:documentRoot+group+'/members/'+uid,fields:value({role,inviteId:id})},currentDocument:{exists:false},updateTransforms:[{fieldPath:'joinedAt',setToServerValue:'REQUEST_TIME'}]},
  {update:{name:documentRoot+group+(group==='groups/household-pilot'?'/profiles/':'/memberNames/')+uid,fields:value({displayName:uid})}},
  {update:{name:documentRoot+'fellowshipMembers/'+uid+'/groups/'+group.split('/')[1],fields:value({threadId:room.split('/').at(-1),title:'Group conversation'})},updateTransforms:[{fieldPath:'savedAt',setToServerValue:'REQUEST_TIME'}]},
];
async function main(){
  const emulator=await startEmulator({rulesFile:path.join(__dirname,'group-invitations.rules')});
  const {seed,request,commit,read,send}=emulator.db;
  const allowed=result=>assert.equal(result.status,200,JSON.stringify(result.data));
  const denied=result=>assert.equal(result.status,403,JSON.stringify(result.data));
  const a=identity('family-host-a','host-a@example.test'),b=identity('family-host-b','host-b@example.test');
  const guest=identity('family-guest','relative@example.test');
  const wrong=identity('family-stranger','other@example.test');
  const id='a'.repeat(64), id2='b'.repeat(64), revoked='c'.repeat(64), removed='d'.repeat(64), race='e'.repeat(64);
  try{
    await seed(room,value({open:true}));
    for(const uid of ['family-host-a','family-host-b'])await seed(group+'/members/'+uid,value({role:'member'}));
    denied(await commit(wrong,makeWrites(id,'family-stranger','relative@example.test')));
    denied(await commit(undefined,makeWrites(id,'family-host-a','relative@example.test')));
    denied(await commit(a,[makeWrites(id,'family-host-a','relative@example.test')[0]]));
    denied(await commit(a,[makeWrites(id,'family-host-a','relative@example.test')[1]]));
    denied(await commit(a,makeWrites(id,'family-host-b','relative@example.test')));
    denied(await commit(a,makeWrites(id,'family-host-a','Relative@Example.test')));
    denied(await commit(a,makeWrites(id,'family-host-a','relative@example.test',Date.now()+9*86400000)));
    allowed(await commit(a,makeWrites(id,'family-host-a','relative@example.test')));
    allowed(await commit(b,makeWrites(id2,'family-host-b','next-relative@example.test'))); // Any current member can invite.
    allowed(await request('/'+invitation(id),a));
    denied(await request('/'+invitation(id),b));
    allowed(await request('/'+invitation(id),guest));
    denied(await request('/'+invitation(id),wrong));
    denied(await request('/'+recipient(id),a)); // Sender cannot list/read recipient PII after creation.
    denied(await request('/'+recipient(id),b));
    allowed(await request('/'+recipient(id),guest));
    denied(await request('/'+recipient(id),wrong));
    denied(await request('/'+group+':runQuery',guest,'POST',{structuredQuery:{from:[{collectionId:'groupInviteRecipients'}],limit:20}}));
    assert.equal((await request('/'+group+'/members/family-guest',guest)).status,404,'Recipient can check only their own absent membership');
    assert.equal((await request('/'+group+'/profiles/family-guest',guest)).status,404,'Recipient transaction can check its own absent profile');
    denied(await read(room,guest));
    const directMembership=joinWrites(id,'family-guest')[1];
    denied(await commit(guest,[directMembership]));
    denied(await commit(guest,[joinWrites(id,'family-guest')[0]]));
    denied(await commit(guest,joinWrites(id,'family-guest','leader')));
    denied(await commit(wrong,joinWrites(id,'family-stranger')));
    denied(await commit(identity('unverified','relative@example.test',false),joinWrites(id,'unverified')));
    denied(await commit(guest,joinWrites(id,'some-other-account')));
    allowed(await commit(guest,joinWrites(id,'family-guest')));
    allowed(await read(room,guest));
    allowed(await send(room,'family-first-real-message',guest,'family-guest','Hello Family [Scripture: Ezekiel 37:1]'));
    allowed(await read(room,a));
    allowed(await read(room,b));
    await seed('groups/pilot-group/studyThreads/family-boundary',value({open:true}));
    denied(await read('groups/pilot-group/studyThreads/family-boundary',guest));
    denied(await request('/groups/pilot-group/members/family-guest',guest,'PATCH',{fields:value({role:'member',inviteId:id})}));
    const profile=await request('/'+group+'/profiles/family-guest',a);allowed(profile);
    assert.deepEqual(Object.keys(profile.data.fields),['displayName']);
    denied(await commit(guest,joinWrites(id,'family-guest')));
    denied(await send(room,'family-spoof',guest,'family-host-a','Wrong author'));
    denied(await request('/'+group+'/members/family-guest',guest,'PATCH',{fields:value({role:'leader'})}));
    denied(await request('/'+group+'/members/family-guest',guest,'DELETE'));
    denied(await request('/'+recipient(id),guest,'PATCH',{fields:value({creatorId:'family-host-a',email:'other@example.test'})}));
    const pair=group+'/privateChats/family-existing-pair';
    await seed(pair,{participantIds:{arrayValue:{values:[{stringValue:'family-host-a'},{stringValue:'family-host-b'}]}}});
    denied(await read(pair,guest));
    denied(await request('/'+pair,guest));
    allowed(await commit(a,makeWrites(revoked,'family-host-a','revoked@example.test')));
    allowed(await request('/'+invitation(revoked)+'?updateMask.fieldPaths=status',a,'PATCH',{fields:value({status:'revoked'})}));
    denied(await commit(identity('revoked-user','revoked@example.test'),joinWrites(revoked,'revoked-user')));
    allowed(await commit(b,makeWrites(removed,'family-host-b','removed@example.test')));
    allowed(await request('/'+group+'/members/family-host-b','owner','DELETE'));
    denied(await commit(identity('removed-user','removed@example.test'),joinWrites(removed,'removed-user')));
    const expired='1'.repeat(64);
    await seed(invitation(expired),value({creatorId:'family-host-a',threadId:'household',title:'Group conversation',status:'open',createdAt:{date:new Date(Date.now()-2*86400000).toISOString()},expiresAt:{date:new Date(Date.now()-86400000).toISOString()}}));
    await seed(recipient(expired),value({creatorId:'family-host-a',email:'expired@example.test',createdAt:{date:new Date(Date.now()-2*86400000).toISOString()}}));
    denied(await commit(identity('expired-user','expired@example.test'),joinWrites(expired,'expired-user')));
    allowed(await commit(a,makeWrites(race,'family-host-a','race@example.test')));
    const attempts=await Promise.all(['race-one','race-two'].map(uid=>commit(identity(uid,'race@example.test'),joinWrites(race,uid))));
    assert.equal(attempts.filter(result=>result.status===200).length,1,'One invitation must grant only one membership');
    assert.ok(attempts.filter(result=>result.status!==200).every(result=>[403,409].includes(result.status)));
    await seed(room,value({open:false}));
    denied(await commit(a,makeWrites('f'.repeat(64),'family-host-a','closed@example.test')));

    // Reuse the same contract for a distinct existing community, not a second
    // Family audience or a global invitation capability.
    group='groups/neighbors';room=group+'/studyThreads/shared';
    const host=identity('neighbors-host','neighbors-host@example.test'),neighbor=identity('new-neighbor','neighbor@example.test');
    await seed(room,value({open:true}));await seed(group+'/members/neighbors-host',value({role:'member'}));
    const other='7'.repeat(64),declined='8'.repeat(64);
    denied(await commit(a,makeWrites(other,'family-host-a','neighbor@example.test')));
    allowed(await commit(host,makeWrites(other,'neighbors-host','neighbor@example.test')));
    denied(await commit(guest,joinWrites(other,'family-guest')));
    const beforeIndex='fellowshipMembers/new-neighbor/groups/neighbors';
    denied(await request('/'+beforeIndex,neighbor,'PATCH',{fields:value({threadId:'shared',title:'Group conversation',savedAt:{date:new Date().toISOString()}})}));
    allowed(await commit(neighbor,joinWrites(other,'new-neighbor')));
    allowed(await read(room,neighbor));
    await seed(group+'/profiles/neighbors-host',value({displayName:'Host',email:'legacy-private@example.test'}));
    denied(await request('/'+group+'/profiles/neighbors-host',neighbor));
    denied(await request('/'+group+':runQuery',neighbor,'POST',{structuredQuery:{from:[{collectionId:'profiles'}],limit:50}}));
    allowed(await request('/'+group+'/memberNames/new-neighbor',host));
    allowed(await send(room,'new-group-message',neighbor,'new-neighbor','Hello neighbors [Scripture: John 1:1]'));
    allowed(await read(room,host));
    allowed(await request('/'+beforeIndex,neighbor));
    denied(await request('/'+beforeIndex,host));
    denied(await request('/fellowshipMembers/new-neighbor:runQuery',host,'POST',{structuredQuery:{from:[{collectionId:'groups'}],limit:50}}));
    allowed(await request('/fellowshipMembers/new-neighbor:runQuery',neighbor,'POST',{structuredQuery:{from:[{collectionId:'groups'}],limit:50}}));
    denied(await request('/fellowshipMembers/new-neighbor:runQuery',neighbor,'POST',{structuredQuery:{from:[{collectionId:'groups'}]}}));
    denied(await read('groups/household-pilot/studyThreads/household',neighbor));
    allowed(await commit(host,makeWrites(declined,'neighbors-host','decline@example.test')));
    const declining=identity('declining','decline@example.test');
    allowed(await commit(declining,[{update:{name:documentRoot+invitation(declined),fields:value({status:'declined',declinedBy:'declining'})},updateMask:{fieldPaths:['status','declinedBy']},updateTransforms:[{fieldPath:'declinedAt',setToServerValue:'REQUEST_TIME'}]}]));
    denied(await commit(declining,joinWrites(declined,'declining')));
    denied(await read(room,declining));
    denied(await request('/'+group+'/memberNames/new-neighbor',neighbor,'PATCH',{fields:value({displayName:'Neighbor',email:'private@example.test'})}));
    await request('/'+group+'/members/new-neighbor','owner','DELETE');
    denied(await read(room,neighbor));
    denied(await send(room,'revoked-group-message',neighbor,'new-neighbor','No longer a member'));
    console.log('Passed group invitation rules: Family and second-group enrollment, private cross-device directory, decline and revocation; any member may invite a named verified recipient; atomic single-use enrollment/profile, private recipient data, no self-enrollment/escalation, wrong-account/unverified/revoked/removed-inviter denial, concurrency, real shared messages, author checks and existing private-chat isolation.');
  }finally{emulator.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
