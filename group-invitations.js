// Group invitations extend the existing membership contract. A saved link or
// directory entry never grants access; Firestore validates the whole join.
export const familyGroup = Object.freeze({groupId:'household-pilot',threadId:'household',title:'Family'});
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(value);
const validToken=value=>/^[a-f0-9]{64}$/.test(value||'');
const failure=code=>Object.assign(new Error(code),{code});
export function groupInviteToken(address=location.href){
  const hash=new URLSearchParams(new URL(address).hash.slice(1));
  const token=hash.get('group-invite')||hash.get('family-invite');
  const groupId=hash.get('group')||(hash.has('family-invite')?familyGroup.groupId:'');
  return validToken(token)&&validId(groupId)?{token,groupId}:null;
}
export const groupSelection=group=>group.groupId===familyGroup.groupId&&group.threadId===familyGroup.threadId
  ?{kind:'household',title:'Family'}:{kind:'group',...group};
const visibleTitle=(groupId,title)=>groupId===familyGroup.groupId?'Family':groupId==='pilot-group'?'Weekly study':title;
const roomTitle=data=>typeof data?.title==='string'&&data.title.trim()&&data.title.length<=80?data.title:'Group conversation';
function refs(sdk,db,groupId,token,uid){
  if(!validId(groupId)||!uid||uid.includes('/'))throw failure('invite/identity');
  const group=sdk.doc(db,'groups',groupId);
  return {group,member:sdk.doc(group,'members',uid),profile:sdk.doc(group,groupId===familyGroup.groupId?'profiles':'memberNames',uid),
    invite:sdk.doc(group,'groupInvites',token||'unused'),recipient:sdk.doc(group,'groupInviteRecipients',token||'unused'),
    index:sdk.doc(db,'fellowshipMembers',uid,'groups',groupId)};
}
export async function createGroupInvite(sdk,db,user,recipientEmail,group=familyGroup,address=location.href){
  const email=String(recipientEmail||'').trim().toLowerCase();
  if(!user?.uid||!validId(group.groupId)||!validId(group.threadId)||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw failure('invite/recipient');
  const token=[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');
  const ref=refs(sdk,db,group.groupId,token,user.uid);
  const room=await sdk.getDocFromServer(sdk.doc(ref.group,'studyThreads',group.threadId));
  if(!room.exists()||room.data().open!==true)throw failure('invite/room-closed');
  const batch=sdk.writeBatch(db);
  batch.set(ref.invite,{creatorId:user.uid,threadId:group.threadId,title:roomTitle(room.data()),createdAt:sdk.serverTimestamp(),expiresAt:sdk.Timestamp.fromMillis(Date.now()+7*86400000-60000),status:'open'});
  batch.set(ref.recipient,{creatorId:user.uid,email,createdAt:sdk.serverTimestamp()});
  await batch.commit(); // Do not expose a pending/offline-only link as an invitation.
  const base=new URL(address);
  const url=new URL(base.pathname,base.origin);
  if(['localhost','127.0.0.1'].includes(url.hostname))url.searchParams.set('pilot','firebase');
  url.hash=new URLSearchParams({'group-invite':token,group:group.groupId}).toString();
  return {token,groupId:group.groupId,url:url.href};
}
export async function acceptGroupInvite(sdk,db,user,invitation,displayName){
  const name=String(displayName||'').trim();
  if(!user?.uid||!user.emailVerified||!validToken(invitation.token)||!name||name.length>80)throw failure('invite/identity');
  const ref=refs(sdk,db,invitation.groupId,invitation.token,user.uid);
  return sdk.runTransaction(db,async transaction=>{
    const member=await transaction.get(ref.member),invite=await transaction.get(ref.invite);
    if(!invite.exists())throw failure('invite/unavailable');
    const data=invite.data();
    if(!validId(data.threadId))throw failure('invite/unavailable');
    const group={groupId:invitation.groupId,threadId:data.threadId,title:visibleTitle(invitation.groupId,data.title)};
    if(member.exists()){
      transaction.set(ref.index,{threadId:data.threadId,title:data.title,savedAt:sdk.serverTimestamp()});
      return {status:'already-member',group};
    }
    if(data.status!=='open'||data.expiresAt.toMillis()<=Date.now())throw failure('invite/unavailable');
    const existingProfile=await transaction.get(ref.profile);
    if(existingProfile.exists()&&Object.keys(existingProfile.data()).some(key=>key!=='displayName'))throw failure('invite/profile-conflict');
    transaction.update(ref.invite,{status:'accepted',acceptedBy:user.uid,acceptedAt:sdk.serverTimestamp()});
    transaction.set(ref.member,{role:'member',inviteId:invitation.token,joinedAt:sdk.serverTimestamp()});
    transaction.set(ref.profile,{displayName:name});
    // A private navigation index enables another device to find this group.
    // Its server rule independently requires actual membership after the join.
    transaction.set(ref.index,{threadId:data.threadId,title:data.title,savedAt:sdk.serverTimestamp()});
    return {status:'joined',group};
  });
}
export async function declineGroupInvite(sdk,db,user,invitation){
  if(!user?.emailVerified||!validToken(invitation.token))throw failure('invite/identity');
  await sdk.updateDoc(refs(sdk,db,invitation.groupId,invitation.token,user.uid).invite,{status:'declined',declinedBy:user.uid,declinedAt:sdk.serverTimestamp()});
}
export function mountGroupInvitations(target,{node,text,button,firestore:sdk,db,user,groups=[familyGroup],onJoined,onGroups,onShowList,onResolved}){
  let active=true,busy=false,wantsOpen=false,available=[],readable=[],accessUncertain=false;
  const inbound=groupInviteToken();
  target.tabIndex=-1;target.setAttribute('aria-label','Group invitations');
  const content=node('div'),status=text(inbound?'Checking your group invitation…':'','form-caption');status.setAttribute('role','status');target.append(content,status);
  function message(error){return error.code==='invite/identity'?'Sign in with a verified account and enter your name.'
    :error.code==='invite/profile-conflict'?'Your group profile needs attention. Ask the inviter for help; your information has not been changed.'
    :error.code==='invite/recipient'?'Enter the exact email address your recipient uses to sign in.'
    :error.code==='invite/room-closed'?'This conversation is not open for invitations.'
    :error.code==='permission-denied'||error.code==='invite/unavailable'?'This invitation is unavailable for this account. Check your sign-in account or ask for a new invitation.'
    :'Could not confirm that request. Check your connection and try again.';}
  async function act(task,done){
    if(busy||!active)return;busy=true;
    for(const control of content.querySelectorAll('button,input,select'))control.disabled=true;
    try{const result=await task();if(active)done(result);}catch(error){if(active)status.textContent=message(error);}
    finally{busy=false;if(active)for(const control of content.querySelectorAll('button,input,select'))control.disabled=false;}
  }
  function clearToken(){const url=new URL(location.href);const hash=new URLSearchParams(url.hash.slice(1));for(const key of ['group-invite','family-invite','group'])hash.delete(key);url.hash=hash.toString();history.replaceState(history.state,'',url);onResolved?.();}
  function unavailable(error){content.replaceChildren(button('Back to conversations',()=>{clearToken();memberView();}));status.textContent=message(error);}
  function rememberGroup(group){if(!readable.some(g=>g.groupId===group.groupId))readable.push(group);if(!available.some(g=>g.groupId===group.groupId))available.push(group);onGroups?.(readable);}
  function memberView(){
    content.replaceChildren();
    if(!available.length){status.textContent=accessUncertain?'Your groups could not be confirmed. Check your connection and reopen Conversations.':'Ask someone in your group for an invitation.';return;}
    status.textContent='';const details=node('details');details.open=wantsOpen;
    const summary=node('summary','Invite to '+available[0].title);details.append(summary);
    const form=node('form'),groupLabel=node('label','Group'),select=node('select');select.setAttribute('aria-label','Group');
    for(const [i,group]of available.entries())select.append(new Option(group.title,String(i)));groupLabel.append(select);
    groupLabel.hidden=available.length===1;
    const label=node('label','Recipient’s sign-in email'),email=node('input');email.type='email';email.required=true;email.maxLength=254;email.autocomplete='off';label.append(email);
    const submit=node('button','Create invitation','button');submit.type='submit';
    const result=node('div');
    form.append(groupLabel,label,text('Only that verified account can accept. The invitation lasts up to seven days.','form-caption'),submit,result);details.append(form);content.append(details);
    select.addEventListener('change',()=>{summary.textContent='Invite to '+available[Number(select.value)].title;result.replaceChildren();status.textContent='';});
    form.addEventListener('submit',event=>{
      event.preventDefault();if(busy)return;result.replaceChildren();status.textContent='Creating invitation · awaiting confirmation…';
      const group=available[Number(select.value)];
      void act(()=>createGroupInvite(sdk,db,user,email.value,group),created=>{
        email.value='';status.textContent='Invitation ready. Share it privately with the person you invited.';
        const field=node('input');field.readOnly=true;field.value=created.url;field.setAttribute('aria-label','Group invitation link');
        const copy=button('Copy invitation',async()=>{try{await navigator.clipboard.writeText(created.url);if(active)status.textContent='Invitation copied.';}catch{if(active){field.focus();field.select();status.textContent='Select and copy the invitation link.';}}});
        const share=button('Share invitation',async()=>{try{await navigator.share({title:'Join '+group.title,text:'You’re invited to '+group.title+' in HomeGroups.',url:created.url});}catch(error){if(active&&error.name!=='AbortError')status.textContent='Sharing was unavailable. Copy the invitation link instead.';}});share.hidden=typeof navigator.share!=='function';
        const revoke=button('Revoke invitation',()=>{status.textContent='Revoking invitation…';void act(()=>sdk.updateDoc(refs(sdk,db,created.groupId,created.token,user.uid).invite,{status:'revoked'}),()=>{result.replaceChildren();status.textContent='Invitation revoked.';});},'quiet');
        result.replaceChildren(field,share,copy,revoke);
      });
    });
  }
  function joinView(data){
    const title=visibleTitle(inbound.groupId,data.title);content.replaceChildren(node('h3','Join '+title));status.textContent='';
    const form=node('form'),label=node('label','Your name in the group'),name=node('input');name.required=true;name.maxLength=80;name.autocomplete='name';name.value=user.displayName||'';label.append(name);
    const join=node('button','Join '+title,'button primary');join.type='submit';
    const decline=button('Decline invitation',()=>{status.textContent='Declining invitation…';void act(()=>declineGroupInvite(sdk,db,user,inbound),()=>{clearToken();memberView();status.textContent='Invitation declined.';});},'quiet');
    form.append(label,text('Joining gives you access to this group’s shared conversation and its history.','form-caption'),join,decline);content.append(form);
    form.addEventListener('submit',event=>{event.preventDefault();status.textContent='Joining group · awaiting confirmation…';void act(()=>acceptGroupInvite(sdk,db,user,inbound,name.value),result=>{clearToken();rememberGroup(result.group);memberView();onJoined(groupSelection(result.group));});});
  }
  async function prepare(){
    const candidates=[...groups];
    try{
      const list=await sdk.getDocsFromServer(sdk.query(sdk.collection(sdk.doc(db,'fellowshipMembers',user.uid),'groups'),sdk.limit(50)));
      for(const item of list.docs){const data=item.data();if(validId(item.id)&&validId(data.threadId)&&!candidates.some(g=>g.groupId===item.id))candidates.push({groupId:item.id,threadId:data.threadId,title:visibleTitle(item.id,data.title)});}
    }catch(error){if(error.code!=='permission-denied')accessUncertain=true;/* Known rooms retain independent access checks. */}
    const checked=await Promise.all(candidates.map(async group=>{try{const ref=refs(sdk,db,group.groupId,null,user.uid);const room=await sdk.getDocFromServer(sdk.doc(ref.group,'studyThreads',group.threadId));return room.exists()?{group,open:room.data().open===true}:null;}catch(error){if(error.code!=='permission-denied')accessUncertain=true;return null;}}));
    if(!active)return;readable=checked.filter(Boolean).map(item=>item.group);available=checked.filter(item=>item?.open).map(item=>item.group);onGroups?.(readable);
    if(!inbound){memberView();return;}
    onShowList?.();
    if(!user.emailVerified){unavailable(failure('invite/identity'));return;}
    try{
      const ref=refs(sdk,db,inbound.groupId,inbound.token,user.uid),invite=await sdk.getDocFromServer(ref.invite);
      if(!active)return;const data=invite.exists()&&invite.data();
      if(!data||!validId(data.threadId))throw failure('invite/unavailable');
      const member=await sdk.getDocFromServer(ref.member);if(!active)return;
      if(member.exists()){
        const group={groupId:inbound.groupId,threadId:data.threadId,title:visibleTitle(inbound.groupId,data.title)};
        content.replaceChildren(text('You already belong to '+group.title+'.'),button('Open '+group.title,()=>{void act(()=>acceptGroupInvite(sdk,db,user,inbound,user.displayName?.slice(0,80)||'Member'),()=>{clearToken();rememberGroup(group);memberView();onJoined(groupSelection(group));});}));status.textContent='';return;
      }
      if(data.status!=='open'||data.expiresAt.toMillis()<=Date.now())throw failure('invite/unavailable');
      joinView(data);
    }catch(error){if(active)unavailable(error);}
  }
  void prepare();
  return {show(){wantsOpen=true;onShowList?.();const details=content.querySelector('details');if(details){details.open=true;details.querySelector('summary').focus({preventScroll:true});}else target.focus({preventScroll:true});},close(){active=false;target.replaceChildren();}};
}
