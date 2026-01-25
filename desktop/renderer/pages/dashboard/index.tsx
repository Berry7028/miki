import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogContent,
  DialogActions,
  Avatar,
  LinearProgress,
  IconButton,
  InputAdornment,
} from "@mui/material";
import {
  CheckCircle,
  Terminal,
  Settings,
  VpnKey,
  Lock,
  Bolt,
  Visibility,
  Link as LinkIcon,
  ArrowForward,
} from "@mui/icons-material";
import { theme } from "../../shared/theme";
import type { BackendEvent, SetupStatus, CustomLlmSettings, CustomLlmProvider } from "../../shared/types";

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

const setupSteps = [
  {
    title: "Configure MIKI AI",
    subtitle: "Set your API keys and model settings.",
    icon: <VpnKey aria-hidden="true" />,
  },
  {
    title: "Enable Accessibility",
    subtitle: "Allow MIKI to control your screen for automation.",
    icon: <Settings aria-hidden="true" />,
  },
  {
    title: "Let MIKI see your workflow",
    subtitle: "Screen recording permission is required for context-aware help.",
    icon: <Visibility aria-hidden="true" />,
  },
];

const App = () => {
  const [apiKey, setApiKey] = useState("");
  const [savedApiKey, setSavedApiKey] = useState("");
  const [isEditingApiKey, setIsEditingApiKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [logs, setLogs] = useState<BackendEvent[]>([]);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [setupStep, setSetupStep] = useState(0);
  const [taskTokenUsage, setTaskTokenUsage] = useState<number | null>(null);
  const [customLlm, setCustomLlm] = useState<CustomLlmSettings>({
    enabled: false,
    provider: "openai",
    baseUrl: "",
    apiKey: "",
    model: "",
  });
  const [savedCustomLlm, setSavedCustomLlm] = useState<CustomLlmSettings>({
    enabled: false,
    provider: "openai",
    baseUrl: "",
    apiKey: "",
    model: "",
  });
  const [providerSaveStatus, setProviderSaveStatus] = useState("");
  const [modelSaveStatus, setModelSaveStatus] = useState("");
  const [isEditingCustomKey, setIsEditingCustomKey] = useState(false);

  const appendLog = useCallback((event: BackendEvent) => {
    setLogs((prev) => [event, ...prev].slice(0, 50));
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
        appendLog({ ...payload, type: "success", message: payload.message || "Completed" });
      } else if (payload.event === "error") {
        appendLog({ ...payload, type: "error", message: payload.message || "Error" });
      } else if (payload.event === "status" && payload.state === "running") {
        setTaskTokenUsage((prev) => (prev === null ? prev : 0));
      }
    });

    window.miki?.getApiKey().then((storedApiKey) => {
      setApiKey(storedApiKey || "");
      setSavedApiKey(storedApiKey || "");
    });
    window.miki?.getCustomLlmSettings().then((settings) => {
      if (settings) {
        const normalized = {
          enabled: Boolean(settings.enabled),
          provider: settings.provider || "openai",
          baseUrl: settings.baseUrl || "",
          apiKey: settings.apiKey || "",
          model: settings.model || "",
        };
        setCustomLlm(normalized);
        setSavedCustomLlm(normalized);
      }
    });

    return () => {
      unsubscribe?.();
      clearInterval(setupInterval);
    };
  }, [appendLog]);

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) return;
    await window.miki?.setApiKey(apiKey);
    setSaveStatus("Saved");
    setSavedApiKey(apiKey);
    setIsEditingApiKey(false);
    setTimeout(() => setSaveStatus(""), 3000);
  };

  const handleSetupNext = async () => {
    if (setupStep === 0) {
      if (!apiKey.trim()) return;
      if (customLlm.enabled && !canSaveCustomFull) return;
      await window.miki?.setApiKey(apiKey);
      setSavedApiKey(apiKey);
      if (customLlm.enabled) {
        await window.miki?.setCustomLlmSettings(customLlm);
        setSavedCustomLlm(customLlm);
      }
    }
    if (setupStep < setupSteps.length - 1) setSetupStep(setupStep + 1);
  };

  const handleSetupFinish = async () => {
    await window.miki?.markSetupCompleted();
    const s = await window.miki?.getSetupStatus();
    setSetupStatus(s);
  };

  const normalizeCustomLlm = (settings: CustomLlmSettings) => ({
    enabled: Boolean(settings.enabled),
    provider: settings.provider || "openai",
    baseUrl: settings.baseUrl || "",
    apiKey: settings.apiKey || "",
    model: settings.model || "",
  });
  const hasApiKey = !!apiKey && apiKey.length > 0;
  const isBaseUrlRequired = (provider?: CustomLlmProvider) => (provider ? provider === "openrouter" : false);
  const hasCustomConfig = !customLlm.enabled
    || Boolean(customLlm.apiKey?.trim() && customLlm.model?.trim() && customLlm.provider);
  const canSaveCustom = !customLlm.enabled || hasCustomConfig;
  const baseUrlRequired = customLlm.enabled && isBaseUrlRequired(customLlm.provider);
  const hasBaseUrl = !baseUrlRequired || Boolean(customLlm.baseUrl?.trim());
  const canSaveCustomFull = canSaveCustom && hasBaseUrl;
  const geminiModel = "gemini-3-flash-preview";
  const isCustomConfigured = Boolean(
    customLlm.enabled &&
      customLlm.provider &&
      customLlm.model?.trim() &&
      customLlm.apiKey?.trim() &&
      (!baseUrlRequired || customLlm.baseUrl?.trim())
  );
  const effectiveRuntime = customLlm.enabled && isCustomConfigured ? "custom" : "gemini";
  const providerLabelMap: Record<CustomLlmProvider, string> = {
    openai: "OpenAI",
    openrouter: "OpenRouter",
    anthropic: "Anthropic",
  };
  const activeModelLabel = effectiveRuntime === "custom" && customLlm.provider && customLlm.model
    ? `${providerLabelMap[customLlm.provider]} · ${customLlm.model}`
    : `Gemini · ${geminiModel}`;
  const hasUnsavedChanges = apiKey !== savedApiKey
    || JSON.stringify(normalizeCustomLlm(customLlm)) !== JSON.stringify(normalizeCustomLlm(savedCustomLlm));
  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    []
  );
  const tokenFormatter = useMemo(() => new Intl.NumberFormat(), []);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  const logLabel = (type?: BackendEvent["type"]) => {
    switch (type) {
      case "action":
        return { label: "ACTION", color: "rgba(100, 120, 150, 0.3)", text: "#8fa0b0" };
      case "success":
        return { label: "SUCCESS", color: "rgba(70, 150, 90, 0.3)", text: "#8fbe8f" };
      case "error":
        return { label: "ERROR", color: "rgba(180, 60, 60, 0.3)", text: "#d08080" };
      case "thinking":
        return { label: "TASK", color: "rgba(150, 150, 150, 0.3)", text: "#b0b0b0" };
      default:
        return { label: "INFO", color: "rgba(255, 255, 255, 0.1)", text: "#9a9a9a" };
    }
  };

  const handleSaveCustom = async () => {
    if (!canSaveCustomFull) return;
    await window.miki?.setCustomLlmSettings(customLlm);
    setModelSaveStatus("Saved");
    setSavedCustomLlm(customLlm);
    setTimeout(() => setModelSaveStatus(""), 3000);
  };

  const handleSaveProviderKey = async () => {
    if (!customLlm.apiKey?.trim()) return;
    await window.miki?.setCustomLlmSettings(customLlm);
    setProviderSaveStatus("Saved");
    setIsEditingCustomKey(false);
    setSavedCustomLlm(customLlm);
    setTimeout(() => setProviderSaveStatus(""), 3000);
  };

  const handleModelModeChange = async (mode: "gemini" | "custom") => {
    const enabled = mode === "custom";
    const nextSettings = { ...customLlm, enabled };
    setCustomLlm(nextSettings);
    if (!enabled) {
      await window.miki?.setCustomLlmSettings(nextSettings);
      setModelSaveStatus("Saved");
      setSavedCustomLlm(nextSettings);
      setTimeout(() => setModelSaveStatus(""), 3000);
      setProviderSaveStatus("");
      return;
    }
    if (customLlm.provider) {
      const stored = await window.miki?.getCustomLlmProviderSettings(customLlm.provider);
      setCustomLlm((prev) => ({
        ...prev,
        apiKey: stored?.apiKey || "",
        baseUrl: stored?.baseUrl || "",
        model: stored?.model || "",
      }));
    }
  };

  const handleCustomProvider = async (provider: CustomLlmProvider) => {
    const stored = await window.miki?.getCustomLlmProviderSettings(provider);
    setCustomLlm((prev) => ({
      ...prev,
      provider,
      apiKey: stored?.apiKey || "",
      baseUrl: stored?.baseUrl || "",
      model: stored?.model || "",
    }));
  };

  const handleCustomBaseUrl = (value: string) => {
    setCustomLlm((prev) => ({
      ...prev,
      baseUrl: value,
    }));
  };

  const handleClearLogs = () => {
    if (logs.length === 0) return;
    const confirmed = window.confirm("Clear all logs?");
    if (!confirmed) return;
    setLogs([]);
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
          component="a"
          href="#main-content"
          sx={{
            position: "absolute",
            top: -40,
            left: 16,
            zIndex: 2,
            px: 2,
            py: 1,
            borderRadius: 1,
            bgcolor: "#1e2228",
            color: "#fff",
            textDecoration: "none",
            border: "1px solid rgba(255,255,255,0.2)",
            "&:focus": { top: 16 },
          }}
        >
          Skip to main content
        </Box>
        <Box
          component="header"
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
                <Terminal sx={{ fontSize: 18, color: "primary.main" }} aria-hidden="true" />
              </Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: "0.08em" }}>
                MIKI DESKTOP
              </Typography>
            </Stack>
            <Stack direction="row" spacing={2} alignItems="center">
              <Chip
                label="SYSTEM READY"
                sx={{
                  bgcolor: "#2e5a3a",
                  color: "#90ee90",
                  fontWeight: 600,
                  border: "1px solid rgba(100, 200, 100, 0.3)",
                }}
              />
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 1,
                  bgcolor: "rgba(255,255,255,0.05)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                aria-hidden="true"
              >
                <Settings fontSize="small" aria-hidden="true" />
              </Box>
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

        <Container
          maxWidth={false}
          component="main"
          id="main-content"
          sx={{ px: { xs: 3, lg: 6 }, py: 5, position: "relative", scrollMarginTop: 24 }}
        >
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, lg: 8 }}>
              <Stack spacing={3}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Typography variant="h1" sx={{ textWrap: "balance" }}>
                      Dashboard
                    </Typography>
                    {taskTokenUsage !== null && (
                      <Box role="status" aria-live="polite">
                        <Chip
                          label={`Task Tokens: ${tokenFormatter.format(taskTokenUsage)}`}
                          sx={{
                            bgcolor: "rgba(90, 120, 160, 0.2)",
                            color: "#b8c7d8",
                            fontWeight: 600,
                            border: "1px solid rgba(90, 120, 160, 0.4)",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        />
                      </Box>
                    )}
                  </Stack>
                  <Chip
                    label="v2.4.0"
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
                    <Typography variant="h6" sx={{ textWrap: "balance" }}>
                      Quick Trigger
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Launch the chat overlay instantly from anywhere.
                    </Typography>
                  </Stack>
                  <Button
                    variant="contained"
                    startIcon={<Bolt aria-hidden="true" />}
                    sx={{ minWidth: 180, justifyContent: "space-between" }}
                  >
                    Cmd + Shift + Space
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
                            <VpnKey fontSize="small" aria-hidden="true" />
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, textWrap: "balance" }}>
                              API Keys
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {hasApiKey ? "Connected" : "Not Connected"}
                            </Typography>
                          </Box>
                        </Stack>
                        <TextField
                          fullWidth
                          label="Gemini API key"
                          type={isEditingApiKey ? "text" : "password"}
                          placeholder="AIza…"
                          name="geminiApiKey"
                          autoComplete="off"
                          inputProps={{ "aria-label": "Gemini API key", spellCheck: false }}
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">
                                <Lock fontSize="small" aria-hidden="true" />
                              </InputAdornment>
                            ),
                          }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          Status: {hasApiKey ? "Saved" : "Missing"}
                        </Typography>
                        <Stack direction="row" spacing={2} alignItems="center" justifyContent="flex-end">
                          <Button variant="text" onClick={() => setIsEditingApiKey(true)}>
                            Change Key
                          </Button>
                          <Button variant="contained" onClick={handleSaveApiKey} disabled={!apiKey.trim()}>
                            Verify & Save
                          </Button>
                        </Stack>
                        {saveStatus && (
                          <Typography variant="caption" color="secondary.light">
                            <span aria-live="polite">{saveStatus}</span>
                          </Typography>
                        )}
                        <Box sx={{ pt: 1 }}>
                          <TextField
                            fullWidth
                            label={`Custom provider API key${customLlm.provider ? ` (${providerLabelMap[customLlm.provider]})` : ""}`}
                            type={isEditingCustomKey ? "text" : "password"}
                            placeholder="sk-…"
                            name="customProviderApiKey"
                            autoComplete="off"
                            inputProps={{ "aria-label": "Custom provider API key", spellCheck: false }}
                            value={customLlm.apiKey || ""}
                            onChange={(event) =>
                              setCustomLlm((prev) => ({ ...prev, apiKey: event.target.value }))
                            }
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">
                                <Lock fontSize="small" aria-hidden="true" />
                              </InputAdornment>
                            ),
                          }}
                        />
                          <Typography variant="caption" color="text.secondary">
                            Status: {customLlm.apiKey?.trim() ? "Saved" : "Missing"}
                          </Typography>
                          <Stack direction="row" spacing={2} alignItems="center" justifyContent="flex-end" sx={{ mt: 1 }}>
                            <Button variant="text" onClick={() => setIsEditingCustomKey(true)}>
                              Change Key
                            </Button>
                            <Button
                              variant="contained"
                              onClick={handleSaveProviderKey}
                              disabled={!customLlm.apiKey?.trim()}
                            >
                              Save Provider Key
                            </Button>
                          </Stack>
                          {providerSaveStatus && (
                            <Typography variant="caption" color="secondary.light">
                              <span aria-live="polite">{providerSaveStatus}</span>
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                    </Paper>
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Paper sx={{ p: 3.5 }}>
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
                            <LinkIcon fontSize="small" aria-hidden="true" />
                          </Avatar>
                          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, textWrap: "balance" }}>
                              Model Settings
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                              Active: {activeModelLabel}
                            </Typography>
                          </Box>
                        </Stack>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 2,
                            bgcolor: "rgba(24, 28, 33, 0.6)",
                            borderColor: effectiveRuntime === "custom"
                              ? "rgba(120, 190, 140, 0.35)"
                              : "rgba(90, 120, 160, 0.35)",
                          }}
                        >
                          <Stack spacing={1}>
                            <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                Effective Runtime
                              </Typography>
                              <Chip
                                label={effectiveRuntime === "custom" ? "Custom Active" : "Gemini Active"}
                                size="small"
                                sx={{
                                  bgcolor: effectiveRuntime === "custom"
                                    ? "rgba(70, 150, 90, 0.2)"
                                    : "rgba(90, 120, 160, 0.2)",
                                  color: effectiveRuntime === "custom" ? "#8fbe8f" : "#b8c7d8",
                                  fontWeight: 600,
                                  border: "1px solid rgba(90, 120, 160, 0.4)",
                                }}
                              />
                            </Stack>
                            <Typography variant="body2" color="text.secondary">
                              Requests will be sent to {activeModelLabel}.
                            </Typography>
                            {customLlm.enabled && !isCustomConfigured && (
                              <Typography variant="caption" color="error">
                                Custom is selected but incomplete. Until it's saved, requests will use Gemini.
                              </Typography>
                            )}
                          </Stack>
                        </Paper>
                        <Grid container spacing={2}>
                          <Grid size={{ xs: 12, md: 4 }}>
                            <FormControl fullWidth>
                              <InputLabel id="model-source-label">Model Source</InputLabel>
                              <Select
                                size="small"
                                value={customLlm.enabled ? "custom" : "gemini"}
                                onChange={(event) => handleModelModeChange(event.target.value as "gemini" | "custom")}
                                labelId="model-source-label"
                                label="Model Source"
                                inputProps={{ "aria-label": "Model source", name: "modelSource", autoComplete: "off" }}
                              >
                                <MenuItem value="gemini">Gemini (default)</MenuItem>
                                <MenuItem value="custom">Custom Provider</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid size={{ xs: 12, md: 4 }}>
                            <FormControl fullWidth>
                              <InputLabel id="provider-label">Provider</InputLabel>
                              <Select
                                size="small"
                                value={customLlm.provider || "openai"}
                                disabled={!customLlm.enabled}
                                onChange={(event) => handleCustomProvider(event.target.value as CustomLlmProvider)}
                                labelId="provider-label"
                                label="Provider"
                                inputProps={{ "aria-label": "Custom provider", name: "customProvider", autoComplete: "off" }}
                              >
                                <MenuItem value="openai">OpenAI</MenuItem>
                                <MenuItem value="openrouter">OpenRouter</MenuItem>
                                <MenuItem value="anthropic">Anthropic</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid size={{ xs: 12, md: 4 }}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Base URL"
                              type="url"
                              inputMode="url"
                              placeholder={
                                customLlm.provider === "openrouter"
                                  ? "https://openrouter.ai/api/v1…"
                                  : "https://api.anthropic.com…"
                              }
                              name="customProviderBaseUrl"
                              autoComplete="off"
                              inputProps={{ "aria-label": "Custom provider base URL", spellCheck: false }}
                              value={customLlm.baseUrl || ""}
                              disabled={!customLlm.enabled || customLlm.provider === "openai"}
                              onChange={(event) => handleCustomBaseUrl(event.target.value)}
                              helperText={
                                customLlm.provider === "openai"
                                  ? "Not used for OpenAI."
                                  : baseUrlRequired
                                  ? "Required for OpenRouter. Set only if your provider needs a custom endpoint."
                                  : "Optional. Set only if your provider needs a custom endpoint."
                              }
                            />
                          </Grid>
                          <Grid size={{ xs: 12, md: 4 }}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Model"
                              placeholder="gpt-4o / claude-3-5-sonnet-20241022…"
                              name="customModel"
                              autoComplete="off"
                              inputProps={{ "aria-label": "Custom model name", spellCheck: false }}
                              value={customLlm.model || ""}
                              disabled={!customLlm.enabled}
                              onChange={(event) =>
                                setCustomLlm((prev) => ({ ...prev, model: event.target.value }))
                              }
                              helperText="Example: gpt-4o or claude-3-5-sonnet-20241022."
                            />
                          </Grid>
                        </Grid>
                        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                          <Box>
                            {customLlm.enabled && !canSaveCustomFull && (
                              <Typography variant="caption" color="error">
                                API key, provider, and model are required. Fill the missing fields, then save.
                                {baseUrlRequired ? " Base URL is required for OpenRouter." : ""}
                              </Typography>
                            )}
                          </Box>
                          <Box sx={{ flexGrow: 1 }} />
                          <Button variant="contained" onClick={handleSaveCustom} disabled={!canSaveCustomFull}>
                            Save Model Settings
                          </Button>
                        </Stack>
                        {modelSaveStatus && (
                          <Typography variant="caption" color="secondary.light">
                            <span aria-live="polite">{modelSaveStatus}</span>
                          </Typography>
                        )}
                        {!customLlm.enabled && (
                          <Typography variant="caption" color="text.secondary">
                            Gemini is used by default when Model Source is set to Gemini.
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
                            <Settings fontSize="small" aria-hidden="true" />
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, textWrap: "balance" }}>
                              System Permissions
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Review system access
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
                              Accessibility
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Granted
                            </Typography>
                          </Stack>
                          {setupStatus?.hasAccessibility ? (
                            <Chip
                              icon={<CheckCircle sx={{ fontSize: 16 }} aria-hidden="true" />}
                              label="Granted"
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
                              Allow
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
                              Screen Recording
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {setupStatus?.hasScreenRecording ? "Granted" : "Action Required"}
                            </Typography>
                          </Stack>
                          {setupStatus?.hasScreenRecording ? (
                            <Chip
                              icon={<CheckCircle sx={{ fontSize: 16 }} aria-hidden="true" />}
                              label="Granted"
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
                              Allow
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
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, textWrap: "balance" }}>
                    Execution Log
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={handleClearLogs}
                    sx={{ opacity: 0.6 }}
                    aria-label="Clear logs"
                  >
                    <Settings fontSize="small" aria-hidden="true" />
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
                              <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
                                {timeFormatter.format(new Date(log.timestamp || Date.now()))}
                              </Typography>
                            </Stack>
                            <Typography variant="body2" sx={{ mt: 1, lineHeight: 1.5, wordBreak: "break-word" }}>
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
                      <Terminal sx={{ fontSize: 32 }} aria-hidden="true" />
                      <Typography variant="body2">No logs yet</Typography>
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
              <Typography variant="subtitle2" sx={{ letterSpacing: "0.1em", textWrap: "balance" }}>
                Setup Wizard
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Step {setupStep + 1} of {setupSteps.length}
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
          <DialogContent sx={{ px: 4, pb: 4, overscrollBehavior: "contain" }}>
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
                <Typography variant="h2" sx={{ textAlign: "center", color: "#f0f0f0", textWrap: "balance" }}>
                  {setupSteps[setupStep].title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
                  {setupSteps[setupStep].subtitle}
                </Typography>
              </Stack>

                  {setupStep === 0 && (
                    <Stack spacing={2} sx={{ width: "100%" }}>
                      <Typography variant="body2" color="text.secondary">
                        Where do you find your API key?
                      </Typography>
                  <TextField
                    fullWidth
                    type="password"
                    label="Gemini API key"
                    placeholder="AIza…"
                    name="geminiApiKeySetup"
                    autoComplete="off"
                    inputProps={{ "aria-label": "Gemini API key", spellCheck: false }}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Your key is encrypted and stored locally. It is never shared with our servers.
                  </Typography>
                </Stack>
              )}

              {setupStep === 1 && (
                <Stack spacing={2} sx={{ width: "100%" }}>
                  {setupStatus?.hasAccessibility ? (
                    <Chip
                      icon={<CheckCircle sx={{ fontSize: 18 }} aria-hidden="true" />}
                      label="Accessibility Granted"
                      color="success"
                      sx={{ alignSelf: "center" }}
                    />
                  ) : (
                    <Button
                      variant="contained"
                      startIcon={<Settings aria-hidden="true" />}
                      onClick={() => window.miki?.openSystemPreferences("accessibility")}
                    >
                      Open System Preferences
                    </Button>
                  )}
                </Stack>
              )}

              {setupStep === 2 && (
                <Stack spacing={2} sx={{ width: "100%" }}>
                  {setupStatus?.hasScreenRecording ? (
                    <Chip
                      icon={<CheckCircle sx={{ fontSize: 18 }} aria-hidden="true" />}
                      label="Screen Recording Granted"
                      color="success"
                      sx={{ alignSelf: "center" }}
                    />
                  ) : (
                    <Button
                      variant="contained"
                      startIcon={<Visibility aria-hidden="true" />}
                      onClick={() => window.miki?.openSystemPreferences("screen-recording")}
                    >
                      Open System Preferences
                    </Button>
                  )}
                  <Chip
                    icon={<Lock sx={{ fontSize: 18 }} aria-hidden="true" />}
                    label="This data is processed locally and never leaves your device."
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
              startIcon={<ArrowForward sx={{ transform: "rotate(180deg)" }} aria-hidden="true" />}
            >
              Back
            </Button>
            <Box sx={{ flexGrow: 1 }} />
             {setupStep < setupSteps.length - 1 ? (
               <Button
                 variant="contained"
                 onClick={handleSetupNext}
                 disabled={setupStep === 0 && (!apiKey.trim() || (customLlm.enabled && !canSaveCustomFull))}
                 endIcon={<ArrowForward aria-hidden="true" />}
               >
                 Next Step
               </Button>
             ) : (
              <Button
                variant="contained"
                onClick={handleSetupFinish}
                disabled={!setupStatus?.hasScreenRecording}
              >
                Finish Setup
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
      <App />
    </CacheProvider>
  );
});
