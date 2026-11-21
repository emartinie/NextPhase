// Deterministic playback races and queue behavior; no files, providers or live accounts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Audio extends EventTarget {
  constructor() { super(); this.attrs=new Map();this.paused=true;this.ended=false;this.currentTime=0;this.duration=120;this.playbackRate=1;this.loads=0;this.plays=[];this.manual=false; }
  getAttribute(key) {return this.attrs.get(key)??null;}
  hasAttribute(key) {return this.attrs.has(key);}
  removeAttribute(key) {this.attrs.delete(key);}
  set src(value) {this.attrs.set('src',value);this.currentTime=0;this.ended=false;}
  get src() {return this.getAttribute('src')||'';}
  load() {this.loads++;this.dispatchEvent(new Event('emptied'));}
  pause() {this.paused=true;this.dispatchEvent(new Event('pause'));}
  play() {
    this.paused=false;this.ended=false;this.dispatchEvent(new Event('play'));
    if(!this.manual)return Promise.resolve();
    return new Promise((resolve,reject)=>this.plays.push({resolve,reject,source:this.src}));
  }
  end() {this.paused=true;this.ended=true;this.dispatchEvent(new Event('ended'));}
}
const source=fs.readFileSync(path.join(__dirname,'../../audio-session.js'),'utf8').replace('export const audioSession =','globalThis.session =');
function fixture() {
  const audio=new Audio(), window=new EventTarget();
  const context={document:{getElementById(id){assert.equal(id,'audio');return audio;}},window,location:{href:'https://example.invalid/NextPhase/'},URL,Promise,Event,CustomEvent};
  vm.runInNewContext(source,context);
  return {audio,session:context.session};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const track=(title,english,hebrew)=>({title,sources:{english,hebrew}});

async function main() {
  const {audio,session}=fixture();
  assert.equal(session.getState().status,'idle');assert.equal(audio.src,'');
  session.playRecording('/first.mp3','First reading');await flush();
  assert.equal(session.getState().title,'First reading');assert.equal(session.getState().status,'playing');
  audio.currentTime=37;
  session.pause();session.playRecording('/first.mp3','First reading');await flush();
  assert.equal(audio.currentTime,37,'Reopening the same recording preserves position');
  const original=audio.src;
  assert.equal(session.playRecording('javascript:alert(1)','Bad'),false);
  assert.equal(session.playRecording('data:audio/wav;base64,','Bad'),false);
  assert.equal(audio.src,original,'Invalid source must not replace the active recording');
  session.setPlaylist([track('One','/one.mp3','/one-he.mp3'),track('Hebrew only',undefined,'/two-he.mp3'),track('Three','/three.mp3')],{language:'english',autoplay:true});await flush();
  assert.equal(session.getState().canNext,true);
  audio.end();await flush();assert.equal(session.getState().title,'Three · English','Auto-next skips absent languages');
  audio.end();await flush();assert.equal(session.getState().status,'ended','End of queue must stop, not loop');
  const last=audio.src;assert.equal(session.setLanguage('greek'),false);assert.equal(audio.src,last);
  session.next();await flush();assert.equal(session.getState().title,'One · English');
  session.cycleLanguage();await flush();assert.equal(session.getState().language,'hebrew');
  session.setAutoNext(false);audio.end();assert.equal(session.getState().status,'ended');
  session.cycleRate();assert.equal(audio.playbackRate,1.25);
  session.pause();session.setLanguage('english');assert.equal(audio.paused,true,'Changing language while paused must not start playback');
  let cancelled=0;
  const release=session.claimSpeech(()=>cancelled++);
  assert.equal(audio.paused,true);
  session.play();await flush();assert.equal(cancelled,1,'Starting a recording stops owned device speech');
  release();
  const releaseFinished=session.claimSpeech(()=>cancelled++);releaseFinished();
  session.play();await flush();assert.equal(cancelled,1,'A completed voice must not cancel later work');
  let observed;const unsubscribe=session.subscribe(state=>observed=state);
  audio.currentTime=60;audio.dispatchEvent(new Event('timeupdate'));assert.equal(observed.currentTime,60);assert.equal(observed.duration,120);
  unsubscribe();session.stop();assert.equal(audio.src,'');assert.equal(session.getState().status,'idle');assert.equal(session.getState().canNext,false);

  const race=fixture();race.audio.manual=true;
  race.session.playRecording('/old.mp3','Old');race.session.playRecording('/new.mp3','New');
  race.audio.plays[1].resolve();await flush();race.audio.plays[0].reject(Object.assign(new Error('late'),{name:'NotAllowedError'}));await flush();
  assert.equal(race.session.getState().status,'playing');assert.equal(race.session.getState().title,'New','Stale failures cannot overwrite a newer recording');
  race.session.pause();const pending=race.session.play();race.session.stop();race.audio.plays[2].resolve();await pending;
  assert.equal(race.session.getState().status,'idle','A late play completion cannot undo Stop');

  const denied=fixture();denied.audio.manual=true;denied.session.playRecording('/blocked.mp3','Blocked');
  denied.audio.plays[0].reject(Object.assign(new Error('gesture required'),{name:'NotAllowedError'}));await flush();
  assert.equal(denied.session.getState().status,'blocked');assert.match(denied.session.getState().message,/Tap Play/);
  const retry=denied.session.play();denied.audio.plays[1].resolve();await retry;assert.equal(denied.session.getState().status,'playing');
  denied.audio.dispatchEvent(new Event('error'));assert.equal(denied.session.getState().status,'error');assert.match(denied.session.getState().message,/unavailable/);
  console.log('Passed shared audio: idle/no autoplay, source validation, same-source position, language-aware queues, finite completion, pause/rate/progress, stale-play cancellation, blocked-play retry, errors and Stop. Synthetic media only.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
