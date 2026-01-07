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
import { theme } from "./theme";
import type { BackendEvent } from "./types";

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

const ChatApp = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTool, setCurrentTool] = useState<string>("");
  const [thinkingText, setThinkingText] = useState<string>("");
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
          background: "rgba(230, 214, 184, 0.15)",
          border: "1px solid rgba(230, 214, 184, 0.3)",
          borderRadius: "16px 4px 16px 16px",
        };
      case "action":
      case "tool":
        return {
          background: "rgba(0, 0, 0, 0.25)",
          border: "1px solid rgba(121, 184, 255, 0.2)",
          borderRadius: "4px 16px 16px 16px",
        };
      case "thinking":
        return {
          background: "rgba(230, 214, 184, 0.1)",
          border: "1px solid rgba(230, 214, 184, 0.3)",
          borderRadius: "4px 16px 16px 16px",
        };
      default:
        return {
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "4px 16px 16px 16px",
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

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          bgcolor: "#1f252d",
          borderRadius: "18px",
          border: "1px solid rgba(255,255,255,0.08)",
          overflow: "hidden",
          boxShadow: "0 20px 50px rgba(0,0,0,0.45)",
        }}
      >
        <Box
          sx={{
            p: 2,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "linear-gradient(180deg, rgba(40,46,56,0.9) 0%, rgba(31,37,45,0.9) 100%)",
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
                      bgcolor: "rgba(255,255,255,0.08)",
                      color: "#d6cec1",
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
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontFamily: msg.type === "action" || msg.type === "tool" ? "monospace" : "inherit" }}>
                    {msg.content}
                  </Typography>
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
              bgcolor: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
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
