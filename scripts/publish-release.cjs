// Runs only in the user-authorized GitHub Actions release workflow.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const repo='ulim01/K', tag='panel-studio-v1.0.0', releaseId=435266785;
const root=path.resolve(__dirname,'..');
const digest=data=>crypto.createHash('sha256').update(data).digest('hex');
function api(...args){return JSON.parse(execFileSync('gh',['api',...args],{encoding:'utf8'}));}
function writeRequest(name,data){const file=path.join(process.env.RUNNER_TEMP||'/tmp',name);fs.writeFileSync(file,JSON.stringify(data));return file;}
(async()=>{
  if(process.env.GITHUB_REPOSITORY!==repo || !process.env.GITHUB_SHA) throw Error('Unexpected release environment');
  const {extractFile}=await import('@electron/asar');
  const archive=path.join(root,'releases','Panel Studio-win32-x64','resources','app.asar');
  const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'release-inputs.json'),'utf8'));
  for(const [file,expected] of Object.entries(manifest)) {
    if(digest(fs.readFileSync(path.join(root,file)))!==expected)throw Error('Source checksum mismatch: '+file);
    if(digest(extractFile(archive,file))!==expected)throw Error('Packaged source checksum mismatch: '+file);
  }
  console.log('Packaged application matches all validated source and asset checksums.');
  const zip=path.join(root,'releases','Panel-Studio-1.0.0-Windows-x64.zip');
  const hash=digest(fs.readFileSync(zip));
  if(fs.readFileSync(zip+'.sha256','utf8').split(/\s+/)[0]!==hash)throw Error('ZIP checksum mismatch');
  execFileSync('unzip',['-tq',zip],{stdio:'inherit'});
  const guide=path.join(process.env.RUNNER_TEMP,'Panel-Studio-Guide-ko.txt');
  fs.copyFileSync(path.join(root,'사용설명서.txt'),guide);
  let release=api(`repos/${repo}/releases/${releaseId}`);
  if(release.tag_name!==tag || !release.draft)throw Error('Expected our unpublished release draft');
  const body=fs.readFileSync(path.join(__dirname,'release-notes.md'),'utf8').replace('7afe353275141927cf1d8ad29ac07af1c72b362b749b6bb2558c68638cc3a9f3',hash)+'\nGitHub Actions에서 검증된 소스와 동일한 체크섬의 앱 리소스로 빌드했습니다.\n';
  const request=writeRequest('panel-release-update.json',{body,target_commitish:process.env.GITHUB_SHA});
  api('--method','PATCH',`repos/${repo}/releases/${releaseId}`,'--input',request);
  const assets=[zip,zip+'.sha256',guide];
  for(const file of assets) {
    release=api(`repos/${repo}/releases/${releaseId}`);
    const old=release.assets.find(a=>a.name===path.basename(file));
    const expected='sha256:'+digest(fs.readFileSync(file));
    if(old) {
      if(old.digest!==expected || old.size!==fs.statSync(file).size)throw Error('Existing draft asset differs: '+old.name);
    } else {
      execFileSync('gh',['release','upload',tag,file,'--repo',repo],{stdio:'inherit'});
    }
  }
  release=api(`repos/${repo}/releases/${releaseId}`);
  for(const file of assets) {
    const a=release.assets.find(a=>a.name===path.basename(file));
    if(!a||a.state!=='uploaded'||a.size!==fs.statSync(file).size||a.digest!=='sha256:'+digest(fs.readFileSync(file)))throw Error('Uploaded asset did not verify: '+file);
  }
  const publish=writeRequest('panel-release-publish.json',{draft:false,prerelease:true});
  release=api('--method','PATCH',`repos/${repo}/releases/${releaseId}`,'--input',publish);
  console.log(JSON.stringify({url:release.html_url,assets:release.assets.map(a=>({name:a.name,size:a.size,digest:a.digest,url:a.browser_download_url}))},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
