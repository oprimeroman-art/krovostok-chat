const assert=require('node:assert/strict'),M=require('../opening.js');
function take(s,id){const o=M.options(s).find(o=>o.id===id);assert(o,`${id} is unavailable at ${s.focus}/${s.contacts[s.focus].node}`);const n=M.act(s,id);assert(M.valid(n));assert.equal(n.now,s.now+o.minutes);return n;}
function firstShop(){let s=M.fresh();for(let n=0;n<160&&s.contacts.tomazik.node!=='shop';n++){const tasks=Object.keys(M.PEOPLE).filter(k=>s.contacts[k].known&&M.options(s,k).length);if(tasks.length){s=M.activate(s,tasks[0]);const os=M.options(s),preferred=['photo','decide','private','listen','contain','quiet','truth','return','late_leave'].map(id=>os.find(o=>o.id===id)).find(Boolean)||os.at(-1);s=take(s,preferred.id);}else{const k=Object.keys(M.PEOPLE).find(k=>s.contacts[k].known&&['settled','wait','alla_gone'].includes(s.contacts[k].node));assert(k);s=M.activate(s,k);assert(M.canWait(s));s=M.wait(s);}}assert.equal(s.contacts.tomazik.node,'shop');return M.activate(s,'tomazik');}
// Old completed fragments can continue without replaying their decisions.
let old=firstShop();delete old.contacts.alla;delete old.contacts.sosed;old.contacts.tomazik.node='ending';old.flags.finished=true;let migrated=M.restore(old);assert(migrated&&migrated.flags.finished);assert.equal(migrated.now,old.now);assert(M.options(migrated).some(o=>o.id==='continue_story'));migrated=take(migrated,'continue_story');assert.equal(migrated.contacts.tomazik.node,'shop');assert(!migrated.flags.finished);
// Warning prevents the trip; gossip delays a requested introduction.
let base=firstShop(),warn=take(base,'warn');assert(warn.flags.allaWarned);assert(!warn.events.some(e=>e.id==='alla_deadline'));let ask=take(base,'contact');base.flags.publicRumor=true;base.flags.rumorHandled=true;let delayed=take(base,'contact');assert(delayed.events.find(e=>e.id==='alla_contact').at>ask.events.find(e=>e.id==='alla_contact').at);
const coverage=new Set();let seed=39817;function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
for(let run=0;run<900;run++){
 let s=firstShop();if(run%2){s.flags.publicRumor=true;s.flags.rumorHandled=true;}const start=['warn','contact','leave_shop'][run%3];s=take(s,start);coverage.add(start);
 for(let step=0;step<240&&!s.flags.cellarFinished;step++){
  const known=Object.keys(M.PEOPLE).filter(k=>s.contacts[k].known),tasks=known.filter(k=>M.options(s,k).length||s.contacts[k].pending.length);
  if(tasks.length){s=M.activate(s,tasks[Math.floor(rand()*tasks.length)]);const opts=M.options(s);if(!opts.length)continue;const o=opts[Math.floor(rand()*opts.length)];coverage.add(o.id);s=take(s,o.id);}
  else{const k=known.find(k=>['settled','wait','alla_gone'].includes(s.contacts[k].node));assert(k);s=M.activate(s,k);assert(M.canWait(s),JSON.stringify({nodes:Object.fromEntries(known.map(k=>[k,s.contacts[k].node])),flags:s.flags,events:s.events}));s=M.wait(s);}
  assert(M.valid(s));assert.equal(JSON.stringify(M.restore(JSON.parse(JSON.stringify(s)))),JSON.stringify(s));
 }
 assert(s.flags.campaign&&s.flags.cellarFinished,JSON.stringify({run,nodes:Object.fromEntries(Object.entries(s.contacts).map(([k,c])=>[k,c.node])),flags:s.flags,events:s.events}));assert(Object.values(s.contacts).every(c=>!c.pending.length));assert(s.flags.allaResolved&&s.flags.tomResolved);if(s.contacts.sosed.known)assert(s.flags.hostResolved);if(s.flags.heardName)assert(s.facts.some(f=>f.id==='shompol'));if(s.flags.allaRefused)assert.notEqual(s.flags.cellarEnding,'watch');
}
for(const action of ['noise','visit','warn_alla','host_call','host_no','food','direct','wrong','privacy','defend','report','watch','drop'])assert(coverage.has(action),'Missing action '+action);
console.log(JSON.stringify({passed:true,completeRuns:900,coverage:[...coverage].sort(),oldSaveContinues:true}));
