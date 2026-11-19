"""Offline browser regressions without loading file:/, which is blocked in this runtime.
All scripts and styles injected into about:blank from release files, in actual page ordering.
"""
import json
from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

root=Path(__file__).parent
raw=(root/'index.html').read_text(encoding='utf8')
soup=BeautifulSoup(raw,'html.parser')
for tag in soup.select('script[src], link[rel=stylesheet]'):tag.decompose()
html=str(soup)


def setup(page, save=None):
    errs=[]
    page.on('pageerror',lambda e:errs.append(str(e)))
    page.set_content(html)
    page.add_style_tag(content=(root/'styles.css').read_text(encoding='utf8'))
    # Browsers prohibit localStorage for about:blank; supply a compatible in-memory adapter.
    local={'krovostok-chat-prefs-v2':json.dumps({'sound':False,'speed':0})}
    if save:local['krovostok-chat-save-v2']=json.dumps(save)
    page.evaluate('''(data)=>{const db=new Map(Object.entries(data));
        Object.defineProperty(window,'localStorage',{configurable:true, value:{
          getItem:(key)=>db.has(key)?db.get(key):null,
          setItem:(key,val)=>db.set(key,String(val)),
          removeItem:(key)=>db.delete(key),clear:()=>db.clear()
        }});window.__saved=db;
    }''',local)
    for name in ['story.js','second_thursday.js','next_friday.js','app.js']:
        page.add_script_tag(content=(root/name).read_text(encoding='utf8'))
    assert not errs,errs
    return errs


def step_script(choice_index):
    return '''(index)=>{
      const api=window.KROVO_DEBUG;
      const story=window.KROVO_STORY;
      const problems=[];
      let seen=0;
      while(seen<18){
        api.skip();
        let state=api.getState();
        if(state.stage==='ended')break;
        if(state.stage==='transition'){api.advance();continue;}
        if(state.stage==='reply'){api.skip();continue;}
        if(state.stage!=='choice'){problems.push(`unexpected stage ${state.stage} at ${state.scene}`);break;}
        const scene=story.scenes[state.scene];
        if(state.active!==scene.chat){
            const b=[...document.querySelectorAll('#chatList button')].find(n=>n.getAttribute('aria-label')==='Открыть чат '+scene.chat);
            if(!b){problems.push(`missing chat ${scene.chat} on ${scene.id}`);break;}
            b.click();
        }
        const buttons=document.querySelectorAll('#quickReplies button.choice-btn');
        if(buttons.length!==3){problems.push(`expected three buttons at ${scene.id}, got ${buttons.length}`);break;}
        buttons[index].click();
        seen++;
        state=api.getState();
        if(state.stage==='reply')api.skip();
        state=api.getState();
        if(state.stage==='transition')api.advance();
      }
      const state=api.getState();
      return {seen,stage:state.stage,last:story.scenes[state.scene].id,
        decisions:state.decisions.length,contacts:Object.keys(state.unread).length,
        forwards:state.messages.filter(m=>m.type==='forward').map(m=>({chat:m.chat,from:m.forwardedFrom,text:m.text})),
        flags:state.flags,problems};
    }'''


with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
  for choice in (0,1,2):
    page=browser.new_page(viewport={'width':1280,'height':800},reduced_motion='reduce')
    seed={'version':'0.3.0','scene':107,'stage':'ended','flags':{'thursday_end':'home'},
          'messages':[],'pending':[],'active':'Старый','unread':{},
          'decisions':[{'scene':f'OLD{i}'} for i in range(108)],'seq':0,'minuteCounter':1270}
    errors=setup(page,seed)
    result=page.evaluate(step_script(choice),choice)
    assert result['seen']==18,result
    assert result['stage']=='ended',result
    assert result['last']=='R18',result
    assert result['decisions']==126,result
    assert not result['problems'],result
    assert not errors,errors
    print(f"Friday route {choice+1}: {result['seen']} scenes, {len(result['forwards'])} visible forwards, end={result['flags'].get('friday_end')}")
    page.close()

  # Resume completed v0.9 after H18 — all decisions preserved.
  seed={'version':'0.3.0','scene':107,'stage':'ended','flags':{'thursday_end':'home'},
        'messages':[],'pending':[],'active':'Старый','unread':{},
        'decisions':[{'scene':f'OLD{i}'} for i in range(108)],'seq':0,'minuteCounter':1270}
  page=browser.new_page(viewport={'width':420,'height':900},reduced_motion='reduce')
  errors=setup(page,seed)
  r=page.evaluate('''()=>{let s=KROVO_DEBUG.getState();return {scene:s.scene,stage:s.stage,decisions:s.decisions.length,active:s.active}}''')
  assert r['scene']==108 and r['decisions']==108,r
  page.evaluate('KROVO_DEBUG.skip()')
  assert page.locator('#chatList button').count()>0
  # Mobile remains on existing chat rather than automatically switching to Dimon.
  state=page.evaluate('KROVO_DEBUG.getState()')
  assert state['active']=='Старый',state['active']
  page.screenshot(path=str(root/'test_v10_mobile.png'))
  assert not errors,errors
  print('Resume v0.9: starts R01, keeps 108 decisions, active chat unchanged, mobile screenshot saved')
  page.close()
  browser.close()
print('PASS: real Chromium DOM tests through about:blank + injected local sources')
