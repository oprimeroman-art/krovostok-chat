"""v0.8 end-to-end Wednesday regression: real choices, forwards, old saves."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
SINGLE=(ROOT/'published_index.html').read_text(encoding='utf-8')


def boot(page, store=None):
    raw=json.dumps(json.dumps(store or {},ensure_ascii=False))
    shim=f'''<script>window.__testStore=JSON.parse({raw});Object.defineProperty(window,'localStorage',{{configurable:true,value:{{getItem:k=>Object.prototype.hasOwnProperty.call(window.__testStore,k)?window.__testStore[k]:null,setItem:(k,v)=>{{window.__testStore[k]=v}},removeItem:k=>{{delete window.__testStore[k]}}}}}});</script>'''
    page.set_content(SINGLE.replace('<head>','<head>'+shim,1),wait_until='load')

ROUTE_JS=r'''({limit, custom})=>{
 let d=window.KROVO_DEBUG, scenes=window.KROVO_STORY.scenes;
 if(scenes.length!==90)throw Error('wrong total scenes '+scenes.length);
 let trace=[];
 for(let i=0;i<limit;i++){
   let g=d.getState();
   if(g.stage==='transition') d.advance();
   d.skip();g=d.getState();
   if(g.stage!=='choice' || g.scene!==i)throw Error(`scene ${i}: ${g.stage} ${g.scene}`);
   const who=scenes[i].chat;
   if(g.active!==who){
     const item=[...document.querySelectorAll('#chatList [role="listitem"]')].find(x=>x.getAttribute('aria-label')==='Открыть чат '+who);
     if(!item)throw Error('missing chat '+who);item.click();
   }
   const buttons=[...document.querySelectorAll('#quickReplies .choice-btn')];
   if(buttons.length!==3)throw Error('choice count '+i);
   const option=custom[i]??0;
   buttons[option].click();d.skip();
   if(i===77 && option===0){
     g=d.getState();
     if(!g.messages.some(m=>m.type==='forward'&&m.chat==='Марат (версии)'&&m.forwardedFrom==='Архив'))throw Error('no archive forward');
     if(g.active!=='Архив')throw Error('auto-switch happened');
     document.querySelector('[aria-label="Открыть чат Марат (версии)"]').click();
     if(![...document.querySelectorAll('.forwarded')].some(x=>x.textContent.includes('Переслано от Архив'))) throw Error('no archive forward bubble');
   }
   if(i===78 && option===0){
     g=d.getState();
     if(!g.messages.some(m=>m.type==='forward'&&m.chat==='Марат (версии)'&&m.forwardedFrom==='Валерик'))throw Error('no valera forward');
   }
   if(i===85 && option===1){
     g=d.getState();
     if(!g.messages.some(m=>m.type==='forward'&&m.chat==='Марат (версии)'&&m.forwardedFrom==='Гаражи'))throw Error('wrong recipient of garage forward');
   }
   trace.push([i,scenes[i].id,option]);
 }
 if(limit===scenes.length){d.advance();let g=d.getState();if(g.stage!=='ended'||g.decisions.length!==90)throw Error('did not complete');return {state:g,trace}}
 return {state:d.getState(),trace}
}'''

def conversations(g,who):
    return '\n'.join(m['text'] for m in g['messages'] if m['chat']==who)

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1230,'height':830})
    page.set_default_timeout(7000)
    errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
    routes=[
      ('privacy',{72:0,73:0,74:1,75:0,76:0,77:1,78:1,79:1,80:1,81:0,82:0,83:1,84:0,85:2,86:0,87:1,88:2,89:0}),
      ('correction',{72:1,73:1,74:0,75:1,76:1,77:0,78:0,79:2,80:0,81:2,82:1,83:0,84:1,85:1,86:1,87:0,88:1,89:1}),
      ('rumor',{72:2,73:2,74:2,75:2,76:2,77:0,78:2,79:0,80:2,81:2,82:2,83:2,84:1,85:0,86:2,87:2,88:0,89:2}),
    ]
    for name, custom in routes:
        boot(page)
        result=page.evaluate(ROUTE_JS,{'limit':90,'custom':{str(i):c for i,c in custom.items()}})
        g=result['state']; assert len(g['decisions'])==90
        assert not errors,errors
        if name=='privacy':
            assert 'так никому и не переслал' in conversations(g,'Лоси')
            assert 'Кстати, мой номер перестали' not in conversations(g,'Лоси')
        elif name=='correction':
            assert 'номер перестали присылать' in conversations(g,'Лоси')
            assert 'пришло сообщение' in conversations(g,'Марат (версии)')
        elif name=='rumor':
            assert 'четырём посторонним' in conversations(g,'Лоси')
            assert 'Марат мне уже даже уточнённую опись' in conversations(g,'Лоси')
        print('PASS',name,len(g['decisions']),'decisions',len(g['messages']),'messages',flush=True)

    # Reconstruct a v0.7 completed 72-choice save via real UI clicks.
    boot(page)
    prefix=page.evaluate(ROUTE_JS,{'limit':72,'custom':{}})['state']
    assert prefix['scene']==71 and prefix['stage']=='transition'
    prefix['stage']='ended';prefix['pending']=[];prefix['seq']+=1
    prefix['messages'].append({'chat':'Лёха (деревня)','who':'Система','type':'sys','mine':False,'text':'Продолжение следует. Эти истории не обязаны заканчиваться одной разгадкой.','time':'23:14','id':prefix['seq']})
    boot(page,{'krovostok-chat-save-v2':json.dumps(prefix,ensure_ascii=False)})
    page.evaluate('window.KROVO_DEBUG.skip()')
    g=page.evaluate('window.KROVO_DEBUG.getState()')
    assert g['scene']==72 and g['stage']=='choice',(g['scene'],g['stage'])
    assert len(g['decisions'])==72
    assert not any(m['type']=='sys' and m['text'].startswith('Продолжение следует.') for m in g['messages'])
    assert not errors,errors
    print('PASS completed v0.7 resumes W01 retaining 72 decisions',flush=True)

    # Phone layout retains manual switching and removes old helper banners.
    mobile=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    boot(mobile)
    assert mobile.locator('#pendingHint').count()==0
    mobile.locator('#backButton').click(); assert mobile.locator('#app.show-thread').count()==0
    mobile.get_by_role('listitem',name='Открыть чат Серёга').click();assert mobile.locator('#app.show-thread').count()==1
    print('PASS mobile navigation and no helper banners',flush=True)
    mobile.close();browser.close()
