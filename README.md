# Panel Studio

Windows에서 오프라인으로 사용하는 한국어 웹툰 편집기입니다. 브라우저용 코드와 Electron 데스크톱 앱을 같은 소스로 제공합니다. 기존 저장소의 13개 PNG는 수정하지 않고 배경 라이브러리에 포함했습니다.

## 사용

`releases/Panel-Studio-1.1.0-Windows-x64.zip`을 모두 압축 해제한 다음 `Panel Studio.exe`를 실행하세요. 자세한 사용법과 제한은 [사용설명서.txt](사용설명서.txt)에 있습니다. Windows 10/11 x64용이며 코드 서명은 포함하지 않습니다.

주요 기능: 1–8000px 캔버스, 여러 페이지와 세로 보기, 8종 말풍선과 직접 조절하는 곡선 꼬리, 12종 효과음, 한글 글꼴 11종과 사용자 글꼴, 비파괴 다각형 이미지 자르기, 투명 그라데이션, 이미지/글자 외곽선, 레이어·잠금·순서·복제, 자유 펜·집중선·속도선, 실행 취소, 로컬 자동 저장, 자산을 포함하는 프로젝트 파일, PNG/JPG/SVG·ZIP·세로 PNG 출력.

## 1.1 변경 사항

- 내레이션은 각진 사각형, 생각 말풍선은 타원과 크기가 줄어드는 원형 꼬리로 표시합니다. 구름 모양의 곡선도 개선했습니다.
- 상단에 캔버스 크기와 텍스트만 추가 버튼을 항상 표시합니다.
- 내 말풍선·효과음 만들기, 현재 선택한 소재 저장, 사용자 그림 가져오기를 지원합니다. 벡터 말풍선과 효과음 문자는 계속 편집할 수 있고, 그림 소재는 이미지로 편집합니다.
- 내 소재는 프로젝트와 별도로 기기에 저장되며 최대 200개까지 보관합니다. `.panel-library.json`으로 그림·추가 글꼴과 함께 내보내고 가져올 수 있습니다.
- 기존 1.0의 `.panel.json` 프로젝트를 그대로 열 수 있습니다.

## 개발

- Node.js 22.12 이상 (검증: 24.22.1), npm, Python 3.12.
- 실제 브라우저 테스트에는 Chromium과 `requirements-dev.txt` 패키지가 필요합니다.
- 이 클라우드 작업은 이미 격리되어 있으므로 `/workspace/K` 체크아웃을 그대로 사용합니다. 별도 worktree는 필요하지 않습니다.

```sh
cd /workspace/K
npm ci --ignore-scripts --no-audit --no-fund
python3 -m venv --system-site-packages /workspace/.panel-studio-venv
/workspace/.panel-studio-venv/bin/python -m pip install -r requirements-dev.txt
npm run dev
```

개발 서버는 로컬 4173 포트를 사용합니다. 별도 데이터베이스, 계정 또는 API 키는 필요하지 않습니다.

다른 터미널에서:

```sh
cd /workspace/K
PATH="/workspace/.panel-studio-venv/bin:$PATH" npm test
ELECTRON_GET_USE_PROXY=1 npm run package:win
```

`PANEL_TEST_URL`과 `CHROMIUM_PATH`로 테스트 서버/브라우저 위치를 지정할 수 있습니다. 브라우저 테스트는 서버가 실행 중이어야 합니다. 서버는 테스트가 끝나도 실행 상태를 유지합니다.

## 검증과 배포

- Node 테스트: 말풍선 곡선, 회전 좌표, 한글 줄바꿈, 8000px 제한, 파일 검증, 다각형.
- 실제 Chromium 테스트: 편집·저장·복원·출력 동작, 투명도/그라데이션/자르기 픽셀 검사, 최대 8000×8000 PNG 생성.
- `tests/desktop-smoke.cjs`: 같은 버전의 Linux Electron에서 `file:` 시작, 격리된 preload API, 데스크톱 파일 저장 검증. Windows 실기 실행 검증은 별도로 필요합니다.
- `scripts/package-windows.cjs`: 공식 Electron 45.2.3 Windows x64 런타임을 체크섬 검증 후 패키징하고 ZIP 및 SHA-256을 생성합니다. 테스트·빌드 스크립트와 개발용 패키지는 배포본에서 제외됩니다.
- 소재 테스트: 새 소재 생성, 스타일 보존, 재실행·새 프로젝트 복원, 이미지와 글꼴을 포함한 백업, 잘못된 파일 거부, 삭제 후 캔버스 보존.
- 최종 검증 결과는 `test-results/`에 생성됩니다.

## 자산

`assets/fonts/fonts.js`는 Google Fonts의 SIL Open Font License 글꼴 14개 파일을 WOFF 형식으로 압축하여 포함합니다. `assets/fonts/*-OFL.txt`에 각 라이선스, `sources.json`에 원본 URL과 SHA-256이 있습니다. 라이선스가 필요한 배포 파일에 동봉됩니다. `assets/demo/demo.js`는 원본 배경을 변경하지 않고 임베딩합니다. 재생성이 필요한 경우 `python3 scripts/prepare-assets.py`를 실행합니다. 현재 자산은 이미 준비되어 있어 일반 개발/패키징 때 네트워크로 글꼴을 다시 받지 않습니다.

IndexedDB에는 기기별 최근 프로젝트 하나와 별도의 내 소재 라이브러리가 저장됩니다. 이미지와 사용자 글꼴은 `.panel.json`에 포함하며, 자동 저장과 별도로 파일 백업이 권장됩니다. 앱은 작업 데이터를 외부로 전송하지 않습니다. 다른 글꼴 굵기 파일이 없는 경우 합성 굵기를 사용합니다. SVG의 임베딩 글꼴 표시는 뷰어에 따라 다를 수 있으므로 이미지 배포에는 PNG/JPG가 적합합니다. PSD/CLIP, CMYK, 애니메이션, 원근 이미지 변형, 온라인 협업은 이 버전에 포함하지 않습니다.
