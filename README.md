# 나의 취향 박물관

사진, 문장, 링크처럼 마음에 남은 것들을 전시실에 모아 둘러보는 개인 박물관 프로토타입입니다. 국립중앙박물관·메트로폴리탄·루브르의 차분한 전시 경험에서 영감을 받아, 로비의 입구와 평면 안내도로 전시실을 탐색합니다.

> 현재는 **인터랙티브 프로토타입**입니다. 추가한 소장품과 전시실 배치는 브라우저 메모리에만 저장되며 **새로고침하면 초기화됩니다**. 아래 방법으로 배포해도 영구 저장이나 기기 간 동기화가 생기지 않습니다.

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
npm run dev -- --host 127.0.0.1 --port 5187
```

브라우저에서 `http://127.0.0.1:5187`을 엽니다.

```sh
npm run build
npm run test:sites
```

빌드 전에 모바일 런타임 무결성 검사가 자동 실행됩니다. 배포할 정적 파일은 **`dist/client/`**에 생성됩니다. `dist/server/`와 `.openai/hosting.json`은 템플릿의 별도 호스팅 출력이며 아래 Ubuntu 배포에서는 사용하지 않습니다.

## Ubuntu 미니 PC에 배포하기

이 안내는 **사용자가 직접 실행하는 배포 절차**입니다. 저장소 업로드만으로 서버가 배포되지는 않습니다.

### 1. 준비와 접속

미니 PC에 Git, Node.js 24, npm, Tailscale이 설치되어 있어야 합니다. 미니 PC와 접속할 휴대전화·PC는 같은 Tailscale 네트워크에 연결합니다. Node.js는 [공식 설치 안내](https://nodejs.org/en/download), Tailscale은 [Linux 설치 안내](https://tailscale.com/docs/install/linux)를 참고하세요.

```sh
ssh <우분투계정>@<미니PC의-Tailscale-IP>
node --version
npm --version
tailscale status
```

### 2. 내려받고 빌드하기

`<저장소-HTTPS-주소>`를 이 GitHub 저장소의 clone 주소로 바꿉니다. 비공개 저장소는 서버의 GitHub 인증 또는 읽기 전용 deploy key가 필요합니다. 토큰을 URL이나 파일에 넣어 커밋하지 마세요.

```sh
git clone https://github.com/esin3329/taste-museum.git taste-museum
cd taste-museum
npm ci
npm run build
test -f dist/client/index.html
```

### 3. 정적 파일 제공하기

Tailscale Serve는 디렉터리의 정적 파일을 제공할 수 있습니다. 여기서는 다른 HTTPS 서비스와 충돌할 가능성을 줄이기 위해 **8443** 포트를 사용합니다. 먼저 기존 설정을 확인하고, 이미 8443을 쓰고 있다면 다른 비어 있는 HTTPS 포트를 선택하세요.

```sh
sudo tailscale serve status
sudo systemctl enable --now tailscaled
sudo tailscale serve --bg --https=8443 "$(pwd)/dist/client"
sudo tailscale serve status
```

처음 실행할 때 HTTPS 활성화 안내가 나오면 표시된 관리 페이지에서 설정을 완료한 뒤 다시 실행합니다. 명령이 출력하는 `https://<장치이름>.<tailnet이름>.ts.net:8443` 주소로 접속합니다. Tailscale IP를 HTTPS 주소로 직접 입력하는 대신 출력된 도메인을 사용하세요.

`--bg` 설정은 백그라운드에서 유지됩니다. 재부팅 후에는 `tailscaled` 상태와 `tailscale serve status`를 확인하고 접속을 확인하세요. 별도 개발 서버나 Node.js 상주 프로세스는 필요하지 않습니다.

접속 범위는 Tailscale 접근 정책을 따릅니다. 혼자 이용하려면 해당 서비스에 본인 계정·기기만 접근하도록 정책을 설정합니다. 이 안내에서는 인터넷 공개용 Funnel이나 공유기 포트 포워딩을 사용하지 않습니다. 저장소 전체가 아니라 **`dist/client`만** 제공합니다.

공식 문서: [Tailscale Serve 명령](https://tailscale.com/docs/reference/tailscale-cli/serve), [정적 사이트 제공 예시](https://tailscale.com/docs/reference/examples/serve).

### 4. 업데이트와 중지

저장소 디렉터리에서 실행합니다. 배포 중 재빌드할 때는 잠깐 새로고침 오류가 발생할 수 있습니다.

```sh
git pull --ff-only
npm ci
npm run build
sudo tailscale serve status
```

같은 디렉터리를 유지했다면 Serve를 다시 설정하지 않아도 됩니다. 서비스 중지는 아래 명령으로 이 포트만 해제합니다.

```sh
sudo tailscale serve --https=8443 off
```

### 접속 확인

1. Tailscale이 연결된 PC에서 출력된 HTTPS 주소를 엽니다.
2. 휴대전화 Wi-Fi를 끄고, 이동통신과 Tailscale을 켠 뒤 같은 주소를 엽니다.
3. 로비 → 안내도 → 전시실 → 소장품 상세를 확인합니다.
4. 문장 추가 → 수집함 → 전시실 배치를 확인합니다.
5. 새로고침하면 예시 상태로 돌아오는 것은 현재 프로토타입의 정상 동작입니다.

## 코드 구성

```text
src/Prototype.tsx       화면, 이동, 소장품의 메모리 상태
src/prototype.css       박물관 화면 스타일
src/mobile/            모바일 미리보기 런타임
public/museum/         생성한 전시 이미지와 안내도
qa/                    화면 캡처
tests/                 템플릿 검증 코드
PROTOTYPE.md           프로토타입 범위와 설계 기록
```

화면 수정은 `src/Prototype.tsx`와 `src/prototype.css`를 중심으로 진행합니다. 모바일 런타임의 수정 경계는 `AGENTS.md`를 참고하세요.

## 검증과 앞으로의 구현

`npm run check:runtime`은 보호된 런타임 파일을 검사하고, `npm run build`는 TypeScript 검사와 배포 파일 생성을 수행합니다. `npm run test:sites`는 템플릿의 Worker 테스트이며 실제 Ubuntu 배포를 검증하는 명령은 아닙니다.

`npm run test:runtime`에는 Playwright 브라우저 설치가 필요합니다. 현재 작업 환경에서는 Chromium 실행 파일이 없어 이 자동 UI 테스트를 완료하지 못했습니다. 실제 Ubuntu 서버 배포와 재부팅 후 접속도 아직 검증하지 않았습니다.

실사용 단계에서 추가할 기능은 소장품·전시 배치의 영구 저장, 사진 파일 저장, 기기 간 동일 데이터 조회, 백업·복원입니다. 현재 버전에는 이 기능과 소장품 편집·삭제, 전시실 생성·편집이 구현되어 있지 않습니다.
