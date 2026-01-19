import React, { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
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
  Chip,
  Stack,
  Dialog,
  DialogContent,
  DialogActions,
  Avatar,
  LinearProgress,
  IconButton,
  MenuItem,
} from "@mui/material";
import {
  CheckCircle,
  Error as ErrorIcon,
  Info as InfoIcon,
  Terminal,
  Settings,
  VpnKey,
  Lock,
  Bolt,
  Visibility,
  ArrowForward,
} from "@mui/icons-material";
import { theme } from "../../shared/theme";
import type { BackendEvent, SetupStatus } from "../../shared/types";
import { I18nProvider, useI18n } from "../../shared/i18n";

// Create Emotion cache with nonce for CSP
async function createEmotionCache() {
  let nonce = "";
  try {
    nonce = await window.miki?.getStyleNonce();
  } catch (error) {
    console.warn("Failed to get nonce, styles may be blocked by CSP:", error);
  }
  
  return createCache({
    key: "miki",
    nonce: nonce || undefined,
    prepend: true,
  });
}

const App = () => {
  const [apiKey, setApiKey] = useState("");
  const [isEditingApiKey, setIsEditingApiKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [logs, setLogs] = useState<BackendEvent[]>([]);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [setupStep, setSetupStep] = useState(0);
  const [taskTokenUsage, setTaskTokenUsage] = useState<number | null>(null);
  const { t, locale, setLocale } = useI18n();

  const setupSteps = [
    {
      title: t("dashboard.setup.configureTitle"),
      subtitle: t("dashboard.setup.configureSubtitle"),
      icon: <VpnKey />,
    },
    {
      title: t("dashboard.setup.accessTitle"),
      subtitle: t("dashboard.setup.accessSubtitle"),
      icon: <Settings />,
    },
    {
      title: t("dashboard.setup.screenTitle"),
      subtitle: t("dashboard.setup.screenSubtitle"),
      icon: <Visibility />,
    },
  ];

  const appendLog = useCallback((event: BackendEvent) => {
    setLogs((prev) => [event, ...prev].slice(0, 100));
  }, []);

  useEffect(() => {
    const checkSetup = async () => {
      const s = await window.miki?.getSetupStatus();
      setSetupStatus(s);
    };

    // 初回マウント時のみステップを設定
    const initialCheck = async () => {
      const s = await window.miki?.getSetupStatus();
      setSetupStatus(s);
      if (s?.needsSetup) {
        setSetupStep(0);
      }
    };
    initialCheck();

    const setupInterval = setInterval(checkSetup, 3000);

    const unsubscribe = window.miki?.onBackendEvent((payload) => {
      if (payload.event === "log") {
        appendLog(payload);
      } else if (payload.event === "token_usage") {
        if (typeof payload.totalTokens === "number") {
          setTaskTokenUsage(payload.totalTokens);
        }
      } else if (payload.event === "completed") {
        appendLog({ ...payload, type: "success", message: payload.message || t("dashboard.completed") });
      } else if (payload.event === "error") {
        appendLog({ ...payload, type: "error", message: payload.message || t("dashboard.error") });
      } else if (payload.event === "status" && payload.state === "running") {
        setTaskTokenUsage((prev) => (prev === null ? prev : 0));
      }
    });

    window.miki?.getApiKey().then(setApiKey);

    return () => {
      unsubscribe?.();
      clearInterval(setupInterval);
    };
  }, [appendLog, t]);

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) return;
    await window.miki?.setApiKey(apiKey);
    setSaveStatus(t("dashboard.saved"));
    setIsEditingApiKey(false);
    setTimeout(() => setSaveStatus(""), 3000);
  };

  const handleSetupNext = async () => {
    if (setupStep === 0) {
      if (!apiKey.trim()) return;
      await window.miki?.setApiKey(apiKey);
    }
    if (setupStep < setupSteps.length - 1) setSetupStep(setupStep + 1);
  };

  const handleSetupFinish = async () => {
    await window.miki?.markSetupCompleted();
    const s = await window.miki?.getSetupStatus();
    setSetupStatus(s);
  };

  const hasApiKey = !!apiKey && apiKey.length > 0;

  const logLabel = (type?: BackendEvent["type"]) => {
    switch (type) {
      case "action":
        return { label: t("log.action"), color: "rgba(100, 120, 150, 0.3)", text: "#8fa0b0" };
      case "success":
        return { label: t("log.success"), color: "rgba(70, 150, 90, 0.3)", text: "#8fbe8f" };
      case "error":
        return { label: t("log.error"), color: "rgba(180, 60, 60, 0.3)", text: "#d08080" };
      case "thinking":
        return { label: t("log.task"), color: "rgba(150, 150, 150, 0.3)", text: "#b0b0b0" };
      default:
        return { label: t("log.info"), color: "rgba(255, 255, 255, 0.1)", text: "#9a9a9a" };
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: "background.default",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            px: { xs: 3, lg: 6 },
            py: 2.5,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            position: "relative",
            zIndex: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: 2,
                  bgcolor: "#2e3339",
                  border: "1px solid rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Terminal sx={{ fontSize: 18, color: "primary.main" }} />
              </Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: "0.08em" }}>
                {t("app.name")}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={2} alignItems="center">
              <Chip
                label={t("dashboard.systemReady")}
                sx={{
                  bgcolor: "#2e5a3a",
                  color: "#90ee90",
                  fontWeight: 600,
                  border: "1px solid rgba(100, 200, 100, 0.3)",
                }}
              />
              <TextField
                select
                size="small"
                label={t("dashboard.language")}
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                sx={{ minWidth: 140 }}
              >
                <MenuItem value="en">{t("locales.en")}</MenuItem>
                <MenuItem value="ja">{t("locales.ja")}</MenuItem>
              </TextField>
              <IconButton size="small" sx={{ bgcolor: "rgba(255,255,255,0.05)" }}>
                <Settings fontSize="small" />
              </IconButton>
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  border: "2px solid rgba(255,255,255,0.3)",
                  bgcolor: "#3a3f47",
                }}
              />
            </Stack>
          </Box>
        </Box>

        <Container maxWidth={false} sx={{ px: { xs: 3, lg: 6 }, py: 5, position: "relative" }}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, lg: 8 }}>
              <Stack spacing={3}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Typography variant="h1">{t("dashboard.title")}</Typography>
                    {taskTokenUsage !== null && (
                      <Chip
                        label={t("dashboard.taskTokens", {
                          count: taskTokenUsage.toLocaleString(),
                        })}
                        sx={{
                          bgcolor: "rgba(90, 120, 160, 0.2)",
                          color: "#b8c7d8",
                          fontWeight: 600,
                          border: "1px solid rgba(90, 120, 160, 0.4)",
                        }}
                      />
                    )}
                  </Stack>
                  <Chip
                    label={t("dashboard.version")}
                    sx={{
                      bgcolor: "#2e3339",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "#9a9a9a",
                      fontWeight: 600,
                    }}
                  />
                </Box>

                <Paper sx={{ p: 3.5, display: "flex", justifyContent: "space-between" }}>
                  <Stack spacing={1}>
                    <Typography variant="h6">{t("dashboard.quickTrigger")}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t("dashboard.quickTriggerDescription")}
                    </Typography>
                  </Stack>
                  <Button
                    variant="contained"
                    startIcon={<Bolt />}
                    sx={{ minWidth: 180, justifyContent: "space-between" }}
                  >
                    {t("dashboard.shortcut")}
                  </Button>
                </Paper>

                <Grid container spacing={2.5}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 3.5, height: "100%" }}>
                      <Stack spacing={2.5}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Avatar
                            sx={{
                              bgcolor: "#3a3f47",
                              color: "#c0c0c0",
                              width: 34,
                              height: 34,
                            }}
                          >
                            <VpnKey fontSize="small" />
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                              {t("dashboard.apiConfiguration")}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {hasApiKey ? t("dashboard.connected") : t("dashboard.notConnected")}
                            </Typography>
                          </Box>
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {t("dashboard.apiKeyLabel")}
                        </Typography>
                        <TextField
                          fullWidth
                          type={isEditingApiKey ? "text" : "password"}
                          placeholder={t("dashboard.apiKeyPlaceholder")}
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          InputProps={{
                            endAdornment: (
                              <IconButton size="small" sx={{ color: "text.secondary" }}>
                                <Lock fontSize="small" />
                              </IconButton>
                            ),
                          }}
                        />
                        <Stack direction="row" spacing={2} alignItems="center" justifyContent="flex-end">
                          <Button variant="text" onClick={() => setIsEditingApiKey(true)}>
                            {t("dashboard.changeKey")}
                          </Button>
                          <Button variant="contained" onClick={handleSaveApiKey} disabled={!apiKey.trim()}>
                            {t("dashboard.verifySave")}
                          </Button>
                        </Stack>
                        {saveStatus && (
                          <Typography variant="caption" color="secondary.light">
                            {saveStatus}
                          </Typography>
                        )}
                      </Stack>
                    </Paper>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 3.5, height: "100%" }}>
                      <Stack spacing={2.5}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Avatar
                            sx={{
                              bgcolor: "#3a3f47",
                              color: "#c0c0c0",
                              width: 34,
                              height: 34,
                            }}
                          >
                            <Settings fontSize="small" />
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                              {t("dashboard.systemPermissions")}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {t("dashboard.reviewSystemAccess")}
                            </Typography>
                          </Box>
                        </Stack>
                        <Paper
                          sx={{
                            p: 2,
                            bgcolor: "#2a2e34",
                            borderRadius: 2,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <Stack spacing={0.5}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {t("dashboard.accessibility")}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {t("dashboard.granted")}
                            </Typography>
                          </Stack>
                          {setupStatus?.hasAccessibility ? (
                            <Chip
                              icon={<CheckCircle sx={{ fontSize: 16 }} />}
                              label={t("dashboard.granted")}
                              size="small"
                              color="success"
                            />
                          ) : (
                            <Button
                              size="small"
                              variant="outlined"
                              color="warning"
                              onClick={() => window.miki?.openSystemPreferences("accessibility")}
                            >
                              {t("dashboard.allow")}
                            </Button>
                          )}
                        </Paper>
                        <Paper
                          sx={{
                            p: 2,
                            bgcolor: "#2a2e34",
                            borderRadius: 2,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <Stack spacing={0.5}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {t("dashboard.screenRecording")}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {setupStatus?.hasScreenRecording
                                ? t("dashboard.granted")
                                : t("dashboard.actionRequired")}
                            </Typography>
                          </Stack>
                          {setupStatus?.hasScreenRecording ? (
                            <Chip
                              icon={<CheckCircle sx={{ fontSize: 16 }} />}
                              label={t("dashboard.granted")}
                              size="small"
                              color="success"
                            />
                          ) : (
                            <Button
                              size="small"
                              variant="outlined"
                              color="warning"
                              onClick={() => window.miki?.openSystemPreferences("screen-recording")}
                            >
                              {t("dashboard.allow")}
                            </Button>
                          )}
                        </Paper>
                      </Stack>
                    </Paper>
                  </Grid>
                </Grid>
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, lg: 4 }}>
              <Paper sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                <Box
                  sx={{
                    px: 3,
                    py: 2,
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {t("dashboard.executionLog")}
                  </Typography>
                  <IconButton size="small" onClick={() => setLogs([])} sx={{ opacity: 0.6 }}>
                    <Settings fontSize="small" />
                  </IconButton>
                </Box>
                <Box
                  sx={{
                    flexGrow: 1,
                    overflowY: "auto",
                    px: 3,
                    py: 2,
                    "&::-webkit-scrollbar": { width: "6px" },
                    "&::-webkit-scrollbar-thumb": {
                      bgcolor: "rgba(255,255,255,0.08)",
                      borderRadius: 3,
                    },
                  }}
                >
                  {logs.length > 0 ? (
                    <Stack spacing={1.5}>
                      {logs.map((log, i) => {
                        const label = logLabel(log.type);
                        return (
                          <Paper
                            key={i}
                            sx={{
                              p: 1.5,
                              bgcolor: "#1e2228",
                              borderRadius: 2,
                              border: "1px solid rgba(255,255,255,0.08)",
                            }}
                          >
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Box
                                sx={{
                                  px: 1,
                                  py: 0.25,
                                  borderRadius: 1,
                                  bgcolor: label.color,
                                  color: label.text,
                                  fontSize: "0.65rem",
                                  fontWeight: 700,
                                  letterSpacing: "0.08em",
                                }}
                              >
                                {label.label}
                              </Box>
                              <Typography variant="caption" color="text.secondary">
                                {new Date(log.timestamp || Date.now()).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                })}
                              </Typography>
                            </Stack>
                            <Typography variant="body2" sx={{ mt: 1, lineHeight: 1.5 }}>
                              {log.message}
                            </Typography>
                          </Paper>
                        );
                      })}
                    </Stack>
                  ) : (
                    <Stack
                      spacing={1}
                      alignItems="center"
                      justifyContent="center"
                      sx={{ height: "100%", opacity: 0.5 }}
                    >
                      <Terminal sx={{ fontSize: 32 }} />
                      <Typography variant="body2">{t("dashboard.noLogsYet")}</Typography>
                    </Stack>
                  )}
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Container>

        <Dialog
          open={!!setupStatus?.needsSetup}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 4,
              background: "#2c333d",
              border: "1px solid rgba(255,255,255,0.1)",
              overflow: "hidden",
            },
          }}
        >
          <Box sx={{ px: 4, pt: 4 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="subtitle2" sx={{ letterSpacing: "0.1em" }}>
                {t("dashboard.setupWizard")}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t("dashboard.stepOf", {
                  current: setupStep + 1,
                  total: setupSteps.length,
                })}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={((setupStep + 1) / setupSteps.length) * 100}
              sx={{
                mt: 2,
                height: 6,
                borderRadius: 999,
                bgcolor: "rgba(0,0,0,0.3)",
                "& .MuiLinearProgress-bar": {
                  bgcolor: "#b0b0b0",
                },
              }}
            />
          </Box>
          <DialogContent sx={{ px: 4, pb: 4 }}>
            <Stack spacing={3} alignItems="center" sx={{ mt: 4 }}>
              <Avatar
                sx={{
                  width: 72,
                  height: 72,
                  bgcolor: "#3a3f47",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#c0c0c0",
                }}
              >
                {setupSteps[setupStep].icon}
              </Avatar>
              <Stack spacing={1} alignItems="center">
                <Typography variant="h2" sx={{ textAlign: "center", color: "#f0f0f0" }}>
                  {setupSteps[setupStep].title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
                  {setupSteps[setupStep].subtitle}
                </Typography>
              </Stack>

              {setupStep === 0 && (
                <Stack spacing={2} sx={{ width: "100%" }}>
                  <Typography variant="body2" color="text.secondary">
                    {t("dashboard.whereFindApiKey")}
                  </Typography>
                  <TextField
                    fullWidth
                    type="password"
                    placeholder={t("dashboard.apiKeyPlaceholderShort")}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {t("dashboard.apiKeySecureNote")}
                  </Typography>
                </Stack>
              )}

              {setupStep === 1 && (
                <Stack spacing={2} sx={{ width: "100%" }}>
                  {setupStatus?.hasAccessibility ? (
                    <Chip
                      icon={<CheckCircle sx={{ fontSize: 18 }} />}
                      label={t("dashboard.accessibilityGranted")}
                      color="success"
                      sx={{ alignSelf: "center" }}
                    />
                  ) : (
                    <Button
                      variant="contained"
                      startIcon={<Settings />}
                      onClick={() => window.miki?.openSystemPreferences("accessibility")}
                    >
                      {t("dashboard.openSystemPreferences")}
                    </Button>
                  )}
                </Stack>
              )}

              {setupStep === 2 && (
                <Stack spacing={2} sx={{ width: "100%" }}>
                  {setupStatus?.hasScreenRecording ? (
                    <Chip
                      icon={<CheckCircle sx={{ fontSize: 18 }} />}
                      label={t("dashboard.screenRecordingGranted")}
                      color="success"
                      sx={{ alignSelf: "center" }}
                    />
                  ) : (
                    <Button
                      variant="contained"
                      startIcon={<Visibility />}
                      onClick={() => window.miki?.openSystemPreferences("screen-recording")}
                    >
                      {t("dashboard.openSystemPreferences")}
                    </Button>
                  )}
                  <Chip
                    icon={<Lock sx={{ fontSize: 18 }} />}
                    label={t("dashboard.localProcessingOnly")}
                    sx={{
                      bgcolor: "#2a2e34",
                      color: "text.secondary",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  />
                </Stack>
              )}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 4, pb: 4 }}>
            <Button
              disabled={setupStep === 0}
              onClick={() => setSetupStep(setupStep - 1)}
              startIcon={<ArrowForward sx={{ transform: "rotate(180deg)" }} />}
            >
              {t("dashboard.back")}
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            {setupStep < setupSteps.length - 1 ? (
              <Button
                variant="contained"
                onClick={handleSetupNext}
                disabled={setupStep === 0 && !apiKey.trim()}
                endIcon={<ArrowForward />}
              >
                {t("dashboard.nextStep")}
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleSetupFinish}
                disabled={!setupStatus?.hasScreenRecording}
              >
                {t("dashboard.finishSetup")}
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

// Initialize app with Emotion cache
createEmotionCache().then((cache) => {
  root.render(
    <CacheProvider value={cache}>
      <I18nProvider>
        <App />
      </I18nProvider>
    </CacheProvider>
  );
});
