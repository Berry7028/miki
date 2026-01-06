import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";

const TRAIL_LENGTH = 8;

const Overlay = () => {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<string>("idle");
  const [currentAction, setCurrentAction] = useState<any>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [trail, setTrail] = useState<{ x: number; y: number }[]>([]);
  const requestRef = useRef<number>();

  useEffect(() => {
    console.log("Overlay component mounted");
    
    const unsubscribeBackend = window.miki?.onBackendEvent((payload: any) => {
      console.log("Overlay received event:", payload);
      if (payload.event === "status") {
        setStatus(payload.state);
        if (payload.state === "running" || payload.state === "thinking") {
          setVisible(true);
        } else if (payload.state === "idle") {
          setVisible(false);
          setCurrentAction(null);
        }
      } else if (payload.event === "action_update") {
        setCurrentAction(payload);
      } else if (payload.event === "fadeout" || payload.event === "completed") {
        setVisible(false);
        setCurrentAction(null);
      }
    });

    const unsubscribeMouse = window.miki?.onMousePos((pos: { x: number; y: number }) => {
      setMousePos(pos);
      setTrail((prev) => [pos, ...prev].slice(0, TRAIL_LENGTH));
    });

    return () => {
      unsubscribeBackend?.();
      unsubscribeMouse?.();
    };
  }, []);

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: "none",
    zIndex: 9999,
    opacity: visible ? 1 : 0,
    transition: "opacity 0.5s ease-in-out",
    visibility: visible ? "visible" : "hidden",
  };

  const isThinking = status === "thinking" || status === "running";

  return (
    <div style={overlayStyle}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "15vh",
          background: "linear-gradient(to bottom, rgba(255, 176, 64, 0.3) 0%, rgba(255, 176, 64, 0) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "15vh",
          background: "linear-gradient(to top, rgba(255, 176, 64, 0.3) 0%, rgba(255, 176, 64, 0) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: "15vw",
          background: "linear-gradient(to right, rgba(255, 176, 64, 0.3) 0%, rgba(255, 176, 64, 0) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          right: 0,
          width: "15vw",
          background: "linear-gradient(to left, rgba(255, 176, 64, 0.3) 0%, rgba(255, 176, 64, 0) 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: mousePos.x - 100,
          top: mousePos.y - 100,
          width: 200,
          height: 200,
          background: "radial-gradient(circle, rgba(255, 176, 64, 0.15) 0%, rgba(255, 176, 64, 0) 70%)",
          borderRadius: "50%",
          pointerEvents: "none",
          transition: "transform 0.1s ease-out",
        }}
      />

      {trail.slice(1).map((pos, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: pos.x,
            top: pos.y,
            opacity: (TRAIL_LENGTH - i - 1) / TRAIL_LENGTH * 0.3,
            transform: `scale(${(TRAIL_LENGTH - i - 1) / TRAIL_LENGTH})`,
            pointerEvents: "none",
          }}
        >
          <CursorSVG color="#FFB040" scale={0.8} />
        </div>
      ))}

      <div
        style={{
          position: "absolute",
          left: mousePos.x,
          top: mousePos.y,
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <CursorSVG color="#FFB040" />
          
          {(status === "thinking" || status === "running") && (
            <div
              style={{
                marginLeft: 8,
                padding: "4px 12px",
                background: "white",
                borderRadius: 20,
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                fontWeight: 600,
                color: "#333",
                animation: "fadeIn 0.2s ease-out",
              }}
            >
              <LoadingSpinner />
              {currentAction?.action 
                ? `${currentAction.action.charAt(0).toUpperCase() + currentAction.action.slice(1)}...`
                : (currentAction?.message || "Thinking...")
              }
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

const CursorSVG = ({ color = "#FFB040", scale = 1 }) => (
  <svg
    width={24 * scale}
    height={24 * scale}
    viewBox="0 0 24 24"
    fill="none"
    style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))" }}
  >
    <path
      d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z"
      fill={color}
      stroke="white"
      strokeWidth="1.5"
    />
  </svg>
);

const LoadingSpinner = () => (
  <div
    style={{
      width: 12,
      height: 12,
      border: "2px solid #EEE",
      borderTop: "2px solid #FFB040",
      borderRadius: "50%",
      animation: "spin 1s linear infinite",
    }}
  />
);

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<Overlay />);
}
