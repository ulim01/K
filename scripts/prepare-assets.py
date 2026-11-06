from pathlib import Path
import base64, json, subprocess, hashlib, concurrent.futures
from fontTools.ttLib import TTFont
ROOT=Path(__file__).resolve().parent.parent
FONT_DIR=ROOT/'assets/fonts'
FONT_DIR.mkdir(parents=True,exist_ok=True)
fonts=[('Nanum Gothic','nanumgothic','NanumGothic-Regular.ttf',400),('Nanum Gothic','nanumgothic','NanumGothic-Bold.ttf',700),('Nanum Gothic','nanumgothic','NanumGothic-ExtraBold.ttf',800),('Nanum Myeongjo','nanummyeongjo','NanumMyeongjo-Regular.ttf',400),('Nanum Myeongjo','nanummyeongjo','NanumMyeongjo-Bold.ttf',700),('Black Han Sans','blackhansans','BlackHanSans-Regular.ttf',400),('Do Hyeon','dohyeon','DoHyeon-Regular.ttf',400),('Jua','jua','Jua-Regular.ttf',400),('Gowun Dodum','gowundodum','GowunDodum-Regular.ttf',400),('Gowun Batang','gowunbatang','GowunBatang-Regular.ttf',400),('Nanum Pen Script','nanumpenscript','NanumPenScript-Regular.ttf',400),('Nanum Brush Script','nanumbrushscript','NanumBrushScript-Regular.ttf',400),('Gaegu','gaegu','Gaegu-Regular.ttf',400),('Gamja Flower','gamjaflower','GamjaFlower-Regular.ttf',400)]
base='https://raw.githubusercontent.com/google/fonts/main/ofl/'
def download(item):
 name,folder,file,weight=item
 target=FONT_DIR/file
 if not target.exists():
  subprocess.run(['curl','--fail','--silent','--show-error','--location','--max-time','90',base+folder+'/'+file,'-o',str(target)],check=True)
 compressed=target.with_suffix('.woff')
 if not compressed.exists():
  font=TTFont(target);font.flavor='woff';font.save(compressed)
 return {'name':name,'weight':weight,'data':'data:font/woff;base64,'+base64.b64encode(compressed.read_bytes()).decode(),'file':file,'source':base+folder+'/'+file,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
 records=list(pool.map(download,fonts))
for folder in sorted(set(f[1] for f in fonts)):
 target=FONT_DIR/(folder+'-OFL.txt')
 if not target.exists():subprocess.run(['curl','--fail','--silent','--show-error','--location','--max-time','30',base+folder+'/OFL.txt','-o',str(target)],check=True)
(FONT_DIR/'fonts.js').write_text('window.BUNDLED_FONTS='+json.dumps(records,ensure_ascii=False)+';',encoding='utf-8')
(FONT_DIR/'sources.json').write_text(json.dumps([{k:v for k,v in f.items() if k!='data'} for f in records],ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'vendor/jszip.min.js').write_bytes((ROOT/'node_modules/jszip/dist/jszip.min.js').read_bytes())
(ROOT/'vendor/JSZip-LICENSE.txt').write_bytes((ROOT/'node_modules/jszip/LICENSE.markdown').read_bytes())
print(f'Prepared {len(records)} font faces ({len(set(f["name"] for f in records))} families) and licenses.')
