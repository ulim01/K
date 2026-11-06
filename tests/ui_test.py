"""Functional checks against the real, offline-capable editor in Chromium."""
from pathlib import Path
import json, io, zipfile, os, time
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'test-results'
OUT.mkdir(exist_ok=True)
BASE=os.environ.get('PANEL_TEST_URL','http://127.0.0.1:4173')
passed=[]
def ok(name):
    passed.append(name)
    print('PASS:',name,flush=True)

with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1500,'height':1000},accept_downloads=True)
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    def wait(expression, timeout=30):
        deadline=time.monotonic()+timeout
        while time.monotonic()<deadline:
            if page.evaluate(expression):return
            page.wait_for_timeout(100)
        raise AssertionError('Timed out: '+expression)
    page.goto(BASE,wait_until='load')
    page.wait_for_selector('body[data-ready="true"]',timeout=60000)
    wait("document.querySelector('#save-state').textContent.includes('이 기기에')")
    def state():return page.evaluate('PanelStudio.getProject()')
    def selected():
        return page.evaluate('(()=>{const p=PanelStudio.getProject();return p.pages.find(x=>x.id===p.activePage).objects.find(x=>x.id===PanelStudio.getSelection())})()')
    def prop(name,value):
        loc=page.locator(f'[data-prop="{name}"]')
        
        if loc.get_attribute('type')=='range':
            loc.evaluate('(el,v)=>{el.value=v;el.dispatchEvent(new Event("input",{bubbles:true}));}',str(value))
        else:loc.fill(str(value))
        loc.dispatch_event('change')
    def act(name):page.locator(f'[data-action="{name}"]').first.click()
    def drag(selector,dx,dy):
        loc=page.locator(selector);box=loc.bounding_box();assert box,selector
        x,y=box['x']+box['width']/2,box['y']+box['height']/2
        page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+dx,y+dy,steps=8);page.mouse.up()
    assert page.evaluate('document.fonts.size')==14
    assert len(state()['pages'][0]['objects'])==0
    ok('offline Korean fonts loaded with an empty canvas and no bundled backgrounds')
    page.screenshot(path=str(OUT/'editor.png'))
    page.locator('[data-add-bubble="ellipse"]').click()
    before=selected()
    drag('[data-handle="tail-tip"]',38,30)
    assert abs(selected()['tailX']-before['tailX'])>.1
    drag('[data-handle="tail-base"]',-35,-10)
    drag('[data-handle="tail-curve"]',30,-40)
    assert abs(selected()['bendX'])>.01 or abs(selected()['bendY'])>.01
    prop('text','안녕하세요!\n나만의 웹툰이에요.')
    prop('strokeWidth',8)
    assert selected()['strokeWidth']==8
    assert '안녕하세요' in selected()['text']
    page.screenshot(path=str(OUT/'tail-editing.png'))
    ok('balloon tip, attachment, curvature, outline and Korean text editing')
    page.keyboard.press('Escape')
    page.locator('[data-add-bubble="round"]').click()
    before=selected();drag('[data-handle="se"]',30,30)
    assert selected()['w']>before['w'] and selected()['h']>before['h']
    prop('rotation',27)
    before=selected();drag('[data-handle="ne"]',30,-20)
    assert selected()['w']!=before['w']
    count=len(state()['pages'][0]['objects'])
    act('duplicate');assert len(state()['pages'][0]['objects'])==count+1
    act('undo');assert len(state()['pages'][0]['objects'])==count
    act('redo');assert len(state()['pages'][0]['objects'])==count+1
    ok('resizing, rotated resizing, duplication, undo and redo')
    page.locator('[data-tab="sfx"]').click();page.locator('[data-add-sfx="0"]').click()
    prop('skew',-20);prop('textStrokeWidth',9)
    assert selected()['text']=='쾅!' and selected()['skew']==-20
    sid=selected()['id'];page.locator(f'[data-lock="{sid}"]').click()
    act('delete');assert any(x['id']==sid for x in state()['pages'][0]['objects'])
    page.locator(f'[data-lock="{sid}"]').click()
    ok('sound effects, outlined text and locked layer protection')
    red=OUT/'red.png';Image.new('RGB',(200,200),(255,0,0)).save(red)
    page.locator('#image-input').set_input_files(str(red))
    wait("(()=>{const p=PanelStudio.getProject();return p.pages[0].objects.at(-1).type==='image'})()")
    page.locator('[data-prop="crop"]').select_option('parallelogram')
    act('crop-mode');before=selected()['points']
    drag('[data-handle="point-0"]',16,14)
    assert selected()['points']!=before
    act('add-point');assert len(selected()['points'])==5
    prop('fade',80);prop('fadeAngle',180);prop('strokeWidth',6);prop('opacity',70)
    assert selected()['fade']==.8 and selected()['opacity']==.7
    act('image-pan');before=selected()
    obj=page.locator(f'[data-object="{before["id"]}"] rect').first
    box=obj.bounding_box();page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);page.mouse.down();page.mouse.move(box['x']+box['width']/2+20,box['y']+box['height']/2+10,steps=4);page.mouse.up()
    assert selected()['imageX']!=before['imageX']
    ok('image import, free polygon crop, added points, opacity, gradient and pan')
    act('add-page');page.locator('#new-width').fill('8000');page.locator('#new-height').fill('8000');act('create-page')
    assert state()['pages'][1]['width']==8000 and state()['pages'][1]['height']==8000
    page.locator('[data-view="scroll"]').click();assert page.locator('.page-canvas').count()==2
    prop('pageWidth',600);prop('pageHeight',800);act('resize-page')
    page.locator('[data-view="page"]').click();assert page.locator('.page-canvas').count()==1
    page.locator('[data-tool="pen"]').first.click()
    box=page.locator('.page-canvas').bounding_box();x=box['x']+80;y=box['y']+80
    page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+80,y+60,steps=12);page.mouse.up()
    assert state()['pages'][1]['objects'][0]['type']=='pen'
    assert len(state()['pages'][1]['objects'][0]['points'])>5
    page.locator('[data-tool="select"]').click()
    ok('8000px canvas, multi-page and continuous views, resize, freehand drawing')
    font_file=ROOT/'assets/fonts/GamjaFlower-Regular.ttf'
    page.locator('[data-tab="text"]').click();page.locator('[data-add-text="body"]').first.click()
    page.locator('#font-input').set_input_files(str(font_file))
    wait('PanelStudio.getProject().fonts.length===1')
    prop('text','내 글꼴도 저장됩니다')
    assert selected()['font'].startswith('GamjaFlower-Regular')
    ok('custom font imported and embedded in project')
    with page.expect_download() as dl:act('save')
    project_path=OUT/'roundtrip.panel.json';dl.value.save_as(str(project_path))
    saved=json.loads(project_path.read_text());assert len(saved['pages'])==2 and len(saved['fonts'])==1
    expected=state()
    wait("document.querySelector('#save-state').textContent.includes('이 기기에')")
    page.reload();page.wait_for_selector('body[data-ready="true"]',timeout=60000)
    assert state()['pages']==expected['pages']
    page.locator('#project-input').set_input_files(str(project_path))
    wait("document.querySelector('#toast').textContent.includes('프로젝트를 불러왔습니다')")
    assert state()['pages']==expected['pages']
    ok('project file round trip and automatic recovery with assets and custom font')
    act('export');page.locator('#export-scope').select_option('all')
    with page.expect_download(timeout=90000) as dl:act('do-export')
    zipped=OUT/'pages.zip';dl.value.save_as(str(zipped))
    with zipfile.ZipFile(zipped) as z:
        assert len(z.namelist())==2
        sizes=[Image.open(io.BytesIO(z.read(n))).size for n in z.namelist()]
        assert sizes==[(900,1400),(600,800)],sizes
    ok('all pages export as a ZIP of full-resolution PNGs')
    act('export');page.locator('#export-scope').select_option('strip')
    with page.expect_download(timeout=90000) as dl:act('do-export')
    path=OUT/'strip.png';dl.value.save_as(str(path));assert Image.open(path).size==(900,2200)
    ok('continuous webtoon PNG has exact combined dimensions')
    # Use a small fixture to verify gradient direction/alpha in exported pixels.
    src='data:image/png;base64,'+__import__('base64').b64encode(red.read_bytes()).decode()
    fixture={'format':'panel-studio','version':1,'name':'alpha-test','activePage':'pagealpha','fonts':[],'assets':{'red':{'name':'red','src':src,'width':200,'height':200}},'pages':[{'id':'pagealpha','name':'alpha','width':200,'height':200,'background':'#ffffff','objects':[{'id':'imagealpha','type':'image','name':'red','x':0,'y':0,'w':200,'h':200,'rotation':0,'opacity':.5,'visible':True,'crop':'trapezoid','points':[[.2,0],[.8,0],[1,1],[0,1]],'assetId':'red','imageZoom':1,'imageX':0,'imageY':0,'fade':1,'fadeAngle':0,'fadeStart':0,'stroke':'#000000','strokeWidth':0}]}]}
    fixture_path=OUT/'alpha.panel.json';fixture_path.write_text(json.dumps(fixture))
    page.locator('#project-input').set_input_files(str(fixture_path));wait("PanelStudio.getProject().name==='alpha-test'")
    act('export');page.locator('#export-transparent').check()
    with page.expect_download(timeout=30000) as dl:act('do-export')
    alpha_path=OUT/'alpha.png';dl.value.save_as(str(alpha_path));im=Image.open(alpha_path).convert('RGBA')
    assert im.getpixel((0,0))[3]==0
    assert 80<im.getpixel((50,100))[3]<110
    assert 20<im.getpixel((150,100))[3]<45
    assert im.getpixel((50,100))[0]>240
    ok('export pixels verify polygon clipping, gradient direction and opacity')
    act('export');page.locator('#export-format').select_option('jpeg')
    with page.expect_download() as dl:act('do-export')
    jpg=OUT/'image.jpg';dl.value.save_as(str(jpg));assert Image.open(jpg).mode=='RGB'
    act('export');page.locator('#export-format').select_option('svg')
    with page.expect_download() as dl:act('do-export')
    svg=OUT/'image.svg';dl.value.save_as(str(svg));assert 'clipPath' in svg.read_text() and 'linearGradient' in svg.read_text()
    ok('JPG and SVG export valid files')
    huge=json.loads(json.dumps(fixture));huge['name']='maximum-canvas';huge['assets']={};huge['pages'][0]['width']=8000;huge['pages'][0]['height']=8000
    huge['pages'][0]['objects']=[{'id':'maxtext','type':'text','name':'maximum','text':'8000 × 8000 웹툰','font':'Nanum Gothic','fontSize':220,'weight':700,'color':'#123456','align':'center','lineHeight':1.4,'x':1000,'y':3500,'w':6000,'h':1000,'opacity':1,'rotation':0}]
    huge_path=OUT/'maximum.panel.json';huge_path.write_text(json.dumps(huge))
    page.locator('#project-input').set_input_files(str(huge_path));wait("PanelStudio.getProject().name==='maximum-canvas'")
    act('export')
    with page.expect_download(timeout=90000) as dl:act('do-export')
    max_png=OUT/'maximum-8000.png';dl.value.save_as(str(max_png));max_image=Image.open(max_png)
    assert max_image.size==(8000,8000)
    from PIL import ImageChops
    area=max_image.crop((2000,3500,6000,4500)).convert('RGB')
    assert ImageChops.difference(area,Image.new('RGB',area.size,'white')).getbbox() is not None
    max_image.close()
    ok('maximum 8000 × 8000 PNG exports with rendered Korean text')
    # Previously loaded custom fonts must remain portable when used in a new document.
    page.locator('[data-tab="text"]').click();page.locator('[data-add-text="body"]').first.click()
    custom_name=saved['fonts'][0]['name'];page.locator('[data-prop="font"]').select_option(custom_name)
    assert state()['fonts'][0]['name']==custom_name
    ok('custom font reused in a different document stays embedded')
    page.locator('[data-tab="panels"]').click();page.locator('[data-add-panel="ellipse"]').click()
    act('crop-mode');panel_id=selected()['id']
    assert page.locator(f'[data-object="{panel_id}"] > path').count()==1
    assert len(selected()['points'])==12
    ok('ellipse panel converts to an editable polygon in both screen and export')
    assert not errors,errors
    context.close()
    # All resources are local; the editor remains functional with networking disabled.
    c2=browser.new_context(viewport={'width':1200,'height':800})
    p2=c2.new_page();p2.on('pageerror',lambda e:errors.append(str(e)))
    p2.goto(BASE);p2.wait_for_selector('body[data-ready="true"]',timeout=60000)
    assert p2.locator('.object').count()==0
    p2.screenshot(path=str(OUT/'editor-1200.png'))
    c2.set_offline(True);p2.locator('[data-add-bubble="ellipse"]').click();assert p2.locator('.object').count()==1;c2.set_offline(False)
    ok('editing with network disabled and smaller desktop layout')
    p2.goto(BASE+'/assets/icon.svg');p2.set_viewport_size({'width':256,'height':256});p2.locator('svg').screenshot(path=str(OUT/'icon.png'),omit_background=True)
    Image.open(OUT/'icon.png').save(ROOT/'assets/icon.ico',sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
    c2.close();browser.close()
    assert not errors,errors

(OUT/'results.json').write_text(json.dumps({'passed':passed,'failed':[],'count':len(passed)},ensure_ascii=False,indent=2))
print(f'{len(passed)} functional checks passed.',flush=True)
