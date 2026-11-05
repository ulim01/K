const fs=require('node:fs/promises');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const crypto=require('node:crypto');
(async()=>{
  const {packager}=await import('@electron/packager');
  const root=path.resolve(__dirname,'..'),out=path.join(root,'releases');
  const version=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version;
  if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Invalid release version');
  const paths=await packager({dir:root,out,name:'Panel Studio',executableName:'Panel Studio',platform:'win32',arch:'x64',electronVersion:'45.2.3',appVersion:version,appCopyright:'Panel Studio',icon:path.join(root,'assets/icon.ico'),asar:true,overwrite:true,prune:true,win32metadata:{CompanyName:'Panel Studio',FileDescription:'Panel Studio · 웹툰 작업실'},ignore:[/^\/(releases|test-results|tests|scripts|node_modules|\.github|\.git)(\/|$)/,/^\/\d+\.png$/,/^\/assets\/fonts\/.*\.(ttf|woff2?|json)$/,/^\/(README\.md|package-lock\.json|requirements-dev\.txt)$/]});
  await fs.copyFile(path.join(root,'사용설명서.txt'),path.join(paths[0],'먼저 읽어주세요.txt'));
  const zip=path.join(out,`Panel-Studio-${version}-Windows-x64.zip`);
  await fs.rm(zip,{force:true});
  execFileSync('zip',['-q','-r','-9',zip,path.basename(paths[0])],{cwd:out,stdio:'inherit'});
  const hash=crypto.createHash('sha256').update(await fs.readFile(zip)).digest('hex');
  await fs.writeFile(zip+'.sha256',`${hash}  ${path.basename(zip)}\n`);
  console.log(JSON.stringify({artifact:zip,bytes:(await fs.stat(zip)).size,sha256:hash},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
