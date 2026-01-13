import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import {
  ThemeProvider,
  CssBaseline,
  Box,
  Typography,
  TextField,
  IconButton,
  Paper,
  Avatar,
  Stack,
  Chip,
} from "@mui/material";
import {
  Send,
  Stop,
  DeleteOutline,
  SmartToy,
  Person,
  AutoFixHigh,
  Build,
  AttachFile,
} from "@mui/icons-material";
import { theme } from "../../shared/theme";
import type { BackendEvent } from "../../shared/types";

// Create Emotion cache with nonce for CSP
async function createEmotionCache() {
  let nonce = "";
  try {
    nonce = await window.miki?.getStyleNonce();
  } catch (error) {
    console.warn("Failed to get nonce, styles may be blocked by CSP:", error);
  }
  
  return createCache({
    key: "miki-chat",
    nonce: nonce || undefined,
    prepend: true,
  });
}

interface Message {
  type: "user" | "ai" | "action" | "result" | "error" | "thinking" | "tool";
  content: string;
  timestamp: number;
  toolName?: string;
  toolInput?: any;
  toolOutput?: any;
}

const ActionContent = ({ msg }: { msg: Message }) => {
  const { content, type, toolName, toolInput } = msg;

  if (type === "action" && content.startsWith("アクション: ")) {
    try {
      const jsonStr = content.substring(6);
      const actionObj = JSON.parse(jsonStr);

      const renderAction = (action: any, isSub = false) => {
        if (!action) return null;

        if (action.action === "batch" && action.params?.actions) {
          return (
            <Box sx={{ mt: isSub ? 0.5 : 0 }}>
              <Typography
                variant="caption"
                sx={{ fontWeight: "bold", color: "#79b8ff", display: "block", mb: 0.5 }}
              >
                BATCH
              </Typography>
              <Box sx={{ ml: 1.5, borderLeft: "1px solid rgba(121, 184, 255, 0.2)", pl: 1.5 }}>
                {action.params.actions.map((subAction: any, idx: number) => (
                  <Box key={idx} sx={{ mb: idx === action.params.actions.length - 1 ? 0 : 1 }}>
                    {renderAction(subAction, true)}
                  </Box>
                ))}
              </Box>
            </Box>
          );
        }

        if (action.action === "think" && action.params?.thought) {
          return (
            <Box sx={{ py: 0.5 }}>
              <Typography
                variant="body2"
                sx={{
                  fontStyle: "italic",
                  color: "#e6d6b8",
                  fontSize: "0.85rem",
                  borderLeft: "2px solid rgba(230, 214, 184, 0.3)",
                  pl: 1.5,
                  py: 0.5,
                }}
              >
                {action.params.thought}
              </Typography>
              {action.params.phase && (
                <Typography
                  variant="caption"
                  sx={{ mt: 0.5, display: "block", opacity: 0.7, fontSize: "0.65rem" }}
                >
                  Phase: {action.params.phase}
                </Typography>
              )}
            </Box>
          );
        }

        const paramsEntries = action.params ? Object.entries(action.params) : [];

        return (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Chip
                label={action.action}
                size="small"
                sx={{
                  height: 18,
                  fontSize: "0.65rem",
                  bgcolor: "#3a4a5a",
                  color: "#8fa0b0",
                  fontWeight: 800,
                  borderRadius: 6,
                  "& .MuiChip-label": { px: 1 },
                }}
              />
              {paramsEntries.length > 0 && (
                <Typography
                  variant="caption"
                  sx={{
                    color: "rgba(255,255,255,0.6)",
                    fontSize: "0.75rem",
                    fontFamily: "monospace",
                    wordBreak: "break-all",
                  }}
                >
                  {paramsEntries
                    .map(([k, v]) => {
                      if (typeof v === "object") return `${k}: ${JSON.stringify(v)}`;
                      return `${k}: ${v}`;
                    })
                    .join(", ")}
                </Typography>
              )}
            </Stack>
          </Box>
        );
      };

      return renderAction(actionObj);
    } catch (e) {
      return (
        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", opacity: 0.8 }}>
          {content}
        </Typography>
      );
    }
  }

  if (type === "tool" && toolName) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {content}
        </Typography>
        {toolInput && (
          <Paper
            variant="outlined"
            sx={{
              p: 1,
              bgcolor: "#1e2228",
              borderColor: "rgba(255,255,255,0.1)",
              maxHeight: 200,
              overflow: "auto",
            }}
          >
            <Typography
              variant="caption"
              component="pre"
              sx={{
                m: 0,
                fontSize: "0.7rem",
                color: "rgba(255,255,255,0.7)",
                whiteSpace: "pre-wrap",
                fontFamily: "monospace",
              }}
            >
              {JSON.stringify(toolInput, null, 2)}
            </Typography>
          </Paper>
        )}
      </Box>
    );
  }

  return (
    <Typography
      variant="body2"
      sx={{
        whiteSpace: "pre-wrap",
        lineHeight: 1.6,
        fontFamily: type === "action" || type === "tool" ? "monospace" : "inherit",
      }}
    >
      {content}
    </Typography>
  );
};

const ChatApp = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTool, setCurrentTool] = useState<string>("");
  const [thinkingText, setThinkingText] = useState<string>("");
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addMessage = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  useEffect(() => {
    const unsubscribe = window.miki?.onBackendEvent((payload) => {
      if (payload.event === "status") {
        if (payload.state === "running") setIsProcessing(true);
        if (payload.state === "idle") {
          setIsProcessing(false);
          setCurrentTool("");
          setThinkingText("");
        }
      } else if (payload.event === "thinking") {
        setThinkingText(payload.message || "Thinking...");
        // Prefer explicit thought field from think action, fall back to message for backwards compatibility
        // payload.thought: explicit thought content from think(phase, thought)
        // payload.message: formatted message with phase label (e.g., "[計画] ...")
        const content = payload.thought || payload.message || "Thinking...";
        addMessage({
          type: "thinking",
          content,
          timestamp: payload.timestamp || Date.now(),
        });
      } else if (payload.event === "tool") {
        if (payload.toolName === "done") return;
        setCurrentTool(payload.toolName || "");
        addMessage({
          type: "tool",
          content: payload.message || `${payload.toolName} running...`,
          timestamp: payload.timestamp || Date.now(),
          toolName: payload.toolName,
          toolInput: payload.toolInput,
          toolOutput: payload.toolOutput,
        });
      } else if (payload.event === "log" && payload.type === "action") {
        if (payload.message && (payload.message.includes('"action":"done"') || payload.message.includes('"action": "done"'))) {
          return;
        }
        addMessage({
          type: "action",
          content: payload.message || "",
          timestamp: payload.timestamp || Date.now(),
        });
      } else if (payload.event === "completed") {
        addMessage({
          type: "ai",
          content: payload.message || payload.result || "Done.",
          timestamp: payload.timestamp || Date.now(),
        });
        setIsProcessing(false);
        setThinkingText("");
      } else if (payload.event === "error") {
        addMessage({
          type: "error",
          content: payload.message || "An error occurred.",
          timestamp: payload.timestamp || Date.now(),
        });
        setIsProcessing(false);
      }
    });

    return () => unsubscribe?.();
  }, [addMessage]);

  useEffect(() => {
    const unsubscribe = window.miki?.onFocusInput(() => {
      inputRef.current?.focus();
    });
    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    let visibilityTimeout: number | null = null;
    let animationTimeout: number | null = null;

    const clearPendingTimeouts = () => {
      if (visibilityTimeout !== null) {
        clearTimeout(visibilityTimeout);
        visibilityTimeout = null;
      }
      if (animationTimeout !== null) {
        clearTimeout(animationTimeout);
        animationTimeout = null;
      }
    };

    const unsubscribe = window.miki?.onChatVisibility?.((payload) => {
      clearPendingTimeouts();

      if (payload.visible) {
        setIsAnimating(true);
        setIsVisible(true);
        animationTimeout = window.setTimeout(() => {
          setIsAnimating(false);
        }, 300);
      } else {
        setIsAnimating(true);
        setIsVisible(false);
        animationTimeout = window.setTimeout(() => {
          setIsAnimating(false);
        }, 300);
      }
    });

    return () => {
      clearPendingTimeouts();
      unsubscribe?.();
    };
  }, []);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isProcessing) return;

    addMessage({ type: "user", content: text, timestamp: Date.now() });
    setInputText("");
    setIsProcessing(true);

    try {
      await window.miki?.start(text);
    } catch (error: any) {
      addMessage({
        type: "error",
        content: "Error: " + error.message,
        timestamp: Date.now(),
      });
      setIsProcessing(false);
    }
  };

  const handleStop = async () => {
    try {
      await window.miki?.stop();
    } catch (error: any) {
      addMessage({
        type: "error",
        content: "Error stopping agent: " + error.message,
        timestamp: Date.now(),
      });
    }
  };

  const handleClearChat = async () => {
    setMessages([]);
    try {
      await window.miki?.reset();
    } catch (error: any) {
      console.error("Failed to reset agent context:", error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      // IME composition check
      if ((e.nativeEvent as any).isComposing) return;

      e.preventDefault();
      if (isProcessing) {
        handleStop();
      } else {
        handleSend();
      }
    }
  };

  // Helper function to get message style based on type
  const getMessageStyle = (type: Message["type"]) => {
    switch (type) {
      case "user":
        return {
          background: "#3a3f47",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "8px 8px 2px 8px",
        };
      case "action":
      case "tool":
        return {
          background: "#2a2e34",
          border: "1px solid rgba(100,120,150,0.3)",
          borderRadius: "8px 8px 8px 2px",
        };
      case "thinking":
        return {
          background: "#32373d",
          border: "1px solid rgba(150,150,150,0.3)",
          borderRadius: "8px 8px 8px 2px",
        };
      default:
        return {
          background: "#2e3339",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "8px 8px 8px 2px",
        };
    }
  };

  // Helper function to get label text
  const getMessageLabel = (msg: Message) => {
    if (msg.type === "tool") return `TOOL: ${msg.toolName}`;
    if (msg.type === "thinking") return "思考中";
    if (msg.type === "action") return "ACTION";
    return null;
  };

  // Animation style for chat widget visibility
  const containerStyle: React.CSSProperties = {
    transition: isAnimating
      ? "opacity 0.3s ease-in-out, transform 0.3s ease-in-out"
      : "",
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? "scale(1)" : "scale(0.95)",
    pointerEvents: isVisible ? "auto" : "none",
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          bgcolor: "#1a1e24",
          borderRadius: "18px",
          border: "1px solid rgba(255,255,255,0.1)",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)",
          transition: containerStyle.transition,
          opacity: containerStyle.opacity,
          transform: containerStyle.transform,
          pointerEvents: containerStyle.pointerEvents,
        }}
      >
        <Box
          sx={{
            p: 2,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            background: "#282e38",
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box sx={{ ml: "auto" }}>
              <IconButton
                size="small"
                onClick={handleClearChat}
                sx={{
                  bgcolor: "rgba(255,255,255,0.06)",
                  "&:hover": { bgcolor: "rgba(255,100,100,0.15)", color: "#ff6b6b" },
                }}
                title="Clear Chat"
              >
                <DeleteOutline fontSize="small" />
              </IconButton>
            </Box>
          </Stack>
        </Box>

        <Box
          sx={{
            flexGrow: 1,
            overflowY: "auto",
            p: 2,
            "&::-webkit-scrollbar": { width: "6px" },
            "&::-webkit-scrollbar-thumb": {
              bgcolor: "rgba(255,255,255,0.08)",
              borderRadius: 3,
            },
          }}
        >
          {messages.map((msg, i) => (
            <Box
              key={i}
              sx={{
                display: "flex",
                justifyContent: msg.type === "user" ? "flex-end" : "flex-start",
                mb: 2,
              }}
            >
              <Stack direction="row" spacing={1.5} sx={{ maxWidth: "85%" }}>
                {msg.type !== "user" && (
                  <Avatar
                    sx={{
                      width: 28,
                      height: 28,
                      bgcolor: "#3a3f47",
                      color: "#b0b0b0",
                    }}
                  >
                    {msg.type === "action" ? (
                      <AutoFixHigh sx={{ fontSize: 16 }} />
                    ) : msg.type === "tool" ? (
                      <Build sx={{ fontSize: 16 }} />
                    ) : (
                      <SmartToy sx={{ fontSize: 16 }} />
                    )}
                  </Avatar>
                )}
                <Paper
                  sx={{
                    p: 2,
                    color: msg.type === "user" ? "#ffffff" : "text.primary",
                    ...getMessageStyle(msg.type),
                  }}
                >
                  {getMessageLabel(msg) && (
                    <Typography
                      variant="caption"
                      sx={{
                        display: "block",
                        mb: 1,
                        color: msg.type === "thinking" ? "#e6d6b8" : "#79b8ff",
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        fontSize: "0.65rem",
                      }}
                    >
                    {getMessageLabel(msg)}
                  </Typography>
                )}
                <ActionContent msg={msg} />
                <Typography
                  variant="caption"
                    sx={{
                      display: "block",
                      mt: 1,
                      opacity: 0.6,
                      textAlign: msg.type === "user" ? "right" : "left",
                      fontSize: "0.7rem",
                    }}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Typography>
                </Paper>
              </Stack>
            </Box>
          ))}
          <div ref={messagesEndRef} />
        </Box>

        <Box sx={{ p: 2, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <Paper
            elevation={0}
            sx={{
              p: 1,
              display: "flex",
              alignItems: "center",
              gap: 1,
              borderRadius: 2,
              bgcolor: "#1e2228",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <IconButton size="small" sx={{ color: "text.secondary" }}>
              <AttachFile fontSize="small" />
            </IconButton>
            <TextField
              fullWidth
              multiline
              maxRows={3}
              inputRef={inputRef}
              placeholder="Ask Miki to automate a task..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              variant="standard"
              InputProps={{
                disableUnderline: true,
                sx: {
                  px: 1,
                  py: 0.5,
                  fontSize: "0.85rem",
                },
              }}
            />
            <IconButton
              onClick={isProcessing ? handleStop : handleSend}
              disabled={!isProcessing && !inputText.trim()}
              sx={{
                bgcolor: isProcessing
                  ? "error.main"
                  : inputText.trim()
                  ? "primary.main"
                  : "transparent",
                color: isProcessing || inputText.trim() ? "#1f242c" : "text.secondary",
                "&:hover": {
                  bgcolor: isProcessing
                    ? "error.light"
                    : inputText.trim()
                    ? "primary.light"
                    : "transparent",
                },
              }}
            >
              {isProcessing ? <Stop fontSize="small" /> : <Send fontSize="small" />}
            </IconButton>
          </Paper>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            Enter to send, Shift+Enter for new line
          </Typography>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

const root = createRoot(document.getElementById("root")!);

// Initialize app with Emotion cache
createEmotionCache().then((cache) => {
  root.render(
    <CacheProvider value={cache}>
      <ChatApp />
    </CacheProvider>
  );
});
