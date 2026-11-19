from pathlib import Path
from playwright.sync_api import sync_playwright
root = Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text()
html=html.replace('<link rel="stylesheet" href="styles.css">','<style>'+ (root/'styles.css').read_text()+'</style>')
html=html.replace('<script defer src="story.js"></script>', '')
html=html.replace('<script defer src="app.js"></script>', '')
html=html.replace('</body>', '<script>'+ (root/'story.js').read_text()+'</script><script>'+(root/'app.js').read_text()+'</script></body>')

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox','--allow-file-access-from-files'])
    for which, choices in [('first',[0]*38),('mixed',[2,1,0,2,2,0,1,1,0,2,0,1]+[2,1,0,1,2,0,2,1,0,1,2,2]+[1,2,1,0,2,1,0,2,0,1,0,2,1,0])]:
        context=browser.new_context(viewport={'width':1380,'height':800},accept_downloads=True)
        page=context.new_page();errors=[]
        page.on('pageerror',lambda e: errors.append(str(e)))
        page.set_content(html,wait_until="load");page.wait_for_timeout(700)
        assert page.locator('#activeName').inner_text()=='Серёга'
        assert not page.locator('#modal').is_visible()
        assert page.locator('#thread').is_visible()
        for i,c in enumerate(choices):
            page.wait_for_timeout(10)
            stage=page.evaluate('window.KROVO_DEBUG.getState().stage')
            if stage in ['intro','reply']:
                page.evaluate('window.KROVO_DEBUG.skip()')
            if page.evaluate('window.KROVO_DEBUG.getState().stage')=='transition':
                page.evaluate('window.KROVO_DEBUG.advance()')
                page.evaluate('window.KROVO_DEBUG.skip()')
            # after skip and transitions wait briefly
            page.wait_for_timeout(10)
            g=page.evaluate('window.KROVO_DEBUG.getState()')
            assert g['stage']=='choice',(which,i,g['stage'],g['scene'])
            assert g['scene']==i,(which,i,g['scene'])
            if g['active']!=page.evaluate('window.KROVO_STORY.scenes[window.KROVO_DEBUG.getState().scene].chat'):
                # New scene cannot force a conversation switch; the user navigates there.
                assert page.locator('#pendingHint').count()==0
                assert 'В другом чате ждут ответа' not in page.locator('body').inner_text()
                target=page.evaluate('window.KROVO_STORY.scenes[window.KROVO_DEBUG.getState().scene].chat')
                page.get_by_role('listitem',name='Открыть чат '+target).click()
            n=page.locator('#quickReplies .choice-btn').count()
            assert n==3,(i,n)
            page.locator('#quickReplies .choice-btn').nth(c%3).click()
            page.evaluate('window.KROVO_DEBUG.skip()')
            page.evaluate('window.KROVO_DEBUG.advance()')
        # all done
        page.wait_for_timeout(10)
        g=page.evaluate('window.KROVO_DEBUG.getState()')
        assert g['stage']=='ended',g['stage']
        assert len(g['decisions'])==38,(which,len(g['decisions']))
        assert len(g['messages'])>130,(which,len(g['messages']))
        assert not errors,(which,errors)
        page.screenshot(path=str(root / 'tests' / f'desktop_{which}.png'))
        print(which,'passed',len(g['messages']),'messages',len(g['decisions']),'choices', 'flags',len(g['flags']))
        # Reload must persist completed game
        assert page.evaluate('window.KROVO_DEBUG.getState().stage')=='ended'
        context.close()
    # fresh mobile with interactive transitions and modal
    context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    page=context.new_page();errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.set_content(html,wait_until="load");page.wait_for_timeout(2200)
    assert page.locator('#app.show-thread').count()==1
    assert page.locator('.inline-typing').is_visible() or page.locator('#quickReplies .choice-btn').count()>0
    page.locator('#speedButton').click()
    assert page.locator('#speedButton').inner_text()=='2×'
    assert page.locator('#pendingHint').count()==0
    page.locator('#backButton').click()
    assert page.locator('#app.show-thread').count()==0
    page.locator('#chatList .chat-item').first.click()
    assert page.locator('#app.show-thread').count()==1
    page.locator('#soundButton').click()
    page.screenshot(path=str(root/'tests'/'mobile.png'),full_page=True)
    assert not errors,errors
    print('mobile passed')
    context.close();browser.close()