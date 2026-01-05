import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#e6d6b8",
      light: "#f1e6cf",
      dark: "#d3c2a2",
    },
    secondary: {
      main: "#67d6a1",
    },
    success: {
      main: "#4fd08a",
      light: "#7fe0ad",
    },
    warning: {
      main: "#f0a54a",
    },
    info: {
      main: "#79b8ff",
    },
    background: {
      default: "#212833",
      paper: "#2c333d",
    },
    text: {
      primary: "#ece7dd",
      secondary: "#a9a399",
    },
    divider: "rgba(255, 255, 255, 0.08)",
  },
  shape: {
    borderRadius: 18,
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
        body: {
          backgroundColor: "#212833",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          padding: "8px 18px",
          boxShadow: "none",
        },
        containedPrimary: {
          color: "#1f242c",
          background: "linear-gradient(180deg, #f1e5cb 0%, #e1d0af 100%)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          "&:hover": {
            background: "linear-gradient(180deg, #f7ead4 0%, #e4d4b6 100%)",
          },
        },
        outlined: {
          borderColor: "rgba(255, 255, 255, 0.18)",
          color: "#d7c8ac",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          boxShadow: "0 16px 40px rgba(0, 0, 0, 0.35)",
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            backgroundColor: "rgba(17, 21, 26, 0.55)",
            "& fieldset": {
              borderColor: "rgba(255, 255, 255, 0.12)",
            },
            "&:hover fieldset": {
              borderColor: "rgba(255, 255, 255, 0.2)",
            },
          },
        },
      },
    },
  },
});
