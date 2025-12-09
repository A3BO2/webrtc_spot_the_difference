# 🎮 WebRTC Real-time Spot the Difference

### WebRTC & Socket.IO 기반 실시간 틀린그림찾기 게임

> **서버의 신뢰성(Reliability)** + **P2P 초저지연(Low Latency)**  
> 두 가지 장점을 결합한 **하이브리드 실시간 협동 웹 게임**

---

## 📖 Overview

이 프로젝트는 **2명의 사용자가 같은 방(Room)**에 접속해  
**동일한 이미지에서 틀린 부분을 실시간으로 찾는 게임**입니다.

- WebRTC Data Channel → **0ms에 가까운 즉각적인 클릭 공유**
- Socket.IO → **검증 · 점수 · 게임 상태 관리**
- 완벽한 동기화 & 보안성 확보

---

## 🚀 주요 기능 (Features)

### ✔ 실시간 1:1 매칭

방 ID를 입력해 즉시 참여.

### ✔ Zero-Latency 클릭 공유 (WebRTC)

상대방 클릭 위치가 **거의 지연 없이 즉시 렌더링**됨.

### ✔ 서버 기반 점수 검증 (Socket.IO)

정답 판정, 점수 관리 등 핵심 로직은 서버에서 처리 → **공정성 보장**

### ✔ 상태 완전 동기화

게임 시작/종료, 타이머, 정답 Lock, 점수 등 모든 흐름이 양쪽 화면에서 일관성 유지.

---

## 🏗 Architecture (하이브리드 구조)

### 🔀 통신 경로별 역할

| Path       | 기술                      | 용도                     | 특징                         |
| ---------- | ------------------------- | ------------------------ | ---------------------------- |
| **Path A** | **WebRTC (Data Channel)** | 클릭 시각, 드로잉        | 서버를 거치지 않는 초저지연  |
| **Path B** | **Socket.IO (WebSocket)** | 정답 검증, 점수, 룸 정보 | 보안 · 신뢰성 높은 중앙 처리 |

---

## 🔄 데이터 흐름도

1. **Signaling (Socket.IO)**

   - SDP, ICE Candidate 교환 → P2P 연결 수립

2. **Action (클릭 발생)**

   - WebRTC → 상대방에게 즉시 좌표 전송
   - Socket.IO → 서버에 “claim(정답 시도)” 요청

3. **Validation (서버 판정)**
   - 서버가 정답 확인 후 `lock` 이벤트로 두 클라이언트에 방송
   - 점수 확정 및 UI 업데이트

---

## 📂 프로젝트 구조

```
📦 WEBRTC_PROJECT
 ┣ 📂 server
 ┃ ┗ 📜 server.js        # Socket.IO 서버, 룸/정답/시그널링 관리
 ┗ 📂 client
     ┣ 📂 public/assets   # 게임 이미지 리소스
     ┗ 📂 src
         ┣ 📂 components
         ┃ ┣ 📜 SpotGame.jsx     # 게임 로직 / 통신 컨트롤러
         ┃ ┗ 📜 ImageCanvas.jsx  # 캔버스 드로잉 & 좌표 계산
         ┣ 📂 lib
         ┃ ┣ 📜 socket.js        # Socket.IO 클라이언트 설정
         ┃ ┗ 📜 rtc.js           # WebRTC 설정 & Data Channel 관리
         ┗ 📜 App.jsx            # 클라이언트 진입점
```

---

## 🛠 설치 및 실행(Setup & Run)

### 1️⃣ 저장소 클론

```bash
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name
```

---

### 2️⃣ 서버 실행 (Server)

```bash
cd server
npm install
node server.js
```

출력:

```
Server running on port 3001
```

---

### 3️⃣ 클라이언트 실행 (Client)

새 터미널에서:

```bash
cd client
npm install
npm run dev
```

접속 주소:

```
http://localhost:5173
```

---

### 4️⃣ 게임 플레이 방법

1. 브라우저 탭 2개 열기 (1개는 시크릿 권장)
2. 두 탭 모두 `http://localhost:5173` 접속
3. 같은 Room ID 입력 → Join
4. 양쪽 Ready → 게임 시작 🎮

---

## 🐛 Troubleshooting (FAQ)

### ❓ Ready 눌렀는데 반응이 없어요

서버가 재시작되면 룸 정보 초기화됨.  
→ **두 브라우저 모두 새로고침(F5) 후 재입장**

---

### ❓ 클릭했는데 점수 안 올라요

`server.js`의 LEVELS 데이터와  
`ImageCanvas.jsx`의 클릭 좌표 계산 로직 불일치 가능성.

→ **정답 영역 좌표값 일치 여부 확인**

---

## 📄 License

MIT License
