import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
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
  Close,
  SmartToy,
  Person,
  AutoFixHigh,
  Build,
  AttachFile,
} from "@mui/icons-material";
import { theme } from "./theme";
import type { BackendEvent } from "./types";

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
      } else if (payload.event === "tool") {
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
        addMessage({
          type: "action",
          content: payload.message || "",
          timestamp: payload.timestamp || Date.now(),
        });
      } else if (payload.event === "completed") {
        addMessage({
          type: "result",
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar
                sx={{
                  bgcolor: "rgba(230,214,184,0.2)",
                  color: "#e6d6b8",
                  width: 28,
                  height: 28,
                }}
              >
                <SmartToy sx={{ fontSize: 16 }} />
              </Avatar>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                MIKI DESKTOP
              </Typography>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  bgcolor: isProcessing ? "#f0a54a" : "#4fd08a",
                  boxShadow: isProcessing
                    ? "0 0 8px rgba(240,165,74,0.7)"
                    : "0 0 8px rgba(79,208,138,0.6)",
                }}
              />
            </Stack>
            <IconButton
              size="small"
              onClick={() => window.close()}
              sx={{
                bgcolor: "rgba(255,255,255,0.06)",
                "&:hover": { bgcolor: "rgba(255,255,255,0.12)" },
              }}
            >
              <Close fontSize="small" />
            </IconButton>
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
                    background:
                      msg.type === "user"
                        ? "rgba(230, 214, 184, 0.15)"
                        : msg.type === "action" || msg.type === "tool"
                        ? "rgba(0, 0, 0, 0.25)"
                        : "rgba(255,255,255,0.04)",
                    color: msg.type === "user" ? "#ffffff" : "text.primary",
                    borderRadius: msg.type === "user" ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
                    border:
                      msg.type === "user"
                        ? "1px solid rgba(230, 214, 184, 0.3)"
                        : msg.type === "action" || msg.type === "tool"
                        ? "1px solid rgba(121, 184, 255, 0.2)"
                        : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {(msg.type === "action" || msg.type === "tool") && (
                    <Typography
                      variant="caption"
                      sx={{
                        display: "block",
                        mb: 1,
                        color: "#79b8ff",
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        fontSize: "0.65rem",
                      }}
                    >
                      {msg.type === "tool" ? `TOOL: ${msg.toolName}` : "ACTION"}
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
              onClick={handleSend}
              disabled={!inputText.trim() || isProcessing}
              sx={{
                bgcolor: inputText.trim() && !isProcessing ? "primary.main" : "transparent",
                color: inputText.trim() && !isProcessing ? "#1f242c" : "text.secondary",
                "&:hover": {
                  bgcolor: inputText.trim() && !isProcessing ? "primary.light" : "transparent",
                },
              }}
            >
              <Send fontSize="small" />
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
root.render(<ChatApp />);
