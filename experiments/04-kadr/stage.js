(()=>{
'use strict';
const E=id=>document.getElementById(id), canvas=E('art'),ctx=canvas.getContext('2d');
let selected='',frame=0,lastCount=-1;let tone={base:'#1a1b18',light:'#cab89b',accent:'#b64632'},dimensions={w:0,h:0};
const palettes=[['#151915','#cfc5ac','#a54132'],['#16191b','#97b1ab','#ba583e'],['#24201c','#b0aa85','#c65d38'],['#181718','#aaa39c','#a6423a'],['#1c2020','#94afa4','#be653c'],['#201b18','#aaa18b','#943b35']];
function nameSeed(name){let x=0;for(const c of name)x=(x*37+c.charCodeAt(0))>>>0;return x}
function colorFor(name){const colors=palettes[nameSeed(name)%palettes.length];return{base:colors[0],light:colors[1],accent:colors[2]}}
function cover(size){const dpr=Math.min(2,window.devicePixelRatio||1);const w=window.innerWidth,h=window.innerHeight;canvas.width=Math.floor(w*dpr);canvas.height=Math.floor(h*dpr);canvas.style.width=w+'px';canvas.style.height=h+'px';ctx.setTransform(dpr,0,0,dpr,0,0);dimensions={w,h};}
function paint(){const {w,h}=dimensions;if(!w||!h)return;const seed=nameSeed(selected||'Серёга');const c=tone;ctx.clearRect(0,0,w,h);ctx.fillStyle=c.base;ctx.fillRect(0,0,w,h);
  // Hard screenprint shapes and offset inks: a deliberately non-photographic stage.
  const portraitW=Math.min(w*.53,h*.79),cx=w<850?w*.42:w*.205,cy=w<850?h*.29:h*.53;ctx.save();ctx.translate(cx,cy);let scale=portraitW/340;ctx.scale(scale,scale);ctx.rotate(Math.sin(seed)*.10);
  ctx.globalAlpha=.5;ctx.fillStyle=c.accent;ctx.beginPath();ctx.moveTo(-250,-260);ctx.lineTo(100,-275);ctx.lineTo(175,270);ctx.lineTo(-200,260);ctx.closePath();ctx.fill();
  ctx.globalAlpha=1;ctx.fillStyle='#070909';ctx.beginPath();ctx.moveTo(-175,280);ctx.bezierCurveTo(-152,130,-130,138,-96,105);ctx.bezierCurveTo(-169,65,-154,-90,-82,-135);ctx.bezierCurveTo(-52,-192,20,-193,61,-147);ctx.bezierCurveTo(110,-95,103,-62,82,-27);ctx.bezierCurveTo(108,-4,105,19,76,36);ctx.bezierCurveTo(83,87,46,135,23,151);ctx.bezierCurveTo(82,162,135,165,154,280);ctx.closePath();ctx.fill();
  ctx.fillStyle=c.light;ctx.beginPath();ctx.moveTo(-78,-144);ctx.bezierCurveTo(-15,-200,100,-124,86,-47);ctx.lineTo(118,-4);ctx.lineTo(87,12);ctx.lineTo(76,66);ctx.bezierCurveTo(56,129,16,129,-24,103);ctx.lineTo(-52,26);ctx.closePath();ctx.fill();
  ctx.fillStyle=c.base;ctx.beginPath();ctx.moveTo(-79,-139);ctx.bezierCurveTo(-36,-159,-15,-114,35,-112);ctx.lineTo(59,-74);ctx.lineTo(31,-86);ctx.lineTo(24,-40);ctx.lineTo(-37,-25);ctx.closePath();ctx.fill();
  ctx.fillStyle='#111310';ctx.beginPath();ctx.moveTo(27,-42);ctx.lineTo(70,-44);ctx.lineTo(65,-38);ctx.lineTo(29,-36);ctx.closePath();ctx.fill();ctx.fillRect(24,61,57,4);
  ctx.fillStyle=c.accent;ctx.globalAlpha=.75;ctx.fillRect(-125,-87,35,214);ctx.fillRect(68,118,19,63);ctx.globalAlpha=1;
  // Contact-specific cuts: change geometry as well as color.
  const cut=seed%4;ctx.fillStyle=c.base;if(cut===1){ctx.fillRect(-142,-128,55,58);ctx.fillRect(39,-148,53,23)}if(cut===2){ctx.beginPath();ctx.moveTo(-82,-170);ctx.lineTo(5,-220);ctx.lineTo(68,-150);ctx.fill()}if(cut===3){ctx.fillRect(-30,153,113,22);ctx.fillRect(-108,-132,45,91)}
  ctx.restore();
  // Offset ruled print marks in margins.
  ctx.globalAlpha=.65;ctx.strokeStyle=c.accent;ctx.lineWidth=2;for(let i=0;i<13;i++){let y=h*.06+i*37;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(Math.min(95,20+(i*13)%90),y);ctx.stroke()}ctx.globalAlpha=1;
  // Rough raster particles, deterministic, no image-generation assets.
  for(let i=0;i<750;i++){let x=(i*179+seed*7)%w,y=(i*311+seed*13)%h;ctx.fillStyle=i%4===0?'#e8d8c0':'#080b08';ctx.globalAlpha=(i%9)/95;ctx.fillRect(x,y,1+(i%3),1+(i%2))}ctx.globalAlpha=1;
  ctx.strokeStyle='#ffffff19';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(w*.41,0);ctx.lineTo(w*.41,h);ctx.stroke();
  ctx.fillStyle=c.accent;ctx.fillRect(0,h-8,Math.max(16,w*.13),8);
}
function words(v){return String(v||'').replace(/\[фото:[^\]]+\]/gi,'Фотография').trim()}
function render(){const api=window.KROVO_DEBUG;if(!api)return;const state=api.getState(),scene=window.KROVO_STORY.scenes[state.scene];if(!scene)return;
 const chat=state.active||scene.chat,related=state.messages.filter(m=>m.chat===chat&&m.type!=='sys');const current=related[related.length-1],prev=related[related.length-2];
 if(selected!==chat){selected=chat;tone=colorFor(chat);E('backgroundWord').textContent=chat.toUpperCase();paint();}
 E('chapter').textContent=(scene.title||'').replace(/\\s+/g,' ').toUpperCase();
 E('speaker').textContent=current?.mine?'ВЫ':(current?.who||chat);
 E('clock').textContent=current?.time||'';
 E('line').textContent=current?.type==='media'?'ФОТОГРАФИЯ.':(words(current?.text)||'Здесь пока тихо.');
 E('line').className='say'+(E('line').textContent.length>170?' long':E('line').textContent.length>85?' medium':'');
 if(current?.type==='forward'){E('speaker').textContent='ПЕРЕСЛАНО · '+(current.forwardedFrom||chat)}
 const previousText=prev&&prev.text?words(prev.text):'';
 E('previous').textContent=previousText.length>135?previousText.slice(0,135)+'…':previousText;
 E('count').textContent=String(state.scene+1).padStart(2,'0')+' / '+window.KROVO_STORY.scenes.length;
 const typing=state.stage==='intro'||state.stage==='reply'||state.stage==='transition';E('stageTyping').hidden=!typing;
 E('prompt').textContent=state.stage==='choice'&&state.active===scene.chat?'ТВОЙ ХОД':state.stage==='ended'?'ИСТОРИЯ ЗАВЕРШЕНА':state.stage==='choice'?'ОТКРОЙ ДИАЛОГ: '+scene.chat:'СЛУШАЙ';
 const choices=E('choices');choices.replaceChildren();
 if(state.stage==='choice'&&state.active===scene.chat){scene.choices.forEach((opt,i)=>{const b=document.createElement('button');b.className='response';b.type='button';const num=document.createElement('span');num.className='index';num.textContent='0'+(i+1);const answer=document.createElement('span');answer.className='answer';answer.textContent=opt.echo;b.append(num,answer);b.addEventListener('click',()=>api.choose(i));choices.append(b)})}
 if(state.stage==='ended'){const b=document.createElement('button');b.className='response';b.type='button';b.textContent='НАЧАТЬ ИСТОРИЮ ЗАНОВО';b.addEventListener('click',()=>{if(confirm('Сбросить прохождение этой версии?'))api.newGame()});choices.append(b)}
 E('unreadCounter').textContent=Object.values(state.unread||{}).reduce((a,b)=>a+b,0)||'';
 if(!E('archive').hidden)renderNames(state,scene);
 if(current?.type==='media'&&E('photoCover').hidden){E('line').style.cursor='pointer'}else E('line').style.cursor='auto';
}
function renderNames(state,scene){const api=window.KROVO_DEBUG,list=E('names');list.replaceChildren();const names=[...new Set([...state.messages.map(m=>m.chat),...Object.keys(state.unread||{}),state.active,scene.chat])].filter(Boolean);names.sort((a,b)=>{const n=(state.unread[b]||0)-(state.unread[a]||0);if(n)return n;const last=n=>state.messages.filter(m=>m.chat===n).at(-1)?.id||0;return last(b)-last(a)});
 for(const name of names){const b=document.createElement('button');b.type='button';b.className='name'+(name===state.active?' current':'');const label=document.createElement('span');label.textContent=name;const count=document.createElement('small');count.textContent=state.unread[name]||'';b.append(label,count);b.addEventListener('click',()=>{api.open(name);E('archive').hidden=true});list.append(b)}
}
function toggleArchive(){const open=E('archive').hidden;E('archive').hidden=!open;if(open){const api=window.KROVO_DEBUG;if(api){const s=api.getState();renderNames(s,window.KROVO_STORY.scenes[s.scene])}}}
E('archiveBtn').addEventListener('click',toggleArchive);E('closeArchive').addEventListener('click',()=>E('archive').hidden=true);
E('fastBtn').addEventListener('click',()=>window.KROVO_DEBUG?.skip());E('soundBtn').addEventListener('click',()=>window.KROVO_DEBUG?.sound());
E('line').addEventListener('click',()=>{const state=window.KROVO_DEBUG.getState();if(state.messages.filter(m=>m.chat===state.active).at(-1)?.type==='media')E('photoCover').hidden=false});E('closePhoto').addEventListener('click',()=>E('photoCover').hidden=true);
document.addEventListener('keydown',e=>{if(!E('archive').hidden){if(e.key==='Escape')E('archive').hidden=true;return}if(!E('photoCover').hidden){if(e.key==='Escape')E('photoCover').hidden=true;return}if(e.key===' '){e.preventDefault();window.KROVO_DEBUG?.skip()}if(e.key.toLowerCase()==='c'&&!e.ctrlKey&&!e.metaKey)toggleArchive();});
window.addEventListener('resize',()=>{cover();paint()});cover();selected='Серёга';tone=colorFor(selected);paint();
window.KROVO_STAGE=render;render();
})();