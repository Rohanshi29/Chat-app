import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);

// Each color theme just needs an accent color - it's applied as a CSS
// variable override, and since --accent already drives buttons, links,
// your own message bubbles, the AI widget, admin stats, etc., picking a
// new one re-themes most of the UI automatically.
export const COLOR_THEMES = [
  { id: "indigo", label: "Indigo", accent: "#6366f1", accentDark: "#818cf8" },
  { id: "blue", label: "Ocean", accent: "#2563eb", accentDark: "#60a5fa" },
  { id: "green", label: "Forest", accent: "#16a34a", accentDark: "#4ade80" },
  { id: "rose", label: "Rose", accent: "#e11d48", accentDark: "#fb7185" },
  { id: "orange", label: "Sunset", accent: "#ea580c", accentDark: "#fb923c" },
  { id: "violet", label: "Violet", accent: "#9333ea", accentDark: "#c084fc" },
];

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "light"
  );
  const [colorTheme, setColorTheme] = useState(
    () => localStorage.getItem("colorTheme") || "indigo"
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-color-theme", colorTheme);
    localStorage.setItem("colorTheme", colorTheme);
  }, [colorTheme]);

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colorTheme, setColorTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
