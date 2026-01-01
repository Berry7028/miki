import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";

const Overlay = () => {
  const [visible, setVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);

  useEffect(() => {
    console.log("Overlay component mounted");
    const unsubscribe = window.miki?.onBackendEvent((payload: any) => {
      console.log("Overlay received event:", payload);
      if (payload.event === "status") {
        if (payload.state === "running") {
          setVisible(true);
        } else if (payload.state === "idle") {
          setVisible(false);
        }
      } else if (payload.event === "fadeout" || payload.event === "completed") {
        setVisible(false);
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  if (!shouldRender) return null;

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: "none",
    opacity: visible ? 1 : 0,
    transition: "opacity 1s ease-in-out",
    zIndex: 9999,
  };

  const commonGradient = "radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, rgba(99, 102, 241, 0) 70%)";

  return (
    <div style={overlayStyle}>
      {/* Top side */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "15vh",
          background: "linear-gradient(to bottom, rgba(99, 102, 241, 0.5) 0%, rgba(99, 102, 241, 0) 100%)",
        }}
      />
      {/* Bottom side */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "15vh",
          background: "linear-gradient(to top, rgba(99, 102, 241, 0.5) 0%, rgba(99, 102, 241, 0) 100%)",
        }}
      />
      {/* Left side */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: "15vw",
          background: "linear-gradient(to right, rgba(99, 102, 241, 0.5) 0%, rgba(99, 102, 241, 0) 100%)",
        }}
      />
      {/* Right side */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          right: 0,
          width: "15vw",
          background: "linear-gradient(to left, rgba(99, 102, 241, 0.5) 0%, rgba(99, 102, 241, 0) 100%)",
        }}
      />
    </div>
  );
};

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<Overlay />);
}

