# 나의 취향 박물관

사진, 문장, 링크처럼 마음에 남은 것들을 전시실에 모아 둘러보는 개인 박물관입니다. 국립중앙박물관·메트로폴리탄·루브르의 차분한 전시 경험에서 영감을 받아, 로비의 입구와 평면 안내도로 전시실을 탐색합니다.

이 프로젝트는 **로그인 없는 1인용 웹**입니다. 미니 PC에서 서버를 실행하고, 휴대전화와 PC의 브라우저가 Tailscale을 통해 같은 박물관에 접속합니다. 소장품 원본과 데이터는 GitHub가 아니라 미니 PC의 데이터 디렉터리에 저장됩니다.

<img src="qa/lobby-screen.png" alt="나의 취향 박물관 모바일 로비" width="393" />

### 빠른 이동

- [사람을 위한 안내](#사람을-위한-안내)
- [LLM / 코딩 에이전트용 컨텍스트](#llm--코딩-에이전트용-컨텍스트)
- [에이전트 설치 가이드](#에이전트-설치-가이드)

## 사람을 위한 안내

### 할 수 있는 일

- 로비에서 전시실 입구를 선택해 입장하기
- 평면 안내도에서 방을 선택하고 크게 보기
- 사진·문장·HTTP(S) 링크를 수집함에 저장하기
- 사진을 미니 PC에 업로드하고 제목·메모·문장·링크·전시실을 수정하기
- 저장한 소장품을 삭제하거나 다른 전시실로 옮기기
- SQLite와 업로드 파일을 날짜별로 백업하고 복원하기
- iPhone / Pixel 10 미리보기에서 모바일 화면과 키보드 동작 확인하기

| 전시실 | 주제 |
| --- | --- |
| 01 고요한 순간들 | 사진, 음악, 문장 |
| 02 언젠가의 공간 | 공간, 가구, 생활의 온도 |
| 03 오래 곁에 둔 것들 | 물건과 기억을 위한 하이라이트 |
| 04 아직 이름 없는 취향 | 이유를 몰라도 좋아하는 것들 |

기본 소장품과 이미지는 체험용 예시입니다. 음악 예시는 실제 음원을 재생하지 않습니다. 예시 소장품은 삭제·편집되지 않으며, 새로 저장한 소장품만 서버 데이터로 관리됩니다.

### 로컬에서 실행하기

Node.js 24와 npm을 준비한 뒤 저장소 루트에서 실행합니다.

~~~sh
npm ci
npm run build
npm start
~~~

브라우저에서 http://127.0.0.1:8080 을 엽니다. <code>npm run dev -- --host 127.0.0.1 --port 5187</code>은 화면 작업용 Vite 미리보기이며, API 서버가 없어 업로드와 영구 저장은 동작하지 않습니다.

로컬 데이터는 기본적으로 <code>server/data/</code>에 만들어집니다. 이 폴더는 Git에 올라가지 않습니다.

### Ubuntu 미니 PC에 배포하기

이 절차는 Ubuntu가 이미 설치된 미니 PC에 프로젝트를 배포하는 방법입니다. Ubuntu 자체 설치는 포함하지 않습니다.

#### 1. 준비

미니 PC에 Git, Node.js 24, npm, Tailscale이 설치되어 있어야 합니다. 접속할 휴대전화와 PC도 같은 Tailscale 네트워크에 연결합니다.

~~~sh
ssh <우분투계정>@<미니PC의-Tailscale-IP>
node --version
npm --version
tailscale status
~~~

#### 2. 내려받고 서버 설치

공개 저장소이므로 인증 없이 내려받을 수 있습니다. <code>/opt/taste-museum</code>이 이미 있으면 기존 폴더를 백업한 뒤 진행합니다.

~~~sh
sudo useradd --system --home /opt/taste-museum --shell /usr/sbin/nologin taste-museum || true
sudo mkdir -p /opt/taste-museum /var/lib/taste-museum
sudo chown -R "$USER":"$USER" /opt/taste-museum
git clone https://github.com/esin3329/taste-museum.git /opt/taste-museum
cd /opt/taste-museum
npm ci
npm run build
test -f dist/client/index.html
~~~

서비스 계정이 데이터 폴더를 쓸 수 있게 하고 systemd 서비스를 등록합니다. Node.js 경로가 <code>/usr/bin/node</code>와 다르면 <code>server/systemd/museum.service</code>의 <code>ExecStart</code>를 <code>command -v node</code> 결과로 바꿉니다.

~~~sh
sudo chown -R taste-museum:taste-museum /var/lib/taste-museum
sudo install -m 0644 server/systemd/museum.service /etc/systemd/system/taste-museum.service
sudo systemctl daemon-reload
sudo systemctl enable --now taste-museum
curl http://127.0.0.1:8080/api/health
sudo systemctl status taste-museum --no-pager
~~~

<code>curl</code> 응답이 <code>{"ok":true}</code>이면 앱 서버가 실행된 상태입니다. 로그는 아래 명령으로 확인합니다.

~~~sh
sudo journalctl -u taste-museum -n 50 --no-pager
~~~

#### 3. Tailscale로 원격 접속

앱 서버는 <code>127.0.0.1:8080</code>에만 열고, Tailscale Serve가 tailnet 안에서 HTTPS로 전달하도록 구성합니다.

~~~sh
sudo systemctl enable --now tailscaled
sudo tailscale serve status
sudo tailscale serve --bg --https=8443 http://127.0.0.1:8080
sudo tailscale serve status
~~~

명령이 출력하는 <code>https://&lt;장치이름&gt;.&lt;tailnet이름&gt;.ts.net:8443</code> 주소를 Tailscale이 켜진 휴대전화나 PC에서 엽니다. 혼자 사용할 때는 tailnet 접근 정책을 본인 기기로 제한하고, 공유기 포트 포워딩과 Tailscale Funnel은 사용하지 않습니다.

공식 문서: [Tailscale Serve 명령](https://tailscale.com/docs/reference/tailscale-cli/serve)

#### 4. 백업과 복원

백업은 SQLite 체크포인트 후 데이터베이스와 업로드 파일을 하나의 날짜별 폴더에 저장합니다. 기본 보존 개수는 14개입니다.

~~~sh
sudo mkdir -p /var/backups/taste-museum
sudo chown taste-museum:taste-museum /var/backups/taste-museum
sudo -u taste-museum env \
  MUSEUM_DATA_DIR=/var/lib/taste-museum \
  MUSEUM_BACKUP_DIR=/var/backups/taste-museum \
  /usr/bin/node /opt/taste-museum/scripts/backup.mjs
ls -lah /var/backups/taste-museum
~~~

매일 새벽에 자동 백업하려면 timer를 등록합니다.

~~~sh
sudo install -m 0644 /opt/taste-museum/server/systemd/museum-backup.service /etc/systemd/system/taste-museum-backup.service
sudo install -m 0644 /opt/taste-museum/server/systemd/museum-backup.timer /etc/systemd/system/taste-museum-backup.timer
sudo systemctl daemon-reload
sudo systemctl enable --now taste-museum-backup.timer
systemctl list-timers taste-museum-backup.timer --no-pager
~~~

복원할 때는 앱을 중지합니다. <code>--force</code>를 사용해도 기존 데이터 폴더는 먼저 <code>*.before-restore-*</code>로 이동합니다.

~~~sh
sudo systemctl stop taste-museum
sudo -u taste-museum env MUSEUM_DATA_DIR=/var/lib/taste-museum \
  /usr/bin/node /opt/taste-museum/scripts/restore.mjs \
  /var/backups/taste-museum/<백업-폴더> /var/lib/taste-museum --force
sudo systemctl start taste-museum
curl http://127.0.0.1:8080/api/health
~~~

#### 5. 업데이트와 중지

~~~sh
cd /opt/taste-museum
git pull --ff-only
npm ci
npm run build
sudo systemctl restart taste-museum
~~~

Serve 설정은 같은 장치와 포트를 유지하는 한 다시 만들 필요가 없습니다. 서비스를 중지하려면 다음을 실행합니다.

~~~sh
sudo systemctl disable --now taste-museum
sudo tailscale serve --https=8443 off
~~~

#### 6. 접속 확인

1. Tailscale이 연결된 PC에서 HTTPS 주소를 엽니다.
2. 휴대전화에서 Wi-Fi를 끄고 이동통신과 Tailscale을 켠 뒤 같은 주소를 엽니다.
3. 로비 → 안내도 → 전시실 → 소장품 상세를 확인합니다.
4. 소장품 추가 → 수집함 → 전시실 배치를 확인합니다.
5. 새로고침한 뒤 방금 올린 소장품이 남아 있는지 확인합니다.

### 현재 상태와 범위

현재 웹 버전에는 소장품 추가·업로드·편집·삭제·재배치, SQLite 영구 저장, 백업·복원이 들어 있습니다. 전시실은 디자인에 맞춘 4개를 고정해 두었습니다. 전시실 생성·편집, HEIC 브라우저용 썸네일 변환, 네이티브 APK, 클라우드 전환은 현재 범위에 포함하지 않습니다.

사진 원본은 미니 PC에 저장됩니다. GitHub에는 소스와 문서만 올리며, <code>server/data/</code>, <code>backups/</code>, SQLite 파일, 업로드 파일은 올리지 않습니다.

## LLM / 코딩 에이전트용 컨텍스트

이 절은 저장소를 수정하는 LLM과 코딩 에이전트를 위한 정보입니다. 작업 전에 [AGENTS.md](AGENTS.md)를 먼저 읽고, 그 파일의 모바일 런타임 경계를 우선 적용합니다. 아래 내용은 현재 제품 방향과 구현 계약을 빠르게 파악하기 위한 요약입니다.

### 에이전트 설치 가이드

이 절차는 코딩 에이전트가 저장소를 처음 받아 기능을 수정하고 검증할 때 사용합니다. Ubuntu 미니 PC에 실제 서비스를 설치하는 절차는 위의 사람용 안내를 따릅니다.

#### 1. 저장소 준비

이미 작업 디렉터리가 있다면 새로 clone하지 말고 해당 디렉터리를 사용합니다. 새로 받을 때는 다음처럼 공개 저장소를 clone합니다.

~~~sh
git clone https://github.com/esin3329/taste-museum.git
cd taste-museum
node --version
npm --version
~~~

Node.js는 24 이상이어야 합니다. 의존성은 lockfile을 기준으로 설치합니다.

~~~sh
npm ci
~~~

#### 2. 첫 검증

코드를 수정하기 전에 보호된 모바일 런타임과 기존 서버·Sites 테스트를 확인합니다.

~~~sh
npm run check:runtime
npm run test:server
npm run test:sites
~~~

#### 3. 실행 방법 선택

- 화면만 확인할 때: <code>npm run dev -- --host 127.0.0.1 --port 5187</code>를 사용합니다. 이 모드는 API 서버가 아니므로 저장·업로드를 검증할 수 없습니다.
- 저장·업로드까지 확인할 때: 먼저 <code>npm run build</code>를 실행한 뒤 <code>npm start</code>를 사용합니다.
- 다른 프로세스가 8080을 쓰면 <code>PORT=8180 npm start</code>처럼 별도 포트를 지정합니다. PowerShell에서는 <code>$env:PORT=8180; npm start</code>를 사용합니다.

에이전트 검증에서는 실제 소장품을 사용하지 말고 임시 데이터 디렉터리를 지정합니다.

~~~sh
MUSEUM_DATA_DIR=/tmp/taste-museum-agent-data PORT=8180 npm start
~~~

PowerShell에서는 다음처럼 지정할 수 있습니다.

~~~powershell
$env:MUSEUM_DATA_DIR = Join-Path $env:TEMP "taste-museum-agent-data"
$env:PORT = 8180
npm start
~~~

서버가 실행되면 <code>http://127.0.0.1:8180/api/health</code>가 <code>{"ok":true}</code>를 반환하는지 확인하고, 검증이 끝난 뒤 서버를 종료합니다.

#### 4. UI 테스트

Playwright 브라우저가 설치되어 있지 않으면 한 번만 설치합니다.

~~~sh
npx playwright install
npm run test:runtime
~~~

브라우저를 설치할 수 없는 환경에서는 런타임 테스트를 억지로 우회하거나 보호된 파일을 수정하지 말고, 누락된 실행 파일을 결과에 기록합니다. 화면을 확인할 수 있는 브라우저가 있으면 로비 → 수집함 → 편집·삭제 흐름을 실제로 확인합니다.

#### 5. 에이전트 작업 종료 전 확인

~~~sh
npm run check:runtime
npm run test:server
npm run build
npm run test:sites
git diff --check
~~~

작업 중 생성된 임시 DB·업로드 파일·백업은 커밋하지 않습니다. 개인 데이터가 있는 <code>MUSEUM_DATA_DIR</code>나 미니 PC의 <code>/var/lib/taste-museum</code>를 테스트 대상으로 지정하지 않습니다.

### 제품 목표와 비목표

- 목표: 기존 모바일 박물관 프로토타입의 화면·동선을 유지하면서, 미니 PC를 원본 저장소로 사용하는 1인용 원격 웹을 제공한다.
- 접근: 로그인 없이 Tailscale 네트워크 접근 정책으로 제한한다.
- 원본 데이터: <code>MUSEUM_DATA_DIR</code> 아래 SQLite와 <code>uploads/</code>에 저장한다. 배포 기본 경로는 <code>/var/lib/taste-museum</code>이다.
- 배포: Node HTTP 서버가 <code>dist/client/</code>를 정적으로 제공하고 <code>/api</code>를 처리한다. Cloudflare Pages는 현재 배포 대상이 아니다.
- 비목표: 전시실 생성·편집, 사용자 계정, 양방향 오프라인 동기화, 네이티브 화면 재작성, HEIC 썸네일 변환.

### 데이터 흐름

~~~text
휴대전화/PC 브라우저
        │ HTTPS (Tailscale Serve)
        ▼
미니 PC Node HTTP 서버 :8080
        ├── dist/client/       React 정적 파일
        ├── /api/items         SQLite 메타데이터
        └── /uploads/*         MUSEUM_DATA_DIR/uploads 원본 파일
~~~

GitHub는 소스 코드와 문서의 저장소입니다. 개인 소장품과 실행 중인 데이터는 GitHub에 저장하지 않습니다.

### 파일 경계

| 경로 | 책임 | 수정 규칙 |
| --- | --- | --- |
| <code>src/Prototype.tsx</code> | 박물관 화면, 이동, API 상태, 입력 흐름 | 앱 기능과 화면은 여기서 수정 |
| <code>src/prototype.css</code> | 박물관 콘텐츠 스타일 | 기존 아이보리·버건디·세리프 톤 유지 |
| <code>src/mobile/</code> | PhoneFrame, FlowStack, 키보드, 스크롤 런타임 | <code>AGENTS.md</code> 승인 없이 수정하지 않음 |
| <code>server/index.mjs</code> | 정적 파일, JSON API, multipart 업로드 | 데이터 디렉터리를 정적으로 노출하지 않음 |
| <code>server/db.mjs</code> | SQLite 스키마와 소장품 CRUD | 모든 입력을 검증하고 파라미터 SQL 사용 |
| <code>server/backup.mjs</code> | 백업·복원·보존 개수 정리 | 복원 전 기존 폴더를 회전 보관 |
| <code>scripts/backup.mjs</code> | 백업 CLI | <code>MUSEUM_DATA_DIR</code>, <code>MUSEUM_BACKUP_DIR</code> 사용 |
| <code>scripts/restore.mjs</code> | 복원 CLI | 대상 교체에는 <code>--force</code> 필요 |
| <code>server/systemd/</code> | 앱 서비스와 선택형 백업 timer | Ubuntu 배포 템플릿 |
| <code>public/museum/</code> | 생성한 전시 이미지와 안내도 | 앱 콘텐츠 자산 |
| <code>tests/</code> | 서버·Sites·모바일 런타임 검증 | 새 API 동작은 서버 테스트부터 추가 |

<code>src/App.tsx</code>, <code>src/main.tsx</code>, <code>src/styles.css</code>, <code>src/mobile/</code>, <code>public/assets/</code>, <code>vite.config.ts</code>, <code>worker/index.js</code>, <code>scripts/prepare-sites-build.mjs</code>는 보호된 런타임 파일입니다. 변경이 정말 필요하면 <code>AGENTS.md</code>의 런타임 절차를 따르고 무결성 lock을 갱신합니다.

### API 계약

모든 API는 같은 origin에서 호출합니다. JSON 요청에는 <code>content-type: application/json</code>을 사용합니다.

| 메서드 | 경로 | 용도 | 응답 |
| --- | --- | --- | --- |
| <code>GET</code> | <code>/api/health</code> | 서버 상태 확인 | <code>{ "ok": true }</code> |
| <code>GET</code> | <code>/api/items</code> | 저장된 소장품 목록 | <code>{ "items": Item[] }</code> |
| <code>POST</code> | <code>/api/items</code> | 문장·링크 메타데이터 저장 | <code>{ "item": Item }</code> |
| <code>PATCH</code> | <code>/api/items/:id</code> | 제목·메모·문장·링크·전시실 수정 | <code>{ "item": Item }</code> |
| <code>DELETE</code> | <code>/api/items/:id</code> | 소장품과 연결된 업로드 파일 삭제 | <code>{ "item": Item }</code> |
| <code>POST</code> | <code>/api/upload</code> | 새 사진 multipart 업로드 | <code>{ "item": Item }</code> |
| <code>POST</code> | <code>/api/items/:id/upload</code> | 기존 사진 교체 | <code>{ "item": Item }</code> |
| <code>GET</code> | <code>/uploads/:file</code> | 업로드 파일 제공 | 이미지 원본 |

<code>Item</code>은 다음 필드를 사용합니다.

~~~ts
type Item = {
  id: string;
  title: string;
  kind: "photo" | "text" | "link";
  note: string;
  room: 1 | 2 | 3 | 4 | null;
  image?: string;
  text?: string;
  url?: string;
};
~~~

사진 업로드는 요청당 25 MiB까지 허용합니다. 파일 이름으로 경로를 만들지 않고 UUID 파일명을 사용합니다. 사용자 링크는 <code>http://</code> 또는 <code>https://</code>만 허용합니다.

### 개발·검증 명령

~~~sh
npm ci
npm run check:runtime
npm run build
npm run test:server
npm run test:sites
npm run test:runtime
~~~

- <code>check:runtime</code>: 보호된 모바일 런타임 28개 파일의 무결성을 검사한다.
- <code>build</code>: TypeScript 검사, Vite 빌드, Sites 패키지 파일 생성을 수행한다.
- <code>test:server</code>: SQLite 지속성, 업로드, 사진 교체, 편집·삭제, 백업·복원을 검사한다.
- <code>test:sites</code>: 정적 자산·앱 라우트 fallback·Sites 패키징을 검사한다.
- <code>test:runtime</code>: Playwright로 모바일 런타임을 검사한다. 로컬에 브라우저가 없으면 먼저 <code>npx playwright install</code>이 필요하다.

### 변경 시 지켜야 할 것

1. 기존 4개 전시실, 로비·안내도·입구·하이라이트 구조와 모바일 프레임을 유지한다.
2. 앱 콘텐츠는 <code>Prototype.tsx</code>와 <code>prototype.css</code>에 넣고, 입력은 <code>KeyboardInput</code>·<code>KeyboardTextarea</code>를 사용한다.
3. 화면 이동은 <code>FlowStack</code>을 사용하고, 이동·시트·메뉴를 열기 전에 키보드가 닫히는 런타임 계약을 지킨다.
4. 서버 데이터는 저장소 밖에 두고, 개인 파일·SQLite·백업을 커밋하지 않는다.
5. 새 서버 동작은 실패 테스트를 먼저 작성한 뒤 구현하고 <code>npm run test:server</code>를 다시 실행한다.
6. 빌드·테스트 후 <code>git diff --check</code>와 <code>npm run check:runtime</code>을 확인한다.

### 알려진 제한

- <code>rooms</code> 테이블은 초기 4실을 시드하며, 현재 API는 방 생성·편집을 제공하지 않는다.
- HEIC/HEIF 원본은 보관하지만 브라우저용 변환 썸네일은 만들지 않는다.
- 로그인과 사용자별 권한은 없으므로 외부 공개용 배포에 그대로 사용하지 않는다.
- <code>npm run dev</code>는 API 서버가 아니며, 실제 저장 동작은 <code>npm run build</code> 후 <code>npm start</code>에서 확인한다.

상세한 프로토타입 결정은 [PROTOTYPE.md](PROTOTYPE.md), 모바일 런타임의 강제 규칙은 [AGENTS.md](AGENTS.md)를 참고합니다.
