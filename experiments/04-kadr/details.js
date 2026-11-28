/* Small, optional object interactions. Their findings belong to the existing save. */
(function(root){'use strict';
const definitions={
 groceries:{name:'Чек из магазина',art:'groceries',who:'tomazik',nodes:['shop','tom_customer'],caption:'Томазик оставил чек на прилавке.',intro:'Бумажная лента свернулась, последние строчки ушли под сгиб. Томазик придерживает её пачкой.',fact:'На чеке две пачки пельменей и морс. Томазик говорит, что это покупки мужчины из дома у реки.',ending:'«Его чек. Две пачки взял, морс ещё спросил, холодный ли. Я и запомнил». Томазик отпускает край бумажки.',kind:'receipt'},
 matchbox:{name:'Коробок из куртки',art:'matchbox',who:'stary',nodes:['story:S02','story:S04','story:S09','story:S14'],caption:'Старый отогнул подкладку. В кармане что-то шуршит.',intro:'Ящичек чуть выдвинут, дальше не идёт. Картон отсырел и снова высох; на уголке лопнула бумага.',fact:'В коробке лежит высохшая трава. Спичек нет. Старый вынул его из кармана куртки, которую давно не носил.',ending:'«Не спички, — говорит Старый. — Я и сам забыл. Убери обратно, а то по всему столу рассыплется».',kind:'box'},
 barphone:{name:'Телефон на стойке',art:'barphone',who:'barman',nodes:['story:S06','story:S10'],caption:'Экран загорелся возле старого счёта.',intro:'Бармен пододвигает телефон вместе с бумажкой. На бумаге круг от стакана, внизу прижата сдача.',fact:'Неизвестный спрашивает об оплате того вечера у окна. На старом счёте отмечен тот же стол; имени плательщика нет.',ending:'«Этот стол помню. Его самого — не уверен. Сумму ещё раз проверю, потом отвечу». Бармен убирает счёт под кассу.',kind:'phone'},
 transfers:{name:'Два перевода',art:'barphone',who:'barman',nodes:['story:M10'],caption:'Два уведомления. Счёт на стойке всё тот же.',intro:'Бармен открывает оба перевода и старый счёт. Предлагает посмотреть самому, пока не вернул лишнее.',fact:'У двух переводов совпадают сумма и указание на старый стол у окна. Это две оплаты одного счёта, а не новый заказ.',ending:'«Вот. Дважды за один стол. Я уже подумал, что сам с утра цифры путаю». Он оставляет второй перевод нетронутым.',kind:'compare'},
 cassette:{name:'Кассета с двумя голосами',art:'cassette',who:'archive',nodes:['story:W02','story:W06','story:W10','story:W15'],caption:'Нина оставила кассету рядом с магнитофоном.',intro:'Плёнка идёт туго. Нина просит не выдёргивать её из кассеты: здесь всего одна запись.',fact:'В начале первый голос ещё строит планы. Позже второй пытается остановить происходящее. После него запись обрывается; дальнейшей речи на плёнке нет.',ending:'Нина помечает место обрыва карандашом. «Вот до сюда слышно. Дальше я уже два раза проверяла — пусто».',kind:'tape'},
 tickets:{name:'Два билета',art:'tickets',who:'olya',nodes:['story:R02','story:R07','story:R11'],caption:'Оля положила билеты один поверх другого.',intro:'Верхний билет закрыл номер второго места. Оля придерживает край, чтобы ветер не унёс.',fact:'На билетах один сеанс и девятый ряд. Места соседние. Оля взяла их вместе, а не для двух разных компаний.',ending:'«Рядом, конечно. Я же с ним идти собиралась». Оля забирает билеты и прячет в карман.',kind:'tickets'},
 hotelkey:{name:'Ключ у старой лестницы',art:'hotelkey',who:'lida',nodes:['story:K15'],caption:'На бирке остался мокрый след. Под ним проступает клеймо.',intro:'Лида положила ключ на сухой край журнала. Металл холодный, бирка скользит между пальцами.',fact:'Под мокрым пятном читается гостиничное клеймо. Бирка относится к старому корпусу: по словам Лиды, его давно снесли.',ending:'«Наш. Такие в старом корпусе были». Лида смотрит на ключ ещё раз и заворачивает его в сухой лист.',kind:'key'}
};
function item(s,id){return s.details?.items?.[id]||{};}
function available(s){return Object.entries(definitions).filter(([,d])=>d.who===s.focus&&d.nodes.includes(s.contacts[s.focus]?.node)).map(([id])=>id);}
function canOpen(s,id){return !!definitions[id]&&(available(s).includes(id)||!!item(s,id).opened);}
function complete(s,id){const d=definitions[id],p=s.details.items[id];if(p.done)return;p.done=true;if(!s.facts.some(f=>f.id==='object-'+id))s.facts.push({id:'object-'+id,title:d.name,text:d.fact,kind:d.kind==='receipt'?'claim':'known',source:d.kind==='receipt'?'Чек и слова Томазика':'Рассмотрено тобой',at:s.now});}
function act(state,id,action,value){if(!canOpen(state,id))return state;const d=definitions[id],old=item(state,id);if(action==='open'&&old.opened)return state;const s=structuredClone(state);s.details||={items:{}};s.details.items||={};const p=s.details.items[id]||={};
 if(action==='open')p.opened=true;
 else if(!p.opened||p.done)return state;
 else if(d.kind==='receipt'&&action==='unfold'){p.unfolded=true;}
 else if(d.kind==='receipt'&&action==='check'&&p.unfolded)complete(s,id);
 else if(d.kind==='box'&&action==='slide'){p.slide=Math.max(0,Math.min(100,Math.round(Number(value)||0)));if(p.slide>=80)p.lid=true;}
 else if(d.kind==='box'&&action==='look'&&p.lid){p.looked=true;complete(s,id);}
 else if(['phone','compare'].includes(d.kind)&&['screen','bill','first','second'].includes(action)){p[action]=true;}
 else if(d.kind==='phone'&&action==='compare'&&p.screen&&p.bill)complete(s,id);
 else if(d.kind==='compare'&&action==='compare'&&p.first&&p.second&&p.bill)complete(s,id);
 else if(d.kind==='tape'&&action==='seek'&&[0,1,2].includes(value)){p.position=value;p.heard||=[];if(!p.heard.includes(value))p.heard.push(value);}
 else if(d.kind==='tape'&&action==='mark'&&[0,1,2].every(x=>p.heard?.includes(x)))complete(s,id);
 else if(d.kind==='tickets'&&action==='slide'){p.slide=Math.max(0,Math.min(100,Math.round(Number(value)||0)));if(p.slide>=90)p.uncovered=true;}
 else if(d.kind==='tickets'&&action==='check'&&p.uncovered)complete(s,id);
 else if(d.kind==='key'&&action==='wipe'){p.wiped=true;}
 else if(d.kind==='key'&&action==='turn'&&p.wiped){p.turned=true;}
 else if(d.kind==='key'&&action==='check'&&p.turned)complete(s,id);
 else return state;
 return JSON.stringify(p)===JSON.stringify(old)?state:s;
}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function image(id){const img=el('img');img.src='art/details/'+definitions[id].art+'.webp?v=10';img.alt=definitions[id].name;return img;}
function insert(s,id,open){const d=definitions[id],p=item(s,id),figure=el('figure','object-insert'),b=el('button','object-peek');b.type='button';b.dataset.object=id;b.setAttribute('aria-label','Рассмотреть: '+d.name);b.append(image(id));const caption=el('figcaption');caption.append(el('span','',d.caption),el('b','',p.done?'Рассмотрено · открыть':'Рассмотреть →'));b.append(caption);b.onclick=()=>open(id);figure.append(b);return figure;}
function render(body,s,id,run){const d=definitions[id],p=item(s,id),layout=el('div','object-layout'),art=el('div','object-art'),controls=el('div','object-controls');controls.setAttribute('aria-live','polite');art.dataset.kind=d.kind;art.dataset.step=p.done?'done':p.turned?'turned':p.wiped?'wiped':p.lid?'open':'closed';art.append(image(id));layout.append(art,controls);body.append(layout);controls.append(el('p','object-intro',d.intro));
 function button(label,action,value,enabled=true){const b=el('button','object-action',label);b.type='button';b.dataset.objectAction=action;b.disabled=!enabled;b.onclick=()=>run(action,value);controls.append(b);return b;}
 function note(text){controls.append(el('p','object-observation',text));}
 function slider(label,current,action){const row=el('label','object-slider'),input=el('input');input.type='range';input.min='0';input.max='100';input.step='1';input.value=String(current||0);input.setAttribute('aria-label',label);row.append(el('span','',label),input);input.oninput=()=>{art.style.setProperty('--object-slide',input.value+'%');art.style.setProperty('--object-reveal',Number(input.value)/100);};input.onchange=()=>run(action,Number(input.value));controls.append(row);art.style.setProperty('--object-slide',(current||0)+'%');art.style.setProperty('--object-reveal',(current||0)/100);}
 if(p.done){note(d.ending);controls.append(el('p','object-saved','Деталь осталась в записях.'));return;}
 if(d.kind==='receipt'){
  if(!p.unfolded)button('Развернуть сгиб','unfold');
  else{const receipt=el('div','object-receipt');receipt.append(el('b','','ПЕЛЬМЕНИ × 2'),el('b','','МОРС × 1'),el('small','','Повторная печать'));art.append(receipt);note('Две пачки, а не одна. Морс в том же чеке. Томазик помнит покупателя.');button('Уточнить, чьи это покупки','check');}
 }
 if(d.kind==='box'){
  slider('Выдвинуть ящичек',p.slide,'slide');art.classList.toggle('object-open',!!p.lid);
  if(p.lid){note('Внутри что-то тёмное. Пахнет сухой травой, спичек не видно.');button('Заглянуть внутрь','look');}else button('Поддеть и выдвинуть','slide',100);
 }
 if(d.kind==='phone'){
  button('Посмотреть экран','screen');button('Развернуть старый счёт','bill');
  if(p.screen)note('Сообщение без имени: «За тот вечер у окна. Сколько с меня?»');
  if(p.bill)note('Под пятном читается пометка: стол у окна. Бумага старая, но итоговая сумма сохранилась.');
  button('Сверить со счётом','compare',null,!!(p.screen&&p.bill));
 }
 if(d.kind==='compare'){
  button('Открыть первый перевод','first');button('Открыть второй перевод','second');button('Развернуть счёт','bill');
  if(p.first)note('Первый перевод: сумма как в старом счёте. Пометка — за тот вечер у окна.');
  if(p.second)note('Второй: другой отправитель. Сумма та же, снова — за стол у окна.');
  if(p.bill)note('На бумаге один заказ и один стол. Второго счёта нет.');
  button('Показать совпадение Бармену','compare',null,!!(p.first&&p.second&&p.bill));
 }
 if(d.kind==='tape'){
  art.append(el('i','object-spool spool-left'),el('i','object-spool spool-right'));
  art.classList.toggle('object-spinning',p.position!==undefined);const transport=el('div','object-transport');controls.append(transport);
  for(const [i,label]of ['К началу','Ко второму голосу','До конца'].entries()){const b=button(label,'seek',i);b.setAttribute('aria-pressed',String(p.position===i));transport.append(b);}
  if(p.position===0)note('Первый голос. Пока ещё ничего не произошло: он рассказывает, что собирается сделать. Говорит о Лёхе, Данилке и гантели.');
  if(p.position===1)note('После паузы — второй. Он уже видит последствия и пытается остановить первого. Те же имена, та же гантель.');
  if(p.position===2)note('На середине фразы запись обрывается. Дальше шорох плёнки. Ни ответа, ни следующего разговора.');
  button('Отметить место обрыва','mark',null,[0,1,2].every(x=>p.heard?.includes(x)));
 }
 if(d.kind==='tickets'){
  const stubs=el('div','object-stubs');stubs.append(el('span','','9 РЯД / 12'),el('span','','9 РЯД / 13'));art.append(stubs);slider('Сдвинуть верхний билет',p.slide,'slide');
  if(p.uncovered){note('Один сеанс, девятый ряд. Двенадцатое и тринадцатое — рядом.');button('Сравнить оба билета','check');}else button('Разложить рядом','slide',100);
 }
 if(d.kind==='key'){
  if(!p.wiped)button('Промокнуть бирку сухим листом','wipe');
  else if(!p.turned){note('Пятно посветлело. На обратной стороне проступает клеймо.');button('Поднести бирку к свету','turn');}
  else{const stamps=el('div','object-keymarks');for(const label of ['На бирке','На бланке']){const mark=el('span');mark.append(el('i','object-seal'),el('small','',label));stamps.append(mark);}art.append(stamps);note('Такое же клеймо стоит на старых бланках гостиницы. Ключ из того корпуса, которого больше нет.');button('Сверить с Лидой','check');}
 }
}
root.SHILO_DETAILS={definitions,item,available,canOpen,act,insert,render};
if(typeof module!=='undefined')module.exports=root.SHILO_DETAILS;
})(typeof window==='undefined'?globalThis:window);
