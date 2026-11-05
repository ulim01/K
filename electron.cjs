const {app,BrowserWindow,dialog,ipcMain} = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
app.setName('Panel Studio');
let win;
app.whenReady().then(()=>{
  win=new BrowserWindow({width:1500,height:980,minWidth:950,minHeight:680,backgroundColor:'#f8faf6',title:'Panel Studio',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.setMenu(null);
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',e=>e.preventDefault());
  win.webContents.on('will-prevent-unload',event=>{
    const choice=dialog.showMessageBoxSync(win,{type:'question',buttons:['편집 계속','종료'],defaultId:0,cancelId:0,title:'저장하지 않은 변경사항',message:'최근 변경사항의 자동 저장이 아직 완료되지 않았습니다.',detail:'작업을 보관하려면 편집을 계속한 뒤 프로젝트를 저장해 주세요.'});
    if(choice===1)event.preventDefault();
  });
  win.webContents.session.setPermissionRequestHandler((_wc,_p,cb)=>cb(false));
  win.loadFile(path.join(__dirname,'index.html'));
  ipcMain.handle('save-file',async(event,{name,bytes})=>{
    if(event.sender!==win.webContents || typeof name!=='string' || !(bytes instanceof Uint8Array)) throw Error('Invalid download');
    const result=await dialog.showSaveDialog(win,{defaultPath:path.join(app.getPath('downloads'),path.basename(name))});
    if(result.canceled)return false;
    await fs.writeFile(result.filePath,Buffer.from(bytes));
    return true;
  });
});
app.on('window-all-closed',()=>app.quit());
