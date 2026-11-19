"""Browser regression: forward delivery/labels/media, independent of navigation, old saves."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]

import json
SINGLE=(Path('/mnt/data/КРОВОСТОК_Переписки_игра.html')).read_text(encoding='utf8')
def open_game(page, initial=None):
    store=initial or {}
    shim="""<script>window.__store=JSON.parse(%s);Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>Object.prototype.hasOwnProperty.call(window.__store,k)?window.__store[k]:null,setItem:(k,v)=>{window.__store[k]=v},removeItem:k=>{delete window.__store[k]}}});</script>""" % json.dumps(json.dumps(store,ensure_ascii=False))
    page.set_content(SINGLE.replace('<head>','<head>'+shim,1),wait_until='load')
    page.evaluate('window.KROVO_DEBUG.skip()')

def choose(page, scene, choice_idx):
    g=page.evaluate('window.KROVO_DEBUG.getState()')
    if g['stage']=='transition':
        page.evaluate('window.KROVO_DEBUG.advance()')
        g=page.evaluate('window.KROVO_DEBUG.getState()')
    if g['stage'] in ('intro','reply'):
        page.evaluate('window.KROVO_DEBUG.skip()')
        g=page.evaluate('window.KROVO_DEBUG.getState()')
    current=page.evaluate('window.KROVO_STORY.scenes[window.KROVO_DEBUG.getState().scene].chat')
    ident=page.evaluate('window.KROVO_STORY.scenes[window.KROVO_DEBUG.getState().scene].id')
    assert ident==scene,(ident,scene)
    if g['active']!=current:
        page.get_by_role('listitem',name='Открыть чат '+current).click()
    assert page.locator('#quickReplies .choice-btn').count()==3,(scene,g['stage'])
    page.locator('#quickReplies .choice-btn').nth(choice_idx).click()
    page.evaluate('window.KROVO_DEBUG.skip()')
    return page.evaluate('window.KROVO_DEBUG.getState()')

def next_scene(page):
    page.evaluate('window.KROVO_DEBUG.advance()')
    page.evaluate('window.KROVO_DEBUG.skip()')

def check_forward(page, to, from_, photo, contain):
    page.get_by_role('listitem',name='Открыть чат '+to).click()
    labels=page.locator('#thread .forwarded').all_inner_texts()
    assert 'Переслано от '+from_ in labels,(to,labels)
    bubbles=page.locator('#thread .bubble.forward-bubble')
    matches=[]
    for i in range(bubbles.count()):
        b=bubbles.nth(i)
        if b.locator('.forwarded').inner_text()=='Переслано от '+from_ and contain in b.inner_text():
            matches.append(b)
    assert matches,(to,from_,contain)
    if photo:
        assert matches[-1].locator('.media-card img').count()==1
        assert matches[-1].locator('img').first.evaluate('(e)=>e.complete && e.naturalWidth>0')
    assert matches[-1].get_attribute('class').find('mine')>=0

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--allow-file-access-from-files'])
    errors=[]
    # Route A: first scene photo, forward to existing Doc; later killer to Valerik and Marat from Sergei
    context=browser.new_context(viewport={'width':1280,'height':800})
    page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    open_game(page)
    choose(page,'E01',0);next_scene(page)
    g=choose(page,'E02',0)
    assert g['active']=='Серёга' # no auto-chat switch
    fw=[m for m in g['messages'] if m['chat']=='Док' and m['type']=='forward']
    assert len(fw)==1,fw
    assert fw[0]['forwardedFrom']=='Серёга' and fw[0]['media']=='head'
    assert g['unread']['Док']>0
    check_forward(page,'Док','Серёга',True,'неизвестного мужчины')
    next_scene(page);choose(page,'E03',0)
    next_scene(page);choose(page,'E04',1)
    next_scene(page);g=choose(page,'E05',0)
    assert g['active']=='Без имени'
    fw=[m for m in g['messages'] if m['chat']=='Валерик' and m['type']=='forward']
    assert len(fw)==1,fw
    check_forward(page,'Валерик','Без имени',False,'мои деньги')
    next_scene(page);choose(page,'E06',1)
    next_scene(page);g=choose(page,'E07',1)
    assert g['active']=='Серёга'
    fw=[m for m in g['messages'] if m['chat']=='Марат (версии)' and m['type']=='forward']
    assert len(fw)==1,fw
    check_forward(page,'Марат (версии)','Серёга',True,'Имя погибшего неизвестно')
    assert not errors,errors
    print('PASS: Doc, Valerik and Marat forwards delivered to target chat, labelled and image-backed')
    context.close()

    # Route B: forward to Valerik on no-photo E01 path, ensure original is received once and the destination receives the attachment.
    context=browser.new_context(viewport={'width':1200,'height':800})
    page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    open_game(page)
    choose(page,'E01',2);next_scene(page)
    g=choose(page,'E02',1)
    assert len([m for m in g['messages'] if m['chat']=='Серёга' and m['type']=='media'])==1
    check_forward(page,'Валерик','Серёга',True,'Фотография из его кухни')
    # Reload and check forward markup and save intact.
    saved=page.evaluate('window.__store')
    open_game(page,saved)
    check_forward(page,'Валерик','Серёга',True,'Фотография из его кухни')
    print('PASS: first forward dynamically adds source media, no duplicates, save survives refresh')
    context.close()

    # Existing v0.4 save with a legacy bracket-form forward must still display forwarding marker.
    context=browser.new_context(viewport={'width':1200,'height':800})
    page=context.new_page();open_game(page)
    data=page.evaluate('window.KROVO_DEBUG.getState()')
    data['pending']=[];data['stage']='choice';data['scene']=1;data['active']='Док'
    data['messages']=[{'chat':'Док','who':'Док','type':'text','mine':True,'text':'[переслано из чата «Серёга»: фото и вопрос о неизвестном мужчине]','time':'09:25','id':1}]
    data['seq']=1
    open_game(page, {'krovostok-chat-save-v2':json.dumps(data,ensure_ascii=False)})
    assert 'Переслано от Серёга' in page.locator('.forwarded').all_inner_texts()
    print('PASS: legacy save forward remains visibly labelled')
    assert not errors,errors
    context.close();browser.close()
