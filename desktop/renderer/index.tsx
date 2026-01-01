import React, { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import {
  ThemeProvider,
  CssBaseline,
  Box,
  Container,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  IconButton,
  Alert,
  Fade,
  Stack,
  Chip,
  Avatar,
  LinearProgress,
} from "@mui/material";
import {
  Save,
  Delete,
  CheckCircle,
  Error as ErrorIcon,
  Info as InfoIcon,
  Terminal,
  Settings,
  VpnKey,
} from "@mui/icons-material";
import { theme } from "./theme";
import { BackendEvent, SetupStatus } from "./types";

const App = () => {
  const [apiKey, setApiKey] = useState("");
  const [isEditingApiKey, setIsEditingApiKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [status, setStatus] = useState<{
    state: string;
    goal: string;
    step: number;
    appName: string;
  }>({
    state: "idle",
    goal: "",
    step: 0,
    appName: window.miki?.appName || "miki",
  });
  const [logs, setLogs] = useState<BackendEvent[]>([]);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [setupStep, setSetupStep] = useState(0);

  const appendLog = useCallback((event: BackendEvent) => {
    setLogs((prev) => [event, ...prev].slice(0, 100));
  }, []);

  useEffect(() => {
    const checkSetup = async () => {
      const s = await window.miki?.getSetupStatus();
      setSetupStatus(s);
      if (s?.needsSetup) {
        setSetupStep(0);
      }
    };
    checkSetup();

    // Poll setup status every 3 seconds to reflect permission changes
    const setupInterval = setInterval(checkSetup, 3000);

    const unsubscribe = window.miki?.onBackendEvent((payload) => {
      if (payload.event === "status") {
        setStatus((prev) => ({
          ...prev,
          state: payload.state || prev.state,
          goal: payload.goal || prev.goal,
        }));
      } else if (payload.event === "step") {
        setStatus((prev) => ({ ...prev, step: payload.step ?? prev.step }));
      } else if (payload.event === "log") {
        appendLog(payload);
      } else if (payload.event === "completed") {
        appendLog({ ...payload, type: "success", message: payload.message || "完了" });
      } else if (payload.event === "error") {
        appendLog({ ...payload, type: "error", message: payload.message || "エラー" });
      }
    });

    window.miki?.getApiKey().then(setApiKey);

    return () => {
      unsubscribe?.();
      clearInterval(setupInterval);
    };
  }, [appendLog]);

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) return;
    await window.miki?.setApiKey(apiKey);
    setSaveStatus("保存しました");
    setIsEditingApiKey(false);
    setTimeout(() => setSaveStatus(""), 3000);
  };

  const handleCancelEditApiKey = async () => {
    const currentKey = await window.miki?.getApiKey();
    setApiKey(currentKey || "");
    setIsEditingApiKey(false);
  };

  const handleSetupNext = async () => {
    if (setupStep === 0) {
      if (!apiKey.trim()) return;
      await window.miki?.setApiKey(apiKey);
    }
    if (setupStep < 2) setSetupStep(setupStep + 1);
  };

  const handleSetupFinish = async () => {
    await window.miki?.markSetupCompleted();
    const s = await window.miki?.getSetupStatus();
    setSetupStatus(s);
  };

  const isRunning = status.state === "running";
  const hasApiKey = !!apiKey && apiKey.length > 0;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: 6 }}>
        <Container maxWidth="xl">
          {/* Header Area */}
          <Box sx={{ mb: 6 }}>
            <Typography
              variant="overline"
              color="primary"
              sx={{ letterSpacing: 4, fontWeight: 800, display: "block" }}
            >
              MIKI DESKTOP
            </Typography>
            <Box
              sx={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                mt: 1,
              }}
            >
              <Typography
                variant="h1"
                sx={{
                  background: "linear-gradient(to right, #fff, #94a3b8)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                ダッシュボード
              </Typography>
              <Chip
                icon={<Terminal sx={{ fontSize: "16px !important" }} />}
                label={status.appName.toUpperCase()}
                variant="outlined"
                sx={{
                  borderRadius: "8px",
                  borderColor: "rgba(255,255,255,0.1)",
                  bgcolor: "rgba(255,255,255,0.02)",
                  fontWeight: 700,
                }}
              />
            </Box>
          </Box>

          <Grid container spacing={4}>
            {/* Main Dashboard Area */}
            <Grid item xs={12} lg={8}>
              <Stack spacing={3}>
                {/* System Status Card */}
                <Paper sx={{ p: 4, position: "relative", overflow: "hidden" }}>
                  <Box
                    sx={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "4px",
                      height: "100%",
                      bgcolor: isRunning ? "primary.main" : "secondary.main",
                    }}
                  />
                  <Typography
                    variant="h6"
                    gutterBottom
                    sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}
                  >
                    <Terminal fontSize="small" /> システムステータス
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12} sm={6}>
                      <Box
                        sx={{
                          p: 2,
                          bgcolor: "rgba(255,255,255,0.02)",
                          borderRadius: 2,
                          border: "1px solid rgba(255,255,255,0.05)",
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "block", mb: 1 }}
                        >
                          実行状態
                        </Typography>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          {isRunning ? (
                            <>
                              <CircularProgress size={20} />
                              <Typography
                                variant="h5"
                                sx={{ fontWeight: 700, color: "primary.main" }}
                              >
                                RUNNING
                              </Typography>
                            </>
                          ) : (
                            <>
                              <CheckCircle sx={{ fontSize: 24, color: "secondary.main" }} />
                              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                                IDLE
                              </Typography>
                            </>
                          )}
                        </Stack>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Box
                        sx={{
                          p: 2,
                          bgcolor: "rgba(255,255,255,0.02)",
                          borderRadius: 2,
                          border: "1px solid rgba(255,255,255,0.05)",
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "block", mb: 1 }}
                        >
                          実行ステップ
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700 }}>
                          {status.step}
                        </Typography>
                      </Box>
                    </Grid>
                    {status.goal && (
                      <Grid item xs={12}>
                        <Box
                          sx={{
                            p: 2.5,
                            bgcolor: "rgba(99, 102, 241, 0.05)",
                            borderRadius: 2,
                            border: "1px solid rgba(99, 102, 241, 0.15)",
                          }}
                        >
                          <Typography
                            variant="caption"
                            color="primary"
                            sx={{ display: "block", mb: 1, fontWeight: 700 }}
                          >
                            現在実行中のタスク
                          </Typography>
                          <Typography variant="body2">{status.goal}</Typography>
                        </Box>
                      </Grid>
                    )}
                  </Grid>
                  {isRunning && (
                    <LinearProgress
                      variant="indeterminate"
                      sx={{ borderRadius: 1, height: 3, mt: 3, opacity: 0.5 }}
                    />
                  )}
                </Paper>

                {/* API Key Card */}
                <Paper sx={{ p: 4 }}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ mb: 3 }}
                  >
                    <Typography
                      variant="h6"
                      sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                    >
                      <VpnKey fontSize="small" /> APIキー設定
                    </Typography>
                    {saveStatus && (
                      <Fade in>
                        <Chip
                          label={saveStatus}
                          color="success"
                          size="small"
                          variant="outlined"
                          sx={{ borderRadius: "6px" }}
                        />
                      </Fade>
                    )}
                  </Stack>

                  {!isEditingApiKey ? (
                    <Box>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Box
                          sx={{
                            flexGrow: 1,
                            p: 2,
                            bgcolor: "rgba(255,255,255,0.02)",
                            borderRadius: 2,
                            border: "1px solid rgba(255,255,255,0.05)",
                          }}
                        >
                          {hasApiKey ? (
                            <Stack direction="row" spacing={1.5} alignItems="center">
                              <CheckCircle sx={{ fontSize: 20, color: "secondary.main" }} />
                              <Typography variant="body2">APIキーが設定されています</Typography>
                              <Chip label="設定済み" size="small" color="success" sx={{ ml: 1 }} />
                            </Stack>
                          ) : (
                            <Stack direction="row" spacing={1.5} alignItems="center">
                              <ErrorIcon sx={{ fontSize: 20, color: "error.main" }} />
                              <Typography variant="body2">APIキーが設定されていません</Typography>
                            </Stack>
                          )}
                        </Box>
                        <Button
                          variant="outlined"
                          startIcon={<Settings />}
                          onClick={() => setIsEditingApiKey(true)}
                          sx={{ borderColor: "rgba(255,255,255,0.2)" }}
                        >
                          {hasApiKey ? "変更" : "設定"}
                        </Button>
                      </Stack>
                    </Box>
                  ) : (
                    <Stack spacing={2}>
                      <TextField
                        fullWidth
                        type="password"
                        variant="outlined"
                        placeholder="GEMINI_API_KEY を入力"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                      />
                      <Stack direction="row" spacing={2} justifyContent="flex-end">
                        <Button
                          variant="text"
                          onClick={handleCancelEditApiKey}
                          sx={{ color: "text.secondary" }}
                        >
                          キャンセル
                        </Button>
                        <Button
                          variant="contained"
                          color="primary"
                          startIcon={<Save />}
                          onClick={handleSaveApiKey}
                          disabled={!apiKey.trim()}
                        >
                          保存
                        </Button>
                      </Stack>
                    </Stack>
                  )}
                </Paper>

                {/* Permissions Status Card */}
                <Paper sx={{ p: 4 }}>
                  <Typography
                    variant="h6"
                    gutterBottom
                    sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}
                  >
                    <Settings fontSize="small" /> 権限ステータス
                  </Typography>
                  <Stack spacing={2}>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        p: 2,
                        bgcolor: "rgba(255,255,255,0.02)",
                        borderRadius: 2,
                        border: "1px solid rgba(255,255,255,0.05)",
                      }}
                    >
                      <Stack spacing={0.5}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          アクセシビリティ権限
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          自動操作に必要な権限
                        </Typography>
                      </Stack>
                      {setupStatus?.hasAccessibility ? (
                        <Chip
                          icon={<CheckCircle />}
                          label="許可済み"
                          color="success"
                          size="small"
                        />
                      ) : (
                        <Button
                          size="small"
                          variant="outlined"
                          color="warning"
                          onClick={() => window.miki?.openSystemPreferences("accessibility")}
                        >
                          設定する
                        </Button>
                      )}
                    </Box>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        p: 2,
                        bgcolor: "rgba(255,255,255,0.02)",
                        borderRadius: 2,
                        border: "1px solid rgba(255,255,255,0.05)",
                      }}
                    >
                      <Stack spacing={0.5}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          画面収録権限
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          画面キャプチャに必要な権限
                        </Typography>
                      </Stack>
                      {setupStatus?.hasScreenRecording ? (
                        <Chip
                          icon={<CheckCircle />}
                          label="許可済み"
                          color="success"
                          size="small"
                        />
                      ) : (
                        <Button
                          size="small"
                          variant="outlined"
                          color="warning"
                          onClick={() => window.miki?.openSystemPreferences("screen-recording")}
                        >
                          設定する
                        </Button>
                      )}
                    </Box>
                  </Stack>
                </Paper>

                {/* Usage Guide Card */}
                <Paper
                  sx={{
                    p: 4,
                    background:
                      "linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)",
                    border: "1px solid rgba(99, 102, 241, 0.2)",
                  }}
                >
                  <Typography
                    variant="h6"
                    gutterBottom
                    sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}
                  >
                    <InfoIcon fontSize="small" /> 使い方
                  </Typography>
                  <Stack spacing={2.5}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                        タスクを依頼する
                      </Typography>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 2,
                          p: 2,
                          bgcolor: "rgba(0,0,0,0.2)",
                          borderRadius: 2,
                        }}
                      >
                        <Box
                          sx={{
                            px: 2,
                            py: 1,
                            bgcolor: "rgba(255,255,255,0.1)",
                            borderRadius: 1,
                            fontFamily: "monospace",
                            fontWeight: 700,
                            fontSize: "0.875rem",
                          }}
                        >
                          Cmd + Shift + Space
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          でチャットウィジェットを開き、タスクを依頼できます
                        </Typography>
                      </Box>
                    </Box>
                    <Alert
                      severity="info"
                      sx={{
                        borderRadius: 2,
                        bgcolor: "rgba(99, 102, 241, 0.1)",
                        border: "1px solid rgba(99, 102, 241, 0.2)",
                      }}
                    >
                      <Typography variant="body2">
                        チャットウィジェットでは、自然な会話形式でタスクを依頼したり、実行中のタスクに追加の指示を送ることができます。
                      </Typography>
                    </Alert>
                  </Stack>
                </Paper>
              </Stack>
            </Grid>

            {/* Sidebar - Execution Log */}
            <Grid item xs={12} lg={4}>
              <Paper
                sx={{
                  p: 4,
                  height: "calc(100vh - 200px)",
                  display: "flex",
                  flexDirection: "column",
                  position: "sticky",
                  top: "20px",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    mb: 3,
                  }}
                >
                  <Typography variant="h6">実行ログ</Typography>
                  <IconButton size="small" onClick={() => setLogs([])} sx={{ opacity: 0.5 }}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Box>
                <Box
                  sx={{
                    flexGrow: 1,
                    overflowY: "auto",
                    mx: -1,
                    px: 1,
                    "&::-webkit-scrollbar": { width: "4px" },
                    "&::-webkit-scrollbar-thumb": {
                      bgcolor: "rgba(255,255,255,0.05)",
                      borderRadius: 2,
                    },
                  }}
                >
                  {logs.length > 0 ? (
                    <Stack spacing={1}>
                      {logs.map((log, i) => (
                        <Box
                          key={i}
                          sx={{
                            p: 1.5,
                            borderRadius: 2,
                            bgcolor: "rgba(255,255,255,0.02)",
                            borderLeft: `3px solid ${
                              log.type === "error"
                                ? theme.palette.error.main
                                : log.type === "success"
                                  ? theme.palette.secondary.main
                                  : log.type === "action"
                                    ? theme.palette.primary.main
                                    : "rgba(255,255,255,0.1)"
                            }`,
                          }}
                        >
                          <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
                            {log.message}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "block", mt: 0.5 }}
                          >
                            {new Date(log.timestamp || Date.now()).toLocaleTimeString()}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Box
                      sx={{
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: 0.3,
                      }}
                    >
                      <Terminal sx={{ fontSize: 40, mb: 1 }} />
                      <Typography variant="body2">ログはありません</Typography>
                    </Box>
                  )}
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Container>

        {/* Setup Wizard */}
        <Dialog
          open={!!setupStatus?.needsSetup}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: { borderRadius: 4, p: 2, bgcolor: "#161b22", backgroundImage: "none" },
          }}
        >
          <DialogTitle sx={{ textAlign: "center", pt: 4, pb: 2 }}>
            <Typography variant="h4" fontWeight={800} gutterBottom>
              Welcome to miki
            </Typography>
            <Typography variant="body2" color="text.secondary">
              エージェントを動かすための初期設定を開始します
            </Typography>
          </DialogTitle>
          <DialogContent>
            <Stepper activeStep={setupStep} alternativeLabel sx={{ py: 4 }}>
              {["APIキー", "アクセシビリティ", "画面収録"].map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            <Box
              sx={{
                mt: 2,
                minHeight: 240,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              {setupStep === 0 && (
                <Fade in>
                  <Box>
                    <Box sx={{ mb: 3, display: "flex", alignItems: "center", gap: 2 }}>
                      <Avatar sx={{ bgcolor: "primary.main" }}>
                        <VpnKey />
                      </Avatar>
                      <Typography variant="h6">APIキーの設定</Typography>
                    </Box>
                    <Typography variant="body2" sx={{ mb: 3, color: "text.secondary" }}>
                      Gemini APIキーを設定してください。APIキーは
                      <Typography
                        component="a"
                        href="https://aistudio.google.com/apikey"
                        target="_blank"
                        color="primary"
                        sx={{ fontWeight: 600, textDecoration: "none" }}
                      >
                        Google AI Studio
                      </Typography>
                      から無料で取得できます。
                    </Typography>
                    <TextField
                      fullWidth
                      type="password"
                      variant="outlined"
                      placeholder="GEMINI_API_KEY を入力"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                  </Box>
                </Fade>
              )}

              {setupStep === 1 && (
                <Fade in>
                  <Box>
                    <Box sx={{ mb: 3, display: "flex", alignItems: "center", gap: 2 }}>
                      <Avatar sx={{ bgcolor: "secondary.main" }}>
                        <CheckCircle />
                      </Avatar>
                      <Typography variant="h6">アクセシビリティ権限</Typography>
                    </Box>
                    <Typography variant="body2" sx={{ mb: 3, color: "text.secondary" }}>
                      miki が自動でマウスを動かしたり、文字を入力したりするために必要な権限です。
                    </Typography>
                    {setupStatus?.hasAccessibility ? (
                      <Alert severity="success" sx={{ borderRadius: 2 }}>
                        権限が付与されています
                      </Alert>
                    ) : (
                      <Paper sx={{ p: 3, textAlign: "center", bgcolor: "rgba(255,255,255,0.02)" }}>
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={() => window.miki?.openSystemPreferences("accessibility")}
                        >
                          システム設定を開く
                        </Button>
                        <Typography
                          variant="caption"
                          display="block"
                          sx={{ mt: 2, color: "text.secondary" }}
                        >
                          設定後、この画面に戻ると自動的に反映されます。
                        </Typography>
                      </Paper>
                    )}
                  </Box>
                </Fade>
              )}

              {setupStep === 2 && (
                <Fade in>
                  <Box>
                    <Box sx={{ mb: 3, display: "flex", alignItems: "center", gap: 2 }}>
                      <Avatar sx={{ bgcolor: "primary.light" }}>
                        <InfoIcon />
                      </Avatar>
                      <Typography variant="h6">画面収録権限</Typography>
                    </Box>
                    <Typography variant="body2" sx={{ mb: 3, color: "text.secondary" }}>
                      AIが現在の画面を見て状況を判断するために必要な権限です。
                    </Typography>
                    {setupStatus?.hasScreenRecording ? (
                      <Alert severity="success" sx={{ borderRadius: 2 }}>
                        権限が付与されています
                      </Alert>
                    ) : (
                      <Paper sx={{ p: 3, textAlign: "center", bgcolor: "rgba(255,255,255,0.02)" }}>
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={() => window.miki?.openSystemPreferences("screen-recording")}
                        >
                          システム設定を開く
                        </Button>
                        <Typography
                          variant="caption"
                          display="block"
                          sx={{ mt: 2, color: "text.secondary" }}
                        >
                          設定後、この画面に戻ると完了です。
                        </Typography>
                      </Paper>
                    )}
                  </Box>
                </Fade>
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 4, pb: 4, gap: 1 }}>
            <Button disabled={setupStep === 0} onClick={() => setSetupStep(setupStep - 1)}>
              戻る
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            {setupStep < 2 ? (
              <Button
                variant="contained"
                onClick={handleSetupNext}
                disabled={setupStep === 0 && !apiKey.trim()}
              >
                次へ進む
              </Button>
            ) : (
              <Button
                variant="contained"
                color="success"
                onClick={handleSetupFinish}
                disabled={!setupStatus?.hasScreenRecording}
              >
                セットアップ完了
              </Button>
            )}
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
};

const container = document.getElementById("root");
const root = createRoot(container!);
root.render(<App />);
