"""Real rotation gestures, text alignment pixels, and all 44 editable reference balloons."""
from pathlib import Path
import base64, io, json, math, os, time
from PIL import Image, ImageChops
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
    def ready():page.wait_for_selector('body[data-ready="true"]',timeout=60000)
    def act(name):page.locator(f'[data-action="{name}"]').first.click()
    def state():return page.evaluate('PanelStudio.getProject()')
    def selected():return page.evaluate('PanelStudio.getProject().pages.flatMap(p=>p.objects).find(o=>o.id===PanelStudio.getSelection())')
    def prop(name,value):
        loc=page.locator(f'[data-prop="{name}"]')
        if loc.get_attribute('type') in ['range','color']:
            loc.evaluate('(el,v)=>{el.value=v;el.dispatchEvent(new Event("input",{bubbles:true}));}',str(value))
        else:loc.fill(str(value))
        loc.dispatch_event('change')
    def open_doc(doc):
        path=OUT/'rotation-bubbles-fixture.panel.json';path.write_text(json.dumps(doc));page.locator('#project-input').set_input_files(str(path))
        wait('PanelStudio.getProject().name==='+json.dumps(doc['name']))
    def world(x,y):return page.evaluate('([x,y])=>{const p=new DOMPoint(x,y).matrixTransform(document.querySelector(".page-canvas").getScreenCTM());return {x:p.x,y:p.y}}',[x,y])
    def export(fmt,name):
        act('export');page.locator('#export-format').select_option(fmt)
        with page.expect_download() as download:act('do-export')
        path=OUT/f'{name}.{fmt}';download.value.save_as(str(path));return path
    def render():
        data=page.evaluate('async()=>{const c=await PanelStudio.renderPage();return c.toDataURL()}')
        return Image.open(io.BytesIO(base64.b64decode(data.split(',')[1]))).convert('RGB')
    def rotate_to(angle,modifier=None,finish=True):
        before=selected();box=page.locator('[data-handle="rotate"]').bounding_box()
        center=world(before['x']+before['w']/2,before['y']+before['h']/2)
        x=box['x']+box['width']/2;y=box['y']+box['height']/2
        radius=math.hypot(x-center['x'],y-center['y'])
        theta=math.atan2(y-center['y'],x-center['x'])+math.radians(angle-before['rotation'])
        if modifier:page.keyboard.down(modifier)
        page.mouse.move(x,y);page.mouse.down();page.mouse.move(center['x']+radius*math.cos(theta),center['y']+radius*math.sin(theta),steps=8)
        if finish:page.mouse.up()
        if modifier:page.keyboard.up(modifier)
        return before
    page.goto(BASE);ready()
    act('canvas-size');page.locator('#new-width').fill('1000');page.locator('#new-height').fill('800');act('apply-canvas-size')
    page.locator('[data-quick-text]').click()
    for key,value in {'text':'한글 텍스트','x':80,'y':120,'w':600,'h':160,'fontSize':40,'padding':30,'color':'#000000'}.items():prop(key,value)
    boxes=[]
    for align,anchor in [('left','start'),('center','middle'),('right','end')]:
        page.locator(f'[data-text-align="{align}"]').click()
        assert selected()['align']==align
        assert page.locator(f'[data-text-align="{align}"]').get_attribute('aria-pressed')=='true'
        group=page.locator(f'[data-object="{selected()["id"]}"]')
        assert group.locator('text').get_attribute('text-anchor')==anchor
        im=render();box=ImageChops.difference(im,Image.new('RGB',im.size,'white')).getbbox();assert box
        boxes.append(box)
        im.save(OUT/f'v1.3-text-{align}.png')
    assert 108<=boxes[0][0]<=116,boxes
    assert abs((boxes[1][0]+boxes[1][2])/2-380)<6,boxes
    assert 644<=boxes[2][2]<=654,boxes
    assert max(b[2]-b[0] for b in boxes)-min(b[2]-b[0] for b in boxes)<=2
    svg=export('svg','v1.3-text-alignment').read_text();assert 'text-anchor="end"' in svg and 'rotation-guide' not in svg
    saved=state();wait("document.querySelector('#save-state').textContent.includes('이 기기에')")
    page.reload();ready();assert state()['pages']==saved['pages']
    page.locator(f'[data-layer="{saved["pages"][0]["objects"][0]["id"]}"]').click()
    assert page.locator('[data-text-align="right"]').get_attribute('aria-pressed')=='true'
    page.screenshot(path=str(OUT/'v1.3-text-controls.png'))
    print('PASS: visible left/center/right buttons, matching SVG anchors and PNG pixels, autosave/reload',flush=True)

    art=io.BytesIO();Image.new('RGB',(200,160),'#64a68a').save(art,format='PNG')
    asset={'id':'source','name':'rotation.png','width':200,'height':160,'src':'data:image/png;base64,'+base64.b64encode(art.getvalue()).decode()}
    cut={'id':'cut','name':'회전할 컷','type':'shape','x':180,'y':220,'w':240,'h':160,'rotation':0,'opacity':1,'visible':True,'locked':False,'crop':'rectangle','points':[[0,0],[1,0],[1,1],[0,1]],'assetId':'source','imageZoom':1,'imageX':0,'imageY':0,'strokeWidth':3,'stroke':'#000000','fill':'#ffffff'}
    other={**cut,'id':'photo','type':'image','name':'기준 이미지','x':650,'y':500,'w':180,'h':130,'rotation':22.5}
    doc={'format':'panel-studio','version':1,'name':'rotation-fixture','activePage':'p1','assets':{'source':asset},'fonts':[],'pages':[{'id':'p1','name':'각도','width':1000,'height':800,'background':'#ffffff','objects':[cut,other]}]}
    open_doc(doc);page.locator('[data-layer="cut"]').click()
    rotate_to(43.1,finish=False);assert selected()['rotation']==45
    assert page.locator('.rotation-guide[data-angle-source="step"]').count()==1
    page.screenshot(path=str(OUT/'v1.3-angle-step.png'));page.mouse.up();assert page.locator('.rotation-guide').count()==0
    act('undo');page.locator('[data-layer="cut"]').click();assert selected()['rotation']==0
    rotate_to(21.9,finish=False);assert selected()['rotation']==22.5
    assert '평행 맞춤' in page.locator('.rotation-guide').text_content()
    page.screenshot(path=str(OUT/'v1.3-angle-peer.png'));page.mouse.up()
    rotate_to(111.1,finish=False);assert selected()['rotation']==112.5
    assert '직각 맞춤' in page.locator('.rotation-guide').text_content();page.mouse.up()
    rotate_to(44.1,'Alt',False);assert abs(selected()['rotation']-44.1)<.1
    assert page.locator('.rotation-guide[data-angle-source="free"]').count()==1;page.mouse.up()
    rotate_to(38,'Shift');assert selected()['rotation']==45
    act('snap');rotate_to(44.2);assert abs(selected()['rotation']-44.2)<.1
    act('snap');prop('rotation',0);rotate_to(-1.7);assert selected()['rotation']==0
    for key in ['x','y','w','h','imageZoom','imageX','imageY']:assert selected()[key]==cut[key]
    page.locator('[data-layer="photo"]').click();rotate_to(88.7);assert selected()['rotation']==90
    rotate_to(28.4,finish=False);page.locator('.page-canvas').dispatch_event('pointercancel');page.mouse.up()
    assert selected()['rotation']==90 and page.locator('.rotation-guide').count()==0
    svg=export('svg','v1.3-rotated-cut').read_text();assert 'rotation-guide' not in svg and 'selection-overlay' not in svg and '<image' in svg
    print('PASS: real cut/image rotation, 15-degree/object/perpendicular guides, zero crossing, Alt/Shift, toggle, undo and cancel',flush=True)

    act('new');page.locator('#new-width').fill('1200');page.locator('#new-height').fill('1000');act('create-project')
    page.locator('[data-tab="bubbles"]').click();created=[]
    for sheet,count in [(1,11),(2,33)]:
        page.locator(f'[data-bubble-collection="{sheet}"]').click()
        assert page.locator('[data-add-bubble]').count()==count
        for number in range(1,count+1):
            shape=f'sheet{sheet}-{number:02d}';page.locator(f'[data-add-bubble="{shape}"]').click()
            o=selected();assert o['type']=='bubble' and o['shape']==shape
            group=page.locator(f'[data-object="{o["id"]}"]')
            assert group.locator(':scope > path').get_attribute('d').endswith('Z')
            if shape in ['sheet1-03','sheet2-17','sheet2-33']:
                prop('text','첫 번째\n대사');prop('text2','두 번째\n대사')
                assert group.locator('[data-dialogue]').count()==2
                assert '첫 번째' in group.locator('[data-dialogue="text"]').text_content()
                assert '두 번째' in group.locator('[data-dialogue="text2"]').text_content()
                page.locator('[data-text-align="left"]').click()
                assert group.locator('[data-dialogue] text[text-anchor="start"]').count()==2
                page.locator('[data-text-align="center"]').click()
                if shape=='sheet2-33':
                    act('save-material');page.locator('#material-name').fill('두 대사 말풍선');act('create-material')
                    wait('PanelStudio.getMaterials().items.length===1 && PanelStudio.materialsSaved()')
            if shape=='sheet2-32':assert group.locator(':scope > ellipse').count()==3
            if shape=='sheet2-04':
                old=group.locator(':scope > path').get_attribute('d')
                box=page.locator('[data-handle="tail-tip"]').bounding_box()
                page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);page.mouse.down();page.mouse.move(box['x']+55,box['y']-20,steps=5);page.mouse.up()
                assert group.locator(':scope > path').get_attribute('d')!=old
                act('undo');page.locator(f'[data-layer="{o["id"]}"]').click()
            created.append(selected());act('delete')
    assert len(created)==44
    # Export the actual editor's vectors and raster text in a readable numbered contact sheet.
    for sheet in [1,2]:
        items=[o.copy() for o in created if o['shape'].startswith(f'sheet{sheet}-')]
        for i,o in enumerate(items):
            scale=.65;o.update(x=(i%4)*400+(400-o['w']*scale)/2,y=(i//4)*380+40,w=o['w']*scale,h=o['h']*scale,fontSize=o['fontSize']*scale,padding=o['padding']*scale,strokeWidth=2)
            o['tailWidth']*=scale
            if 'text2' not in o:o['text']=o['shape'].split('-')[1]+' · 대사'
        gallery={'format':'panel-studio','version':1,'name':f'reference-sheet-{sheet}','activePage':'gallery','assets':{},'fonts':[],'pages':[{'id':'gallery','name':'말풍선 모음','width':1600,'height':math.ceil(len(items)/4)*380,'background':'#e3ece6','objects':items}]}
        open_doc(gallery)
        svg=export('svg',f'v1.3-catalog-{sheet}').read_text()
        assert svg.count('data-dialogue="text"')==len(items)
        assert 'rotation-guide' not in svg and '<image' not in svg
        png=Image.open(export('png',f'v1.3-catalog-{sheet}'));assert png.size==(1600,math.ceil(len(items)/4)*380)
        for i,o in enumerate(items):
            cell=png.crop(((i%4)*400,(i//4)*380,(i%4+1)*400,(i//4+1)*380)).convert('RGB')
            assert sum(1 for r,g,b in cell.getdata() if r>245 and g>245 and b>245)>1000,o['shape']
    page.locator('[data-tab="bubbles"]').click();item=page.evaluate('PanelStudio.getMaterials().items[0]')
    page.locator(f'[data-add-material="{item["id"]}"]').click();assert selected()['text2']=='두 번째\n대사'
    with page.expect_download() as download:act('save')
    path=OUT/'v1.3-catalog-saved.panel.json';download.value.save_as(str(path));saved=json.loads(path.read_text())
    wait("document.querySelector('#save-state').textContent.includes('이 기기에')")
    page.reload();ready();assert state()['pages']==saved['pages']
    assert page.evaluate('PanelStudio.getMaterials().items[0].template.text2')=='두 번째\n대사'
    page.locator('#project-input').set_input_files(str(path));wait('PanelStudio.getProject().pages[0].objects.length===34')
    assert state()['pages']==saved['pages']
    assert not errors,errors
    print('PASS: all 44 presets through real UI, editable tails, separate linked dialogues, PNG/SVG exports, material/project persistence',flush=True)
    context.close();browser.close()
