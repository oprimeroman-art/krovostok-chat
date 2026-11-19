"""v0.7 end-to-end regression. Runs real UI clicks inside headless Chromium."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
SINGLE=(ROOT/'published_index.html').read_text(encoding='utf-8')

JS_ROUTE=r'''({fromIndex, special}) => {
  const debug=window.KROVO_DEBUG, s=window.KROVO_STORY;
  let check=null;
  const observed=[];
  for(let i=fromIndex;i<s.scenes.length;i++){
    let g=debug.getState();
    if(g.stage==='transition')debug.advance();
    debug.skip();g=debug.getState();
    if(g.scene!==i || g.stage!=='choice')throw Error('scene '+i+' state '+g.scene+'/'+g.stage);
    const chat=s.scenes[i].chat;
    if(g.active!==chat){
      const btn=Array.from(document.querySelectorAll('#chatList [role="listitem"]')).find(x=>x.getAttribute('aria-label')==='Открыть чат '+chat);
      if(!btn)throw Error('no chat '+chat+' at '+i);
      btn.click();
    }
    const buttons=Array.from(document.querySelectorAll('#quickReplies .choice-btn'));
    if(buttons.length!==3)throw Error('choices mismatch '+i+': '+buttons.length);
    buttons[special[i]||0].click();debug.skip();g=debug.getState();
    if(i===58 && special[i]===1){
      const forwards=g.messages.filter(x=>x.type==='forward' && x.chat==='Марат (версии)' && x.forwardedFrom==='Лёха (деревня)');
      if(forwards.length!==1)throw Error('lost village forward');
      if(g.active!=='Лёха (деревня)')throw Error('auto switched to forward target');
      document.querySelector('[aria-label="Открыть чат Марат (версии)"]').click();
      if(!Array.from(document.querySelectorAll('.forwarded')).some(x=>x.textContent.includes('Переслано от Лёха (деревня)')))throw Error('forward invisible in destination');
    }
    if(i===61 && special[i]===1){
      if(!g.messages.some(x=>x.type==='forward' && x.chat==='Док' && x.forwardedFrom==='Гаражи')) throw Error('lost doc forward');
    }
    if(i===63 && special[i]===2){
      if(!g.messages.some(x=>x.type==='forward' && x.chat==='Бармен' && x.forwardedFrom==='Гаражи')) throw Error('lost bar forward');
    }
  }
  debug.advance();
  const g=debug.getState();
  if(g.stage!=='ended' || g.decisions.length!==s.scenes.length)throw Error('route unfinished '+g.stage);
  return {state:g, scenes:s.scenes.length, active:document.querySelector('#activeName').textContent};
}'''


def open_game(page, store=None):
    raw=json.dumps(json.dumps(store or {},ensure_ascii=False))
    shim=f'''<script>window.__testStore=JSON.parse({raw});Object.defineProperty(window,'localStorage',{{configurable:true,value:{{getItem:k=>Object.prototype.hasOwnProperty.call(window.__testStore,k)?window.__testStore[k]:null,setItem:(k,v)=>{{window.__testStore[k]=v}},removeItem:k=>{{delete window.__testStore[k]}}}}}});</script>'''
    page.set_content(SINGLE.replace('<head>','<head>'+shim,1), wait_until='load')


def text(g,who):
    return '\n'.join(m['text'] for m in g['messages'] if m['chat']==who)

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':840})
    errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
    routes=[
      ('public_with_verification',{58:1,59:0,60:0,61:1,63:2,64:0,65:0,68:1,70:1}),
      ('private_and_quiet',{58:2,59:2,60:2,61:0,63:0,64:2,65:1,68:2,69:2,70:2}),
      ('rumor_spread',{58:1,59:2,60:2,61:2,63:1,64:1,65:2,68:0,70:2}),
    ]
    for name,route in routes:
        open_game(page)
        r=page.evaluate(JS_ROUTE,{'fromIndex':0,'special':{str(k):v for k,v in route.items()}})
        g=r['state']; assert r['scenes']==72
        if name=='public_with_verification':
            assert 'поговорил с Васюней' in text(g,'Гаражи')
            assert 'Марат прислал предупреждение про слухи' in text(g,'Лёха (деревня)')
        if name=='private_and_quiet':
            assert 'поговорил с Васюней' not in text(g,'Гаражи')
            assert 'Обсуждают мой дом без меня' not in text(g,'Лёха (деревня)')
        if name=='rumor_spread':
            assert 'решили, что трое точно погибли' in text(g,'Гаражи')
            assert 'Обсуждают мой дом без меня' in text(g,'Лёха (деревня)')
        assert not errors,errors
        print('PASS',name,'decisions',len(g['decisions']),'messages',len(g['messages']),flush=True)

    # Build a v0.6 completed save from a 54-scene prefix via real UI interactions.
    open_game(page)
    prefix=page.evaluate(r'''() => {
      const d=window.KROVO_DEBUG,story=window.KROVO_STORY;
      for(let i=0;i<54;i++){
        let g=d.getState();if(g.stage==='transition')d.advance();d.skip();g=d.getState();
        if(g.scene!==i||g.stage!=='choice')throw Error('migration prefill failed '+i);
        let chat=story.scenes[i].chat;
        if(g.active!==chat)document.querySelector('[aria-label="Открыть чат '+chat+'"]').click();
        document.querySelector('#quickReplies .choice-btn').click();d.skip();
      }
      return d.getState();
    }''')
    assert prefix['scene']==53 and prefix['stage']=='transition'
    prefix['stage']='ended';prefix['pending']=[]
    prefix['seq']+=1
    prefix['messages'].append({'chat':'Сонный','who':'Система','type':'sys','mine':False,'text':'Продолжение следует. Эти истории не обязаны заканчиваться одной разгадкой.','time':'22:42','id':prefix['seq']})
    open_game(page,{'krovostok-chat-save-v2':json.dumps(prefix,ensure_ascii=False)})
    page.evaluate('window.KROVO_DEBUG.skip()')
    state=page.evaluate('window.KROVO_DEBUG.getState()')
    assert state['scene']==54 and state['stage']=='choice',(state['scene'],state['stage'])
    assert len(state['decisions'])==54
    assert not any(m['type']=='sys' and m['text'].startswith('Продолжение следует.') for m in state['messages'])
    print('PASS v0.6 finished save resumes T01 without lost decisions',flush=True)
    assert not errors,errors
    browser.close()
