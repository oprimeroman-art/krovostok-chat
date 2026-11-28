const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const M=require('../opening.js'),D=require('../details.js'),C=globalThis.SHILO_CAMPAIGN;
const out=process.env.SHILO_QA_DIR||path.join(os.tmpdir(),'shilo-qa'),witness=JSON.parse(fs.readFileSync(path.join(out,'witness.json')));
const plans={groceries:[['unfold'],['check']],matchbox:[['slide',100],['look']],barphone:[['screen'],['bill'],['compare']],transfers:[['first'],['second'],['bill'],['compare']],cassette:[['seek',0],['seek',1],['seek',2],['mark']],tickets:[['slide',100],['check']],hotelkey:[['wipe'],['turn'],['check']]};
let shop=M.fresh();const pref=['photo','decide','private','listen','contain','quiet','truth','return','end'];for(let i=0;i<150&&shop.contacts.tomazik.node!=='shop';i++){const tasks=Object.keys(M.PEOPLE).filter(k=>shop.contacts[k].known&&(M.options(shop,k).length||shop.contacts[k].pending.length));if(tasks.length){shop=M.activate(shop,tasks[0]);const opts=M.options(shop),o=pref.map(id=>opts.find(o=>o.id===id)).find(Boolean)||opts[0];if(o)shop=M.act(shop,o.id);}else{const k=Object.keys(M.PEOPLE).find(k=>shop.contacts[k].known&&['settled','wait','alla_gone'].includes(shop.contacts[k].node));shop=M.activate(shop,k);assert(M.canWait(shop));shop=M.wait(shop);}}
assert.equal(shop.contacts.tomazik.node,'shop');shop=M.activate(shop,'tomazik');
const samples={groceries:shop,matchbox:witness['story:S02'],barphone:witness['story:S06'],transfers:witness['story:M10'],cassette:witness['story:W02'],tickets:witness['story:R02'],hotelkey:witness['story:K15']},completed={};
assert.deepEqual(D.available(M.fresh()),[]);assert.equal(D.act(M.fresh(),'matchbox','open').details,undefined);
for(const [id,plan]of Object.entries(plans)){
 let s=structuredClone(samples[id]);assert(D.available(s).includes(id));const time=s.now,flags=JSON.stringify(s.flags),events=JSON.stringify(s.events),options=M.options(s).map(o=>[o.id,o.minutes]);s=D.act(s,id,'open');assert(M.valid(s));const premature=D.act(s,id,plan.at(-1)[0],plan.at(-1)[1]);assert.equal(premature,s,'Completion gate bypass: '+id);
 for(const [action,value]of plan)s=D.act(s,id,action,value);
 assert(D.item(s,id).done,id+' did not complete');assert.equal(s.now,time);assert.equal(JSON.stringify(s.flags),flags);assert.equal(JSON.stringify(s.events),events);assert.deepEqual(M.options(s).map(o=>[o.id,o.minutes]),options);assert.equal(s.facts.filter(f=>f.id==='object-'+id).length,1);
 const restored=M.restore(JSON.parse(JSON.stringify(s)));assert(restored);assert.deepEqual(restored.details,s.details);assert.equal(D.act(s,id,'open'),s);assert.equal(D.act(s,id,plan.at(-1)[0],plan.at(-1)[1]),s);completed[id]=s;
}
const followups={matchbox:['story:S04','коробок'],barphone:['story:M10','вместе смотрели'],cassette:['story:W15','сам до конца'],tickets:['story:R11','ты сам видел'],hotelkey:['story:K17','тоже разглядел']};
for(const [id,[n,text]]of Object.entries(followups)){const s=structuredClone(witness[n]);s.details=completed[id].details;assert(JSON.stringify(C.compose(s,s.focus)).includes(text),'Missing later response: '+id);}
fs.writeFileSync(path.join(out,'details-witness.json'),JSON.stringify({samples,completed}));console.log(JSON.stringify({passed:true,activities:Object.keys(plans).length,followups:Object.keys(followups).length,saves:true,noTimeOrPlotChanges:true,noDuplicates:true}));
