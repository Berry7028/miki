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
  Fade,
  CircularProgress,
  Chip,
  LinearProgress,
  Collapse,
} from "@mui/material";
import {
  Send,
  Close,
  SmartToy,
  Person,
  AutoFixHigh,
  Psychology,
  Build,
  ExpandMore,
  ExpandLess,
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
  const [isThinking, setIsThinking] = useState(false);
  const [showThinking, setShowThinking] = useState(true);
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
          setIsThinking(false);
        }
      } else if (payload.event === "thinking") {
        setIsThinking(true);
        setThinkingText(payload.message || "");
      } else if (payload.event === "tool") {
        setCurrentTool(payload.toolName || "");
        addMessage({
          type: "tool",
          content: payload.message || `${payload.toolName}を実行中...`,
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
          content: payload.message || payload.result || "完了しました",
          timestamp: payload.timestamp || Date.now(),
        });
        setIsProcessing(false);
        setIsThinking(false);
        setThinkingText("");
      } else if (payload.event === "error") {
        addMessage({
          type: "error",
          content: payload.message || "エラーが発生しました",
          timestamp: payload.timestamp || Date.now(),
        });
        setIsProcessing(false);
        setIsThinking(false);
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
        content: "エラー: " + error.message,
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
          bgcolor: "rgba(11, 14, 20, 0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        <Box
          sx={{
            background:
              "linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(16, 185, 129, 0.1) 100%)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            p: 2,
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: currentTool ? 1.5 : 0,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  bgcolor: isProcessing ? "warning.main" : "success.main",
                  boxShadow: isProcessing
                    ? "0 0 8px rgba(251, 191, 36, 0.6)"
                    : "0 0 8px rgba(16, 185, 129, 0.6)",
                }}
              />
              <Typography variant="subtitle2" fontWeight={700}>
                miki
              </Typography>
              <Chip
                label={isProcessing ? "実行中" : "待機中"}
                size="small"
                sx={{
                  height: 20,
                  fontSize: "0.7rem",
                  bgcolor: isProcessing ? "rgba(251, 191, 36, 0.15)" : "rgba(16, 185, 129, 0.15)",
                  color: isProcessing ? "warning.light" : "success.light",
                  border: `1px solid ${isProcessing ? "rgba(251, 191, 36, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
                }}
              />
            </Box>
            <IconButton
              size="small"
              onClick={() => window.close()}
              sx={{
                bgcolor: "rgba(255,255,255,0.05)",
                "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
              }}
            >
              <Close fontSize="small" />
            </IconButton>
          </Box>

          {currentTool && (
            <Fade in>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  p: 1,
                  bgcolor: "rgba(99, 102, 241, 0.1)",
                  borderRadius: 2,
                  border: "1px solid rgba(99, 102, 241, 0.2)",
                }}
              >
                <Build sx={{ fontSize: 16, color: "primary.light" }} />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  実行中のツール:
                </Typography>
                <Chip
                  label={currentTool}
                  size="small"
                  color="primary"
                  sx={{ height: 20, fontSize: "0.7rem" }}
                />
                <CircularProgress size={14} sx={{ ml: "auto" }} />
              </Box>
            </Fade>
          )}
        </Box>

        <Collapse in={isThinking && showThinking}>
          <Box
            sx={{
              p: 2,
              bgcolor: "rgba(139, 92, 246, 0.08)",
              borderBottom: "1px solid rgba(139, 92, 246, 0.2)",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 1,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Psychology sx={{ fontSize: 18, color: "secondary.light" }} />
                <Typography variant="caption" fontWeight={700} color="secondary.light">
                  思考過程
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={() => setShowThinking(!showThinking)}
                sx={{ opacity: 0.7 }}
              >
                {showThinking ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
              </IconButton>
            </Box>
            <LinearProgress
              sx={{
                mb: 1.5,
                borderRadius: 1,
                height: 3,
                bgcolor: "rgba(139, 92, 246, 0.1)",
                "& .MuiLinearProgress-bar": {
                  bgcolor: "secondary.light",
                },
              }}
            />
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
                fontStyle: "italic",
                lineHeight: 1.6,
                fontSize: "0.8rem",
              }}
            >
              {thinkingText || "AIが考えています..."}
            </Typography>
          </Box>
        </Collapse>

        <Box
          sx={{
            flexGrow: 1,
            overflowY: "auto",
            p: 2,
            "&::-webkit-scrollbar": { width: "6px" },
            "&::-webkit-scrollbar-track": {
              bgcolor: "rgba(255,255,255,0.02)",
              borderRadius: 1,
            },
            "&::-webkit-scrollbar-thumb": {
              bgcolor: "rgba(255,255,255,0.1)",
              borderRadius: 1,
              "&:hover": { bgcolor: "rgba(255,255,255,0.15)" },
            },
          }}
        >
          {messages.map((msg, i) => (
            <Fade in key={i}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: msg.type === "user" ? "flex-end" : "flex-start",
                  mb: 2,
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: msg.type === "user" ? "row-reverse" : "row",
                    gap: 1.5,
                    maxWidth: "85%",
                  }}
                >
                  <Avatar
                    sx={{
                      width: 32,
                      height: 32,
                      bgcolor:
                        msg.type === "user"
                          ? "primary.main"
                          : msg.type === "action"
                            ? "secondary.main"
                            : msg.type === "tool"
                              ? "info.main"
                              : msg.type === "thinking"
                                ? "secondary.light"
                                : "rgba(255,255,255,0.1)",
                      boxShadow:
                        msg.type === "user"
                          ? "0 0 12px rgba(99, 102, 241, 0.4)"
                          : msg.type === "action"
                            ? "0 0 12px rgba(16, 185, 129, 0.4)"
                            : "none",
                    }}
                  >
                    {msg.type === "user" ? (
                      <Person sx={{ fontSize: 18 }} />
                    ) : msg.type === "action" ? (
                      <AutoFixHigh sx={{ fontSize: 18 }} />
                    ) : msg.type === "tool" ? (
                      <Build sx={{ fontSize: 18 }} />
                    ) : msg.type === "thinking" ? (
                      <Psychology sx={{ fontSize: 18 }} />
                    ) : (
                      <SmartToy sx={{ fontSize: 18 }} />
                    )}
                  </Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        bgcolor:
                          msg.type === "user"
                            ? "linear-gradient(135deg, rgba(99, 102, 241, 0.9) 0%, rgba(79, 70, 229, 0.9) 100%)"
                            : msg.type === "action"
                              ? "rgba(16, 185, 129, 0.1)"
                              : msg.type === "tool"
                                ? "rgba(59, 130, 246, 0.1)"
                                : msg.type === "thinking"
                                  ? "rgba(139, 92, 246, 0.08)"
                                  : "rgba(255,255,255,0.04)",
                        borderRadius:
                          msg.type === "user" ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
                        border:
                          msg.type === "action"
                            ? "1px solid rgba(16, 185, 129, 0.3)"
                            : msg.type === "tool"
                              ? "1px solid rgba(59, 130, 246, 0.3)"
                              : msg.type === "thinking"
                                ? "1px solid rgba(139, 92, 246, 0.2)"
                                : msg.type === "error"
                                  ? "1px solid rgba(239, 68, 68, 0.4)"
                                  : "1px solid rgba(255,255,255,0.05)",
                        backdropFilter: "blur(8px)",
                      }}
                    >
                      {msg.toolName && (
                        <Box sx={{ mb: 1 }}>
                          <Chip
                            label={msg.toolName}
                            size="small"
                            icon={<Build sx={{ fontSize: "14px !important" }} />}
                            sx={{
                              height: 22,
                              fontSize: "0.7rem",
                              bgcolor: "rgba(59, 130, 246, 0.2)",
                              border: "1px solid rgba(59, 130, 246, 0.3)",
                            }}
                          />
                        </Box>
                      )}
                      <Typography
                        variant="body2"
                        sx={{
                          whiteSpace: "pre-wrap",
                          color:
                            msg.type === "user"
                              ? "#fff"
                              : msg.type === "action"
                                ? "secondary.light"
                                : msg.type === "error"
                                  ? "error.light"
                                  : "text.primary",
                          lineHeight: 1.6,
                        }}
                      >
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
                  </Box>
                </Box>
              </Box>
            </Fade>
          ))}
          <div ref={messagesEndRef} />
        </Box>

        <Box sx={{ p: 2, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <Paper
            elevation={0}
            sx={{
              p: "6px 10px",
              display: "flex",
              alignItems: "center",
              borderRadius: "24px",
              bgcolor: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(8px)",
              transition: "all 0.2s",
              "&:focus-within": {
                bgcolor: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(99, 102, 241, 0.5)",
                boxShadow: "0 0 16px rgba(99, 102, 241, 0.2)",
              },
            }}
          >
            <TextField
              fullWidth
              multiline
              maxRows={4}
              placeholder="質問してみましょう..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              variant="standard"
              InputProps={{
                disableUnderline: true,
                sx: {
                  px: 2,
                  py: 1,
                  fontSize: "0.875rem",
                  color: "text.primary",
                },
              }}
            />
            <IconButton
              color="primary"
              onClick={handleSend}
              disabled={!inputText.trim() || isProcessing}
              sx={{
                p: 1.5,
                bgcolor: inputText.trim() && !isProcessing ? "primary.main" : "transparent",
                "&:hover": {
                  bgcolor: inputText.trim() && !isProcessing ? "primary.dark" : "transparent",
                },
                transition: "all 0.2s",
              }}
            >
              {isProcessing ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <Send sx={{ fontSize: 20 }} />
              )}
            </IconButton>
          </Paper>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<ChatApp />);
