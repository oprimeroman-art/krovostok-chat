import os,json,tempfile
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[3];OUT=Path(os.environ.get('SHILO_QA_DIR',Path(tempfile.gettempdir())/'shilo-qa'));os.chdir(ROOT)
class H(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',8794),H);Thread(target=server.serve_forever,daemon=True).start()
data=json.loads((OUT/'details-witness.json').read_text());errors=[];bad=[]
plans={'groceries':[('unfold',None),('check',None)],'matchbox':[('slide',100),('look',None)],'barphone':[('screen',None),('bill',None),('compare',None)],'transfers':[('first',None),('second',None),('bill',None),('compare',None)],'cassette':[('seek',0),('seek',1),('seek',2),('mark',None)],'tickets':[('slide',100),('check',None)],'hotelkey':[('wipe',None),('turn',None),('check',None)]}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('SHILO_CHROME') or None,args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1000});page.on('pageerror',lambda e:errors.append(str(e)));page.on('response',lambda r:bad.append([r.url,r.status]) if r.status>=400 else None);url='http://127.0.0.1:8794/experiments/04-kadr/';page.goto(url,wait_until='networkidle');page.locator('#start').click();assert page.locator('.object-insert').count()==0
 def state():return page.evaluate('JSON.parse(localStorage.getItem("shilo-opening-v2"))')
 for id,plan in plans.items():
  sample=data['samples'][id];page.evaluate('(s)=>localStorage.setItem("shilo-opening-v2",JSON.stringify(s))',sample);page.reload(wait_until='domcontentloaded');page.locator('#resume').click();assert page.locator('.object-insert').count()==1
  page.evaluate('document.fonts.ready');page.screenshot(path=str(OUT/(id+'-insert.png')),full_page=True,animations='disabled');page.locator('[data-object="'+id+'"]').click();assert page.locator('#dialog.object-dialog').is_visible()
  if id=='matchbox':
   slider=page.get_by_label('Выдвинуть ящичек',exact=True);slider.focus();page.keyboard.press('ArrowRight');assert page.get_by_label('Выдвинуть ящичек',exact=True).evaluate('(i)=>i===document.activeElement')
  if id=='barphone':
   page.locator('[data-object-action="screen"]').click();page.keyboard.press('Escape');page.reload(wait_until='domcontentloaded');page.locator('#resume').click();page.locator('[data-object="barphone"]').click();assert 'За тот вечер' in page.locator('.object-controls').inner_text()
  for action,value in plan:
   if action=='slide':page.get_by_role('slider').fill(str(value))
   elif action=='seek':page.locator('[data-object-action="seek"]').nth(value).click()
   else:page.locator('[data-object-action="'+action+'"]').click()
  assert page.locator('.object-saved').is_visible();assert state()['now']==sample['now'];assert state()['details']['items'][id]['done'];assert len([f for f in state()['facts'] if f['id']=='object-'+id])==1
  page.screenshot(path=str(OUT/(id+'-detail.png')),animations='disabled');page.keyboard.press('Escape');page.reload(wait_until='domcontentloaded');page.locator('#resume').click();assert 'Рассмотрено' in page.locator('.object-peek').inner_text();page.locator('#historyBtn').click();assert page.locator('.object-notes [data-object="'+id+'"]').count()==1;page.locator('.object-notes [data-object="'+id+'"]').click();assert page.locator('.object-saved').is_visible();page.keyboard.press('Escape')
  page.set_viewport_size({'width':390,'height':844});page.locator('[data-object="'+id+'"]').click();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert page.locator('#dialog').evaluate('(d)=>d.scrollWidth<=d.clientWidth+1');page.screenshot(path=str(OUT/(id+'-mobile.png')),animations='disabled');page.keyboard.press('Escape');page.set_viewport_size({'width':1440,'height':1000})
 b.close()
assert not errors,errors
assert not bad,bad
result={'passed':True,'activities':len(plans),'partialAndCompleteReload':True,'notesReopen':True,'keyboardSlider':True,'mobileNoOverflow':True,'errors':errors,'badResources':bad};(OUT/'browser-details-result.json').write_text(json.dumps(result));print(json.dumps(result))
