/* Persistent music and effects preferences, independent of story saves. */
(() => {
'use strict';
const KEY='shilo-sound-v1',music=document.getElementById('music');
const defaults={enabled:true,musicEnabled:true,effectsEnabled:true,musicVolume:.35,effectsVolume:.65};
let prefs={...defaults},unlocked=false,context=null;
try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&typeof saved==='object'){for(const k of ['enabled','musicEnabled','effectsEnabled'])if(typeof saved[k]==='boolean')prefs[k]=saved[k];for(const k of ['musicVolume','effectsVolume'])if(Number.isFinite(saved[k]))prefs[k]=Math.max(0,Math.min(1,saved[k]));}}catch{}
music.loop=true;
function persist(){try{localStorage.setItem(KEY,JSON.stringify(prefs));}catch{}}
function apply(){music.volume=prefs.musicVolume;music.muted=!prefs.enabled||!prefs.musicEnabled;if(unlocked&&prefs.enabled&&prefs.musicEnabled&&prefs.musicVolume>0){const p=music.play();if(p?.catch)p.catch(()=>{});}else music.pause();const footer=document.getElementById('sound');if(footer){footer.textContent='ЗВУК: '+(prefs.enabled?'ВКЛ':'ВЫКЛ');footer.setAttribute('aria-pressed',String(prefs.enabled));}}
function unlock(){unlocked=true;apply();}
// Browsers require a gesture before the first playback. Later transitions never restart the track.
document.addEventListener('pointerdown',()=>{if(!unlocked||(music.paused&&prefs.enabled&&prefs.musicEnabled&&prefs.musicVolume>0))unlock();},{capture:true});
document.addEventListener('keydown',e=>{if(!unlocked&&!e.ctrlKey&&!e.metaKey&&!e.altKey)unlock();},{capture:true});
function set(key,value){prefs[key]=value;persist();apply();}
function effect(type='notice'){if(!prefs.enabled||!prefs.effectsEnabled||prefs.effectsVolume<=0||!unlocked)return;try{context ||= new (window.AudioContext||window.webkitAudioContext)();context.resume();const oscillator=context.createOscillator(),gain=context.createGain(),now=context.currentTime;oscillator.type='sine';oscillator.frequency.setValueAtTime(type==='notice'?390:190,now);oscillator.frequency.exponentialRampToValueAtTime(type==='notice'?210:130,now+.07);gain.gain.setValueAtTime((type==='notice' ? 0.07 : 0.025)*prefs.effectsVolume,now);gain.gain.exponentialRampToValueAtTime(.001,now+.1);oscillator.connect(gain);gain.connect(context.destination);oscillator.start();oscillator.stop(now+.11);}catch{}}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function settings(container){container.replaceChildren();const body=el('section','sound-settings');
 function toggle(label,key){const row=el('div','sound-row'),name=el('span','',label),b=el('button','sound-toggle');b.type='button';b.dataset.soundControl='toggle';b.setAttribute('aria-label',label);function paint(){b.textContent=prefs[key]?'ВКЛ':'ВЫКЛ';b.setAttribute('aria-pressed',String(prefs[key]));}b.onclick=()=>{unlocked=true;set(key,!prefs[key]);paint();};paint();row.append(name,b);body.append(row);}
 function volume(label,key){const row=el('label','volume-row'),head=el('span','volume-label'),output=el('output','',Math.round(prefs[key]*100)+'%'),input=el('input');head.append(el('span','',label),output);input.type='range';input.min='0';input.max='100';input.step='1';input.value=String(Math.round(prefs[key]*100));input.setAttribute('aria-label',label);input.oninput=()=>{unlocked=true;set(key,Number(input.value)/100);output.value=input.value+'%';output.textContent=input.value+'%';};row.append(head,input);body.append(row);}
 toggle('Весь звук','enabled');toggle('Музыка','musicEnabled');volume('Громкость музыки','musicVolume');toggle('Уведомления и эффекты','effectsEnabled');volume('Громкость эффектов','effectsVolume');container.append(body);
}
window.SHILO_SOUND={settings,effect,toggle(){unlocked=true;set('enabled',!prefs.enabled);},start:unlock};
apply();
})();
