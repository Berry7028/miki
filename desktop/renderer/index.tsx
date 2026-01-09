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
import { theme } from "./theme";
import type { BackendEvent, SetupStatus } from "./types";
import { useI18n, type Language } from "./i18n";
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  DialogTitle,
} from "@mui/material";

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

const setupSteps = (t: any) => [
  {
    title: t("configureMiki"),
    subtitle: t("enterApiKey"),
    icon: <VpnKey />,
  },
  {
    title: t("enableAccessibility"),
    subtitle: t("allowControl"),
    icon: <Settings />,
  },
  {
    title: t("seeWorkflow"),
    subtitle: t("screenRecordingReq"),
    icon: <Visibility />,
  },
];

const App = () => {
  const { t, lang, setLanguage } = useI18n();
  const [apiKey, setApiKey] = useState("");
  const [isEditingApiKey, setIsEditingApiKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [logs, setLogs] = useState<BackendEvent[]>([]);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [setupStep, setSetupStep] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const steps = setupSteps(t);

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

    const setupInterval = setInterval(checkSetup, 3000);

    const unsubscribe = window.miki?.onBackendEvent((payload) => {
      if (payload.event === "log") {
        appendLog(payload);
      } else if (payload.event === "completed") {
        appendLog({ ...payload, type: "success", message: payload.message || t("done") });
      } else if (payload.event === "error") {
        appendLog({ ...payload, type: "error", message: payload.message || t("errorOccurred") });
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
    setSaveStatus(t("saved"));
    setIsEditingApiKey(false);
    setTimeout(() => setSaveStatus(""), 3000);
  };

  const handleSetupNext = async () => {
    if (setupStep === 0) {
      if (!apiKey.trim()) return;
      await window.miki?.setApiKey(apiKey);
    }
    if (setupStep < steps.length - 1) setSetupStep(setupStep + 1);
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
        return { label: "ACTION", color: "rgba(121, 184, 255, 0.2)", text: "#8bc4ff" };
      case "success":
        return { label: t("done").toUpperCase(), color: "rgba(79, 208, 138, 0.2)", text: "#7fe0ad" };
      case "error":
        return { label: "ERROR", color: "rgba(255, 99, 99, 0.2)", text: "#ff7b7b" };
      case "thinking":
        return { label: t("thinking").toUpperCase(), color: "rgba(230, 214, 184, 0.2)", text: "#e6d6b8" };
      default:
        return { label: "INFO", color: "rgba(255, 255, 255, 0.08)", text: "#b8b2a7" };
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
          "&::before": {
            content: '""',
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 20% 20%, rgba(230, 214, 184, 0.08), transparent 45%), radial-gradient(circle at 80% 0%, rgba(120, 184, 255, 0.08), transparent 40%)",
            pointerEvents: "none",
          },
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
                  bgcolor: "rgba(230,214,184,0.15)",
                  border: "1px solid rgba(230,214,184,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Terminal sx={{ fontSize: 18, color: "primary.main" }} />
              </Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: "0.08em" }}>
                {t("appTitle")}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={2} alignItems="center">
              <Chip
                label={t("systemReady")}
                sx={{
                  bgcolor: "rgba(79, 208, 138, 0.15)",
                  color: "#7fe0ad",
                  fontWeight: 600,
                  border: "1px solid rgba(79, 208, 138, 0.3)",
                }}
              />
              <IconButton 
                size="small" 
                sx={{ bgcolor: "rgba(255,255,255,0.05)" }}
                onClick={() => setIsSettingsOpen(true)}
              >
                <Settings fontSize="small" />
              </IconButton>
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  border: "2px solid rgba(230,214,184,0.7)",
                  bgcolor: "rgba(230,214,184,0.2)",
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
                  <Typography variant="h1">{t("dashboard")}</Typography>
                  <Chip
                    label="v2.4.0"
                    sx={{
                      bgcolor: "rgba(230,214,184,0.12)",
                      border: "1px solid rgba(230,214,184,0.25)",
                      color: "#e6d6b8",
                      fontWeight: 600,
                    }}
                  />
                </Box>

                <Paper sx={{ p: 3.5, display: "flex", justifyContent: "space-between" }}>
                  <Stack spacing={1}>
                    <Typography variant="h6">{t("quickTrigger")}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t("quickTriggerDesc")}
                    </Typography>
                  </Stack>
                  <Button
                    variant="contained"
                    startIcon={<Bolt />}
                    sx={{ minWidth: 180, justifyContent: "space-between" }}
                  >
                    Cmd + Shift + Space
                  </Button>
                </Paper>

                <Grid container spacing={2.5}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 3.5, height: "100%" }}>
                      <Stack spacing={2.5}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Avatar
                            sx={{
                              bgcolor: "rgba(230,214,184,0.15)",
                              color: "#e6d6b8",
                              width: 34,
                              height: 34,
                            }}
                          >
                            <VpnKey fontSize="small" />
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                              {t("apiConfig")}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {hasApiKey ? t("connected") : t("notConnected")}
                            </Typography>
                          </Box>
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {t("openaiApiKey")}
                        </Typography>
                        <TextField
                          fullWidth
                          type={isEditingApiKey ? "text" : "password"}
                          placeholder="sk-...."
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
                            {t("changeKey")}
                          </Button>
                          <Button variant="contained" onClick={handleSaveApiKey} disabled={!apiKey.trim()}>
                            {t("verifyAndSave")}
                          </Button>
                        </Stack>
                        {saveStatus && (
                          <Typography variant="caption" color="secondary.light">
                            {t("saved")}
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
                              bgcolor: "rgba(230,214,184,0.15)",
                              color: "#e6d6b8",
                              width: 34,
                              height: 34,
                            }}
                          >
                            <Settings fontSize="small" />
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                              {t("systemPermissions")}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {t("reviewPermissions")}
                            </Typography>
                          </Box>
                        </Stack>
                        <Paper
                          sx={{
                            p: 2,
                            bgcolor: "rgba(255,255,255,0.03)",
                            borderRadius: 2,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <Stack spacing={0.5}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {t("accessibility")}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {setupStatus?.hasAccessibility ? t("granted") : t("actionRequired")}
                            </Typography>
                          </Stack>
                          {setupStatus?.hasAccessibility ? (
                            <Chip
                              icon={<CheckCircle sx={{ fontSize: 16 }} />}
                              label={t("granted")}
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
                              {t("allow")}
                            </Button>
                          )}
                        </Paper>
                        <Paper
                          sx={{
                            p: 2,
                            bgcolor: "rgba(255,255,255,0.03)",
                            borderRadius: 2,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <Stack spacing={0.5}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {t("screenRecording")}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {setupStatus?.hasScreenRecording ? t("granted") : t("actionRequired")}
                            </Typography>
                          </Stack>
                          {setupStatus?.hasScreenRecording ? (
                            <Chip
                              icon={<CheckCircle sx={{ fontSize: 16 }} />}
                              label={t("granted")}
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
                              {t("allow")}
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
                    {t("executionLog")}
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
                              bgcolor: "rgba(17,21,26,0.4)",
                              borderRadius: 2,
                              border: "1px solid rgba(255,255,255,0.06)",
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
                      <Typography variant="body2">{t("noLogs")}</Typography>
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
              background: "linear-gradient(180deg, #3a414b 0%, #2c333d 100%)",
              border: "1px solid rgba(255,255,255,0.08)",
              overflow: "hidden",
            },
          }}
        >
          <Box sx={{ px: 4, pt: 4 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="subtitle2" sx={{ letterSpacing: "0.1em" }}>
                {t("setupWizard")}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t("step")} {setupStep + 1} {t("of")} {steps.length}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={((setupStep + 1) / steps.length) * 100}
              sx={{
                mt: 2,
                height: 6,
                borderRadius: 999,
                bgcolor: "rgba(0,0,0,0.2)",
                "& .MuiLinearProgress-bar": {
                  bgcolor: "#e6d6b8",
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
                  bgcolor: "rgba(33,40,51,0.7)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#e6d6b8",
                }}
              >
                {steps[setupStep].icon}
              </Avatar>
              <Stack spacing={1} alignItems="center">
                <Typography variant="h2" sx={{ textAlign: "center", color: "#e6d6b8" }}>
                  {steps[setupStep].title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
                  {steps[setupStep].subtitle}
                </Typography>
              </Stack>

              {setupStep === 0 && (
                <Stack spacing={2} sx={{ width: "100%" }}>
                  <Typography variant="body2" color="text.secondary">
                    {t("findApiKey")}
                  </Typography>
                  <TextField
                    fullWidth
                    type="password"
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {t("apiKeyPrivacy")}
                  </Typography>
                </Stack>
              )}

              {setupStep === 1 && (
                <Stack spacing={2} sx={{ width: "100%" }}>
                  {setupStatus?.hasAccessibility ? (
                    <Chip
                      icon={<CheckCircle sx={{ fontSize: 18 }} />}
                      label={t("accessibilityGranted")}
                      color="success"
                      sx={{ alignSelf: "center" }}
                    />
                  ) : (
                    <Button
                      variant="contained"
                      startIcon={<Settings />}
                      onClick={() => window.miki?.openSystemPreferences("accessibility")}
                    >
                      {t("openSystemPreferences")}
                    </Button>
                  )}
                </Stack>
              )}

              {setupStep === 2 && (
                <Stack spacing={2} sx={{ width: "100%" }}>
                  {setupStatus?.hasScreenRecording ? (
                    <Chip
                      icon={<CheckCircle sx={{ fontSize: 18 }} />}
                      label={t("screenRecordingGranted")}
                      color="success"
                      sx={{ alignSelf: "center" }}
                    />
                  ) : (
                    <Button
                      variant="contained"
                      startIcon={<Visibility />}
                      onClick={() => window.miki?.openSystemPreferences("screen-recording")}
                    >
                      {t("openSystemPreferences")}
                    </Button>
                  )}
                  <Chip
                    icon={<Lock sx={{ fontSize: 18 }} />}
                    label={t("dataPrivacy")}
                    sx={{
                      bgcolor: "rgba(0,0,0,0.25)",
                      color: "text.secondary",
                      border: "1px solid rgba(255,255,255,0.08)",
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
              {t("back")}
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            {setupStep < steps.length - 1 ? (
              <Button
                variant="contained"
                onClick={handleSetupNext}
                disabled={setupStep === 0 && !apiKey.trim()}
                endIcon={<ArrowForward />}
              >
                {t("nextStep")}
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleSetupFinish}
                disabled={!setupStatus?.hasScreenRecording}
              >
                {t("finishSetup")}
              </Button>
            )}
          </DialogActions>
        </Dialog>

        <Dialog
          open={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          maxWidth="xs"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 4,
              background: "linear-gradient(180deg, #3a414b 0%, #2c333d 100%)",
              border: "1px solid rgba(255,255,255,0.08)",
            },
          }}
        >
          <DialogTitle sx={{ color: "#e6d6b8", fontWeight: 700 }}>
            {t("settings")}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 1 }}>
              <FormControl fullWidth variant="outlined">
                <InputLabel id="language-select-label" sx={{ color: "rgba(255,255,255,0.5)" }}>
                  {t("language")}
                </InputLabel>
                <Select
                  labelId="language-select-label"
                  value={lang}
                  label={t("language")}
                  onChange={(e) => setLanguage(e.target.value as Language)}
                  sx={{
                    color: "white",
                    ".MuiOutlinedInput-notchedOutline": {
                      borderColor: "rgba(255,255,255,0.1)",
                    },
                    "&:hover .MuiOutlinedInput-notchedOutline": {
                      borderColor: "rgba(255,255,255,0.2)",
                    },
                    ".MuiSvgIcon-root": {
                      color: "rgba(255,255,255,0.5)",
                    },
                  }}
                >
                  <MenuItem value="en">English</MenuItem>
                  <MenuItem value="ja">日本語</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setIsSettingsOpen(false)} variant="contained">
              {t("done")}
            </Button>
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
      <App />
    </CacheProvider>
  );
});
