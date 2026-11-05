"""Exercise the v1.1 material library, saved data, geometry and visible controls."""
from pathlib import Path
import base64, io, json, os, time
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'test-results'
OUT.mkdir(exist_ok=True)
BASE=os.environ.get('PANEL_TEST_URL','http://127.0.0.1:4173')
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1500,'height':1000},accept_downloads=True)
    page=context.new_page();errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    def wait(expr,seconds=30):
        deadline=time.monotonic()+seconds
        while time.monotonic()<deadline:
            if page.evaluate(expr):return
            page.wait_for_timeout(100)
        raise AssertionError('Timed out: '+expr)
    def act(name):page.locator(f'[data-action="{name}"]').first.click()
    def state():return page.evaluate('PanelStudio.getProject()')
    def materials():return page.evaluate('PanelStudio.getMaterials()')
    def selected():return page.evaluate('PanelStudio.getProject().pages.flatMap(p=>p.objects).find(o=>o.id===PanelStudio.getSelection())')
    def prop(name,value):
        loc=page.locator(f'[data-prop="{name}"]')
        if loc.get_attribute('type') in ['range','color']:
            loc.evaluate('(el,v)=>{el.value=v;el.dispatchEvent(new Event("input",{bubbles:true}));}',str(value))
        else:loc.fill(str(value))
        loc.dispatch_event('change')
    def ready():page.wait_for_selector('body[data-ready="true"]',timeout=60000)
    def new_project():
        act('new');page.locator('#new-width').fill('1000');page.locator('#new-height').fill('800');act('create-project')
    def export_library(path):
        with page.expect_download() as dl:act('export-materials')
        dl.value.save_as(str(path))
    page.goto(BASE);ready();new_project()
    prop('pageBackground','#ccd9cc')
    page.locator('[data-add-bubble="caption"]').click()
    prop('x',50);prop('y',50);prop('w',300);prop('h',150);prop('text','각진 내레이션');prop('strokeWidth',4)
    cap=selected();node=page.locator(f'[data-object="{cap["id"]}"] > path')
    assert node.get_attribute('d')=='M0,0 L300,0 L300,150 L0,150 Z'
    assert node.get_attribute('stroke-linejoin')=='miter'
    assert page.locator('[data-action="tail-mode"]').count()==0
    image_data=page.evaluate('async()=>{const c=await PanelStudio.renderPage();return c.toDataURL()}')
    pixels=Image.open(io.BytesIO(base64.b64decode(image_data.split(',')[1]))).convert('RGB')
    assert pixels.getpixel((54,54))==(255,255,255),pixels.getpixel((54,54))
    page.locator('[data-add-bubble="thought"]').click()
    prop('x',530);prop('y',50);prop('text','타원형 생각 말풍선');prop('tailWidth',24)
    thought=selected();group=page.locator(f'[data-object="{thought["id"]}"]')
    assert group.locator(':scope > ellipse').count()==3
    before=group.locator(':scope > ellipse').first.get_attribute('cx')
    handle=page.locator('[data-handle="tail-curve"]').bounding_box()
    page.mouse.move(handle['x']+handle['width']/2,handle['y']+handle['height']/2)
    page.mouse.down();page.mouse.move(handle['x']+60,handle['y']+45,steps=5);page.mouse.up()
    assert group.locator(':scope > ellipse').first.get_attribute('cx')!=before
    page.locator('[data-add-bubble="cloud"]').click();prop('x',60);prop('y',360);prop('text','부드러운 구름 말풍선')
    page.locator('[data-quick-text]').click();prop('text','말풍선 없이 텍스트만');prop('x',500);prop('y',390);prop('w',440)
    plain=selected();group=page.locator(f'[data-object="{plain["id"]}"]')
    assert plain['type']=='text' and group.locator('path, ellipse').count()==0
    assert page.locator('[data-prop="lineHeight"] + output').inner_text()=='1.4'
    page.locator('[data-prop="w"]').blur();page.keyboard.press('Escape');page.screenshot(path=str(OUT/'v1.1-balloons.png'))
    print('PASS: sharp narration in SVG and PNG, elliptical thoughts with curved circle tails, plain text',flush=True)

    page.locator('[data-add-bubble="ellipse"]').click();before=selected()
    act('canvas-size');page.locator('#new-width').fill('8001');act('apply-canvas-size')
    assert page.locator('#modal').evaluate('(el)=>el.open') and state()['pages'][0]['width']==1000
    page.locator('#new-width').fill('1200');page.locator('#new-height').fill('900');act('apply-canvas-size')
    assert state()['pages'][0]['width']==1200 and selected()==before
    assert page.locator('#canvas-size-label').inner_text()=='1200 × 900 px'
    act('undo');assert state()['pages'][0]['width']==1000
    for width in [1200,950]:
        page.set_viewport_size({'width':width,'height':850})
        for selector in ['[data-action="canvas-size"]','[data-quick-text]']:
            box=page.locator(selector).bounding_box();assert box and box['x']>=0 and box['x']+box['width']<=width
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.screenshot(path=str(OUT/f'v1.1-layout-{width}.png'))
    page.set_viewport_size({'width':1500,'height':1000})
    print('PASS: always-visible canvas dimensions with selection, limits, undo and compact desktop layout',flush=True)

    act('new-material-bubbles');page.locator('#material-name').fill('내 생각 말풍선')
    page.locator('#material-shape').select_option('thought');page.locator('#material-text').fill('새로운 생각');act('create-material')
    wait('PanelStudio.getMaterials().items.length===1 && PanelStudio.materialsSaved()')
    prop('strokeWidth',9)
    prop('text','수정한 대사');prop('rotation',-12)
    act('save-material');page.locator('#material-name').fill('굵은 생각 말풍선');act('create-material')
    wait('PanelStudio.getMaterials().items.length===2 && PanelStudio.materialsSaved()')
    assert materials()['items'][1]['template']['strokeWidth']==9
    assert materials()['items'][1]['template']['rotation']==-12
    page.locator('[data-tab="sfx"]').click();act('new-material-sfx')
    page.locator('#material-name').fill('내 효과음');page.locator('#material-text').fill('쿠구궁!');act('create-material')
    wait('PanelStudio.getMaterials().items.length===3 && PanelStudio.materialsSaved()')
    assert selected()['type']=='sfx' and selected()['text']=='쿠구궁!'
    page.locator('#font-input').set_input_files(str(ROOT/'assets/fonts/GamjaFlower-Regular.ttf'))
    wait('PanelStudio.getProject().fonts.length===1')
    custom_font=selected()['font'];act('save-material');page.locator('#material-name').fill('내 글꼴 효과음');act('create-material')
    wait('PanelStudio.getMaterials().fonts.length===1 && PanelStudio.materialsSaved()')
    art=OUT/'custom-balloon.png';im=Image.new('RGBA',(240,140),(0,0,0,0));ImageDraw.Draw(im).ellipse((5,5,235,135),fill='white',outline='black',width=4);im.save(art)
    page.locator('[data-tab="bubbles"]').click()
    # The picker category is set by the same button used by the user.
    with page.expect_file_chooser():act('import-material-image')
    page.locator('#material-image-input').set_input_files(str(art))
    wait('PanelStudio.getMaterials().items.length===5 && PanelStudio.materialsSaved()')
    image_item=materials()['items'][-1];page.locator(f'[data-add-material="{image_item["id"]}"]').click()
    assert selected()['type']=='image' and selected()['assetId'] in state()['assets']
    act('save-material');page.locator('#material-name').fill('그림 효과음');page.locator('#material-category').select_option('sfx');act('create-material')
    wait('PanelStudio.getMaterials().items.length===6 && PanelStudio.materialsSaved()')
    backup=OUT/'v1.1-materials.panel-library.json';export_library(backup)
    saved=json.loads(backup.read_text());assert len(saved['items'])==6 and len(saved['assets'])==1 and len(saved['fonts'])==1
    page.screenshot(path=str(OUT/'v1.1-custom-materials.png'))
    wait("document.querySelector('#save-state').textContent.includes('이 기기에')")
    page.reload();ready();assert len(materials()['items'])==6
    new_project();page.locator('[data-tab="sfx"]').click()
    font_item=next(i for i in materials()['items'] if i['name']=='내 글꼴 효과음')
    page.locator(f'[data-add-material="{font_item["id"]}"]').click()
    assert selected()['font']==custom_font and len(state()['fonts'])==1
    assert len(materials()['items'])==6
    print('PASS: editable user balloons/effects, graphic imports, custom fonts and restart/new-project persistence',flush=True)

    # Fresh installation: import the portable library and reuse actual image/font assets.
    first=context;context=browser.new_context(viewport={'width':1500,'height':1000},accept_downloads=True)
    page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto(BASE);ready();new_project()
    page.locator('#material-library-input').set_input_files(str(backup))
    wait('PanelStudio.getMaterials().items.length===6 && PanelStudio.materialsSaved()')
    page.locator('#material-library-input').set_input_files(str(backup));page.wait_for_timeout(800)
    assert len(materials()['items'])==6
    restored_image=next(i for i in materials()['items'] if i['name']=='custom-balloon')
    page.locator(f'[data-add-material="{restored_image["id"]}"]').click()
    assert len(state()['assets'])==1
    image_id=selected()['id']
    page.locator(f'[data-delete-material="{restored_image["id"]}"]').click();act('confirm-delete-material')
    wait('PanelStudio.getMaterials().items.length===5 && PanelStudio.materialsSaved()')
    assert any(o['id']==image_id for o in state()['pages'][0]['objects']) and len(state()['assets'])==1
    page.locator('[data-tab="sfx"]').click();font_item=next(i for i in materials()['items'] if i['name']=='내 글꼴 효과음')
    page.locator(f'[data-add-material="{font_item["id"]}"]').click();assert len(state()['fonts'])==1
    malformed=OUT/'bad-materials.json';bad=json.loads(backup.read_text());bad['items'][0]['template']['font']={};malformed.write_text(json.dumps(bad))
    page.locator('#material-library-input').set_input_files(str(malformed));wait("document.querySelector('#toast').textContent.includes('소재 열기 실패')")
    assert len(materials()['items'])==5
    context.set_offline(True);page.locator(f'[data-add-material="{font_item["id"]}"]').click();prop('text','오프라인에서도 수정')
    assert selected()['text']=='오프라인에서도 수정'
    assert not errors,errors
    print('PASS: backup import on a fresh installation, deduplication, safe deletion, invalid data rejection and offline reuse',flush=True)
    context.close();first.close();browser.close()
