import json,os
from pathlib import Path
from threading import Thread
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[3];out=Path(os.environ.get('SHILO_QA_DIR','/tmp/shilo-qa'));out.mkdir(parents=True,exist_ok=True);os.chdir(root)
class H(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',8791),H);Thread(target=server.serve_forever,daemon=True).start()
errors=[];bad=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('SHILO_CHROME') or None,args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1000});page.on('pageerror',lambda e:errors.append(str(e)));page.on('response',lambda r:bad.append([r.url,r.status]) if r.status>=400 else None)
 url='http://127.0.0.1:8791/experiments/04-kadr/';page.goto(url,wait_until='networkidle');page.locator('#start').click();page.locator('#relationsBtn').click();before=page.evaluate('localStorage.getItem("shilo-opening-v2")');assert page.locator('.ties-person').count()==2;assert not page.locator('#dialogBody').inner_text().find('Коромысло')>=0;page.get_by_role('button',name='Увеличить карту').click();page.get_by_role('button',name='Вся карта').click();assert page.evaluate('localStorage.getItem("shilo-opening-v2")')==before;page.screenshot(path=str(out/'map-opening.png'),animations='disabled');page.keyboard.press('Escape')
 witnesses=json.loads((out/'witness.json').read_text());samples=['story:E06','story:W06','story:U10'];counts=[]
 for sample in samples:
  state=witnesses[sample];page.evaluate('(s)=>localStorage.setItem("shilo-opening-v2",JSON.stringify(s))',state);page.reload(wait_until='domcontentloaded');page.locator('#resume').click();page.locator('#relationsBtn').click();assert page.locator('.ties-person').count()==1+sum(c['known'] for c in state['contacts'].values());counts.append(page.locator('.ties-person').count());page.evaluate('document.fonts.ready');page.screenshot(path=str(out/('map-'+sample[-3:]+'.png')),animations='disabled');page.locator('.ties-open').click();assert page.evaluate('!document.getElementById("dialog").open');assert json.loads(page.evaluate('localStorage.getItem("shilo-opening-v2")'))['now']==state['now']
 page.locator('#relationsBtn').click();page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(out/'map-mobile.png'),full_page=True,animations='disabled');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.keyboard.press('Escape');assert not page.locator('#dialog').evaluate('(d)=>d.open');b.close()
assert not errors,errors
assert not bad,bad
print(json.dumps({'passed':True,'knownNodes':counts,'newGameNoSpoilers':True,'clockUnchanged':True,'mobileNoPageOverflow':True,'errors':errors,'badResources':bad}))
