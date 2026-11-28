const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const M=require('../opening.js'),C=globalThis.SHILO_CAMPAIGN;
const fixtures=JSON.parse(fs.readFileSync(path.join(process.env.SHILO_QA_DIR||path.join(require('node:os').tmpdir(),'shilo-qa'),'witness.json')));
let tested=0;
for(const [parent,child,who,decline]of [['M03','M04','sonny','C'],['W01','W02','archive','C'],['H01','H04','master','B'],['R03','R04','strelok','B']]){
 for(const accept of [true,false]){
  let s=structuredClone(fixtures['story:'+parent]),k=s.focus,until=C.scenes[child].at;
  while(s.now<until){const parked=Object.keys(s.contacts).find(id=>s.contacts[id].known&&id!==k&&['settled','wait'].includes(s.contacts[id].node));assert(parked);s=M.activate(s,parked);assert(M.canWait(s));s=M.wait(s);}
  assert(s.campaign.deferred.some(e=>e.node==='story:'+child));assert(!s.campaign.skipped.includes(child));
  s=M.activate(s,k);s=M.act(s,'take_'+(accept?'A':decline));s=M.act(s,'leave_dialogue');
  assert(!s.campaign.deferred.some(e=>e.node==='story:'+child));
  for(let n=0;n<10&&!s.contacts[who].known;n++){const parked=Object.keys(s.contacts).find(id=>s.contacts[id].known&&['settled','wait'].includes(s.contacts[id].node));s=M.activate(s,parked);if(!M.canWait(s))break;s=M.wait(s);}
  if(accept){assert(s.contacts[who].known,parent);assert.equal(s.contacts[who].node,'story:'+child);assert(M.options(s,who).length);assert(M.restore(JSON.parse(JSON.stringify(s))));}
  else{assert(!s.contacts[who].known,parent);assert(s.campaign.skipped.includes(child));}
  tested++;
 }
}

// Accepting while a later event is due must still introduce the character first.
for(const [parent,child,next,who]of [['M03','M04','M07','sonny'],['W01','W02','W06','archive'],['H01','H04','H07','master'],['R03','R04','R08','strelok']]){
 let s=structuredClone(fixtures['story:'+parent]),k=s.focus,until=C.scenes[next].at-1;
 while(s.now<until){const parked=Object.keys(s.contacts).find(id=>s.contacts[id].known&&id!==k&&['settled','wait'].includes(s.contacts[id].node));s=M.activate(s,parked);const event=M.nextEvent(s);assert(event);if(event.at>=until){s.now=until;break;}s=M.wait(s);}
 s=M.activate(s,k);s=M.act(s,'take_A');assert.equal(s.contacts[who].node,'story:'+child,parent);assert(M.valid(s));tested++;
}
console.log(JSON.stringify({passed:true,delayedIntroductions:tested}));
// Missing an actual deadline changes available actions and consequences, without rewinding time.
for(const [id,until]of [['K02',9*1440+9*60+17],['M04',4*1440+18*60+3]]){
 let s=structuredClone(fixtures['story:'+id]),who=s.focus;
 while(s.now<until){const k=Object.keys(s.contacts).find(k=>s.contacts[k].known&&k!==who&&['settled','wait'].includes(s.contacts[k].node));assert(k);s=M.activate(s,k);assert(M.canWait(s));s=M.wait(s);}
 const time=s.now;s=M.activate(s,who);assert.equal(s.now,time);const os=M.options(s);
 if(id==='K02'){assert(!os.some(o=>o.id==='take_A'));s=M.act(s,'take_B');assert(s.flags.pawnLate);}
 else{assert.deepEqual(os.map(o=>o.id),['take_C']);assert(os[0].hint);s=M.act(s,'take_C');assert.equal(s.flags.sleep_plan,'stay');}
 assert(M.valid(s));
}
console.log(JSON.stringify({passed:true,expiredWindows:2}));
