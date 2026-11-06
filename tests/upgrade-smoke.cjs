// Load a released package, save there, then open this package with the same user data.
const {app,BrowserWindow,dialog}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),legacy=process.env.PANEL_LEGACY_APP_ROOT,current=process.env.PANEL_APP_ROOT;
if(!legacy||!current)throw Error('Set PANEL_LEGACY_APP_ROOT and PANEL_APP_ROOT to the two app.asar files');
app.setPath('userData',fs.mkdtempSync(path.join(root,'test-results','upgrade-profile-')));
dialog.showMessageBoxSync=()=>1;
require(path.join(legacy,'electron.cjs'));
const timeout=setTimeout(()=>{console.error('Upgrade test timed out');app.exit(1);},90000);
app.whenReady().then(async()=>{
  const win=BrowserWindow.getAllWindows()[0],js=code=>win.webContents.executeJavaScript(code);
  const ready=()=>js(`new Promise(resolve=>{const tick=()=>document.body.dataset.ready==='true'?resolve():setTimeout(tick,50);tick()})`);
  const wait=expression=>js(`new Promise(resolve=>{const tick=()=>(${expression})?resolve():setTimeout(tick,100);tick()})`);
  try {
    await new Promise(resolve=>win.webContents.once('did-finish-load',resolve));await ready();
    await js(`document.querySelector('[data-add-bubble="caption"]').click();const text=document.querySelector('[data-prop="text"]');text.value='1.0에서 저장한 내레이션';text.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-add-bubble="thought"]').click();`);
    let oldMaterials=null;
    if(await js("typeof PanelStudio.getMaterials==='function'")){
      await js(`document.querySelector('[data-action="new-material-bubbles"]').click();document.querySelector('#material-name').value='이전 버전의 내 소재';document.querySelector('[data-action="create-material"]').click();`);
      await wait('PanelStudio.getMaterials().items.length===1 && PanelStudio.materialsSaved()');oldMaterials=await js('PanelStudio.getMaterials()');
    }
    const old=await js('PanelStudio.getProject()'),oldCount=old.pages[0].objects.length;
    await wait(`document.querySelector('#save-state').textContent.includes('이 기기에')`);
    await win.loadFile(path.join(current,'index.html'));await ready();
    const restored=await js('PanelStudio.getProject()');assert.deepEqual(restored,old);
    if(oldMaterials)assert.deepEqual(await js('PanelStudio.getMaterials()'),oldMaterials);
    const caption=old.pages[0].objects.find(o=>o.shape==='caption');
    const d=await js(`document.querySelector('[data-object="${caption.id}"] > path').getAttribute('d')`);
    assert.equal(d,`M0,0 L${caption.w},0 L${caption.w},${caption.h} L0,${caption.h} Z`);
    await js(`document.querySelector('[data-action="new-material-bubbles"]').click();document.querySelector('#material-name').value='업데이트 후 만든 말풍선';document.querySelector('[data-action="create-material"]').click();`);
    await wait(`PanelStudio.getMaterials().items.length===${(oldMaterials?.items.length||0)+1} && PanelStudio.materialsSaved()`);
    await wait(`document.querySelector('#save-state').textContent.includes('이 기기에')`);
    await win.loadFile(path.join(current,'index.html'));await ready();
    assert.equal(await js('PanelStudio.getMaterials().items.at(-1).name'),'업데이트 후 만든 말풍선');
    assert.equal(await js('PanelStudio.getProject().pages[0].objects.length'),oldCount+1);
    console.log('PASS: released app autosave and materials survive new package location and persist via file:');
    fs.writeFileSync(path.join(root,'test-results','upgrade-smoke.json'),JSON.stringify({passed:true,legacy,current,oldObjects:oldCount,newObjects:oldCount+1,legacyMaterials:oldMaterials?.items.length||0,materialRestored:true},null,2));
    clearTimeout(timeout);app.exit(0);
  }catch(e){console.error(e);clearTimeout(timeout);app.exit(1);}
});
