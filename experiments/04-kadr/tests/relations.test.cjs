const assert=require('node:assert/strict');
const M=require('../opening.js');require('../relations.js');const R=globalThis.SHILO_RELATIONS;
let s=M.fresh(),before=JSON.stringify(s);let g=R.graph(s);assert.deepEqual(g.known,['serega']);assert.equal(g.edges.length,1);assert.equal(JSON.stringify(s),before);
s=M.act(s,'photo');before=JSON.stringify(s);R.graph(s);assert.equal(JSON.stringify(s),before);
// Every subset of already met people must omit unknown endpoints, even if their introducer is absent.
const all=Object.keys(M.PEOPLE);for(let n=1;n<=all.length;n++){
 const t=structuredClone(s);all.forEach((k,i)=>t.contacts[k].known=i<n);const save=JSON.stringify(t);g=R.graph(t);const expected=all.slice(0,n);assert.deepEqual(g.known,expected);for(const e of g.edges){assert(expected.includes(e.to));assert(e.from==='you'||expected.includes(e.from));}const layout=R.positions(['you',...g.known],g.edges);assert(layout.box.every(Number.isFinite));for(const p of Object.values(layout.pos))assert(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.equal(JSON.stringify(t),save);
}
console.log(JSON.stringify({passed:true,newGameOnlySerega:true,knownContactSubsets:all.length,readOnly:true}));
