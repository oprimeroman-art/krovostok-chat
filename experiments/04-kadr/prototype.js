/* SHILO: isolated art approval fragment. Original story and full engine remain untouched. */
(() => {
'use strict';
const $=id=>document.getElementById(id), DATA=window.SHILO_DEMO;
const KEY='shilo-art-prototype-v1';
const PEOPLE={
 serega:{name:'Серёга',where:'ЧЕТВЕРГ / КУХНЯ',caption:'ОБЫЧНОЕ УТРО'},
 valerik:{name:'Валерик',where:'ЧЕТВЕРГ / ГАРАЖИ',caption:'НЕНУЖНЫЕ ВОПРОСЫ'},
 shurik:{name:'Шурик',where:'ЧЕТВЕРГ / ФИЛИППИНЫ',caption:'С ДРУГОГО БЕРЕГА'},
 marat:{name:'Марат',where:'ЧЕТВЕРГ / НА ЛЕСТНИЦЕ',caption:'СЛИШКОМ МНОГО СОВПАДЕНИЙ'},
 dok:{name:'Док',where:'ЧЕТВЕРГ / ОРДИНАТОРСКАЯ',caption:'ЧУЖАЯ РАБОТА'}
};
let state=null,timer=null,inGame=false,sound=false,ctx=null,lastArt='';
try{const s=JSON.parse(localStorage.getItem(KEY));if(s?.version===1&&PEOPLE[s.active]&&s.flags&&s.contacts&&Object.keys(PEOPLE).every(k=>{const c=s.contacts[k];return c&&Number.isInteger(c.index)&&c.index>=0&&c.index<DATA[k].length&&['intro','choice','reply','end'].includes(c.phase)&&Array.isArray(c.queue)&&Array.isArray(c.log)&&c.queue.every(x=>typeof x.text==='string')&&c.log.every(x=>typeof x.text==='string')}))state=s;}catch{}
function fresh(){return {version:1,active:'serega',flags:{},contacts:Object.fromEntries(Object.keys(PEOPLE).map(k=>[k,{index:0,phase:'intro',queue:[],log:[],started:false}]))};}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{}}
function beep(){if(!sound)return;try{ctx ||= new (window.AudioContext||window.webkitAudioContext)();ctx.resume();const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(390,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(210,ctx.currentTime+.07);g.gain.setValueAtTime(.025,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.09);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.09);}catch{}}
function current(){return state.contacts[state.active];}
function scene(){return DATA[state.active][current().index];}
function cleanLine(x){return {...x,text:x.kind==='media'?'На столе — пакет. Рядом кружка и хлебница.':x.text};}
function begin(k){const c=state.contacts[k];if(c.started)return;c.started=true;const s=DATA[k][c.index];c.queue=[...s.core,...(s.variants||[]).filter(v=>Object.entries(v.when||{}).every(([f,val])=>state.flags[f]===val)).flatMap(v=>v.lines)].map(cleanLine);c.phase='intro';}
function endQueue(){const c=current();if(c.phase==='intro')c.phase=scene().choices.length?'choice':'end';else if(c.phase==='reply')c.phase='end';}
function addLine(){const c=current();if(!c.queue.length){endQueue();return;}const line=c.queue.shift();if(line.kind==='forward'){
 const target=Object.keys(PEOPLE).find(k=>PEOPLE[k].name===line.who);
 if(target&&target!==state.active){state.contacts[target].log.push({...line,kind:'out',text:'Переслано от '+line.from+': '+line.text});}
 else c.log.push(line);
}else c.log.push(line);if(!c.queue.length)endQueue();beep();}
function schedule(){clearTimeout(timer);if(!inGame||$('dialog').open||!current().queue.length)return;const next=current().queue[0];timer=setTimeout(()=>{addLine();save();render();schedule();},Math.min(3000,900+next.text.length*12));}
function skip(){if(!inGame||$('dialog').open)return;clearTimeout(timer);while(current().queue.length)addLine();save();render();}
function choose(i){const c=current(),s=scene();if(c.phase!=='choice'||!s.choices[i]||!inGame||$('dialog').open)return;const opt=s.choices[i];Object.assign(state.flags,opt.set);c.log.push({who:'Ты',kind:'out',text:opt.echo});c.queue=opt.lines.map(cleanLine);c.phase='reply';if(!c.queue.length)endQueue();save();render();schedule();}
function openContact(k){if(!PEOPLE[k])return;clearTimeout(timer);state.active=k;begin(k);save();render();schedule();}
function element(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function button(label,action,cls){const n=element('button',cls,label);n.type='button';n.onclick=action;return n;}
function render(){const k=state.active,c=current(),s=scene(),p=PEOPLE[k];
 if(lastArt!==k){const img=$('backdrop');img.src='art/'+k+'.webp';img.style.animation='none';void img.offsetWidth;img.style.animation='';lastArt=k;}
 $('location').textContent=p.where;$('artPlace').textContent=p.caption;$('artName').textContent=p.name.toUpperCase();$('name').textContent=p.name.toUpperCase();
 $('chapter').textContent=s.title.replace(/^.*?—\s*/,'').toUpperCase();$('clock').textContent=(s.title.match(/\d\d:\d\d/)||[''])[0];
 $('hint').textContent=c.phase==='choice'?'ТЕПЕРЬ ТВОЙ ХОД':c.phase==='end'?'РАЗГОВОР ЗАТИХ':'НЕ ВСЁ НУЖНО ГОВОРИТЬ ВСЛУХ';
 const transcript=$('transcript');transcript.replaceChildren();const visible=c.log.slice(-3);
 if(!visible.length)transcript.append(element('p','earlier','Связь установлена.'));
 visible.forEach((m,i)=>{const n=element('p',m.kind==='out'?'mine':i<visible.length-1?'earlier':'',m.text);transcript.append(n);});
 $('waiting').hidden=!c.queue.length;$('skip').disabled=!c.queue.length;
 const replies=$('replies');replies.replaceChildren();if(c.phase==='choice')s.choices.forEach((o,i)=>{const b=button('',()=>choose(i),'reply');b.append(element('span','',String(i+1).padStart(2,'0')),element('span','',o.echo));replies.append(b);});
 const aft=$('aftermath');aft.replaceChildren();aft.hidden=c.phase!=='end';
 if(c.phase==='end'){
  if(c.index<DATA[k].length-1){aft.append(element('p','','Через пятнадцать минут Серёга пишет снова.'));const b=button('',()=>{c.index++;c.started=false;begin(k);save();render();schedule();},'next');b.append(element('span','','→'),document.createTextNode('Прочитать сообщение'));aft.append(b);}
  else{const next=Object.keys(PEOPLE).find(id=>state.contacts[id].phase!=='end');aft.append(element('p','',next?'Здесь пока всё. Остальные всё ещё на связи.':'Все пять разговоров закончены. Продолжение — после утверждения оформления.'));const b=button('',()=>next?openContact(next):goHome(),'next');b.append(element('span','','→'),document.createTextNode(next?'Ответить: '+PEOPLE[next].name:'В главное меню'));aft.append(b);}
 }
 const rail=$('people');rail.replaceChildren();for(const [id,person]of Object.entries(PEOPLE)){
  const v=state.contacts[id],active=id===k,b=button('',()=>openContact(id),'person'+(active?' active':''));b.setAttribute('aria-pressed',String(active));b.setAttribute('aria-label',person.name);const img=element('img');img.src='art/'+id+'-small.webp';img.alt='';const desc=element('span');desc.append(element('b','',person.name.toUpperCase()),element('small','',active?'ТЫ ЗДЕСЬ':v.phase==='end'?'ПРОЧИТАНО':v.started?'ЖДЁТ ТЕБЯ':'ЕСТЬ СООБЩЕНИЕ'));b.append(img,desc);if(!v.started)b.append(element('i','dot'));rail.append(b);
 }
}
function enter(){state ||= fresh();inGame=true;$('home').hidden=true;$('game').hidden=false;begin(state.active);save();render();schedule();window.scrollTo(0,0);$('menu').focus({preventScroll:true});}
function goHome(){clearTimeout(timer);inGame=false;$('home').hidden=false;$('game').hidden=true;$('resume').hidden=!state;window.scrollTo(0,0);$('start').focus({preventScroll:true});}
function closeDialog(){$('dialog').close();schedule();}
function showDialog(title){clearTimeout(timer);$('dialogTitle').textContent=title;$('dialogBody').replaceChildren();$('dialog').showModal();}
function startNew(){state=fresh();lastArt='';enter();}
$('start').onclick=()=>{if(!state){startNew();return;}showDialog('НАЧАТЬ СНАЧАЛА?');$('dialogBody').append(element('p','','Текущие разговоры этого фрагмента начнутся заново.'),button('Начать сначала',()=>{$('dialog').close();startNew();},'dialog-action'),button('Вернуться',closeDialog,'dialog-action'));};
$('resume').hidden=!state;$('resume').onclick=enter;$('menu').onclick=goHome;$('skip').onclick=skip;
$('sound').onclick=()=>{sound=!sound;$('sound').textContent='ЗВУК: '+(sound?'ВКЛ':'ВЫКЛ');$('sound').setAttribute('aria-pressed',String(sound));beep();};
$('historyBtn').onclick=()=>{showDialog('РАЗГОВОР / '+PEOPLE[state.active].name.toUpperCase());if(!current().log.length)$('dialogBody').append(element('p','','Пока ни слова.'));for(const m of current().log){const n=element('p',m.kind==='out'?'log-mine':'');n.append(element('time','',m.kind==='out'?'ТЫ':m.who),document.createTextNode(m.text));$('dialogBody').append(n);}};
$('aboutBtn').onclick=()=>{showDialog('ЧУЖАЯ ИСТОРИЯ.');for(const t of ['Обычный четверг. Серёга нашёл на кухне то, чего там быть не должно. Валерик занят чужими проблемами. Шурик далеко, но всё ещё помнит старые долги.','Пять людей. Несколько разговоров. Ты выбираешь, кому ответить и что сказать. Не каждое совпадение — часть заговора.','Это короткий игровой фрагмент для оценки оформления. В нём использованы оригинальные диалоги из существующего сценария. Полная история здесь пока не подключена.','Управление: выбери контакт справа. Ответы — мышью или клавишами 1–3. Пробел пропускает ожидание. Разговор можно перечитать целиком. На телефоне контакты находятся над текстом.'])$('dialogBody').append(element('p','',t));};
$('closeDialog').onclick=closeDialog;$('dialog').addEventListener('close',schedule);$('dialog').addEventListener('click',e=>{if(e.target===$('dialog')){const r=$('dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();}});
document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||!inGame||$('dialog').open||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))return;if(e.code==='Space'){e.preventDefault();skip();}if(['1','2','3'].includes(e.key)){e.preventDefault();choose(Number(e.key)-1);}if(e.key==='Escape')goHome();});
// The artwork is loaded locally; there are no analytics or third-party runtime calls.
})();
