import { useEffect, useRef, useState } from "react";
import ImageCanvas from "./ImageCanvas";
import { socket, sendReady, claimSpot } from "../lib/socket";
import { onRT, sendRT } from "../lib/rtc";

export default function SpotGame() {
  const [phase, setPhase] = useState("idle");
  const [count, setCount] = useState(null);
  const [endsAt, setEndsAt] = useState(null);
  const [image, setImage] = useState(null);
  const [base, setBase] = useState({ w: 1024, h: 500 });
  const [players, setPlayers] = useState([]);

  const [spots, setSpots] = useState([]);
  const spotsRef = useRef([]);

  const [hits, setHits] = useState([]);
  const [scores, setScores] = useState({});
  const [result, setResult] = useState(null);
  const [leftSec, setLeftSec] = useState(null);

  const drawRef = useRef(null);
  const draw = (op) => drawRef.current && drawRef.current(op);
  const registerDraw = (fn) => (drawRef.current = fn);

  // 화면 갱신: X만 지우고 정답(O)은 유지
  const redrawHits = (currentHits) => {
    draw({ type: "clear" });
    currentHits.forEach((spotId) => {
      const s = spotsRef.current.find((v) => v.id === spotId);
      if (s) draw({ x: s.x, y: s.y, r: s.r, kind: "lock" });
    });
  };

  useEffect(() => {
    const handleRoster = (data) => {
      if (data.roster && data.roster.players) setPlayers(data.roster.players);
    };
    socket.on("joined", handleRoster);
    socket.on("peer-joined", handleRoster);
    socket.on("peer-left", handleRoster);
    return () => {
      socket.off("joined", handleRoster);
      socket.off("peer-joined", handleRoster);
      socket.off("peer-left", handleRoster);
    };
  }, []);

  useEffect(() => {
    const onStart = ({ image, base, spots, startsAt, endsAt }) => {
      setImage(image);
      if (base?.w) setBase(base);

      const toPx = (s) => ({
        id: s.id,
        x: Math.round(s.nx * base.w),
        y: Math.round(s.ny * base.h),
        r: Math.round(s.nr * base.w),
      });

      const pxSpots = (spots || []).map(toPx);
      setSpots(pxSpots);
      spotsRef.current = pxSpots;

      setPhase("countdown");
      setHits([]);
      setScores({});
      setResult(null);
      setEndsAt(endsAt);
      draw({ type: "clear" });

      let t;
      const tick = () => {
        const remain = Math.max(0, Math.ceil((startsAt - Date.now()) / 1000));
        setCount(remain);
        if (remain === 0) {
          setPhase("playing");
          clearInterval(t);
        }
      };
      tick();
      t = setInterval(tick, 200);
    };

    socket.on("start", onStart);
    return () => socket.off("start", onStart);
  }, []);

  useEffect(() => {
    const onLock = ({ spotId, scores }) => {
      if (scores) setScores(scores);
      setHits((prev) => {
        if (prev.includes(spotId)) return prev;
        const next = [...prev, spotId];
        const s = spotsRef.current.find((v) => v.id === spotId);
        if (s) draw({ x: s.x, y: s.y, r: s.r, kind: "lock" });
        return next;
      });
    };
    socket.on("lock", onLock);
    return () => socket.off("lock", onLock);
  }, []);

  useEffect(() => {
    const onOver = ({ scores, winners, reason }) => {
      setResult({ scores, winners, reason });
      setPhase("idle");
      setEndsAt(null);
    };

    socket.on("round-over", onOver);
    return () => socket.off("round-over", onOver);
  }, []);

  // WebRTC 수신부: 오답일 경우 상대 화면에서도 2초 뒤 삭제
  useEffect(() => {
    onRT((msg) => {
      if (msg.t === "mark") {
        draw({ ...msg }); // 일단 그리기

        // 만약 'miss'(오답)라면, 2초 뒤에 지워주기 (내 화면 로직과 동일)
        if (msg.kind === "miss") {
          setTimeout(() => {
            setHits((prev) => {
              redrawHits(prev); // 화면 싹 지우고 정답만 다시 그리기
              return prev;
            });
          }, 2000);
        }
      }
    });
  }, []);

  useEffect(() => {
    if (phase !== "playing" || !endsAt) return;
    const tick = () =>
      setLeftSec(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [phase, endsAt]);

  const handleReady = () => {
    const rid = window.__roomId || localStorage.getItem("roomId");
    if (!rid) {
      alert("방 이름이 없습니다. 새로고침 후 다시 Join 해주세요.");
      return;
    }
    sendReady(rid);
    setPhase("ready");
  };

  const handleClick = (ux, uy) => {
    if (phase !== "playing") return;

    let best = null,
      bestD = Infinity;
    for (const s of spotsRef.current) {
      const d = Math.hypot(s.x - ux, s.y - uy);
      if (!hits.includes(s.id) && d < bestD) {
        bestD = d;
        best = s;
      }
    }

    if (best && bestD <= best.r) {
      if (best.id) {
        draw({ x: best.x, y: best.y, r: best.r, kind: "hit" });
        sendRT({ t: "mark", x: best.x, y: best.y, r: best.r, kind: "hit" });

        const rid = window.__roomId || localStorage.getItem("roomId");
        claimSpot(rid, best.id);
      }
    } else {
      draw({ x: ux, y: uy, r: 10, kind: "miss" });
      sendRT({ t: "mark", x: ux, y: uy, r: 10, kind: "miss" });
      setTimeout(() => {
        setHits((prev) => {
          redrawHits(prev);
          return prev;
        });
      }, 2000);
    }
  };

  const myId = socket.id;
  const myScore = scores && myId ? scores[myId] || 0 : 0;
  const total = spots.length;

  let resultMessage = "";
  let resultColor = "#fff";
  if (result) {
    const winners = result.winners || [];
    const amIWinner = winners.includes(myId);

    // 승자 목록에 내가 있고, 승자가 1명보다 많으면 무승부
    const isDraw = winners.length > 1 && amIWinner;

    if (isDraw && amIWinner) {
      resultMessage = "무승부 🤝";
      resultColor = "#FFD166";
    } else if (amIWinner) {
      resultMessage = "승리! 🏆";
      resultColor = "#3BE37F";
    } else {
      resultMessage = "패배... 😭";
      resultColor = "#FF5E57";
    }
  }

  return (
    <div>
      <div
        style={{
          background: "#1a2030",
          padding: "8px 12px",
          borderRadius: 8,
          marginBottom: 10,
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontSize: "0.95rem",
        }}
      >
        <span style={{ color: "#aaa" }}>참여자:</span>
        {players.length > 0 ? (
          players.map((p) => (
            <span
              key={p.id}
              style={{
                background: p.id === myId ? "#6aa3ff" : "#273043",
                color: p.id === myId ? "#fff" : "#ccc",
                padding: "4px 8px",
                borderRadius: 4,
                fontWeight: p.id === myId ? "bold" : "normal",
              }}
            >
              {p.name} {p.id === myId ? "(나)" : ""}
            </span>
          ))
        ) : (
          <span style={{ color: "#666" }}>접속 중...</span>
        )}
      </div>

      <div
        style={{
          marginBottom: 8,
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={handleReady}
          disabled={phase !== "idle" && phase !== "ready"}
        >
          {phase === "ready" ? "상대 대기중…" : "준비"}
        </button>
        {result && (
          <button
            onClick={() => {
              setHits([]);
              setResult(null);
              handleReady();
            }}
          >
            다시하기
          </button>
        )}

        {phase === "countdown" && <span>시작: {count}</span>}
        {phase === "playing" && leftSec != null && (
          <span>남은시간: {leftSec}s</span>
        )}
        <span style={{ marginLeft: "auto", fontSize: "1.1em" }}>
          점수: <b style={{ color: "#6aa3ff" }}>{myScore}</b>
        </span>
        <span>
          정답 {hits.length}/{total}
        </span>
      </div>

      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 1024,
          margin: "0 auto",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 12,
          background: "#0e1320",
        }}
      >
        {result && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 10,
              background: "rgba(0,0,0,0.7)",
              backdropFilter: "blur(4px)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              borderRadius: 8,
            }}
          >
            <h2
              style={{
                fontSize: "3rem",
                color: resultColor,
                marginBottom: "20px",
                textShadow: "0 4px 10px rgba(0,0,0,0.5)",
              }}
            >
              {resultMessage}
            </h2>
            <div style={{ fontSize: "1.2rem", color: "#ddd" }}>
              {result.reason === "time-out"
                ? "시간 종료!"
                : "모든 정답을 찾았습니다!"}
            </div>
          </div>
        )}

        {image ? (
          <ImageCanvas
            src={image}
            base={base}
            onClick={handleClick}
            registerDraw={registerDraw}
          />
        ) : (
          <div style={{ opacity: 0.7 }}>이미지 대기 중... (Join → 준비)</div>
        )}
      </div>
    </div>
  );
}
