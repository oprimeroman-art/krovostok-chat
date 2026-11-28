import json,os,time,tempfile
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[3];OUT=Path(os.environ.get('SHILO_QA_DIR',Path(tempfile.gettempdir())/'shilo-qa'));OUT.mkdir(parents=True,exist_ok=True);os.chdir(ROOT)
class H(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',8786),H);Thread(target=server.serve_forever,daemon=True).start()
errors=[];bad=[];key='shilo-opening-v2';audio_result={};screens=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('SHILO_CHROME') or None,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':900});page.on('pageerror',lambda e:errors.append(str(e)));page.on('response',lambda r:bad.append([r.url,r.status]) if r.status>=400 else None)
 page.add_init_script('''(()=>{window.__sounds=[];window.__contexts=[];const Base=window.AudioContext;window.AudioContext=class extends Base{constructor(...a){super(...a);window.__contexts.push(this);this.qa=this.createAnalyser();this.qa.fftSize=2048;const makeGain=this.createGain.bind(this),makeOsc=this.createOscillator.bind(this);this.createGain=()=>{const g=makeGain(),connect=g.connect.bind(g);g.connect=(to,...args)=>{if(to===this.destination)connect(this.qa);return connect(to,...args);};return g;};this.createOscillator=()=>{const o=makeOsc(),start=o.start.bind(o),freq=o.frequency.setValueAtTime.bind(o.frequency);o.frequency.setValueAtTime=(hz,t)=>{o.qaHz=hz;return freq(hz,t);};o.start=t=>{window.__sounds.push({hz:o.qaHz??o.frequency.value,type:o.type,at:t});start(t);};return o;};}};})();''')
 url='http://127.0.0.1:8786/experiments/04-kadr/'
 def load(s=None):
  if s is not None:page.evaluate('(s)=>localStorage.setItem("shilo-opening-v2",JSON.stringify(s))',s)
  page.goto(url,wait_until='domcontentloaded');page.locator('#resume' if s else '#start').evaluate('(b)=>b.click()')
 def state():return page.evaluate('JSON.parse(localStorage.getItem("shilo-opening-v2"))')
 def sample():return page.evaluate('''async()=>{let peak=0;for(let i=0;i<32;i++){const a=window.__contexts.at(-1)?.qa;if(a){let x=new Float32Array(a.fftSize);a.getFloatTimeDomainData(x);peak=Math.max(peak,Math.sqrt(x.reduce((s,v)=>s+v*v,0)/x.length));}await new Promise(r=>setTimeout(r,12));}return peak;}''')
 page.goto(url,wait_until='networkidle');page.locator('#settingsBtn').click();page.get_by_role('button',name='Прослушать уведомление').click();duck=page.locator('#music').evaluate('(m)=>m.volume');rms=sample();page.wait_for_timeout(650);restored=page.locator('#music').evaluate('(m)=>m.volume');assert rms>.025,(rms,errors);assert duck<restored*.3,(duck,restored);assert abs(restored-.35)<.001
 assert page.evaluate('window.__contexts.at(-1).state')=='running';audio_result={'rms':rms,'duckVolume':duck,'restoredVolume':restored,'tones':page.evaluate('window.__sounds.slice(-2)')}
 def toggle(name):page.get_by_role('button',name=name,exact=True).click()
 toggle('Музыка');page.get_by_role('button',name='Прослушать уведомление').click();assert sample()>.025;assert page.locator('#music').evaluate('(m)=>m.paused');toggle('Музыка')
 for label in ['Уведомления и эффекты','Весь звук']:
  toggle(label);n=page.evaluate('window.__sounds.length');page.get_by_role('button',name='Прослушать уведомление').click();assert page.evaluate('window.__sounds.length')==n;toggle(label)
 slider=page.get_by_role('slider',name='Громкость эффектов');slider.fill('0');n=page.evaluate('window.__sounds.length');page.get_by_role('button',name='Прослушать уведомление').click();assert page.evaluate('window.__sounds.length')==n;slider.fill('65')
 page.locator('#closeDialog').click();page.locator('#start').click();assert state()['focus']=='serega'
 # A complete actual UI playthrough, with saves resumed after each day and after contact changes.
 # Check an actual incoming signal before the accelerated UI run.
 page.evaluate('()=>{for(const id of [\'photo\',\'decide\',\'private\',\'listen\'])document.querySelector(\'[data-action="\'+id+\'"]\').click();document.getElementById(\'skip\').click();}');assert page.evaluate('window.__sounds.some(x=>Math.abs(x.hz-880)<1)');incoming=True
 # All decisions still go through DOM buttons and production handlers, batched one day at a time.
 days=set()
 for day_pass in range(12):
  s=state()
  if s['flags'].get('finished'):break
  days.add(s['now']//1440)
  before=s;page.reload(wait_until='domcontentloaded');page.locator('#resume').evaluate('(b)=>b.click()');assert state()==before
  result=page.evaluate('()=>{const M=window.SHILO_OPENING,start=JSON.parse(localStorage.getItem(\'shilo-opening-v2\')).now/1440|0;for(let step=0;step<900;step++){const s=JSON.parse(localStorage.getItem(\'shilo-opening-v2\'));if(s.flags.finished||(s.now/1440|0)!==start)return {steps:step};const tasks=Object.keys(M.PEOPLE).filter(k=>s.contacts[k].known&&(M.options(s,k).length||s.contacts[k].pending.length));if(tasks.length){const k=tasks[0];if(k!==s.focus)document.querySelector(\'[data-contact="\'+k+\'"]\').click();const x=JSON.parse(localStorage.getItem(\'shilo-opening-v2\')),os=M.options(x),order=[\'photo\',\'decide\',\'private\',\'listen\',\'contain\',\'quiet\',\'truth\',\'return\',\'warn\',\'host_no\',\'alla_close\',\'privacy\',\'report\',\'end\'];const o=order.map(id=>os.find(o=>o.id===id)).find(Boolean)||os[0];if(o)document.querySelector(\'[data-action="\'+o.id+\'"]\').click();}else {const b=document.getElementById(\'skip\');if(b.disabled)throw Error(\'No event or action\');b.click();}const x=JSON.parse(localStorage.getItem(\'shilo-opening-v2\'));if(document.getElementById(\'clock\').textContent!==M.clock(x.now))throw Error(\'Wrong world clock\');}throw Error(\'UI loop did not finish\');}')
  print('UI day',day_pass+1,'passed',flush=True)
 assert len(days)==11 and incoming;assert state()['flags']['finished'];page.screenshot(path=str(OUT/'ending-desktop.png'),full_page=True,animations='disabled')
 complete=state();page.reload(wait_until='domcontentloaded');page.locator('#resume').evaluate('(b)=>b.click()');assert state()==complete
 page.locator('#historyBtn').click();assert page.locator('.history-contact').count()>20;assert len(page.locator('#dialogBody').text_content())>10000;page.locator('#closeDialog').click();page.locator('#eventsBtn').click();assert page.locator('.event-entry').count()>100;page.locator('#closeDialog').click()
 # Every campaign scene renders in the real interface and accepts all of its available choices.
 witnesses=json.loads((OUT/'witness.json').read_text());ui_branches=0
 for item,(node,s) in enumerate(witnesses.items()):
  if item%25==0:print('Rendered',item,'of',len(witnesses),flush=True)
  load(s);assert page.locator('#transcript').inner_text().strip();page.wait_for_function('document.getElementById("backdrop").complete && document.getElementById("backdrop").naturalWidth>=1000')
  opts=page.locator('[data-action]').evaluate_all('(bs)=>bs.map(b=>b.dataset.action)');assert opts,node
  for i,action in enumerate(opts):
   if i:load(s)
   page.locator('[data-action="'+action+'"]').evaluate('(b)=>b.click()');out=state();assert out['campaign']['answers'][node[6:]]==action[5:];assert page.locator('#transcript').inner_text().strip();ui_branches+=1
 # Portrait/choice/archive layouts across mobile, tablet and desktop.
 selected=['story:M04','story:H13','story:K17','story:U10']
 for width,height in [(320,568),(390,844),(700,900),(768,1024),(1024,768),(1440,900),(1920,1080)]:
  page.set_viewport_size({'width':width,'height':height})
  for node in selected:
   load(witnesses[node]);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,node);assert page.locator('[data-action]').count()>0
   for button in page.locator('[data-action]').all():assert button.bounding_box()['width']>100
  if width in [390,1440]:page.screenshot(path=str(OUT/f'scene-{width}.png'),full_page=True,animations='disabled')
 # Settings and progress survive reload independently; a new game does not erase audio preferences.
 page.locator('#menu').click();page.locator('#settingsBtn').click();page.get_by_role('slider',name='Громкость музыки').fill('21');page.locator('#closeDialog').click();page.locator('#start').click();page.get_by_role('button',name='Начать сначала',exact=True).click();assert state()['flags']=={};assert page.evaluate('JSON.parse(localStorage.getItem("shilo-sound-v1")).musicVolume')==.21
 page.reload(wait_until='domcontentloaded');page.locator('#resume').evaluate('(b)=>b.click()');assert state()['contacts']['serega']['node']=='discovery'
 # Loop crossing does not stop or restart the soundtrack on navigation.
 page.locator('#menu').click();page.locator('#resume').click();page.wait_for_timeout(100);page.locator('#music').evaluate('(m)=>{m.currentTime=m.duration-.12;}');page.wait_for_timeout(500);assert page.locator('#music').evaluate('(m)=>m.loop&&!m.paused&&m.currentTime<2')
 assert not errors,errors;assert not bad,bad
 result={'passed':True,'fullUIPlaythrough':True,'days':len(days),'renderedScenes':len(witnesses),'clickedBranches':ui_branches,'viewports':7,'audio':audio_result,'musicLoop':True,'saveReload':True,'archive':True,'errors':errors,'badResources':bad}
 (OUT/'browser-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False));b.close()
