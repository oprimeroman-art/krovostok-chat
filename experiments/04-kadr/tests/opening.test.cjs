const assert=require('node:assert/strict');
const M=require('../opening.js');
const act=(s,id)=>{assert(M.options(s).some(o=>o.id===id),`Unavailable action ${id} at ${s.focus}/${s.contacts[s.focus].node}`);const out=M.act(s,id);assert(M.valid(out));assert(out.now>=s.now);return out;};
const open=(s,k)=>M.activate(s,k);
function setup(route='private',first='photo'){let s=M.fresh();s=act(s,first);s=act(s,'decide');s=act(s,route);s=act(s,'listen');return s;}
function until(s,predicate){let count=0;while(!predicate(s)){assert(++count<30,'No event progression');if(!M.canWait(s)){const parked=Object.keys(M.PEOPLE).find(k=>s.contacts[k].known&&['wait','settled'].includes(s.contacts[k].node));assert(parked,'No waiting position');s=open(s,parked);}assert(M.canWait(s),'No scheduled event');s=M.wait(s);}return s;}
let s=M.fresh();assert.deepEqual(Object.keys(s.contacts).filter(k=>s.contacts[k].known),['serega']);assert.equal(M.activate(s,'dok'),s);assert(!M.canWait(s));assert(M.valid(JSON.parse(JSON.stringify(s))));assert(!M.valid({version:1}));
for(const route of ['private','doctor','valerik']){s=setup(route);assert.equal(s.flags.route,route);assert.equal(s.contacts.dok.known,route==='doctor');assert.equal(s.flags.photoVal===true,route==='valerik');assert.equal(s.contacts.marat.known,false);assert.equal(s.contacts.shurik.known,false);const now=s.now;for(const k of Object.keys(M.PEOPLE)){s=open(s,k);assert.equal(s.now,now);}assert.deepEqual(M.options(s).map(o=>o.id),[]);}
// Information is different after investigation, not just differently worded.
s=M.fresh();s=act(s,'check');assert(s.facts.some(f=>f.id==='locks'));assert(!s.flags.hasPhoto);s=act(s,'photo');s=act(s,'inspect');assert(s.facts.some(f=>f.id==='photo'&&f.kind==='known'));assert(!s.flags.police);
// Scheduled callbacks happen while the player spends time elsewhere, and are kept in a queue.
s=setup('doctor','call');s=until(s,x=>x.contacts.dok.node==='doc_answer');s=open(s,'dok');s=act(s,'doc_check');assert(s.flags.docResolved);assert(s.contacts.valerik.known||s.events.some(e=>e.id==='val_offer'));assert(s.contacts.serega.unread||s.contacts.serega.pending.length);assert(s.facts.find(f=>f.id==='no-id').kind==='claim');
// Missing Valerik's window really removes the route that names Andrey.
s=M.fresh();for(const id of ['call','check','decide','doctor','listen'])s=act(s,id);s=until(s,x=>x.contacts.dok.node==='doc_answer');s=open(s,'dok');s=act(s,'doc_check');assert(s.now>=M.DEADLINE);s=open(s,'valerik');assert.equal(s.contacts.valerik.node,'val_late');assert(!M.options(s).some(o=>o.id==='question'));s=act(s,'late_leave');assert.equal(s.flags.val_mode,'missed');assert(!s.facts.some(f=>f.id==='andrey'));
// Asking in time makes that independent information available.
s=setup('valerik');s=until(s,x=>x.contacts.valerik.known&&x.contacts.valerik.node==='val_offer');s=open(s,'valerik');s=act(s,'question');assert(s.facts.some(f=>f.id==='andrey'&&f.text.includes('не установлена')));assert(s.flags.photoVal);
// Privacy and gossip have genuinely different downstream events and relationships.
function marat(choice){let x=setup('private');x=until(x,t=>t.contacts.serega.node==='ser_follow');x=open(x,'serega');x=act(x,'marat');x=act(x,'return');x=until(x,t=>t.contacts.marat.node==='marat_open');x=open(x,'marat');x=act(x,choice);x=act(x,'return');return x;}
s=marat('challenge');assert(!s.events.some(e=>e.id==='rumour'));assert(s.facts.some(f=>f.kind==='hypothesis'));assert(s.contacts.serega.relation>0);
s=marat('spread');assert(s.flags.publicRumor);s=until(s,x=>x.contacts.serega.node==='rumour');const leaked=s;assert(s.contacts.serega.relation<0);s=open(s,'serega');const repaired=act(s,'repair'),denied=act(s,'deny');assert(repaired.flags.publicRumor&&denied.flags.publicRumor);assert(repaired.contacts.serega.relation>denied.contacts.serega.relation);assert(denied.contacts.serega.relation<=-3);
// Traverse varied complete runs, including timing, all routes and conditional queues.
const coverage=new Set(),endings=new Set();let seed=97233;
function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
for(let run=0;run<600;run++){
 let x=M.fresh();
 for(let turn=0;turn<160&&!x.flags.finished;turn++){
  assert(M.valid(x));assert(x.now<1440);const known=Object.keys(M.PEOPLE).filter(k=>x.contacts[k].known);
  let tasks=known.filter(k=>M.options(x,k).length||x.contacts[k].pending.length);
  if(tasks.length){let k=tasks[Math.floor(rnd()*tasks.length)];x=open(x,k);let opts=M.options(x);if(!opts.length)continue;const o=opts[Math.floor(rnd()*opts.length)];coverage.add(o.id);const before=x.now;x=act(x,o.id);assert.equal(x.now,before+o.minutes);}
  else {const rest=known.find(k=>['wait','settled'].includes(x.contacts[k].node));assert(rest,'No resting contact');x=open(x,rest);assert(M.canWait(x),'Dead end without any action or future event');x=M.wait(x);}
  const json=JSON.stringify(x);assert(M.valid(JSON.parse(json)));assert.equal(JSON.stringify(JSON.parse(json)),json);
 }
 assert(x.flags.finished,'Run failed to reach the fragment boundary');assert(x.contacts.tomazik.known);assert.equal(x.contacts.tomazik.node,'ending');assert(x.flags.shurikResolved&&x.flags.valResolved&&x.flags.serResolved);endings.add([x.flags.route,x.flags.theory_mode,x.flags.val_mode].join('/'));
}
assert(coverage.has('repair')&&coverage.has('deny')&&coverage.has('late_request')&&coverage.has('doc_check')&&coverage.has('call')&&coverage.has('inspect'));
console.log(JSON.stringify({passed:true,completeRuns:600,actionCoverage:[...coverage].sort(),differentOutcomeCombinations:endings.size}));
