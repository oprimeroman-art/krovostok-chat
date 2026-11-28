const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const OUT=process.env.SHILO_QA_DIR||path.join(os.tmpdir(),'shilo-qa');fs.mkdirSync(OUT,{recursive:true});
const root=path.resolve(__dirname,'..');
const M=require(root+'/opening.js'),C=globalThis.SHILO_CAMPAIGN;
const hits={},nodes=new Set(),ends={},witness={},routes=[];
let seed=1234567;function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
const pref=['photo','decide','private','listen','contain','quiet','truth','return','warn','host_no','alla_close','privacy','report','end'];
function run(plan,max=1600,forced={}){let s=M.fresh(),steps=0;
 for(;steps<max&&!s.flags.finished;steps++){
  assert(M.valid(s),'Invalid save at '+s.now);const tasks=Object.keys(M.PEOPLE).filter(k=>s.contacts[k].known&&(M.options(s,k).length||s.contacts[k].pending.length));
  if(tasks.length){const k=plan%4===3?tasks[Math.floor(random()*tasks.length)]:tasks[0];const before=s.now;s=M.activate(s,k);assert.equal(s.now,before);const os=M.options(s);if(!os.length)continue;
   const n=s.contacts[k].node;nodes.add(n);let o;
   if(forced[n])o=os.find(x=>x.id===forced[n]);
   else if(n?.startsWith('story:')||n==='book:closing')o=os.slice().sort((a,b)=>(hits[n+'/'+a.id]||0)-(hits[n+'/'+b.id]||0)||((plan%3===0?os.indexOf(a):plan%3===1?-os.indexOf(a):random()-.5)-(plan%3===0?os.indexOf(b):plan%3===1?-os.indexOf(b):0)))[0];
   else if(n==='route')o=os.find(x=>x.id===['private','doctor','valerik'][plan%3]);
   else if(n==='ser_follow')o=os.find(x=>x.id===(plan%3?'marat':'contain'));
   else if(n==='marat_open')o=os.find(x=>x.id===['challenge','spread','ignore'][plan%3]);
   else if(n==='rumour')o=os.find(x=>x.id===(plan%2?'deny':'repair'));
   else if(n==='val_offer')o=os.find(x=>x.id===(plan%3?'question':'quiet'));
   else o=pref.map(id=>os.find(x=>x.id===id)).find(Boolean)||os[plan%os.length];
   assert(o);hits[n+'/'+o.id]=(hits[n+'/'+o.id]||0)+1;
   if(n?.startsWith('story:')&&!witness[n])witness[n]=structuredClone(s);
   const snap=JSON.stringify(M.describe(s));assert.equal(JSON.stringify(M.describe(s)),snap);
   const now=s.now;s=M.act(s,o.id);assert.equal(s.now,now+o.minutes);
   const text=JSON.stringify(M.describe(s));assert(!/undefined|NaN/.test(text),n+' corrupt prose');
  }else{const k=Object.keys(s.contacts).find(k=>s.contacts[k].known&&['wait','settled','alla_gone'].includes(s.contacts[k].node));assert(k,'No resting contact');s=M.activate(s,k);assert(M.canWait(s),'Dead end '+JSON.stringify({now:s.now,flags:s.flags,contacts:Object.fromEntries(Object.entries(s.contacts).filter(([,c])=>c.known).map(([k,c])=>[k,{node:c.node,pending:c.pending}]))}));const now=s.now;s=M.wait(s);assert(s.now>=now);}
  if(steps%35===0){const restored=M.restore(JSON.parse(JSON.stringify(s)));assert(restored,'Restore failed');assert.equal(JSON.stringify(M.describe(restored)),JSON.stringify(M.describe(s)));s=restored;}
 }
 assert(s.flags.finished,'Campaign never finished '+plan);assert.equal(s.contacts[s.focus].node,'book:credits');assert.equal(s.contacts[s.focus].status,'available');assert(!JSON.stringify(M.describe(s)).includes('ПОСЛЕ ПОЛУНОЧИ'));assert.equal(s.campaign.day,10);assert(!s.events.length);assert(Object.values(s.contacts).every(c=>!c.pending.length));
 for(const k of ['finalChoice','cellarFate','sleepFate','masterFate','pawnFate','coastFate','fireFate','olyaFate']){ends[k]||=new Set();ends[k].add(s.flags[k]??'unseen');}
 routes.push({plan,steps,day:s.campaign.day,choices:s.campaign.done.length,known:Object.values(s.contacts).filter(c=>c.known).length});return s;
}
try{for(let i=0;i<24;i++)run(i);
 run(24,1600,{"story:K02":"take_C","story:K05":"take_A","story:U03":"take_C","story:U06":"take_B","story:R07":"take_C","story:R11":"take_A"});
 let actions=0;for(const [node,s]of Object.entries(witness))for(const o of M.options(s)){const out=M.act(s,o.id);assert(M.valid(out));assert.equal(out.now,s.now+o.minutes);const scene=C.scenes[node.slice(6)],choice=scene.choices.find(c=>'take_'+c.id===o.id);if(choice)for(const [k,v]of Object.entries(choice.set))assert.equal(out.flags[k],v);actions++;}
 for(const [key,expected]of Object.entries({finalChoice:['stay','leave','archive'],cellarFate:['alive','gone','unknown'],sleepFate:['away','dead','stopped'],masterFate:['found','searched','missing'],pawnFate:['avoided','out','inside'],coastFate:['warned','trace','left'],fireFate:['saved','injured','late'],olyaFate:['together','missed','late']}))for(const value of expected)assert(ends[key].has(value),key+' missing '+value);
 const missing=Object.keys(C.scenes).filter(id=>!nodes.has('story:'+id));assert.deepEqual(missing,[],'Unvisited scenes');
 const result={passed:true,routes:routes.length,scenes:Object.keys(witness).length,branchActions:actions,ends:Object.fromEntries(Object.entries(ends).map(([k,v])=>[k,[...v]])),routesDetail:routes};fs.writeFileSync(path.join(OUT,'campaign-result.json'),JSON.stringify(result,null,2));fs.writeFileSync(path.join(OUT,'witness.json'),JSON.stringify(witness));console.log(JSON.stringify(result));
}catch(e){fs.writeFileSync(path.join(OUT,'failure.txt'),e.stack);throw e;}
