"""v0.6: branch-sensitive Monday chapter, forwarding and v0.5 save migration."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
SINGLE=(ROOT/'published_index.html').read_text(encoding='utf-8')


def open_game(page, initial=None):
    store=initial or {}
    shim='''<script>window.__testStore=JSON.parse(%s);Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>Object.prototype.hasOwnProperty.call(window.__testStore,k)?window.__testStore[k]:null,setItem:(k,v)=>{window.__testStore[k]=v},removeItem:k=>{delete window.__testStore[k]}}});</script>''' % json.dumps(json.dumps(store,ensure_ascii=False))
    page.set_content(SINGLE.replace('<head>','<head>'+shim,1),wait_until='load')


def choose(page,i,choice=0):
    g=page.evaluate('window.KROVO_DEBUG.getState()')
    if g['stage']=='transition':
        page.evaluate('window.KROVO_DEBUG.advance()')
    page.evaluate('window.KROVO_DEBUG.skip()')
    g=page.evaluate('window.KROVO_DEBUG.getState()')
    assert g['scene']==i and g['stage']=='choice',(i,g['scene'],g['stage'])
    who=page.evaluate('window.KROVO_STORY.scenes[window.KROVO_DEBUG.getState().scene].chat')
    if g['active']!=who:
        assert page.locator('#activeName').inner_text()==g['active']
        page.get_by_role('listitem',name='Открыть чат '+who).click()
    assert page.locator('#quickReplies .choice-btn').count()==3
    page.locator('#quickReplies .choice-btn').nth(choice).click()
    page.evaluate('window.KROVO_DEBUG.skip()')
    return page.evaluate('window.KROVO_DEBUG.getState()')


def all_messages(g,contact):
    return ' '.join(m['text'] for m in g['messages'] if m['chat']==contact)


def route(browser,name,special,expected,extra=None):
    ctx=browser.new_context(viewport={'width':1280,'height':850})
    page=ctx.new_page();errs=[]
    page.on('pageerror',lambda e: errs.append(str(e)))
    open_game(page)
    count=page.evaluate('window.KROVO_STORY.scenes.length')
    assert count==72,count
    page.set_default_timeout(4500)
    for i in range(count):
        print('STEP',name,i,flush=True)
        choose_idx=special.get(i,0)
        g=choose(page,i,choose_idx)
        if i==40 and choose_idx==0:  # M03: a forwarded warning to the 'Сонный' chat
            forwarded=[m for m in g['messages'] if m['type']=='forward' and m['chat']=='Сонный' and m.get('forwardedFrom')=='Колян']
            assert len(forwarded)==1,forwarded
            assert g['active']=='Колян'
            page.get_by_role('listitem',name='Открыть чат Сонный').click()
            assert 'Переслано от Колян' in page.locator('.forwarded').all_inner_texts()
        if i==44 and choose_idx==0:  # M07: Сонный gives relay to Колян
            fw=[m for m in g['messages'] if m['type']=='forward' and m['chat']=='Колян' and m.get('forwardedFrom')=='Сонный']
            assert len(fw)==1,fw
    g=page.evaluate('window.KROVO_DEBUG.getState()')
    assert g['stage']=='transition',(name,g['stage'])
    page.evaluate('window.KROVO_DEBUG.advance()')
    g=page.evaluate('window.KROVO_DEBUG.getState()')
    assert g['stage']=='ended'
    assert len(g['decisions'])==72,len(g['decisions'])
    assert expected in all_messages(g,'Сонный'),(name,all_messages(g,'Сонный')[-3000:])
    if extra: extra(page,g)
    assert not errs,errs
    print('PASS',name,'messages',len(g['messages']),'decisions',len(g['decisions']))
    ctx.close()

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--allow-file-access-from-files'])
    # 38 prior scenes then 16 added Monday: index 38..53.
    # M03 = 40, M04 = 41, M06 = 43, M07 = 44, M08 = 45, M11 = 48, M12 = 49.
    route(browser,'leaves_and_limits_rumors',{
        40:0,41:0,43:0,44:0,45:0,48:0
    },'Я тогда ушёл к сестре',lambda page,g: (
        (_ for _ in ()).throw(AssertionError('wrong public rumor')) if 'картинка уже в районной ленте' in all_messages(g,'Восемь') else None
    ))
    route(browser,'stays_and_spreads',{
        40:2,41:2,43:2,44:2,45:2,48:2
    },'Я остался дома. Он действительно пришёл с двумя. Я живой. Они — нет.',lambda page,g: (
        (_ for _ in ()).throw(AssertionError('no public rumor')) if 'картинка уже в районной ленте' not in all_messages(g,'Восемь') else None
    ))
    route(browser,'documents_with_early_warning',{
        40:0,41:1,43:1,44:1,45:1,48:1
    },'Я заранее сообщил об угрозах')
    route(browser,'documents_without_warning',{
        40:2,41:1,43:1,44:1,45:1,48:1
    },'три чужих телефона в коридоре')

    # A completed 0.5 save has 38 decisions ending at S14.
    ctx=browser.new_context(viewport={'width':1200,'height':800})
    page=ctx.new_page();open_game(page)
    for i in range(38): choose(page,i,0)
    g=page.evaluate('window.KROVO_DEBUG.getState()')
    assert g['scene']==37 and g['stage']=='transition'
    g['stage']='ended'; g['pending']=[]
    g['messages'].append({'chat':'Старый','who':'Система','type':'sys','mine':False,'text':'Продолжение следует. Эти истории не обязаны заканчиваться одной разгадкой.','time':'19:01','id':g['seq']+1})
    g['seq']+=1
    open_game(page,{'krovostok-chat-save-v2':json.dumps(g,ensure_ascii=False)})
    page.evaluate('window.KROVO_DEBUG.skip()')
    resumed=page.evaluate('window.KROVO_DEBUG.getState()')
    assert resumed['scene']==38 and resumed['stage']=='choice',resumed
    assert len(resumed['decisions'])==38
    assert 'Восемь' in page.locator('#chatList').inner_text()
    assert not any(m['type']=='sys' and m['text'].startswith('Продолжение следует.') for m in resumed['messages'])
    print('PASS completed v0.5 save resumes at M01 without losing 38 prior decisions')
    ctx.close();browser.close()
