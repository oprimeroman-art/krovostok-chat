/* КРОВОСТОК — messaging fiction engine. Vanilla JS, local-first, no remote dependencies. */
(() => {
  'use strict';
  const STORY = window.KROVO_STORY;
  if (!STORY || !Array.isArray(STORY.scenes)) throw Error('story.js not loaded');
  const VERSION = STORY.meta.version || '0.2.0'; // Storage schema version: keep compatible with existing saves.
  const BUILD_VERSION = '1.2.0';
  const STORAGE = 'krovostok-kadr-save-v1';
  const PREF_KEY = 'krovostok-kadr-prefs-v1';
  const CONTACTS = {
    'Серёга': {ab:'С', a:'#8f9583',b:'#465e59', desc:'знакомый'},
    'Шурик': {ab:'Ш',a:'#a77b62',b:'#5e3f42',desc:'Филиппины'},
    'Валерик': {ab:'В',a:'#677d9d',b:'#293e59',desc:'знакомый'},
    'Док': {ab:'Д',a:'#799e93',b:'#335e61',desc:'специалист'},
    'Без имени': {ab:'?',a:'#7e8288',b:'#313943',desc:'неизвестный номер'},
    'Марат (версии)': {ab:'М',a:'#b59a73',b:'#67553d',desc:'сосед'},
    'Томазик': {ab:'Т',a:'#9c8271',b:'#54433a',desc:'магазин'},
    'Алла': {ab:'А',a:'#94758c',b:'#4c4059',desc:'новый контакт'},
    'Старый': {ab:'С',a:'#9e8d78',b:'#514637',desc:'старый знакомый'},
    'Бармен': {ab:'Б',a:'#9e776a',b:'#4d3b46',desc:'старый номер'},
    'Восемь': {ab:'8',a:'#857c71',b:'#3b3633',desc:'старый знакомый'},
    'Колян': {ab:'К',a:'#6e8b82',b:'#314f4d',desc:'знакомый знакомых'},
    'Лёха (деревня)': {ab:'Л',a:'#827a68',b:'#44483a',desc:'вернулся в Москву'},
    'Гаражи': {ab:'Г',a:'#867d7c',b:'#423e46',desc:'после драки'},
    'Сонный': {ab:'С',a:'#947983',b:'#493a4c',desc:'новый контакт'},
    'Архив': {ab:'А',a:'#637e89',b:'#284856',desc:'старые записи'},
    'Лоси': {ab:'Л',a:'#96866f',b:'#4d4140',desc:'ошибся с людьми'},
    'Мастер': {ab:'М',a:'#927a62',b:'#3d322e',desc:'столярная мастерская'},
    'Капитан': {ab:'К',a:'#68788a',b:'#29333c',desc:'на службе'},
    'Столовая': {ab:'С',a:'#ac9982',b:'#55493c',desc:'комплексные обеды'},
    'Димон': {ab:'Д',a:'#998476',b:'#554539',desc:'район'},
    'Оля': {ab:'О',a:'#8c819e',b:'#424559',desc:'кино'},
    'Стрелок': {ab:'С',a:'#7c887c',b:'#303f3b',desc:'музыка'},
    'Павел': {ab:'П',a:'#887b65',b:'#4e4335',desc:'старый знакомый Зёмы'},
    'Рита': {ab:'Р',a:'#8f7c8d',b:'#48404c',desc:'приёмка ломбарда'},
    'Лида': {ab:'Л',a:'#6897a1',b:'#244754',desc:'Ливадия'},
    'Толя Панкратов': {ab:'Т',a:'#8c8274',b:'#3c4a48',desc:'после грозы'},
    'Гарик': {ab:'Г',a:'#907868',b:'#493d40',desc:'поминки'},
    'Дом 14': {ab:'14',a:'#7e6b66',b:'#49343a',desc:'жильцы дома'}
  };
  const el = id => document.getElementById(id);
  const timePattern = /(?:[01]\d|2[0-3]):[0-5]\d/;
  const audio = {ctx:null};
  let timer = null, animationSeq = 0, toastTimer = null;
  let typingChat = null, mobileOpened = true;
  let prefs = readJSON(PREF_KEY) || {sound:true,speed:1};
  if (![0,1,2].includes(prefs.speed)) prefs.speed=1;
  if (typeof prefs.sound !== 'boolean') prefs.sound=true;
  let game = readJSON(STORAGE);
  if (!validateSave(game)) game=null;

  function readJSON(key) { try {const raw=localStorage.getItem(key);return raw?JSON.parse(raw):null} catch {return null} }
  function writeJSON(key,value) { try{localStorage.setItem(key,JSON.stringify(value))}catch{/* local file/storage restrictions */} }
  function validateSave(g){return g && g.version===VERSION && Number.isInteger(g.scene) && g.scene>=0 && g.scene<STORY.scenes.length && Array.isArray(g.messages) && Array.isArray(g.pending) && ['intro','reply','choice','transition','ended'].includes(g.stage)}
  function persist(){writeJSON(STORAGE, game)}
  function savePrefs(){writeJSON(PREF_KEY,prefs)}
  function fresh(){
    return {version:VERSION,scene:0,stage:'intro',flags:{},messages:[],pending:[],active:'Серёга',unread:{},decisions:[],seq:0,minuteCounter:544};
  }
  function normalize(name){return name==='Марат'?'Марат (версии)':name}
  function eventFrom(src, sceneChat){
    const name=normalize(src.who);
    const isSys=src.kind==='sys';
    const isForward=src.kind==='forward';
    const chat=isSys?sceneChat:(CONTACTS[name]?name:sceneChat);
    return {
      chat,who:name,
      type:isSys?'sys':isForward?'forward':src.kind==='media'?'media':'text',
      mine:isForward?src.sent_by!=='contact':src.kind==='out',
      text:String(src.text || ''),
      forwardedFrom:isForward?String(src.from || ''):null,
      media:isForward?(src.media || null):null
    };
  }
  function getScene(){return STORY.scenes[game.scene]}
  function matches(variant){return Object.entries(variant.when||{}).every(([k,v]) => game.flags[k]===v)}
  function currentSceneClock(){const m=getScene().title.match(timePattern);if(!m)return;const [h,min]=m[0].split(':').map(Number);game.minuteCounter=h*60+min}
  function stamp(){const n=game.minuteCounter;return String(Math.floor(n/60)%24).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
  function pushMessage(event){
    // When a route forwards a photo, the original must exist in the source thread as well.
    // This also repairs routes where a player didn't ask for the photo in the earlier scene.
    if(event.type==='forward' && event.media==='head' && event.forwardedFrom==='Серёга' &&
      !game.messages.some(m=>m.chat==='Серёга' && m.type==='media')){
      pushMessage({chat:'Серёга',who:'Серёга',type:'media',mine:false,text:'[фото: пакет на кухонном столе]'});
    }
    game.seq+=1;
    const time=stamp();
    if(game.seq%3===0)game.minuteCounter+=1;
    const msg={...event,id:game.seq,time};
    game.messages.push(msg);
    if(event.chat!==game.active && event.type!=='sys') game.unread[event.chat]=(game.unread[event.chat]||0)+1;
    if(event.type!=='sys' && !event.mine) beep('incoming');
    updateUnreadIndicator();
    persist();
  }
  function prepareScene(i){
    // A new scene may arrive in another chat: NEVER move the user's open conversation.
    game.scene=i;game.stage='intro';currentSceneClock();
    const sc=getScene();
    game.pending=[{chat:sc.chat,who:'Система',type:'sys',text:sc.title,mine:false},...sc.core.map(m=>eventFrom(m,sc.chat))];
    for(const v of sc.variants||[]) if(matches(v)) game.pending.push(...v.lines.map(m=>eventFrom(m,sc.chat)));
    persist();render();runQueue();
  }
  function typingDelay(e){
    if (prefs.speed===0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches)return 25;
    // A human-paced messenger: visible thinking/typing and a readable gap after each bubble.
    if(e.type==='sys')return prefs.speed===2?180:340;
    if(e.type==='forward')return prefs.speed===2?180:410;
    if(e.mine)return prefs.speed===2?360:780;
    const words=e.text.trim().split(/\s+/).length;
    const pace=1350 + Math.min(2250,Math.max(e.text.length*15,words*45));
    return Math.round(pace/(prefs.speed===2?1.9:1));
  }
  function clearRunning(){animationSeq++;if(timer!==null){clearTimeout(timer);timer=null}}
  function runQueue(){
    clearRunning();
    const t=animationSeq;
    const tick=()=>{
      if(t!==animationSeq) return;
      if(!game.pending.length){typingChat=null;render();onQueueDone();return}
      const event=game.pending[0];
      typingChat=event.mine||event.type==='sys'?null:event.chat;
      render();
      timer=setTimeout(()=>{
        if(t!==animationSeq)return;
        game.pending.shift();typingChat=null;pushMessage(event);render();tick();
      },typingDelay(event));
    };
    tick();
  }
  function skipQueue(){
    if(!['intro','reply'].includes(game.stage))return;
    clearRunning();typingChat=null;
    while(game.pending.length)pushMessage(game.pending.shift());
    render();onQueueDone();
  }
  function onQueueDone(){
    if(game.stage==='intro'){game.stage='choice';persist();render();return}
    if(game.stage==='reply'){
      game.stage='transition';persist();render();
      const t=animationSeq;
      timer=setTimeout(()=>{if(t!==animationSeq)return;advanceScene()},prefs.speed===0?40:850);
    }
  }
  function advanceScene(){
    clearRunning();
    if(game.scene+1<STORY.scenes.length){prepareScene(game.scene+1)}
    else {
      game.stage='ended';
      pushMessage({chat:game.active,who:'Система',type:'sys',mine:false,text:'Продолжение следует. Эти истории не обязаны заканчиваться одной разгадкой.'});
      persist();render();
    }
  }
  function chooseChoice(choice){
    if(game.stage!=='choice' || game.active!==getScene().chat)return;
    const sc=getScene();
    pushMessage({chat:sc.chat,who:'Вы',type:'text',mine:true,text:choice.echo});
    beep('outgoing');
    Object.assign(game.flags,choice.set);
    game.decisions.push({scene:sc.id,where:sc.title,chat:sc.chat,title:choice.title,echo:choice.echo});
    game.pending=choice.lines.map(m=>eventFrom(m,sc.chat));
    game.stage='reply';persist();render();runQueue();
  }
  function selectChat(chat){
    if(!CONTACTS[chat]) return;
    game.active=chat;game.unread[chat]=0;updateUnreadIndicator();persist();
    mobileOpened=true;
    el('app').classList.add('show-thread');
    render();scrollBottom(true);
  }
  function scrollBottom(force=false){const div=el('threadScroll');if(force || div.scrollHeight-div.scrollTop-div.clientHeight<280){requestAnimationFrame(()=>div.scrollTop=div.scrollHeight)}}
  function lastMessage(chat){for(let i=game.messages.length-1;i>=0;i--)if(game.messages[i].chat===chat)return game.messages[i];return null}
  function visibleChats(){
    const names=Object.keys(CONTACTS).filter(n=>n===game.active||game.messages.some(m=>m.chat===n)||n===getScene().chat||n===typingChat);
    names.sort((a,b)=>((lastMessage(b)||{}).id||0)-((lastMessage(a)||{}).id||0));
    const filter=el('search').value.trim().toLowerCase();
    return names.filter(n=>!filter||n.toLowerCase().includes(filter));
  }
  function avatar(name,extra=''){
    const c=CONTACTS[name]||{ab:'?',a:'#526371',b:'#293b48'};
    const d=document.createElement('span');d.className='avatar '+extra;
    d.style.setProperty('--av1',c.a);d.style.setProperty('--av2',c.b);d.textContent=c.ab;
    return d;
  }
  function renderList(){
    const list=el('chatList');list.replaceChildren();
    const chats=visibleChats();
    if(!chats.length){const d=document.createElement('p');d.className='empty-list';d.textContent='Ничего не найдено';list.appendChild(d);return}
    for(const chat of chats){
      const last=lastMessage(chat);const row=document.createElement('button');row.type='button';row.className='chat-item'+(chat===game.active?' active':'');row.setAttribute('role','listitem');row.setAttribute('aria-label','Открыть чат '+chat);
      row.appendChild(avatar(chat));const body=document.createElement('span');body.className='chat-item-body';const head=document.createElement('span');head.className='chat-row';
      const name=document.createElement('span');name.className='chat-name';name.textContent=chat;
      const time=document.createElement('span');time.className='chat-time';time.textContent=last?.time||'';
      head.append(name,time);body.appendChild(head);
      const preview=document.createElement('span');preview.className='chat-preview';
      if(typingChat===chat){preview.classList.add('typing');preview.textContent='печатает…'}
      else if(last){preview.textContent=isForward(last)?('↪ '+(forwardOrigin(last)||'Пересланное')+': '+(hasForwardedPhoto(last)?'Фотография':visibleMessageText(last).replace(/\s+/g,' ').slice(0,46))):last.type==='media'?'Фотография':last.text.replace(/\s+/g,' ').slice(0,65)}
      else preview.textContent='Нет сообщений';
      body.appendChild(preview);row.appendChild(body);
      if(game.unread[chat]>0){const count=document.createElement('span');count.className='counter';count.textContent=game.unread[chat]>99?'99+':String(game.unread[chat]);row.appendChild(count)}
      else if(game.stage==='choice' && getScene().chat===chat){row.classList.add('needs-reply');const dot=document.createElement('span');dot.className='reply-dot';dot.setAttribute('aria-label','Можно ответить');row.appendChild(dot)}
      row.addEventListener('click',()=>selectChat(chat));list.appendChild(row);
    }
  }
  function isForward(m){return m.type==='forward'||/^\[переслано/i.test(m.text)}
  function forwardOrigin(m){
    if(m.forwardedFrom)return m.forwardedFrom;
    // Preserve labels in previously saved playthroughs from v0.4.
    const old=m.text.match(/^\[переслано из чата «([^»]+)»/i);
    return old?old[1]:'';
  }
  function hasForwardedPhoto(m){
    return m.type==='forward' ? m.media==='head' :
      isForward(m) && /^\[переслано из чата «Серёга»:/i.test(m.text) && /фото|фотограф/i.test(m.text);
  }
  function visibleMessageText(m){
    // Old v0.4 saves used bracketed placeholder prose; remove the wrapper in the UI.
    const old=m.text.match(/^\[переслано из чата «[^»]+»:\s*([^\]]+)\]$/i);
    return old?old[1]:m.text;
  }
  function renderMedia(m){
    const card=document.createElement('button');card.type='button';card.className='media-card';
    const img=document.createElement('img');img.src='../../assets/head-kitchen.jpg';img.alt='Фотография: голова в пакете на кухонном столе';img.loading='lazy';card.appendChild(img);
    const cap=document.createElement('span');cap.className='media-caption';const title=document.createElement('b');title.textContent='Фотография';const info=document.createElement('span');info.textContent='Нажмите, чтобы рассмотреть';cap.append(title,info);card.appendChild(cap);
    card.addEventListener('click',()=>showPhoto(m));return card;
  }
  function renderThread(){
    const thread=el('thread');const oldHeight=el('threadScroll').scrollHeight;const oldScroll=el('threadScroll').scrollTop;const shouldScroll=oldHeight-oldScroll-el('threadScroll').clientHeight<280;
    const messages=game.messages.filter(m=>m.chat===game.active);
    const fragment=document.createDocumentFragment();
    if(!messages.length && typingChat!==game.active){const empty=document.createElement('div');empty.className='empty-chat';empty.textContent='Здесь пока тихо. Новые сообщения появятся по ходу истории.';fragment.appendChild(empty)}
    for(const m of messages){
      const bubble=document.createElement('article');bubble.className='bubble'+(m.mine?' mine':'')+(m.type==='sys'?' sys':'');
      if(m.type==='sys'){bubble.textContent=m.text;fragment.appendChild(bubble);continue}
      if(isForward(m)){
        bubble.classList.add('forward-bubble');
        const source=forwardOrigin(m);
        const label=document.createElement('div');label.className='forwarded';
        label.textContent=source?'Переслано от '+source:'Пересланное сообщение';
        bubble.appendChild(label);
      }
      if(m.type==='media'||hasForwardedPhoto(m))bubble.appendChild(renderMedia(m));
      if(m.type!=='media'&&m.text){
        const content=document.createElement('div');content.className='message-text';content.textContent=visibleMessageText(m);
        bubble.appendChild(content);
      }
      const meta=document.createElement('div');meta.className='meta';const tm=document.createElement('time');tm.textContent=m.time;meta.appendChild(tm);
      if(m.mine){const ticks=document.createElement('span');ticks.className='checkmark';ticks.textContent='✓✓';ticks.setAttribute('aria-label','доставлено');meta.appendChild(ticks)}
      bubble.appendChild(meta);fragment.appendChild(bubble)
    }
    if(typingChat===game.active){
      const row=document.createElement('div');row.className='inline-typing';
      row.setAttribute('aria-label',game.active+' печатает');
      const dots=document.createElement('span');dots.className='typing-bubble';
      for(let i=0;i<3;i++)dots.appendChild(document.createElement('i'));
      row.appendChild(dots);fragment.appendChild(row);
    }
    thread.replaceChildren(fragment);
    if(shouldScroll)scrollBottom(true);
  }
  function renderInteraction(){
    const scene=getScene(), isCurrent=game.active===scene.chat;
    const prompt=el('quickTitle'),choices=el('quickReplies');
    choices.replaceChildren();prompt.hidden=true;
    el('fakeInputText').textContent='Сообщение';
    if(game.stage==='ended'){
      el('fakeInputText').textContent='Переписка завершена';
      if(isCurrent){
        const replay=document.createElement('button');replay.className='choice-btn';
        replay.textContent='Начать новую историю';
        replay.addEventListener('click',()=>{if(confirm('Начать заново? Текущие решения будут сброшены.'))newGame()});choices.appendChild(replay);
      }
      return;
    }
    // Other chats have a normal empty compose bar; no buttons, banners or auto-navigation.
    if(game.stage!=='choice' || !isCurrent)return;
    el('fakeInputText').textContent='Выберите сообщение выше';
    scene.choices.forEach(choice=>{
      const b=document.createElement('button');b.type='button';b.className='choice-btn';
      b.textContent=choice.echo;
      b.title=choice.title;
      b.addEventListener('click',()=>chooseChoice(choice));choices.appendChild(b);
    });
  }

  function render(){
    el('activeName').textContent=game.active;
    const c=CONTACTS[game.active]||{ab:'?',a:'#526371',b:'#293b48'};
    const av=el('activeAvatar');av.textContent=c.ab;av.style.setProperty('--av1',c.a);av.style.setProperty('--av2',c.b);
    const count=game.messages.filter(x=>x.chat===game.active).length;
    el('activeStatus').textContent=typingChat===game.active?'печатает…':(c.desc+' · '+count+' сообщений');
    el('soundButton').classList.toggle('muted',!prefs.sound);
    el('soundButton').setAttribute('aria-pressed',String(prefs.sound));
    el('speedButton').textContent=prefs.speed===0?'∞':prefs.speed+'×';
    renderList();renderThread();renderInteraction();updateUnreadIndicator();
    if(window.KROVO_STAGE)window.KROVO_STAGE();
  }
  function updateUnreadIndicator(){
    const total=Object.entries(game.unread).reduce((sum,[name,n])=>sum+(name===game.active?0:n),0);
    const badge=el('totalUnread');
    if(badge){badge.hidden=!total;badge.textContent=total>99?'99+':String(total)}
    document.title=(total?'('+total+') ':'')+'КРОВОСТОК — Переписки';
  }
  function beep(kind='incoming'){
    if(!prefs.sound||!audio.ctx||audio.ctx.state!=='running')return;
    try{
      const t=audio.ctx.currentTime,osc=audio.ctx.createOscillator(),gain=audio.ctx.createGain();
      osc.type='sine';
      if(kind==='outgoing'){
        osc.frequency.setValueAtTime(460,t);
        osc.frequency.exponentialRampToValueAtTime(390,t+.075);
      }else{
        osc.frequency.setValueAtTime(740,t);
        osc.frequency.exponentialRampToValueAtTime(590,t+.12);
      }
      gain.gain.setValueAtTime(.0001,t);
      gain.gain.exponentialRampToValueAtTime(kind==='outgoing'?.012:.026,t+.015);
      gain.gain.exponentialRampToValueAtTime(.0001,t+.15);
      osc.connect(gain);gain.connect(audio.ctx.destination);osc.start(t);osc.stop(t+.16);
    }catch{/* audio optional */}
  }

  function unlockAudio(){
    if(!prefs.sound)return;
    try{
      const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;
      if(!audio.ctx)audio.ctx=new Ctx();if(audio.ctx.state==='suspended')audio.ctx.resume();
    }catch{/* permission may block audio */}
  }
  function showToast(message){const toast=el('toast');toast.textContent=message;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2300)}
  function showModal(title,bodyBuilder){
    const box=el('modalContent');box.replaceChildren();el('modalTitle').textContent=title;
    bodyBuilder(box);el('modal').hidden=false;
  }
  function closeModal(){el('modal').hidden=true}
  function showPhoto(m){showModal('Полученная фотография',box=>{
    const img=document.createElement('img');img.className='photo-overlay';img.src='../../assets/head-kitchen.jpg';img.alt='Фотография головы в пакете на кухонном столе';box.appendChild(img);
    const p=document.createElement('p');p.textContent=m.text;box.appendChild(p);
    const cap=document.createElement('p');cap.className='caption';cap.textContent='Вложение из переписки';box.appendChild(cap);
  })}
  function settings(){showModal('Настройки',box=>{
    const info=document.createElement('p');info.textContent='Сообщения появляются по очереди. История и ответы сохраняются локально в этом браузере.';box.appendChild(info);
    const soundRow=document.createElement('div');soundRow.className='setting-row';soundRow.textContent='Звук сообщений';const toggle=document.createElement('button');toggle.textContent=prefs.sound?'Включён':'Выключен';toggle.addEventListener('click',()=>{prefs.sound=!prefs.sound;savePrefs();unlockAudio();toggle.textContent=prefs.sound?'Включён':'Выключен';render()});soundRow.appendChild(toggle);box.appendChild(soundRow);
    const speedRow=document.createElement('div');speedRow.className='setting-row';speedRow.textContent='Скорость сообщений';const speed=document.createElement('button');speed.textContent=prefs.speed===0?'Сразу':prefs.speed+'×';speed.addEventListener('click',()=>{cycleSpeed();speed.textContent=prefs.speed===0?'Сразу':prefs.speed+'×'});speedRow.appendChild(speed);box.appendChild(speedRow);
    const decisionRow=document.createElement('div');decisionRow.className='setting-row';decisionRow.textContent='История ваших ответов';const journal=document.createElement('button');journal.textContent='Открыть';journal.addEventListener('click',decisionModal);decisionRow.appendChild(journal);box.appendChild(decisionRow);
    const resetRow=document.createElement('div');resetRow.className='setting-row';resetRow.textContent='Начать новую историю';const b=document.createElement('button');b.className='danger';b.textContent='Сбросить прохождение';b.addEventListener('click',()=>{if(confirm('Сбросить сообщения и все решения?')){closeModal();newGame()}});resetRow.appendChild(b);box.appendChild(resetRow);
    const about=document.createElement('p');about.className='caption';about.textContent='Версия '+BUILD_VERSION+'. Оригинальные игровые диалоги; мотивы песен используются как сюжетные источники. Нет серверной передачи данных.';box.appendChild(about);
  })}
  function decisionModal(){showModal('Ваши решения',box=>{
    const p=document.createElement('p');p.textContent='Выбранные ответы влияют на то, кто что узнал и как собеседники реагируют в следующих сценах.';box.appendChild(p);
    if(!game.decisions.length){const empty=document.createElement('p');empty.textContent='Вы пока ничего не выбирали.';box.appendChild(empty);return}
    const list=document.createElement('ol');list.className='decision-list';
    for(const d of game.decisions){const li=document.createElement('li'),b=document.createElement('b');b.textContent=d.chat+' — ';li.appendChild(b);li.appendChild(document.createTextNode(d.echo));list.appendChild(li)}
    box.appendChild(list)
  })}
  function cycleSpeed(){prefs.speed=prefs.speed===1?2:prefs.speed===2?0:1;savePrefs();render();if(['intro','reply'].includes(game.stage))runQueue();showToast(prefs.speed===0?'Сообщения показываются сразу':'Скорость '+prefs.speed+'×')}
  function newGame(){clearRunning();typingChat=null;game=fresh();el('search').value='';prepareScene(0);el('app').classList.add('show-thread');mobileOpened=true}

  el('soundButton').addEventListener('click',()=>{prefs.sound=!prefs.sound;savePrefs();unlockAudio();render();showToast(prefs.sound?'Звук уведомлений включён':'Звук уведомлений выключен')});
  el('speedButton').addEventListener('click',cycleSpeed);
  el('settingsButton').addEventListener('click',settings);
  el('closeModal').addEventListener('click',closeModal);
  el('modal').addEventListener('click',e=>{if(e.target===el('modal'))closeModal()});
  el('backButton').addEventListener('click',()=>{mobileOpened=false;el('app').classList.remove('show-thread')});
  el('search').addEventListener('input',renderList);
  document.addEventListener('pointerdown',unlockAudio,{once:true,passive:true});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!el('modal').hidden){closeModal();return}
    if(!el('modal').hidden||e.target.closest('input,textarea'))return;
    if(game.stage==='choice' && game.active===getScene().chat && /^[123]$/.test(e.key)){
      const choice=getScene().choices[Number(e.key)-1];if(choice){e.preventDefault();chooseChoice(choice)}
    }
  });
  // Completed saves from earlier chapters resume at the next scene without losing history.
  // Endpoints F12, S14, M16, T18, W18, H18 and R18 are supported.
  if(game && game.stage==='ended' && ['F12','S14','M16','T18','W18','H18','R18','K18'].includes(STORY.scenes[game.scene]?.id) &&
     game.scene+1<STORY.scenes.length){
    game.messages=game.messages.filter(m=>!(m.type==='sys' &&
      m.text==='Продолжение следует. Эти истории не обязаны заканчиваться одной разгадкой.'));
    game.stage='transition';
    persist();
  }
  if(game){
    render();if(game.stage==='intro'||game.stage==='reply')runQueue();else if(game.stage==='transition')advanceScene();
    el('app').classList.add('show-thread');
  }else newGame();
  window.KROVO_DEBUG={getState:()=>JSON.parse(JSON.stringify(game)),skip:skipQueue,advance:()=>{if(game.stage==='transition')advanceScene()},newGame,open:selectChat,choose:(i)=>{if(game.stage==='choice')chooseChoice(getScene().choices[i])},sound:()=>el('soundButton').click(),speed:()=>el('speedButton').click()};
})();
