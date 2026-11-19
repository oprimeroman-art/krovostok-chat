"""Regression for v0.5.0: appended chapter, causal branches, forward delivery and save migration."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SINGLE=(ROOT / "published_index.html").read_text(encoding="utf-8")

def open_game(page, initial=None):
    store=initial or {}
    shim="""<script>window.__store=JSON.parse(%s);Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>Object.prototype.hasOwnProperty.call(window.__store,k)?window.__store[k]:null,setItem:(k,v)=>{window.__store[k]=v},removeItem:k=>{delete window.__store[k]}}});</script>""" % json.dumps(json.dumps(store,ensure_ascii=False))
    page.set_content(SINGLE.replace('<head>','<head>'+shim,1), wait_until='load')


def assert_scene_choice(page, i, c):
    page.evaluate("window.KROVO_DEBUG.skip()")
    g = page.evaluate("window.KROVO_DEBUG.getState()")
    if g['stage'] == 'transition':
        page.evaluate("window.KROVO_DEBUG.advance()")
        page.evaluate("window.KROVO_DEBUG.skip()")
        g = page.evaluate("window.KROVO_DEBUG.getState()")
    assert g['scene'] == i, (i, g['scene'], g['stage'])
    assert g['stage'] == 'choice', (i, g['stage'])
    chat = page.evaluate("window.KROVO_STORY.scenes[window.KROVO_DEBUG.getState().scene].chat")
    if g['active'] != chat:
        # Confirm explicitly: the app didn't auto-switch when the story moved.
        assert page.locator('#activeName').inner_text() == g['active']
        page.get_by_role('listitem', name='Открыть чат ' + chat).click()
    assert page.locator('#quickReplies button').count() == 3
    page.locator('#quickReplies button').nth(c).click()
    page.evaluate("window.KROVO_DEBUG.skip()")
    return page.evaluate("window.KROVO_DEBUG.getState()")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox','--allow-file-access-from-files'])
    failures = []
    for route, overrides in [
        ("rescue_public_retracted", {17:0,20:0,27:1,28:2,30:0,33:0,36:0}),
        ("quiet_no_confirm", {17:2,20:2,27:2,28:0,30:1,33:2,36:2}),
    ]:
        ctx = browser.new_context(viewport={'width':1280,'height':850})
        page = ctx.new_page()
        page.on('pageerror', lambda e: failures.append(str(e)))
        open_game(page)
        scene_count = page.evaluate('window.KROVO_STORY.scenes.length')
        assert scene_count == 38, scene_count
        for i in range(scene_count):
            c = overrides.get(i, 0 if route=='rescue_public_retracted' else 2)
            state = assert_scene_choice(page, i, c)
            if i == 27 and c == 1:  # S04 forward to Marat
                forwards = [m for m in state['messages'] if m['type']=='forward' and m['chat']=='Марат (версии)' and m.get('forwardedFrom')=='Старый']
                assert len(forwards)==1,forwards
                assert state['active']=='Старый' # no autoselection
                page.get_by_role('listitem', name='Открыть чат Марат (версии)').click()
                assert 'Переслано от Старый' in page.locator('#thread .forwarded').all_inner_texts()
        page.evaluate('window.KROVO_DEBUG.advance()')
        state=page.evaluate("window.KROVO_DEBUG.getState()")
        assert state['stage']=='ended', (route,state['stage'])
        assert len(state['decisions'])==38,(route,len(state['decisions']))
        assert len(state['messages'])>=210,(route,len(state['messages']))
        # Consequence check: with correct choices Shompol survived; without them not confirmed.
        alla_text = ' '.join(m['text'] for m in state['messages'] if m['chat']=='Алла')
        if route=='rescue_public_retracted':
            assert 'Из дома вывели мужчину. Живого.' in alla_text
            old_text=' '.join(m['text'] for m in state['messages'] if m['chat']=='Старый')
            assert 'Тот умник в районном чате поправился' in old_text
            bar_text=' '.join(m['text'] for m in state['messages'] if m['chat']=='Бармен')
            assert 'точно по жёлтому чеку' in bar_text
        else:
            assert 'Из дома вывели мужчину. Живого.' not in alla_text
        assert not failures, failures
        print('PASS',route,'messages',len(state['messages']),'decisions',len(state['decisions']))
        ctx.close()

    # Migration: a v0.4.1 completed save (old final F12) continues at Saturday S01.
    ctx=browser.new_context(viewport={'width':1280,'height':850})
    page=ctx.new_page();open_game(page)
    for i in range(24):
        state=assert_scene_choice(page,i,0)
    assert state['scene']==23 and state['stage']=='transition'
    state['stage']='ended'
    state['messages'].append({'chat':'Алла','who':'Система','type':'sys','mine':False,'text':'Продолжение следует. Эти истории не обязаны заканчиваться одной разгадкой.','time':'11:00','id':state['seq']+1})
    page.evaluate("state=>localStorage.setItem('krovostok-chat-save-v2',JSON.stringify(state))",state)
    old_store=page.evaluate('window.__store')
    open_game(page,old_store)
    page.evaluate('window.KROVO_DEBUG.skip()')
    resumed=page.evaluate("window.KROVO_DEBUG.getState()")
    assert resumed['scene']==24 and resumed['stage']=='choice', resumed
    assert len(resumed['decisions'])==24
    assert not any(m['type']=='sys' and m['text'].startswith('Продолжение следует.') for m in resumed['messages'])
    print('PASS completed v0.4.1 save resumed at new scene S01 without reset')
    ctx.close(); browser.close()