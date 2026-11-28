#!/usr/bin/env python3
"""Package the complete project and a self-contained first-Thursday edition.
Usage: python tools/package-shilo.py /absolute/output/directory
Node is needed only to resolve the editorial scenario data during packaging.
"""
import json,shutil,subprocess,sys,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else ROOT.parent/'releases'
OUT.mkdir(parents=True,exist_ok=True)
VERSION='v9'
FULL=OUT/('SHILO-Full-'+VERSION);DEMO=OUT/('SHILO-Demo-'+VERSION)
for target in (FULL,DEMO):
 if target.exists():shutil.rmtree(target)
 target.mkdir()
def ignore(path,names):
 return {n for n in names if n in {'.git','node_modules','__pycache__','.DS_Store'} or n.endswith('.pyc')}
shutil.copytree(ROOT,FULL,dirs_exist_ok=True,ignore=ignore)
GAME=Path('experiments/04-kadr')
fullgame=FULL/GAME;demogame=DEMO/GAME;demogame.mkdir(parents=True)
redirect='<!doctype html><html lang="ru"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=experiments/04-kadr/index.html"><title>ШИЛО</title><a href="experiments/04-kadr/index.html">Открыть ШИЛО</a></html>'
(FULL/'source-materials').mkdir(exist_ok=True)
shutil.copy2(FULL/'index.html',FULL/'source-materials/legacy-index.html')
for target in (FULL,DEMO):
 (target/'index.html').write_text(redirect,encoding='utf-8')
 (target/'START.bat').write_bytes(b'@echo off\r\nstart "" "%~dp0index.html"\r\n')
for name in ['index.html','prototype.js','prototype.css','opening.js','sound.js','relations.js','mark.svg']:
 shutil.copy2(fullgame/name,demogame/name)
resolved=json.loads(subprocess.check_output(['node','-e',"require('./experiments/04-kadr/campaign-data.js');require('./experiments/04-kadr/campaign.js');console.log(JSON.stringify({people:{killer:SHILO_CAMPAIGN.people.killer},scenes:Object.values(SHILO_CAMPAIGN.scenes).filter(a=>a.day===0)}));"],cwd=ROOT))
(demogame/'campaign-data.js').write_text('globalThis.SHILO_CAMPAIGN_DATA='+json.dumps(resolved,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
(demogame/'campaign.js').write_text('''/* First Thursday edition. No later-day scenes or ending outcomes are included. */
(function(root){'use strict';
const data=root.SHILO_CAMPAIGN_DATA,scenes=Object.fromEntries(data.scenes.map(a=>[a.id,a]));let H;
const line=(text,who)=>({text,who}),matches=(f,c)=>Object.entries(c||{}).every(([k,v])=>Array.isArray(v)?v.includes(f[k]):f[k]===v);
function go(s,k,n,at){H.unlock(s,k);H.go(s,k,n,at);}
function allowed(s,a){return !(a.who==='serega'&&s.flags.denied)&&!(a.who==='killer'&&(s.flags.val_mode!=='question'||s.flags.killer_mode==='refuse'));}
function boot(s){const f=s.flags;if(f.campaign)return;f.cellarFinished=true;f.finished=false;f.campaign=true;s.campaign={day:0,done:[],skipped:[],between:false,answers:{},receipts:{},reply:null};f.photo_route=f.route;f.theory_mode=f.theory_mode||(f.publicRumor?'spread':f.maratRequested?'challenge':'ignore');f.rumor_mode=f.rumor_mode||(f.publicRumor?'speculation':'contained');f.cellar_mode=f.cellarMode==='warn'?'careful':f.cellarMode==='ask'?'identify':'leave';for(const c of Object.values(s.contacts))if(c.node==='ending'){c.node='settled';c.status='available';}let at=s.now;for(const a of data.scenes.slice().sort((a,b)=>a.at-b.at)){at=Math.max(a.at,at+1);H.event(s,'story-'+a.id,at,a.who,'story:'+a.id,H.PEOPLE[a.who].name+': '+a.title+'.');}}
function receive(s,e){const a=scenes[e.node.slice(6)];if(!a)return false;if(!allowed(s,a)){s.campaign.skipped.push(a.id);return true;}s.campaign.receipts[a.id]=e.originAt??e.at;return false;}
function tick(s){if(!s.flags.campaign||s.flags.finished||s.events.length)return;const busy=Object.values(s.contacts).some(c=>c.known&&(!['settled','wait','ending'].includes(c.node)||c.pending.length));if(!busy){s.flags.demoFinished=true;s.flags.finished=true;go(s,'tomazik','book:credits');s.focus='tomazik';}}
function clean(t){return t.replace(/Марат \\(версии\\)/g,'Марат').replace(/\\[фото: ([^\\]]+)\\]/g,'На фотографии: $1.');}
function compose(s,k){const n=s.contacts[k].node,f=s.flags;if(n==='book:credits')return {title:'До седьмого',prose:'Томазик закрыл кассу. Алла поправляет красные бусы у двери. За домом темнеет река.',lines:['На сегодня всё. Завтра седьмое. Алла говорит, опять слышала — я ей сказал, пусть утром ко мне зайдёт.','Ты завтра будешь на связи?','Конец демоверсии.','История продолжится на следующий день.'],shot:'wide',place:'ЧЕТВЕРГ / ВЕЧЕР'};const a=scenes[n?.slice(6)];if(!a)return null;if(n.startsWith('reply:'))return {title:a.title,prose:'',lines:s.campaign.reply?.lines||[],shot:a.shot,place:'ЧЕТВЕРГ / '+a.place};if(!n.startsWith('story:'))return null;let lines=[...a.core];for(const v of a.variants||[])if(matches(f,v.when))lines.push(...v.lines);if(a.id==='E06'&&!s.contacts.killer.known)lines=[line('Мой заказчик опять трубку оборвал. Я тебе его номер не даю, не пугайся.'),line('Андрея Коромысло ночью убил, потом спохватился про деньги. Я кошельки нашёл, биткоины пополам поделили. Теперь считает, не продешевил ли.'),line('Если ещё хочешь спросить — спрашивай.')];if(a.id==='E06'&&f.killer_mode)lines.push(line({literal:'Вопрос получил. Всё, что нашёл. Пусть теперь хотя бы сутки не звонит.',refuse:'Правильно, что не стал передавать. Он с вопросами никогда не кончает.',confront:'Он мне на тебя жаловался. Я сказал, пусть тебе больше не звонит.'}[f.killer_mode]));if(a.who==='serega'&&s.contacts.serega.relation<0)lines.unshift(line('Я тебе ещё не всё простил. Но сейчас не об этом.'));return {title:a.title,prose:a.prose,lines:lines.map(x=>({who:x.who&&x.who!=='Система'&&x.who!==H.PEOPLE[k].name?x.who:undefined,text:clean(x.text)})),shot:a.shot,place:'ЧЕТВЕРГ / '+a.place};}
function options(s,k){const n=s.contacts[k].node;if(n==='book:credits')return [];if(n?.startsWith('reply:'))return [H.option('leave_dialogue','Закончить разговор',0,x=>{H.finish(x,k);if(k==='killer'&&x.flags.killer_mode==='refuse')x.contacts[k].status='away';})];const a=n?.startsWith('story:')&&scenes[n.slice(6)];if(!a)return null;return a.choices.map(c=>H.option('take_'+c.id,c.label,c.minutes,x=>{const f=x.flags;Object.assign(f,c.set);x.campaign.answers[a.id]=c.id;x.campaign.done.push(a.id);if(c.copyEffect?.share)f.looseCopies=(f.looseCopies||0)+1;for(const d of c.copyEffect?.relations||[])H.relation(x,a.who,d);if(a.id==='E05'&&c.set.killer_mode==='literal')f.killerForwarded=true;if(a.id==='E05'&&c.set.killer_mode==='confront')H.relation(x,'killer',-1);if(a.id==='E06'&&c.set.cross_mode==='mention'&&!f.photoVal&&f.hasPhoto){f.photoVal=true;H.fact(x,'second-val','Валерик увидел снимок','Ты передал снимок Валерику, отдельно от истории Андрея.','known','Твоё действие');}x.campaign.reply={id:a.id,prose:'',lines:[...(c.echo?[line(c.echo,'Ты')]:[]),...c.lines]};go(x,a.who,'reply:'+a.id);}));}
root.SHILO_CAMPAIGN={people:data.people,scenes,bind:h=>H=h,boot,tick,compose,options,receive,isNode:n=>n==='book:credits'||/^((story)|(reply)):[A-Z]\\d\\d$/.test(n)&&!!scenes[n.slice(6)],epilogue:()=>[]};
})(typeof window==='undefined'?globalThis:window);
''',encoding='utf-8')
cast=['serega','dok','valerik','shurik','marat','tomazik','alla','sosed','killer']
(demogame/'art').mkdir();
for name in ['cover.webp','condensed.ttf','FONT-LICENSE.txt']+[k+suffix for k in cast for suffix in ['.webp','-small.webp']]:
 if (fullgame/'art'/name).is_file():shutil.copy2(fullgame/'art'/name,demogame/'art'/name)
shutil.copytree(fullgame/'media',demogame/'media')
p=demogame/'prototype.js';s=p.read_text().replace("shilo-opening-v2","shilo-demo-v1");s=s.replace("aft.append(button('В главное меню',goHome,'next'));", "if(state.flags.demoFinished){const full=node('a','next','Открыть полную версию →');full.href='https://oprimeroman-art.github.io/krovostok-chat/experiments/04-kadr/?v=9';full.target='_blank';full.rel='noopener';aft.append(full);}aft.append(button('В главное меню',goHome,'next'));");s=s.replace('История по мотивам песен «Кровостока». 18+. Одиннадцать дней: от четверга, шестого, до воскресенья, шестнадцатого. Самостоятельные истории связаны встречами и твоими решениями. Старое сохранение можно продолжить.','Демоверсия. Первый четверг, шестое: кухня Серёги, звонки знакомых и дом у реки. Твои решения меняют этот день. Продолжение — в полной версии. Сохранения демоверсии отдельные. 18+.');p.write_text(s,encoding='utf-8')
p=demogame/'index.html';s=p.read_text().replace('<title>ШИЛО — Чужая история</title>','<title>ШИЛО — Демоверсия</title>').replace('КРИМИНАЛЬНЫЙ ГРАФИЧЕСКИЙ РОМАН</p>','КРИМИНАЛЬНЫЙ ГРАФИЧЕСКИЙ РОМАН / ДЕМОВЕРСИЯ</p>').replace('Одиннадцать дней чужих историй и твоих решений.','Первый четверг: кухня Серёги и дом у реки. Демоверсия.');p.write_text(s,encoding='utf-8')
readme='''# ШИЛО — Чужая история

{edition}

Распакуй архив целиком. Открой `index.html` в корне папки или `START.bat` на Windows.
Все изображения, музыка, шрифт и исходники входят в архив. Обязательного сервера, установки npm и сборки нет.

Для разработки и стабильного адреса сохранений: запусти в корневой папке `python -m http.server 8080` и открой http://localhost:8080/. Саму игру можно разместить на любом статическом хостинге, включая GitHub Pages. Путь игры: `experiments/04-kadr/`.

Управление: выбор мышью / 1–4, пробел — пропуск доступного ожидания. «Связи» открывают карту знакомств и передачи информации; портрет — сведения и переход к разговору. «Записи» — полученные сведения и история. Просмотр карты и записей не тратит игровое время. Настройки звука находятся в меню. Музыка на повторе, сигналы сообщений настраиваются отдельно.

Прогресс сохраняется в этом браузере. При переносе на другой домен сохранение само не переносится. Полная и демонстрационная версии используют разные ключи прогресса. Новая игра сбрасывает прогресс выбранной версии.

{contents}

Сборка v9, 28 ноября 2026. byGagarin.
'''
(FULL/'README-START.md').write_text(readme.format(edition='Полная текущая версия: одиннадцать дней, от четверга, шестого, до воскресенья, шестнадцатого. Все сюжетные маршруты текущей игры и финалы.',contents='В архиве сохранён весь проект репозитория, включая прежние эксперименты и исходные сценарии. Корневая стартовая страница направляет в актуальную игру. Прежняя корневая HTML-страница сохранена в source-materials/legacy-index.html как исходный материал. Документация и проверки текущей игры находятся в experiments/04-kadr/. Рабочая версия: https://oprimeroman-art.github.io/krovostok-chat/experiments/04-kadr/?v=9.'),encoding='utf-8')
(DEMO/'README-START.md').write_text(readme.format(edition='Демоверсия: весь первый четверг. Находка Серёги, выбор получателя снимка, окно разговора с Валериком, звонок Шурика, возможная утечка, Томазик, Алла и дом у реки. Вечерние разговоры и остановка перед следующим днём.',contents='Демонстрация содержит собственные исходники, оформление и музыку. Последующие дни, их финалы и изображения в архив не включены. Разговор с заказчиком Валерика открывается только при соответствующем решении; потому доступные персонажи и события в разных прохождениях различаются. Исходная песня — основа, знакомства и альтернативные решения — игровая адаптация. Полная версия: https://oprimeroman-art.github.io/krovostok-chat/experiments/04-kadr/?v=9.'),encoding='utf-8')
for target in (FULL,DEMO):
 archive=OUT/(target.name+'.zip')
 with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  for f in sorted(target.rglob('*')):
   if f.is_file():z.write(f,target.name+'/'+f.relative_to(target).as_posix())
 with zipfile.ZipFile(archive) as z:assert z.testzip() is None
 print(json.dumps({'archive':str(archive),'bytes':archive.stat().st_size},ensure_ascii=False))
