/* Approved presentation, new scene-based opening. */
(() => {
'use strict';
const $=id=>document.getElementById(id),M=window.SHILO_OPENING,P=M.PEOPLE,KEY='shilo-opening-v2';
let state=null,inGame=false,lastArt='',lastNotice=0,noticeTimer;
try{const saved=JSON.parse(localStorage.getItem(KEY));if(M.valid(saved))state=saved;}catch{}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{}}
function node(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function button(label,fn,cls){const b=node('button',cls,label);b.type='button';b.onclick=fn;return b;}
function beep(){window.SHILO_SOUND?.effect('notice');}
function lineText(line){return typeof line==='string'?line:line.text;}
function renderLine(line){return node('p',typeof line==='object'&&line.who==='Ты'?'player-spoken':'spoken',lineText(line));}
function setState(next){if(next===state)return;const seq=state?.seq||0;state=next;save();render();if(state.seq>seq)beep();}
function choose(id){if(!inGame||$('dialog').open)return;const prev=state.contacts[state.focus].node;window.SHILO_SOUND?.effect('touch');setState(M.act(state,id));if(prev!==state.contacts[state.focus].node)window.scrollTo({top:0,behavior:'instant'});}
function activate(k){if(!inGame||$('dialog').open)return;setState(M.activate(state,k));window.scrollTo({top:0,behavior:'instant'});}
function wait(){if(!inGame||$('dialog').open)return;setState(M.wait(state));}
function relationLabel(c){return c.relation<=-3?'НЕ ДОВЕРЯЕТ':c.relation<0?'ОСТОРОЖЕН':c.relation>0?'ДОВЕРЯЕТ':'';}
function statusLabel(c){if(c.pending.length)return 'ЕСТЬ НОВОЕ';if(c.status==='away')return 'ЗАНЯТ';if(c.unread)return c.status==='event'?'ЕСТЬ НОВОЕ':'НАПИСАЛ';if(c.status==='newinfo')return 'ЕСТЬ НОВОЕ';if(c.status==='reply')return 'ЖДЁТ ТЕБЯ';return 'НА СВЯЗИ';}
function actionButton(o,i){const b=button('',()=>choose(o.id),'reply');b.dataset.action=o.id;b.append(node('span','',String(i+1).padStart(2,'0')));const words=node('span','action-words');words.append(node('span','',o.label));if(o.hint)words.append(node('small','action-hint',o.hint));b.append(words);if(o.minutes>1)b.append(node('small','action-time',o.minutes+' МИН'));return b;}
function render(){if(!state)return;const k=state.focus,c=state.contacts[k],v=M.describe(state),p=P[k];
 const artKey=k+'/'+v.shot;if(lastArt!==artKey){$('backdrop').src='art/'+k+'.webp';$('backdrop').style.animation='none';void $('backdrop').offsetWidth;$('backdrop').style.animation='';lastArt=artKey;}
 $('game').dataset.shot=v.shot;$('game').dataset.person=k;
 $('location').textContent=p.where;$('artPlace').textContent=p.caption;$('artName').textContent=p.name.toUpperCase();$('name').textContent=p.name.toUpperCase();$('chapter').textContent=v.title.toUpperCase();$('clock').textContent=M.clock(state.now);$('worldDate').textContent=M.date(state.now);
 const transcript=$('transcript');transcript.replaceChildren();if(v.prose)transcript.append(node('p','scene-prose',v.prose));for(const line of v.lines)transcript.append(renderLine(line));transcript.classList.toggle('dialogue-long',v.lines.map(lineText).join(' ').length>460);
 const opts=M.options(state);$('replies').classList.toggle('single-step',opts.length===1);$('replies').replaceChildren(...opts.map(actionButton));
 const waiting=M.canWait(state),event=M.nextEvent(state);$('skip').disabled=!waiting;$('skip').title=waiting?'Продвинуть общее время до следующего события':'Ожидание доступно, когда текущая ситуация закончена';$('waiting').hidden=c.node!=='wait';$('waitText').textContent=k==='dok'?'Он прочитал. Пока молчит.':'Пока не отвечает.';
 $('hint').textContent=v.title.toUpperCase();
 const aft=$('aftermath');aft.replaceChildren();aft.hidden=opts.length>0;
 if(!opts.length){
  if(state.flags.finished){aft.append(node('p','',outcome()));aft.append(button('В главное меню',goHome,'next'));}
  else{const pending=Object.keys(P).find(id=>state.contacts[id].known&&(state.contacts[id].unread||state.contacts[id].pending.length)&&id!==k)||Object.keys(P).find(id=>id!==k&&state.contacts[id].known&&M.options(state,id).length);if(pending){const b=button('',()=>activate(pending),'next');b.append(node('span','','→'),document.createTextNode('Ответить: '+P[pending].name));aft.append(b);}else if(waiting){const b=button('',wait,'next');b.append(node('span','','→'),document.createTextNode('Дождаться следующего события · '+M.clock(event.at)));aft.append(b);}else aft.append(node('p','','Пока никто не ждёт ответа. Полученное можно перечитать в записях.'));}
 }
 const rail=$('people');rail.replaceChildren();const known=Object.keys(P).filter(id=>state.contacts[id].known);$('knownCount').textContent=String(known.length).padStart(2,'0');
 for(const id of known){const person=P[id],v=state.contacts[id],b=button('',()=>activate(id),'person'+(id===k?' active':'')+(v.status==='away'?' unavailable':''));b.setAttribute('aria-label',person.name);b.setAttribute('aria-pressed',String(id===k));b.dataset.contact=id;b.dataset.status=v.status;const img=node('img');img.src='art/'+id+'-small.webp';img.alt='';const desc=node('span');desc.append(node('b','',person.name.toUpperCase()),node('small','contact-status',statusLabel(v)));b.append(img,desc);if(v.unread||v.pending.length)b.append(node('i','dot'));rail.append(b);}
 if(innerWidth<=700){const active=rail.querySelector('.active');if(active)rail.scrollLeft=Math.max(0,active.offsetLeft-rail.offsetLeft-rail.clientWidth/2+active.clientWidth/2);}
 const unread=state.notices.filter(n=>!n.read&&!['relation','contact'].includes(n.kind)).length;$('eventCount').textContent=unread?String(unread):'';
 const newest=state.notices.filter(n=>!['relation','contact'].includes(n.kind)).at(-1);if(newest&&newest.id>lastNotice){lastNotice=newest.id;const status=$('notice');status.textContent=M.clock(newest.at)+' / '+newest.text;status.hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>status.hidden=true,6000);}
}
function outcome(){const f=state.flags,parts=[];parts.push(f.publicRumor?'Снимок оказался у посторонних.':f.maratRequested?'Снимок увидел ещё один человек; дальше он не пошёл.':f.route==='private'?'Находка осталась между тобой и Серёгой.':'Снимок остался в ограниченном кругу.');if(f.denied)parts.push('Серёга перестал отвечать.');else if(f.repair)parts.push('Серёга услышал признание, но копии уже не вернуть.');else if(state.contacts.serega.relation>0)parts.push('Серёга продолжает доверять тебе.');parts.push(f.val_mode==='question'?'Ты узнал об Андрее — другом погибшем.':f.val_mode==='late'||f.val_mode==='missed'?'Разговорить Валерика вовремя не удалось.':'Валерик сохранил подробности при себе.');return parts.join(' ');}
function enter(){state ||= M.fresh();inGame=true;$('home').hidden=true;$('game').hidden=false;lastNotice=state.seq;render();save();window.scrollTo(0,0);$('menu').focus({preventScroll:true});}
function goHome(){inGame=false;$('home').hidden=false;$('game').hidden=true;$('resume').hidden=!state;$('notice').hidden=true;clearTimeout(noticeTimer);window.scrollTo(0,0);$('start').focus({preventScroll:true});}
function show(title){$('dialogTitle').textContent=title;$('dialogBody').replaceChildren();$('dialog').showModal();}
function close(){$('dialog').close();}
function startNew(){state=M.fresh();lastArt='';lastNotice=0;enter();}
$('start').onclick=()=>{if(!state){startNew();return;}show('НАЧАТЬ СНАЧАЛА?');$('dialogBody').append(node('p','','Решения и записи этого фрагмента будут сброшены.'),button('Начать сначала',()=>{close();startNew();},'dialog-action'),button('Вернуться',close,'dialog-action'));};
$('resume').hidden=!state;$('resume').onclick=enter;$('menu').onclick=goHome;$('skip').onclick=wait;
$('sound').onclick=()=>window.SHILO_SOUND?.toggle();
$('settingsBtn').onclick=()=>{show('НАСТРОЙКИ / ЗВУК');window.SHILO_SOUND.settings($('dialogBody'));};
$('historyBtn').onclick=()=>{show('ЗАПИСИ / '+M.clock(state.now));const body=$('dialogBody'),facts=node('section','notebook');facts.append(node('h3','','ИЗВЕСТНОЕ И ВЕРСИИ'));if(!state.facts.length)facts.append(node('p','','Пока записывать нечего.'));for(const f of state.facts){const p=node('p','fact');p.append(node('time','',M.clock(f.at)+' / '+f.source+' / '+({known:'ИЗВЕСТНО',claim:'СО СЛОВ',hypothesis:'ВЕРСИЯ'}[f.kind])),node('b','',f.title),node('span','',f.text));facts.append(p);}body.append(facts);for(const [k,c]of Object.entries(state.contacts)){if(!c.known||!c.history.length)continue;const block=node('details','history-contact');block.open=k===state.focus;block.append(node('summary','',P[k].name.toUpperCase()));for(const e of c.history){const p=node('div',e.choice?'log-mine':'log-entry');p.append(node('time','',M.clock(e.at)+(e.receivedAt!==undefined&&e.receivedAt!==e.at?' / ПОЛУЧЕНО '+M.clock(e.receivedAt):'')+(e.choice?' / ТВОЁ ДЕЙСТВИЕ':' / '+e.title)));if(e.choice)p.append(node('p','',e.choice));else{p.append(node('p','scene-prose',e.prose));for(const line of e.lines)p.append(renderLine(line));}block.append(p);}body.append(block);}};
$('eventsBtn').onclick=()=>{show('ЧЕТВЕРГ / СОБЫТИЯ');const body=$('dialogBody');if(!state.notices.length)body.append(node('p','','Пока только одно чужое утро.'));for(const e of [...state.notices].filter(n=>!['relation','contact'].includes(n.kind)).reverse()){const p=node('p','event-entry');p.append(node('time','',M.clock(e.at)),node('span','',e.text));if(state.contacts[e.who]?.known)p.append(button('К разговору',()=>{close();activate(e.who);},'event-link'));body.append(p);e.read=true;}save();$('eventCount').textContent='';};
$('aboutBtn').onclick=()=>{show('ЧУЖАЯ ИСТОРИЯ.');for(const text of ['Четверг, шестое. Серёга вышел завтракать и нашёл на кухне голову. Теперь ему нужно кому-то об этом рассказать. Тебе — решить, что с этим делать.','Действия занимают время. Переключение людей и чтение записей — нет. Пока ты ждёшь одного, другой может уйти работать.','Ответы — мышью или клавишами 1–4. Пробел — пропустить ожидание, когда текущий разговор закончен. Звук настраивается в главном меню.','История по мотивам песен «Кровостока». 18+. В этом фрагменте — первое утро; продолжение начинается с вопроса Томазика.'])$('dialogBody').append(node('p','',text));};
$('closeDialog').onclick=close;$('dialog').addEventListener('click',e=>{if(e.target===$('dialog')){const r=$('dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||!inGame||$('dialog').open||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))return;if(e.code==='Space'){e.preventDefault();wait();}if(/^[1-4]$/.test(e.key)){const o=M.options(state)[Number(e.key)-1];if(o){e.preventDefault();choose(o.id);}}if(e.key==='Escape')goHome();});
})();
