import { io } from "socket.io-client";
import { BACKEND_URL } from "./config";
import { setMyId, setPeerId, maybeStartCall, initRTCSignal } from "./rtc";

export const socket = io(BACKEND_URL, {
  transports: ["websocket"], // 롱풀링 생략, 속도 상승, Render 배포에 적합
  withCredentials: false, // 요청 보낼 때 쿠키 or 인증헤더 X
});

initRTCSignal();

// 방 입장
export function joinRoom(roomId, name) {
  window.__roomId = roomId;
  socket.emit("join", { roomId, name });
}

// ready
export function sendReady(roomId) {
  socket.emit("ready", { roomId });
}

// ★ 수정된 부분: spotIdx -> spotId 로 변경
export function claimSpot(roomId, spotId) {
  // 서버가 받는 이름(spotId)과 똑같이 맞춰줍니다.
  socket.emit("claim", { roomId, spotId });
}

// WebRTC 시그널(내 연결정보를 상대에게 전달 요청)
export function emitSignal(to, data) {
  socket.emit("signal", { to, data });
}
export function onSignal(fn) {
  socket.on("signal", ({ from, data }) => fn(from, data));
}

// 로스터/ID 연동 & 핸드셰이크
socket.on("joined", (p) => {
  setMyId(p.you);
  // roster 정보가 있으면 처리
  const others = (p.roster?.players || [])
    .map((v) => v.id)
    .filter((id) => id !== p.you);
  if (others[0]) {
    setPeerId(others[0]);
    maybeStartCall();
  }
});

socket.on("peer-joined", (p) => {
  setPeerId(p.peer);
  maybeStartCall();
});
