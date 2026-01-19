import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import type { MikiAPI } from "../../shared/types";
import { I18nProvider, useI18n } from "../../shared/i18n";

const TRAIL_LENGTH = 8;

const Overlay = () => {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<string>("idle");
  const [currentAction, setCurrentAction] = useState<any>(null);
  const [thinkingText, setThinkingText] = useState<string>("");
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [trail, setTrail] = useState<{ x: number; y: number }[]>([]);
  const [isStopping, setIsStopping] = useState(false);
  const [isStopButtonHovered, setIsStopButtonHovered] = useState(false);
  const requestRef = useRef<number>();
  const stopButtonRef = useRef<HTMLButtonElement | null>(null);
  const mousePassthroughRef = useRef(true);
  const showControlsRef = useRef(false);
  const { t } = useI18n();

  useEffect(() => {
    console.log("Overlay component mounted");

    const unsubscribeBackend = window.miki?.onBackendEvent((payload: any) => {
      console.log("Overlay received event:", payload);
      if (payload.event === "status") {
        setStatus(payload.state);
        if (payload.state === "running" || payload.state === "thinking") {
          setVisible(true);
          setIsStopping(false);
        } else if (payload.state === "idle") {
          setVisible(false);
          setCurrentAction(null);
          setThinkingText("");
          setIsStopping(false);
        } else if (payload.state === "stopping") {
          setVisible(true);
          setIsStopping(true);
        }
      } else if (payload.event === "action_update") {
        setCurrentAction(payload);
    } else if (payload.event === "thinking") {
      // Prefer explicit thought field from think action, fall back to message
      const content = payload.thought || payload.message || t("overlay.thinking");
      setThinkingText(content);
      } else if (payload.event === "fadeout" || payload.event === "completed") {
        setVisible(false);
        setCurrentAction(null);
        setThinkingText("");
        setIsStopping(false);
      }
    });

    const unsubscribeMouse = window.miki?.onMousePos((pos: { x: number; y: number }) => {
      setMousePos(pos);
      setTrail((prev) => [pos, ...prev].slice(0, TRAIL_LENGTH));

      const stopButton = stopButtonRef.current;
      if (!showControlsRef.current || !stopButton) {
        if (!mousePassthroughRef.current) {
          mousePassthroughRef.current = true;
          window.miki?.setOverlayMousePassthrough(true);
        }
        return;
      }

      const rect = stopButton.getBoundingClientRect();
      const isInside =
        pos.x >= rect.left &&
        pos.x <= rect.right &&
        pos.y >= rect.top &&
        pos.y <= rect.bottom;

      const nextIgnore = !isInside;
      if (mousePassthroughRef.current !== nextIgnore) {
        mousePassthroughRef.current = nextIgnore;
        window.miki?.setOverlayMousePassthrough(nextIgnore);
      }
    });

    return () => {
      unsubscribeBackend?.();
      unsubscribeMouse?.();
    };
  }, [t]);

  // Stop button handler
  const handleStop = async () => {
    try {
      setIsStopping(true);
      await window.miki?.stop();
    } catch (error) {
      console.error("Stop failed:", error);
      setIsStopping(false);
    }
  };

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: "auto",
    zIndex: 9999,
    opacity: visible ? 1 : 0,
    transition: "opacity 0.5s ease-in-out",
    visibility: visible ? "visible" : "hidden",
  };

  const isThinking = status === "thinking" || status === "running";
  const showControls = isThinking || isStopping || status === "stopping";

  useEffect(() => {
    showControlsRef.current = showControls;
    if (!showControls && !mousePassthroughRef.current) {
      mousePassthroughRef.current = true;
      window.miki?.setOverlayMousePassthrough(true);
    }
  }, [showControls]);

  return (
    <div style={overlayStyle}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "15vh",
          background: "linear-gradient(to bottom, rgba(150, 150, 150, 0.15) 0%, rgba(150, 150, 150, 0) 100%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "15vh",
          background: "linear-gradient(to top, rgba(150, 150, 150, 0.15) 0%, rgba(150, 150, 150, 0) 100%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: "15vw",
          background: "linear-gradient(to right, rgba(150, 150, 150, 0.15) 0%, rgba(150, 150, 150, 0) 100%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          right: 0,
          width: "15vw",
          background: "linear-gradient(to left, rgba(150, 150, 150, 0.15) 0%, rgba(150, 150, 150, 0) 100%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: mousePos.x - 100,
          top: mousePos.y - 100,
          width: 200,
          height: 200,
          background: "radial-gradient(circle, rgba(180, 180, 180, 0.08) 0%, rgba(180, 180, 180, 0) 70%)",
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
          <CursorSVG color="#b0b0b0" scale={0.8} />
        </div>
      ))}

      {/* Status display and stop button at bottom center */}
      {showControls && (
        <div
          style={{
            position: "fixed",
            bottom: 40,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            pointerEvents: "auto",
            zIndex: 10000,
          }}
        >
          {/* Thinking text */}
          {thinkingText && !isStopping && (
            <div
              style={{
                padding: "12px 20px",
                background: "#2e3339",
                borderRadius: 12,
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.1)",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                maxWidth: 400,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 400,
                  color: "#e6d6b8",
                  fontStyle: "italic",
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                }}
              >
                💭 {thinkingText}
              </span>
            </div>
          )}

          {/* Current action status */}
          <div
            style={{
              padding: "12px 20px",
              background: "#2e3339",
              borderRadius: 12,
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
              gap: 12,
              minWidth: 200,
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                border: isStopping
                  ? "2px solid #ff6b6b"
                  : "2px solid #555",
                borderTop: isStopping
                  ? "2px solid transparent"
                  : "2px solid #b0b0b0",
                borderRadius: "50%",
                animation: isStopping ? "spin 0.6s linear infinite" : "spin 1s linear infinite",
              }}
            />
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#d0d0d0",
              }}
            >
              {isStopping
                ? t("overlay.stopping")
                : (currentAction?.action
                  ? `${currentAction.action.charAt(0).toUpperCase() + currentAction.action.slice(1)}...`
                  : t("overlay.processing"))
              }
            </span>
          </div>

          {/* Stop button */}
          <button
            ref={stopButtonRef}
            onClick={handleStop}
            disabled={isStopping}
            onMouseEnter={() => !isStopping && setIsStopButtonHovered(true)}
            onMouseLeave={() => setIsStopButtonHovered(false)}
            style={{
              padding: "12px 24px",
              background: isStopping
                ? "#555"
                : isStopButtonHovered
                  ? "#ff5252"
                  : "#ff6b6b",
              color: "#1f242c",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              cursor: isStopping ? "not-allowed" : "pointer",
              opacity: isStopping ? 0.6 : 1,
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              transform: isStopButtonHovered && !isStopping ? "translateY(-1px)" : "translateY(0)",
            }}
          >
            <svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            {t("overlay.stopAgent")}
          </button>
        </div>
      )}

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
          <CursorSVG color="#b0b0b0" />

          {(status === "thinking" || status === "running") && (
            <div
              style={{
                marginLeft: 8,
                padding: "4px 12px",
                background: "#2e3339",
                borderRadius: 20,
                boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                fontWeight: 600,
                color: "#d0d0d0",
                animation: "fadeIn 0.2s ease-out",
              }}
            >
              <LoadingSpinner />
              {currentAction?.action
                ? `${currentAction.action.charAt(0).toUpperCase() + currentAction.action.slice(1)}...`
                : (currentAction?.message || t("overlay.thinking"))
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const CursorSVG = ({ color = "#b0b0b0", scale = 1 }) => (
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
      border: "2px solid #555",
      borderTop: "2px solid #b0b0b0",
      borderRadius: "50%",
      animation: "spin 1s linear infinite",
    }}
  />
);

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    <I18nProvider>
      <Overlay />
    </I18nProvider>
  );
}
