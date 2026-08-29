import { useState } from "react";
import { COLOR_THEMES, useTheme } from "../context/ThemeContext";

const ThemePicker = () => {
  const [open, setOpen] = useState(false);
  const { colorTheme, setColorTheme } = useTheme();

  return (
    <div className="theme-picker-wrap">
      <button
        className="icon-btn"
        title="Change theme color"
        onClick={() => setOpen((o) => !o)}
      >
        🎨
      </button>
      {open && (
        <div className="theme-picker-popover">
          {COLOR_THEMES.map((t) => (
            <button
              key={t.id}
              className={`theme-swatch ${colorTheme === t.id ? "active" : ""}`}
              style={{ background: t.accent }}
              title={t.label}
              onClick={() => {
                setColorTheme(t.id);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ThemePicker;
