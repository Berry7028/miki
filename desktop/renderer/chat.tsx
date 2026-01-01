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
} from "@mui/material";
import { Send, Close, SmartToy, Person, AutoFixHigh } from "@mui/icons-material";
import { theme } from "./theme";
import { BackendEvent } from "./types";

interface Message {
  type: "user" | "ai" | "action" | "result" | "error";
  content: string;
  timestamp: number;
}

const ChatApp = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
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
        if (payload.state === "idle") setIsProcessing(false);
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
      } else if (payload.event === "error") {
        addMessage({
          type: "error",
          content: payload.message || "エラーが発生しました",
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
      addMessage({ type: "error", content: "エラー: " + error.message, timestamp: Date.now() });
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
          bgcolor: "transparent",
          p: 2,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 2,
            px: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                bgcolor: isProcessing ? "warning.main" : "success.main",
              }}
            />
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
              miki
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={() => window.close()}
            sx={{ bgcolor: "rgba(255,255,255,0.05)" }}
          >
            <Close fontSize="small" />
          </IconButton>
        </Box>

        {/* Messages */}
        <Box
          sx={{
            flexGrow: 1,
            overflowY: "auto",
            mb: 2,
            pr: 1,
            "&::-webkit-scrollbar": { display: "none" },
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
                    gap: 1,
                    maxWidth: "85%",
                  }}
                >
                  <Avatar
                    sx={{
                      width: 28,
                      height: 28,
                      bgcolor:
                        msg.type === "user"
                          ? "primary.main"
                          : msg.type === "action"
                            ? "secondary.main"
                            : "background.paper",
                    }}
                  >
                    {msg.type === "user" ? (
                      <Person sx={{ fontSize: 16 }} />
                    ) : msg.type === "action" ? (
                      <AutoFixHigh sx={{ fontSize: 16 }} />
                    ) : (
                      <SmartToy sx={{ fontSize: 16 }} />
                    )}
                  </Avatar>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.5,
                      bgcolor:
                        msg.type === "user"
                          ? "primary.main"
                          : msg.type === "action"
                            ? "rgba(16, 185, 129, 0.1)"
                            : "background.paper",
                      borderRadius:
                        msg.type === "user" ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
                      border: msg.type === "action" ? "1px solid rgba(16, 185, 129, 0.3)" : "none",
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        whiteSpace: "pre-wrap",
                        color: msg.type === "action" ? "secondary.light" : "text.primary",
                      }}
                    >
                      {msg.content}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ display: "block", mt: 0.5, opacity: 0.5, textAlign: "right" }}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Typography>
                  </Paper>
                </Box>
              </Box>
            </Fade>
          ))}
          <div ref={messagesEndRef} />
        </Box>

        {/* Input */}
        <Paper
          elevation={4}
          sx={{
            p: "4px 8px",
            display: "flex",
            alignItems: "center",
            borderRadius: "24px",
            bgcolor: "background.paper",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <TextField
            fullWidth
            multiline
            maxRows={4}
            placeholder="質問してみましょう"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            variant="standard"
            InputProps={{ disableUnderline: true, sx: { px: 2, py: 1, fontSize: "0.875rem" } }}
          />
          <IconButton
            color="primary"
            onClick={handleSend}
            disabled={!inputText.trim() || isProcessing}
            sx={{ p: 1 }}
          >
            {isProcessing ? <CircularProgress size={24} color="inherit" /> : <Send />}
          </IconButton>
        </Paper>
      </Box>
    </ThemeProvider>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<ChatApp />);
