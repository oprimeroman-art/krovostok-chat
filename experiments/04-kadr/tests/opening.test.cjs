const assert=require('node:assert/strict');
const M=require('../opening.js');
const act=(s,id)=>{assert(M.options(s).some(o=>o.id===id),`Unavailable action ${id} at ${s.focus}/${s.contacts[s.focus].node}`);const out=M.act(s,id);assert(M.valid(out));assert(out.now>=s.now);return out;};
const open=(s,k)=>M.activate(s,k);
function setup(route='private',first='photo'){let s=M.fresh();s=act(s,first);s=act(s,'decide');s=act(s,route);s=act(s,'listen');return s;}
function until(s,predicate){let count=0;while(!predicate(s)){assert(++count<30,'No event progression');if(!M.canWait(s)){const parked=Object.keys(M.PEOPLE).find(k=>s.contacts[k].known&&['wait','settled'].includes(s.contacts[k].node));if(!parked){const k=Object.keys(M.PEOPLE).find(k=>s.contacts[k].known&&M.options(s,k).length);assert(k,'No waiting position');s=open(s,k);const opts=M.options(s),preferred=['contain','quiet','truth','ignore','return','listen','late_leave'].map(id=>opts.find(o=>o.id===id)).find(Boolean)||opts[0];s=act(s,preferred.id);continue;}s=open(s,parked);}assert(M.canWait(s),'No scheduled event');s=M.wait(s);}return s;}
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
// Dialogue must not assume a question that was never asked or knowledge never sent.
let clean=setup('private','call');clean=M.activate(clean,'serega');assert(!clean.flags.hasPhoto);assert(!JSON.stringify(M.describe(clean)).includes('ты тоже это видишь'));
let inspection=M.fresh();inspection=act(inspection,'photo');inspection=act(inspection,'inspect');assert(!inspection.flags.details);assert(!JSON.stringify(M.describe(inspection)).includes('замок'));
let intro=setup('private');intro=until(intro,x=>x.contacts.shurik.known);intro=M.activate(intro,'shurik');assert(JSON.stringify(M.describe(intro)).includes('долги'));intro=act(intro,'friendly');intro=act(intro,'return');intro=until(intro,x=>x.contacts.shurik.node==='shurik_return');assert(JSON.stringify(M.describe(intro)).includes('похоже, не Димон'));
// A received scene stays unchanged if information is sent or learned elsewhere later.
let fixed=setup('doctor');fixed=until(fixed,x=>x.contacts.serega.node==='ser_follow');const received=structuredClone(M.describe(fixed,'serega'));assert(!fixed.flags.docTold);fixed=M.activate(fixed,'dok');fixed=act(fixed,'doc_accept');assert(fixed.flags.docTold);assert.deepEqual(M.describe(fixed,'serega'),received);assert.deepEqual(M.describe(JSON.parse(JSON.stringify(fixed)),'serega'),received);
// Inspecting after a route must offer a logical end to this same conversation.
for(const route of ['private','doctor','valerik']){let x=M.fresh();for(const id of ['photo','decide',route,'check','inspect'])x=act(x,id);assert(!M.options(x).some(o=>/Вернуться к Серёге/.test(o.label)));assert(M.options(x).some(o=>o.id==='decide'&&/Держи в курсе/.test(o.label)));x=act(x,'decide');assert.equal(x.contacts.serega.node,'settled');}
// Song facts outrank domestic details invented by the old chat draft.
const firstMorning=JSON.stringify(M.describe(M.fresh()));assert(/водки/.test(firstMorning)&&/триста/.test(firstMorning));assert(!/чайник|макарон/i.test(firstMorning));
let debts=M.activate(intro,'shurik');debts=structuredClone(debts);debts.contacts.shurik.node='shurik_open';debts.contacts.shurik.history=[];debts=act(debts,'ask');const debtText=JSON.stringify(M.describe(debts));assert(/прощения прошу/.test(debtText));assert(!/пусть считает, что квиты/.test(debtText));
// All principal combinations: initial action, recipient, doctor decision, response choices and gossip result.
const coverage=new Set(),endings=new Set();let completeRuns=0;
const resolutions=[{ser:'contain'},{ser:'leave'},{ser:'marat',theory:'challenge'},{ser:'marat',theory:'ignore'},{ser:'marat',theory:'spread',rumour:'repair'},{ser:'marat',theory:'spread',rumour:'deny'}];
function runPlan(cfg){let x=M.fresh();x=act(x,cfg.first);x=act(x,'decide');x=act(x,cfg.route);x=act(x,'listen');
 for(let turn=0;turn<180&&!x.flags.finished;turn++){
  assert(M.valid(x));const known=Object.keys(M.PEOPLE).filter(k=>x.contacts[k].known),tasks=known.filter(k=>M.options(x,k).length||x.contacts[k].pending.length);
  if(tasks.length){x=M.activate(x,tasks[0]);const opts=M.options(x);if(!opts.length)continue;const current=x.contacts[x.focus].node;
   const preferred={doc_answer:cfg.doc,ser_follow:cfg.ser,val_offer:cfg.val,val_late:'late_request',shurik_open:cfg.shurik,marat_open:cfg.theory,rumour:cfg.rumour,shop:'end'}[current];
   const o=preferred?opts.find(o=>o.id===preferred):opts.find(o=>o.id==='return')||opts.find(o=>o.id==='hold_debt')||opts.at(-1);assert(o,JSON.stringify({cfg,current,opts:opts.map(o=>o.id)}));coverage.add(o.id);
   assert(!opts.some(o=>o.label.includes('Вернуться к '+M.PEOPLE[x.focus].name)),'Self-navigation');
   if(current==='shop')assert(M.ready(x),'Premature boundary');
   const before=x.now;x=act(x,o.id);assert.equal(x.now,before+o.minutes);
  }else{const rest=known.find(k=>['wait','settled'].includes(x.contacts[k].node));assert(rest,'No resting contact');x=M.activate(x,rest);assert(M.canWait(x),'Dead end');x=M.wait(x);}
  const json=JSON.stringify(x);assert(M.valid(JSON.parse(json)));assert.deepEqual(M.describe(JSON.parse(json)),M.describe(x));
 }
 assert(x.flags.finished,'Run did not finish: '+JSON.stringify(cfg));assert(M.ready(x));assert.equal(x.contacts.tomazik.node,'ending');assert(Object.values(x.contacts).every(c=>!c.pending.length));if(cfg.route==='private')assert(!x.contacts.dok.known);if(cfg.ser!=='marat')assert(!x.contacts.marat.known);if(x.flags.theory_mode==='spread')assert(x.flags.publicRumor&&x.flags.rumorHandled);if(cfg.rumour==='deny')assert(x.contacts.serega.relation<=-3);if(cfg.rumour==='repair')assert(x.flags.stopReshare);completeRuns++;endings.add([x.flags.route,x.flags.theory_mode,x.flags.val_mode,x.flags.shurik_mode,x.flags.denied,x.flags.docRecheck].join('/'));
}
for(const first of ['photo','check','call'])for(const route of ['private','doctor','valerik'])for(const doc of route==='doctor'?['doc_accept','doc_check']:['doc_accept'])for(const resolution of resolutions)for(const val of ['quiet','question','relay'])for(const shurik of ['truth','ask','friendly'])runPlan({first,route,doc,...resolution,val,shurik});
assert.equal(completeRuns,648);
assert(coverage.has('repair')&&coverage.has('deny')&&coverage.has('late_request')&&coverage.has('doc_check'));
console.log(JSON.stringify({passed:true,completeRuns,actionCoverage:[...coverage].sort(),differentOutcomeCombinations:endings.size,dialogueContinuityChecks:true}));
