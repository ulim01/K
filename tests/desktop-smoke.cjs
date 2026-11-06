// Run with the same Electron version as the Windows distribution.
const {app,BrowserWindow,dialog}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const appRoot=process.env.PANEL_APP_ROOT||root;
app.setPath('userData',fs.mkdtempSync(path.join(root,'test-results','electron-profile-')));
fs.rmSync(path.join(root,'test-results','desktop-saved.panel.json'),{force:true});
dialog.showSaveDialog=async()=>({canceled:false,filePath:path.join(root,'test-results','desktop-saved.panel.json')});
dialog.showMessageBoxSync=()=>1;
require(path.join(appRoot,'electron.cjs'));
const timeout=setTimeout(()=>{console.error('Electron smoke test timed out');app.exit(1);},60000);
app.whenReady().then(async()=>{
  const win=BrowserWindow.getAllWindows()[0];
  win.webContents.on('console-message',event=>{if(event.message?.includes('Error'))console.error(event.message);});
  try {
    await new Promise((resolve,reject)=>{win.webContents.once('did-finish-load',resolve);win.webContents.once('did-fail-load',(_e,c,d)=>reject(Error(c+': '+d)));});
    await win.webContents.executeJavaScript(`new Promise(resolve=>{const tick=()=>document.body.dataset.ready==='true'?resolve():setTimeout(tick,50);tick()})`);
    const info=await win.webContents.executeJavaScript(`({url:location.protocol,ready:document.body.dataset.ready,bridge:typeof window.desktop.saveFile,objects:PanelStudio.getProject().pages[0].objects.length,fonts:document.fonts.size,referenceBalloons:BubbleCatalog.presets.length})`);
    if(info.url!=='file:'||info.ready!=='true'||info.bridge!=='function'||info.objects!==0||info.fonts!==14||info.referenceBalloons!==44)throw Error(JSON.stringify(info));
    await win.webContents.executeJavaScript(`document.querySelector('[data-bubble-collection="1"]').click();document.querySelector('[data-add-bubble="sheet1-03"]').click();const text=document.querySelector('[data-prop="text2"]');text.value='데스크톱의 두 번째 대사';text.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-text-align="left"]').click();document.querySelector('[data-action="save"]').click();`);
    let saved;
    for(let i=0;i<100;i++){try{saved=JSON.parse(fs.readFileSync(path.join(root,'test-results','desktop-saved.panel.json'),'utf8'));if(saved.pages[0].objects.length===1)break;}catch{}await new Promise(r=>setTimeout(r,100));}
    if(saved?.pages[0].objects.length!==1)throw Error('Native save did not preserve the new balloon');
    const balloon=saved.pages[0].objects[0];
    if(balloon.shape!=='sheet1-03'||balloon.text2!=='데스크톱의 두 번째 대사'||balloon.align!=='left')throw Error('Packaged dialogue/alignment did not survive native save');
    fs.writeFileSync(path.join(root,'test-results','desktop-smoke.json'),JSON.stringify({passed:true,appRoot,...info,nativeSaveObjects:saved.pages[0].objects.length},null,2));
    console.log('PASS: Electron file startup, sandboxed preload bridge, 44 presets, linked dialogue, alignment and native file save');
    clearTimeout(timeout);app.exit(0);
  }catch(e){console.error(e);clearTimeout(timeout);app.exit(1);}
});
