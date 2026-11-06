"""Real mouse/file/PNG checks for image-filled cuts and alignment guides."""
from pathlib import Path
import base64,io,json,os,time
from PIL import Image,ImageDraw
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent;OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)
BASE=os.environ.get('PANEL_TEST_URL','http://127.0.0.1:4173')
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1500,'height':1000},accept_downloads=True)
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    def wait(expr,seconds=30):
        deadline=time.monotonic()+seconds
        while time.monotonic()<deadline:
            if page.evaluate(expr):return
            page.wait_for_timeout(80)
        raise AssertionError('Timed out: '+expr)
    def act(name):page.locator(f'[data-action="{name}"]').first.click()
    def state():return page.evaluate('PanelStudio.getProject()')
    def selected():return page.evaluate('PanelStudio.getProject().pages.flatMap(p=>p.objects).find(o=>o.id===PanelStudio.getSelection())')
    def prop(name,value):
        loc=page.locator(f'[data-prop="{name}"]')
        if loc.get_attribute('type') in ['range','color']:
            loc.evaluate('(el,v)=>{el.value=v;el.dispatchEvent(new Event("input",{bubbles:true}));}',str(value))
        else:loc.fill(str(value))
        loc.dispatch_event('change')
    def world(x,y):return page.evaluate('([x,y])=>{const p=new DOMPoint(x,y).matrixTransform(document.querySelector(".page-canvas").getScreenCTM());return {x:p.x,y:p.y}}',[x,y])
    def mouse_to(x,y):p=world(x,y);page.mouse.move(p['x'],p['y'])
    def drag_world(x,y,dx,dy,up=True):
        mouse_to(x,y);page.mouse.down();p=world(x+dx,y+dy);page.mouse.move(p['x'],p['y'],steps=6)
        if up:page.mouse.up()
    def export(fmt='png',transparent=False):
        act('export');page.locator('#export-format').select_option(fmt)
        if transparent:page.locator('#export-transparent').check()
        with page.expect_download() as download:act('do-export')
        path=OUT/f'cut-export.{fmt}';download.value.save_as(str(path));return path
    def open_doc(doc):
        path=OUT/'cut-fixture.panel.json';path.write_text(json.dumps(doc));page.locator('#project-input').set_input_files(str(path))
        wait('PanelStudio.getProject().name==='+json.dumps(doc['name']))
    def drop_file(path,x,y,event='drop'):
        data=base64.b64encode(path.read_bytes()).decode();p=world(x,y)
        page.evaluate('''({data,x,y,name,event})=>{const raw=atob(data),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0)),dt=new DataTransfer();dt.items.add(new File([bytes],name,{type:'image/png'}));document.elementFromPoint(x,y).dispatchEvent(new DragEvent(event,{bubbles:true,cancelable:true,clientX:x,clientY:y,dataTransfer:dt}));}''',{'data':data,'x':p['x'],'y':p['y'],'name':path.name,'event':event})
    page.goto(BASE);page.wait_for_selector('body[data-ready="true"]',timeout=60000)
    assert state()['pages'][0]['objects']==[] and state()['assets']=={}
    assert page.evaluate('typeof window.DEMO_ASSETS')=='undefined'
    page.locator('[data-tab="images"]').click();assert page.locator('[data-demo-image]').count()==0
    assert '배경 라이브러리' not in page.locator('#library-content').inner_text()
    act('canvas-size');page.locator('#new-width').fill('1000');page.locator('#new-height').fill('800');act('apply-canvas-size')
    act('snap');assert page.locator('#snap-button').get_attribute('aria-pressed')=='false'
    page.locator('.rail-item[data-tab="panels"]').click();page.locator('[data-add-panel="trapezoid"]').click()
    for key,value in {'x':100,'y':100,'w':400,'h':240,'strokeWidth':8,'stroke':'#000000'}.items():prop(key,value)
    frame=selected();fid=frame['id']
    art=OUT/'two-colors.png';im=Image.new('RGB',(400,240),'red');ImageDraw.Draw(im).rectangle((200,0,400,240),fill='blue');im.save(art)
    with page.expect_file_chooser() as picker:act('frame-import')
    picker.value.set_files(str(art));wait("Boolean(PanelStudio.getProject().pages[0].objects[0].assetId)")
    assert selected()['id']==fid and selected()['type']=='shape'
    for key in ['x','y','w','h','crop','points','strokeWidth']:assert selected()[key]==frame[key],key
    assert page.locator('[data-handle^="content-"]').count()==4
    image=Image.open(export()).convert('RGB');assert image.getpixel((280,220))==(255,0,0);assert image.getpixel((320,220))==(0,0,255);assert image.getpixel((101,101))==(255,255,255)
    drag_world(300,220,50,0);assert abs(selected()['imageX']-.125)<.001
    assert selected()['x']==100 and selected()['w']==400
    image=Image.open(export()).convert('RGB');assert image.getpixel((320,220))==(255,0,0)
    act('reset-image');before=selected();box=page.locator('[data-handle="content-se"]').bounding_box()
    page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);page.mouse.down();page.mouse.move(box['x']+65,box['y']+40,steps=5);page.mouse.up()
    assert selected()['imageZoom']>1.1
    for key in ['x','y','w','h','points','crop']:assert selected()[key]==before[key]
    page.keyboard.press('Escape');assert selected()['id']==fid and page.locator('[data-handle="se"]').count()==1
    prop('rotation',23);p=world(300,220);page.mouse.dblclick(p['x'],p['y']);assert page.locator('[data-handle^="content-"]').count()==4
    before=selected();drag_world(300,220,25,20);assert selected()['imageX']!=before['imageX'] and selected()['rotation']==23
    page.keyboard.press('Escape');prop('rotation',0);act('reset-image');prop('strokeWidth',30)
    image=Image.open(export()).convert('RGB');assert image.getpixel((300,327))==(0,0,0);assert image.getpixel((300,363))==(255,255,255)
    prop('opacity',50);image=Image.open(export(transparent=True)).convert('RGBA')
    assert 126<=image.getpixel((280,220))[3]<=129,image.getpixel((280,220))
    assert 126<=image.getpixel((300,340))[3]<=129,image.getpixel((300,340))
    assert image.getpixel((101,101))[3]==0
    prop('opacity',100);svg=export('svg').read_text();assert '<image' in svg and 'clipPath' in svg and 'frame-placeholder' not in svg and 'snap-guides' not in svg
    print('PASS: frame file import, independent pan/resize (including rotation), clipping, border width and PNG/SVG consistency',flush=True)

    with page.expect_download() as dl:act('save')
    saved_path=OUT/'cut-saved.panel.json';dl.value.save_as(str(saved_path));saved=json.loads(saved_path.read_text())
    assert len(saved['assets'])==1 and saved['pages'][0]['objects'][0]['assetId'] in saved['assets']
    wait("document.querySelector('#save-state').textContent.includes('이 기기에')")
    page.reload();page.wait_for_selector('body[data-ready="true"]',timeout=60000);assert state()['pages']==saved['pages']
    page.locator(f'[data-layer="{fid}"]').click();act('frame-remove-image');assert 'assetId' not in selected()
    act('undo');assert state()['pages'][0]['objects'][0]['assetId'] in state()['assets']
    page.locator(f'[data-layer="{fid}"]').click();act('frame-choose-asset');page.locator('[data-frame-asset]').first.click();assert selected()['assetId'] in state()['assets']
    # External drag/drop targets the polygon, not its rectangular bounding box.
    second=OUT/'green.png';Image.new('RGB',(200,200),'lime').save(second)
    drop_file(second,300,220,'dragover');assert page.locator('.frame-drop-highlight').count()==1
    drop_file(second,300,220);wait("Object.values(PanelStudio.getProject().assets).some(a=>a.name==='green.png')")
    assert len(state()['pages'][0]['objects'])==1 and selected()['id']==fid
    page.keyboard.press('Escape');page.screenshot(path=str(OUT/'v1.2-frame.png'))
    page.locator(f'[data-lock="{fid}"]').click();before=state()['pages'][0]['objects'][0]
    drop_file(art,300,220);wait('PanelStudio.getProject().pages[0].objects.length===2')
    assert state()['pages'][0]['objects'][0]==before
    page.locator('#project-input').set_input_files(str(saved_path));wait("PanelStudio.getProject().pages[0].objects.length===1")
    assert state()['pages']==saved['pages']
    print('PASS: frame assets survive project/restart, undo and reuse; drag/drop respects shape and locked cuts',flush=True)

    asset=next(iter(saved['assets'].values()));asset['id']='source'
    cut={'id':'cut','name':'컷','type':'shape','x':120,'y':100,'w':240,'h':160,'rotation':0,'opacity':1,'visible':True,'locked':False,'crop':'rectangle','points':[[0,0],[1,0],[1,1],[0,1]],'assetId':'source','imageZoom':1,'imageX':0,'imageY':0,'strokeWidth':3,'stroke':'#000000','fill':'#ffffff'}
    other={**cut,'id':'photo','type':'image','name':'기준 이미지','x':600,'y':560,'w':200,'h':160}
    doc={'format':'panel-studio','version':1,'name':'snap-fixture','activePage':'p1','assets':{'source':asset},'fonts':[],'pages':[{'id':'p1','name':'정렬','width':1000,'height':800,'background':'#ffffff','objects':[cut,other]}]}
    open_doc(doc)
    if page.locator('#snap-button').get_attribute('aria-pressed')=='false':act('snap')
    drag_world(240,180,263,222,False)
    assert abs(selected()['x']-380)<.001 and abs(selected()['y']-320)<.001
    assert page.locator('[data-guide-source="page"]').count()==2
    page.screenshot(path=str(OUT/'v1.2-center-guide.png'));page.mouse.up();assert page.locator('.snap-guides').count()==0
    drag_world(500,400,223,0,False);assert abs(selected()['x']-600)<.001
    assert page.locator('[data-guide-source="object"]').count()>=1
    page.screenshot(path=str(OUT/'v1.2-object-guide.png'));page.mouse.up()
    page.keyboard.down('Alt');drag_world(720,400,4,0,False)
    assert abs(selected()['x']-604)<.001 and page.locator('.snap-guides').count()==0
    page.mouse.up();page.keyboard.up('Alt');act('snap');drag_world(724,400,2,0);assert abs(selected()['x']-606)<.001
    act('snap');prop('x',100);prop('y',100);prop('w',240);prop('h',160)
    box=page.locator('[data-handle="se"]').bounding_box();page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);page.mouse.down();mouse_to(597,350)
    assert abs(selected()['w']-500)<.001;assert page.locator('[data-guide-source="object"]').count()>=1
    page.mouse.up();assert selected()['x']==100 and selected()['y']==100
    for width in [1200,950]:
        page.set_viewport_size({'width':width,'height':850});act('fit')
        for selector in ['#snap-button','[data-action="canvas-size"]','[data-quick-text]']:
            box=page.locator(selector).bounding_box();assert box and box['x']>=0 and box['x']+box['width']<=width
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    print('PASS: real pointer snapping to page center/object edges, Alt bypass, toggle, resizing and compact layout',flush=True)
    assert not errors,errors
    context.close();browser.close()
