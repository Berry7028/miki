import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#b0b0b0",
      light: "#d0d0d0",
      dark: "#808080",
    },
    secondary: {
      main: "#7a8a9e",
    },
    success: {
      main: "#6fa86f",
      light: "#8fbe8f",
    },
    warning: {
      main: "#d4a46a",
    },
    info: {
      main: "#7a8fa0",
    },
    background: {
      default: "#1a1e24",
      paper: "#252930",
    },
    text: {
      primary: "#f0f0f0",
      secondary: "#9a9a9a",
    },
    divider: "rgba(255, 255, 255, 0.12)",
  },
  shape: {
    borderRadius: 6,
  },
  typography: {
    fontFamily: [
      '"Plus Jakarta Sans"',
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "Roboto",
      "sans-serif",
    ].join(","),
    h1: {
      fontSize: "2.6rem",
      fontWeight: 700,
      letterSpacing: "-0.01em",
    },
    h2: {
      fontSize: "1.6rem",
      fontWeight: 700,
      letterSpacing: "-0.01em",
    },
    h6: {
      fontWeight: 700,
      fontSize: "0.95rem",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "#b8b2a7",
    },
    button: {
      textTransform: "none",
      fontWeight: 600,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          colorScheme: "dark",
        },
        body: {
          backgroundColor: "#212833",
          colorScheme: "dark",
        },
        "button, a, input, select, textarea": {
          WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation",
        },
        select: {
          backgroundColor: "#1e2228",
          color: "#f0f0f0",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: "8px 18px",
          boxShadow: "none",
        },
        containedPrimary: {
          color: "#1f242c",
          background: "#a0a0a0",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          "&:hover": {
            background: "#b5b5b5",
          },
        },
        outlined: {
          borderColor: "rgba(255, 255, 255, 0.2)",
          color: "#b0b0b0",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)",
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            backgroundColor: "#1e2228",
            "& fieldset": {
              borderColor: "rgba(255, 255, 255, 0.15)",
            },
            "&:hover fieldset": {
              borderColor: "rgba(255, 255, 255, 0.25)",
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
        },
      },
    },
  },
});
