/* Persistent music and effects preferences, independent of story saves. */
(() => {
'use strict';
const KEY='shilo-sound-v1',music=document.getElementById('music'),activeMasters=new Set();
const defaults={enabled:true,musicEnabled:true,effectsEnabled:true,musicVolume:.35,effectsVolume:.65};
let prefs={...defaults},unlocked=false,context=null,duckUntil=0,duckTimer;
try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&typeof saved==='object'){for(const k of ['enabled','musicEnabled','effectsEnabled'])if(typeof saved[k]==='boolean')prefs[k]=saved[k];for(const k of ['musicVolume','effectsVolume'])if(Number.isFinite(saved[k]))prefs[k]=Math.max(0,Math.min(1,saved[k]));}}catch{}
music.loop=true;
function persist(){try{localStorage.setItem(KEY,JSON.stringify(prefs));}catch{}}
function apply(){for(const gain of activeMasters)gain.gain.setValueAtTime(prefs.enabled&&prefs.effectsEnabled?prefs.effectsVolume:0,context.currentTime);music.volume=prefs.musicVolume*(performance.now()<duckUntil ? .22 : 1);music.muted=!prefs.enabled||!prefs.musicEnabled;if(unlocked&&prefs.enabled&&prefs.musicEnabled&&prefs.musicVolume>0){const p=music.play();if(p?.catch)p.catch(()=>{});}else music.pause();const footer=document.getElementById('sound');if(footer){footer.textContent='ЗВУК: '+(prefs.enabled?'ВКЛ':'ВЫКЛ');footer.setAttribute('aria-pressed',String(prefs.enabled));}}
function unlock(){unlocked=true;try{context ||= new (window.AudioContext||window.webkitAudioContext)();context.resume().catch(()=>{});}catch{}apply();}
// Browsers require a gesture before the first playback. Later transitions never restart the track.
document.addEventListener('pointerdown',()=>{if(!unlocked||(music.paused&&prefs.enabled&&prefs.musicEnabled&&prefs.musicVolume>0))unlock();},{capture:true});
document.addEventListener('keydown',e=>{if(!unlocked&&!e.ctrlKey&&!e.metaKey&&!e.altKey)unlock();},{capture:true});
function set(key,value){prefs[key]=value;persist();apply();}
// A short, unmistakable telephone-style two-tone signal sits above the soundtrack.
function effect(type='notice'){
 if(!prefs.enabled||!prefs.effectsEnabled||prefs.effectsVolume<=0||!unlocked)return;
 try{
  context ||= new (window.AudioContext||window.webkitAudioContext)();context.resume().catch(()=>{});
  const now=context.currentTime,notice=type==='notice',master=context.createGain();
  master.gain.setValueAtTime(prefs.effectsVolume,now);master.connect(context.destination);activeMasters.add(master);
  const notes=notice?[[0,880,.16],[.2,1174.66,.25]]:[[0,240,.055]];
  for(const [offset,hz,duration]of notes){
   const oscillator=context.createOscillator(),gain=context.createGain(),t=now+offset;
   oscillator.type=notice?'triangle':'sine';oscillator.frequency.setValueAtTime(hz,t);
   gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(notice ? .42 : .035,t+.008);
   gain.gain.setValueAtTime(notice ? .32 : .025,t+duration*.55);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
   oscillator.connect(gain);gain.connect(master);oscillator.start(t);oscillator.stop(t+duration+.015);
   oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
  }
  setTimeout(()=>{master.disconnect();activeMasters.delete(master);},notice?800:200);
  if(notice){duckUntil=performance.now()+900;clearTimeout(duckTimer);apply();duckTimer=setTimeout(()=>{duckUntil=0;apply();},920);}
 }catch{}
}

function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function settings(container){container.replaceChildren();const body=el('section','sound-settings');
 function toggle(label,key){const row=el('div','sound-row'),name=el('span','',label),b=el('button','sound-toggle');b.type='button';b.dataset.soundControl='toggle';b.setAttribute('aria-label',label);function paint(){b.textContent=prefs[key]?'ВКЛ':'ВЫКЛ';b.setAttribute('aria-pressed',String(prefs[key]));}b.onclick=()=>{unlocked=true;set(key,!prefs[key]);paint();};paint();row.append(name,b);body.append(row);}
 function volume(label,key){const row=el('label','volume-row'),head=el('span','volume-label'),output=el('output','',Math.round(prefs[key]*100)+'%'),input=el('input');head.append(el('span','',label),output);input.type='range';input.min='0';input.max='100';input.step='1';input.value=String(Math.round(prefs[key]*100));input.setAttribute('aria-label',label);input.oninput=()=>{unlocked=true;set(key,Number(input.value)/100);output.value=input.value+'%';output.textContent=input.value+'%';};row.append(head,input);body.append(row);}
 toggle('Весь звук','enabled');toggle('Музыка','musicEnabled');volume('Громкость музыки','musicVolume');toggle('Уведомления и эффекты','effectsEnabled');volume('Громкость эффектов','effectsVolume');const preview=el('button','dialog-action','Прослушать уведомление');preview.type='button';preview.onclick=()=>{unlock();effect('notice');};body.append(preview);container.append(body);
}
window.SHILO_SOUND={settings,effect,toggle(){unlocked=true;set('enabled',!prefs.enabled);},start:unlock};
apply();
})();
