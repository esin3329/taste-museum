# 나의 취향 박물관

사진, 문장, 링크처럼 마음에 남은 것들을 전시실에 모아 둘러보는 개인 박물관 프로토타입입니다. 국립중앙박물관·메트로폴리탄·루브르의 차분한 전시 경험에서 영감을 받아, 로비의 입구와 평면 안내도로 전시실을 탐색합니다.

> 현재는 인터랙티브 프로토타입에서 개인 서버용 1차 구현으로 넘어가는 단계입니다. 서버 모드로 실행하면 폰에서 올린 소장품과 전시실 배치가 SQLite와 미니 PC 파일 저장소에 남습니다. 로그인은 없으므로 Tailscale 네트워크 접근 정책으로 사용자를 제한합니다.

<img src="qa/lobby-screen.png" alt="나의 취향 박물관 모바일 로비" width="393" />

## 둘러보기

- 로비: 전시실 입구를 선택해 입장합니다.
- 평면 안내도: 전시실 선택, 확대 보기, 선택한 전시실로 이동합니다.
- 일반 전시실과 어두운 하이라이트 전시실: 사진·문장·링크와 소장품 이야기를 감상합니다.
- 소장품 추가: 사진 선택, 문장 작성, HTTP(S) 링크와 메모 입력이 가능합니다.
- 수집함: 아직 방을 정하지 않은 소장품을 모으고 여러 개를 선택해 전시합니다.
- iPhone / Pixel 10 미리보기: 모바일 화면과 키보드 동작을 체험합니다.

| 전시실 | 주제 |
| --- | --- |
| 01 고요한 순간들 | 사진, 음악, 문장 |
| 02 언젠가의 공간 | 공간, 가구, 생활의 온도 |
| 03 오래 곁에 둔 것들 | 물건과 기억을 위한 하이라이트 |
| 04 아직 이름 없는 취향 | 이유를 몰라도 좋아하는 것들 |

로그인은 없습니다. 기본 소장품과 이미지는 체험용 예시이며, 음악 예시는 실제 음원 재생 기능이 아닙니다. 선택한 사진은 현재 브라우저에서만 표시되고 서버에 업로드되지 않습니다. PC에서도 열 수 있지만 화면은 휴대전화 미리보기 프레임을 유지합니다.

## 로컬 실행

Node.js 24와 npm을 준비하고 저장소 루트에서 실행합니다.

```sh
npm ci
npm run build
npm start
```

브라우저에서 `http://127.0.0.1:8080`을 엽니다. `npm run dev -- --host 127.0.0.1 --port 5187`은 화면 작업용 Vite 미리보기이며, API가 없어서 실제 업로드·영구 저장은 동작하지 않습니다.

```sh
npm run build
npm run test:sites
```

빌드 전에 모바일 런타임 무결성 검사가 자동 실행됩니다. 서버는 `dist/client/`를 정적으로 제공하고 `/api`로 SQLite와 업로드 API를 제공합니다.

## Ubuntu 미니 PC에 배포하기

이 안내는 이미 Ubuntu가 설치된 미니 PC에 프로젝트를 배포하는 절차입니다. Ubuntu 자체를 설치하는 과정은 포함하지 않습니다.

### 1. 준비와 접속

미니 PC에 Git, Node.js 24, npm, Tailscale이 설치되어 있어야 합니다. 미니 PC와 접속할 휴대전화·PC는 같은 Tailscale 네트워크에 연결합니다. Node.js는 [공식 설치 안내](https://nodejs.org/en/download), Tailscale은 [Linux 설치 안내](https://tailscale.com/docs/install/linux)를 참고하세요.

```sh
ssh <우분투계정>@<미니PC의-Tailscale-IP>
node --version
npm --version
tailscale status
```

### 2. 내려받고 빌드하기

공개 저장소이므로 아래 명령으로 인증 없이 내려받을 수 있습니다. 기존에 같은 경로가 있으면 먼저 백업하거나 별도 디렉터리를 사용합니다.

```sh
sudo useradd --system --home /opt/taste-museum --shell /usr/sbin/nologin taste-museum || true
sudo mkdir -p /opt/taste-museum /var/lib/taste-museum
sudo chown -R "$USER":"$USER" /opt/taste-museum
git clone https://github.com/esin3329/taste-museum.git /opt/taste-museum
cd /opt/taste-museum
npm ci
npm run build
test -f dist/client/index.html
```

Node.js 경로가 `/usr/bin/node`가 아니라면 `server/systemd/museum.service`의 `ExecStart` 경로를 `command -v node` 결과로 바꿉니다. 빌드가 끝난 뒤 런타임 데이터 디렉터리의 소유권을 설정합니다.

```sh
sudo chown -R taste-museum:taste-museum /var/lib/taste-museum
sudo install -m 0644 /opt/taste-museum/server/systemd/museum.service /etc/systemd/system/taste-museum.service
sudo systemctl daemon-reload
sudo systemctl enable --now taste-museum
curl http://127.0.0.1:8080/api/health
sudo systemctl status taste-museum --no-pager
```

`curl` 응답이 `{"ok":true}`이면 앱 서버가 실행된 상태입니다. 로그는 `sudo journalctl -u taste-museum -n 50 --no-pager`로 확인합니다.

### 3. Tailscale로 연결하기

앱 서버는 로컬호스트에만 열고, Tailscale Serve가 tailnet 안에서 HTTPS로 전달하도록 구성합니다. Tailscale Serve는 로컬 서비스를 tailnet에 공유하는 기능입니다. 먼저 기존 설정을 확인하고, 이미 8443을 쓰고 있다면 다른 HTTPS 포트를 선택하세요.

```sh
sudo tailscale serve status
sudo systemctl enable --now tailscaled
sudo tailscale serve --bg --https=8443 http://127.0.0.1:8080
sudo tailscale serve status
```

처음 실행할 때 HTTPS 활성화 안내가 나오면 표시된 관리 페이지에서 설정을 완료합니다. 명령이 출력하는 `https://<장치이름>.<tailnet이름>.ts.net:8443` 주소로 접속합니다. 휴대전화에서도 Tailscale을 켠 뒤 이 주소를 엽니다.

`--bg` 설정은 백그라운드에서 유지됩니다. 앱 자체는 systemd가 재부팅 후 자동으로 다시 실행합니다. 앱 포트 8080은 `127.0.0.1`에만 바인딩되므로 Tailscale Serve를 거치지 않은 외부 접근은 받지 않습니다.

접속 범위는 Tailscale 접근 정책을 따릅니다. 혼자 이용하려면 tailnet에 본인 기기만 남기고, 공유기 포트 포워딩이나 인터넷 공개용 Funnel은 사용하지 않습니다.

공식 문서: [Tailscale Serve 명령](https://tailscale.com/docs/reference/tailscale-cli/serve), [정적 사이트 제공 예시](https://tailscale.com/docs/reference/examples/serve).

### 4. 업데이트와 중지

저장소 디렉터리에서 실행합니다. 배포 중 재빌드할 때는 잠깐 새로고침 오류가 발생할 수 있습니다.

```sh
git pull --ff-only
npm ci
npm run build
sudo tailscale serve status
```

같은 디렉터리를 유지했다면 Serve를 다시 설정하지 않아도 됩니다. 서비스 중지는 아래 명령으로 수행합니다.

```sh
sudo systemctl disable --now taste-museum
sudo tailscale serve --https=8443 off
```

### 접속 확인

1. Tailscale이 연결된 PC에서 출력된 HTTPS 주소를 엽니다.
2. 휴대전화 Wi-Fi를 끄고, 이동통신과 Tailscale을 켠 뒤 같은 주소를 엽니다.
3. 로비 → 안내도 → 전시실 → 소장품 상세를 확인합니다.
4. 문장 추가 → 수집함 → 전시실 배치를 확인합니다.
5. 새로고침한 뒤에도 방금 올린 소장품이 남아 있는지 확인합니다.

## 코드 구성

```text
src/Prototype.tsx       화면, 이동, API 연동 상태
src/prototype.css       박물관 화면 스타일
src/mobile/            모바일 미리보기 런타임
server/index.mjs        정적 파일·업로드 API 서버
server/db.mjs           SQLite 스키마와 소장품 CRUD
server/systemd/         Ubuntu 자동 실행 서비스 템플릿
public/museum/         생성한 전시 이미지와 안내도
qa/                    화면 캡처
tests/                 템플릿 검증 코드
PROTOTYPE.md           프로토타입 범위와 설계 기록
```

화면 수정은 `src/Prototype.tsx`와 `src/prototype.css`를 중심으로 진행합니다. 모바일 런타임의 수정 경계는 `AGENTS.md`를 참고하세요.

## 검증과 앞으로의 구현

`npm run check:runtime`은 보호된 런타임 파일을 검사하고, `npm run build`는 TypeScript 검사와 클라이언트 빌드를 수행합니다. `npm run test:server`는 SQLite·업로드·재시작 지속성을 확인하고, `npm run test:sites`는 템플릿의 Worker 테스트입니다.

`npm run test:runtime`에는 Playwright 브라우저 설치가 필요합니다. 현재 작업 환경에서는 Chromium 실행 파일이 없어 이 자동 UI 테스트를 완료하지 못했습니다. 실제 Ubuntu 서버 배포와 재부팅 후 접속도 아직 검증하지 않았습니다.

현재 구현은 소장품 추가(사진·문장·링크), SQLite 영구 저장, 사진 파일 업로드, 수집함 배치까지 제공합니다. 소장품 편집·삭제, 전시실 생성·편집, 자동 백업·복원은 다음 단계입니다. 사진 원본은 미니 PC에 저장되며, 현재 HEIC는 원본 보관만 하고 브라우저 호환 썸네일 변환은 아직 제공하지 않습니다.
