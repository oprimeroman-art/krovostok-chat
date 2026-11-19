const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=__dirname;
const ctx={window:{}};vm.createContext(ctx);
for(const f of ['story.js','second_thursday.js','next_friday.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{timeout:10000});
const s=ctx.window.KROVO_STORY, scenes=s.scenes;
assert.equal(scenes.length,126);assert.equal(new Set(scenes.map(x=>x.id)).size,126);
assert.equal(scenes[89].id,'W18');assert.equal(scenes[90].id,'H01');assert.equal(scenes[107].id,'H18');assert.equal(scenes[108].id,'R01');assert.equal(scenes[125].id,'R18');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const known=['Серёга','Шурик','Валерик','Док','Без имени','Марат (версии)','Томазик','Алла','Старый','Бармен','Восемь','Колян','Лёха (деревня)','Гаражи','Сонный','Архив','Лоси','Мастер','Капитан','Столовая','Димон','Оля','Стрелок'];
const knownSet=new Set(known);
for(const who of known)assert(app.includes("'"+who+"':"),`CONTACTS missing ${who}`);
for(const scene of scenes.slice(108)){
 assert.equal(scene.choices.length,3,`${scene.id} choices`);
 assert(knownSet.has(scene.chat),`${scene.id} missing scene contact: ${scene.chat}`);
 assert(scene.core.length>=3,`${scene.id} core`);
 assert(scene.choices.map(x=>x.id).join()==='A,B,C');
 const keys=new Set();
 for(const choice of scene.choices){assert(choice.echo&&choice.title&&choice.lines.length>0);assert.equal(Object.keys(choice.set).length,1);Object.keys(choice.set).forEach(x=>keys.add(x));for(const evt of choice.lines){assert(knownSet.has(evt.who),`unknown ${evt.who} in ${scene.id}`);if(evt.kind==='forward')assert(evt.from&&evt.sent_by==='me')}}
 assert.equal(keys.size,1,`${scene.id} flags mismatch`);
 for(const evt of scene.core)assert(knownSet.has(evt.who));
 for(const v of scene.variants||[]){assert(v.when&&v.lines);for(const evt of v.lines)assert(knownSet.has(evt.who),`${scene.id} v unknown ${evt.who}`)}
}
assert(app.includes("'W18','H18'].includes"),'migration does not include H18');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(index.indexOf('story.js')<index.indexOf('second_thursday.js'));
assert(index.indexOf('second_thursday.js')<index.indexOf('next_friday.js'));
assert(index.indexOf('next_friday.js')<index.indexOf('app.js'));
for(let route=0;route<3;route++){
 const flags={head_first:'police',thursday_end:'report',master_location:'warn'};
 let forwards=0,variants=0;
 for(const scene of scenes.slice(108)){
  const choice=scene.choices[route];Object.assign(flags,choice.set);
  forwards+=choice.lines.filter(e=>e.kind==='forward').length;
  for(const v of scene.variants||[])if(Object.entries(v.when).every(([k,val])=>flags[k]===val))variants++;
 }
 assert.equal(Object.keys(flags).length,21); // 3 earlier + 18 added
 assert(flags.friday_end);
 console.log(`route ${route+1}: 18 decisions, ${forwards} forwards, ${variants} conditionals; end=${flags.friday_end}`);
}
console.log('PASS 126 scenes / 378 replies / 23 contacts / module ordering / completed-save migration');
