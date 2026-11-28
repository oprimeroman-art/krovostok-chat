/* The board is derived from the player's received history. Opening it never advances time. */
(function(root){
'use strict';
const NS='http://www.w3.org/2000/svg';
const origins={
 serega:['you','Нашёл голову на кухне','call'],dok:['you','Ответил как врач','call'],
 valerik:['you','Вышел на связь','call'],shurik:['you','Ошибся номером','call'],
 marat:['serega','Получил снимок через тебя','paper'],tomazik:['you','Позвонил из магазина','call'],
 alla:['tomazik','Дал номер с её согласия','call'],sosed:['tomazik','Передал твой номер','call'],
 killer:['valerik','Заказчик по делу Андрея','call'],stary:['you','Позвонил насчёт куртки','call'],
 barman:['you','Спросил про старый счёт','call'],vosem:['barman','Искал ножницы','call'],
 kolyan:['shurik','Получил твой номер','call'],sonny:['kolyan','Передал предупреждение о Ваче','paper'],
 lekha:['stary','Попросил познакомить','call'],garazhi:['barman','Дал твой номер после рассказа о драке','call'],
 archive:['barman','Отдал кассету на оцифровку','paper'],losi:['garazhi','Переслал чужое сообщение','paper'],
 stolovaya:['you','Зашёл на обед','call'],master:['stary','Нашёл по объявлению','call'],
 kapitan:['barman','Дал твой номер','call'],dimon:['barman','Обратился за помощью','call'],
 olya:['you','Рассказала о двух билетах','call'],strelok:['barman','Предложил забрать пластинки','call'],
 pavel:['you','Выбирал фотографию Зёмы','call'],rita:['you','Позвонила из ломбарда','call'],
 lida:['you','Нашла номер в гостевой книге','call'],tolya:['you','Сосед дал твой номер','call'],
 garik:['you','Позвонил с поминок','call'],dom14:['barman','Увидела номер на объявлении','call']
};
const songs={serega:'Голова',dok:'Патологоанатом',valerik:'Коромысло',shurik:'Шурик',marat:'Подозрение',tomazik:'Летом',alla:'Летом',sosed:'Летом',killer:'Коромысло',stary:'Куртец',barman:'В баре',vosem:'Ногти',kolyan:'Приснился',sonny:'Приснился',lekha:'Деревня',garazhi:'Бакланы',archive:'Гантеля / Аутро',losi:'Лоси',stolovaya:'Столовая',master:'Столярка',kapitan:'Пора домой',olya:'Теряю голову',strelok:'Снайпер',pavel:'Зёма',rita:'Ломбард',lida:'Амфибия',tolya:'Молния',garik:'Чебурашка',dom14:'Пожар'};
function graph(s){
 const known=Object.keys(s.contacts).filter(k=>s.contacts[k].known),seen=(k,id)=>s.contacts[k]?.history.some(e=>e.node==='story:'+id||e.node==='reply:'+id),edges=[];
 function add(from,to,label,type='call'){if(!known.includes(to)||from!=='you'&&!known.includes(from))return;edges.push({from,to,label,type});}
 for(const k of known){let [from,label,type]=origins[k]||['you','Позвонил','call'];
  if(!known.includes(from)&&from!=='you'){from='you';label='Вышел на связь';}
  if(k==='dok'&&s.flags.docRequested)label='Посмотрел присланный тобой снимок';
  if(k==='valerik'&&s.flags.photoVal){from='serega';label='Ты передал его снимок';type='paper';}
  add(from,k,label,type);
 }
 if(s.flags.docRequested)add('serega','dok','Снимок с кухни, переданный тобой','paper');
 if(seen('valerik','E06')&&s.flags.cross_mode==='mention')add('serega','valerik','Ты спросил о находке на кухне','paper');
 if(seen('dok','H09'))add('stary','dok','Переслал запись из мастерской','paper');
 if(seen('barman','H12'))add('master','barman','Предложил мебель для бара');
 if(seen('stary','H18')&&s.flags.masterFate==='searched')add('barman','stary','Вместе ждут у склада');
 if(seen('archive','K14'))add('pavel','archive','Ищет фотографию Зёмы','paper');
 if(seen('garik','U16')&&s.contacts.pavel?.known)add('pavel','garik','Рассказали друг другу о поминках');
 if(seen('garik','U16')&&s.flags.fire_beds==='volunteers')add('garik','dom14','Отвёз оставшуюся еду');
 if(s.flags.coast_log==='archive'&&seen('lida','K15'))add('archive','lida','Проверила адрес снесённого корпуса','paper');
 if(s.flags.tolya_image==='verify'&&seen('tolya','U08'))add('tolya','archive','Ты отправил фотографию','paper');
 return {known,edges};
}
function status(c){return c.unread||c.pending.length?'Есть новое':c.status==='away'?'Пока не отвечает':c.status==='reply'?'Ждёт твоего решения':'Разговор можно перечитать';}
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function svg(tag,attrs,text){const e=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs||{}))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;}
function positions(keys,edges){
 const width=1240,height=Math.max(700,Math.ceil(keys.length/5)*200),cols=Math.min(5,Math.ceil(Math.sqrt(keys.length*1.35))),rows=Math.ceil(keys.length/cols);
 const pos={};keys.forEach((k,i)=>pos[k]={x:100+(i%cols)*(width-200)/Math.max(1,cols-1),y:100+Math.floor(i/cols)*(height-200)/Math.max(1,rows-1)});
 // Short springs place actual acquaintances near one another; repulsion keeps portraits apart.
 for(let t=0;t<120;t++){
  const force=Object.fromEntries(keys.map(k=>[k,{x:0,y:0}]));
  for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++){let a=keys[i],b=keys[j],dx=pos[a].x-pos[b].x,dy=pos[a].y-pos[b].y,d=Math.max(1,Math.hypot(dx,dy)),f=Math.min(16,37000/(d*d));force[a].x+=dx/d*f;force[a].y+=dy/d*f;force[b].x-=dx/d*f;force[b].y-=dy/d*f;}
  for(const e of edges){let a=pos[e.from],b=pos[e.to];if(!a||!b)continue;let dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1,Math.hypot(dx,dy)),f=(d-230)*.012;force[e.from].x+=dx/d*f;force[e.from].y+=dy/d*f;force[e.to].x-=dx/d*f;force[e.to].y-=dy/d*f;}
  for(const k of keys){pos[k].x=Math.max(85,Math.min(width-85,pos[k].x+force[k].x));pos[k].y=Math.max(95,Math.min(height-95,pos[k].y+force[k].y));}
 }
 // Resolve rectangular portrait overlap, including at the board's edges.
 for(let t=0;t<90;t++)for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++){
  const a=pos[keys[i]],b=pos[keys[j]],dx=b.x-a.x,dy=b.y-a.y,ox=157-Math.abs(dx),oy=185-Math.abs(dy);if(ox>0&&oy>0){if(ox<oy){const push=(ox+1)/2,sign=dx>=0?1:-1;a.x-=push*sign;b.x+=push*sign;}else{const push=(oy+1)/2,sign=dy>=0?1:-1;a.y-=push*sign;b.y+=push*sign;}}
 }
 const minX=Math.min(...Object.values(pos).map(p=>p.x))-90,minY=Math.min(...Object.values(pos).map(p=>p.y))-100,maxX=Math.max(...Object.values(pos).map(p=>p.x))+90,maxY=Math.max(...Object.values(pos).map(p=>p.y))+100;
 return {pos,box:[minX,minY,maxX-minX,maxY-minY]};
}
function render(body,s,people,api){
 const {known,edges}=graph(s),keys=['you',...known],{pos,box}=positions(keys,edges);
 const intro=el('div','ties-intro');intro.append(el('p','', 'Чужие истории пересекаются там, где ты о них узнал. Здесь только уже знакомые тебе люди.'));
 const legend=el('div','ties-legend');legend.append(el('span','ties-call','ЗНАКОМСТВО / ЗВОНОК'),el('span','ties-paper','ПЕРЕДАННАЯ ИНФОРМАЦИЯ'));intro.append(legend);body.append(intro);
 const layout=el('div','ties-layout'),map=el('section','ties-map'),toolbar=el('div','ties-tools'),viewport=el('div','ties-viewport');viewport.tabIndex=0;viewport.setAttribute('aria-label','Карта связей. Прокручивай, чтобы рассмотреть портреты.');
 let zoom=1;const canvas=svg('svg',{viewBox:box.join(' '),role:'group','aria-label':'Связи, известные на '+api.date(s.now)+' '+api.clock(s.now),class:'ties-canvas'}),detail=el('aside','ties-detail');
 const edgeEls=[],nodeEls=new Map();
 const resize=()=>{canvas.style.width=Math.round(zoom*100)+'%';};
 for(const [label,run]of [['−',()=>zoom=Math.max(.5,zoom-.25)],['+',()=>zoom=Math.min(6,zoom+(zoom>=2?.5:.25))],['Вся карта',()=>zoom=1]]){const b=el('button','',label);b.type='button';b.setAttribute('aria-label',label==='−'?'Уменьшить карту':label==='+'?'Увеличить карту':label);b.onclick=()=>{run();resize();};toolbar.append(b);}
 map.append(toolbar,viewport);viewport.append(canvas);layout.append(map,detail);body.append(layout);
 for(const e of edges){const a=pos[e.from],b=pos[e.to],path=svg('path',{d:`M ${a.x} ${a.y} Q ${(a.x+b.x)/2+12} ${(a.y+b.y)/2-12} ${b.x} ${b.y}`,class:'ties-thread '+e.type});canvas.append(path);edgeEls.push([e,path]);}
 function choose(k){
  for(const [id,g]of nodeEls)g.classList.toggle('selected',id===k);
  for(const [e,path]of edgeEls){path.classList.toggle('lit',e.from===k||e.to===k);path.classList.toggle('dim',k!=='you'&&e.from!==k&&e.to!==k);}
  detail.replaceChildren();
  if(k==='you'){detail.append(el('p','ties-kicker','ЧУЖАЯ ИСТОРИЯ'),el('h3','','ТЫ'),el('p','','Ты познакомился с '+known.length+' '+(known.length===1?'человеком':'людьми')+'. Нажми на портрет: увидишь, откуда он появился и что связывает его с остальными.'));}
  else{
   const c=s.contacts[k],p=people[k],latest=c.history.findLast(e=>!e.choice),name=el('h3','',p.name.toUpperCase());detail.append(el('p','ties-kicker',status(c)),name);
   if(c.relation!==0)detail.append(el('p','ties-relation',c.relation>0?'Тебе доверяет':c.relation<=-3?'Доверие потеряно':'Держится настороженно'));
   if(latest){detail.append(el('h4','','ПОСЛЕДНИЙ РАЗГОВОР'),el('p','',latest.title),el('time','',api.date(latest.at)+' / '+api.clock(latest.at)));}
   const button=el('button','ties-open',api.options(s,k).length?'К разговору →':'Перечитать разговор →');button.type='button';button.onclick=()=>api.activate(k);detail.append(button);
  }
  const touching=edges.filter(e=>e.from===k||e.to===k);if(touching.length){detail.append(el('h4','','ЧТО ВАС СВЯЗЫВАЕТ'));for(const e of touching){const a=e.from==='you'?'Ты':people[e.from].name,b=e.to==='you'?'ты':people[e.to].name,entry=el('p','ties-proof');entry.append(el('b','',a+' → '+b),el('span','',e.label));detail.append(entry);}}
  if(k!=='you'&&songs[k])detail.append(el('p','ties-source','ПО МОТИВАМ / «'+songs[k]+'»'));
 }
 keys.forEach((k,i)=>{
  const p=pos[k],tilt=[-3,2,-1,3,-2][i%5],g=svg('g',{transform:`translate(${p.x} ${p.y}) rotate(${tilt})`,class:'ties-person',role:'button',tabindex:'0','aria-label':k==='you'?'Ты':people[k].name+' — '+status(s.contacts[k])});
  g.append(svg('title',{},k==='you'?'Ты':people[k].name),svg('path',{d:'M -66 -76 L 65 -80 L 69 75 L -69 79 Z',class:'ties-frame'}),svg('rect',{x:-62,y:-71,width:124,height:118,class:'ties-photo-back'}));
  if(k==='you')g.append(svg('path',{d:'M -30 40 L -20 7 L -12 -2 L -17 -25 L -4 -43 L 15 -36 L 23 -11 L 15 5 L 33 40 Z',class:'ties-self'}));
  else g.append(svg('image',{href:'art/'+k+'-small.webp?v=6',x:-61,y:-70,width:122,height:116,preserveAspectRatio:'xMidYMid slice'}));
  g.append(svg('path',{d:'M -70 -78 L -43 -82 L -39 -67 L -68 -66 Z',class:'ties-tape'}),svg('text',{x:0,y:65,'text-anchor':'middle',class:'ties-name'},k==='you'?'ТЫ':people[k].name.toUpperCase()));
  if(k!=='you'){
   const c=s.contacts[k],needs=!!(c.unread||c.pending.length),reply=api.options(s,k).some(o=>o.id!=='next_day');
   if(needs||reply){g.append(svg('circle',{cx:59,cy:-72,r:14,class:needs?'ties-unread':'ties-decision'}),svg('text',{x:59,y:-66,'text-anchor':'middle',class:'ties-badge'},needs?'!':'?'));}
   else if(c.status==='away')g.classList.add('unavailable');
   else g.append(svg('path',{d:'M 44 -72 L 51 -64 L 65 -82',class:'ties-check'}));
  }
  g.onclick=()=>choose(k);g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(k);}};canvas.append(g);nodeEls.set(k,g);
 });
 choose(s.focus&&known.includes(s.focus)?s.focus:'you');resize();
}
root.SHILO_RELATIONS={render,graph,positions};
})(typeof window==='undefined'?globalThis:window);
