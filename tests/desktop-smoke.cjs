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
    const info=await win.webContents.executeJavaScript(`({url:location.protocol,ready:document.body.dataset.ready,bridge:typeof window.desktop.saveFile,objects:PanelStudio.getProject().pages[0].objects.length,fonts:document.fonts.size})`);
    if(info.url!=='file:'||info.ready!=='true'||info.bridge!=='function'||info.objects!==8||info.fonts!==14)throw Error(JSON.stringify(info));
    await win.webContents.executeJavaScript(`document.querySelector('[data-add-bubble="ellipse"]').click();document.querySelector('[data-action="save"]').click();`);
    let saved;
    for(let i=0;i<100;i++){try{saved=JSON.parse(fs.readFileSync(path.join(root,'test-results','desktop-saved.panel.json'),'utf8'));if(saved.pages[0].objects.length===9)break;}catch{}await new Promise(r=>setTimeout(r,100));}
    if(saved?.pages[0].objects.length!==9)throw Error('Native save did not preserve the new balloon');
    fs.writeFileSync(path.join(root,'test-results','desktop-smoke.json'),JSON.stringify({passed:true,appRoot,...info,nativeSaveObjects:saved.pages[0].objects.length},null,2));
    console.log('PASS: Electron file startup, sandboxed preload bridge, editing and native file save');
    clearTimeout(timeout);app.exit(0);
  }catch(e){console.error(e);clearTimeout(timeout);app.exit(1);}
});
