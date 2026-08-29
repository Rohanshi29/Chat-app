const OPTIONS = [
  { label: "Default", value: "" },
  { label: "Sunset", value: "linear-gradient(135deg, #f6d365, #fda085)" },
  { label: "Ocean", value: "linear-gradient(135deg, #667eea, #764ba2)" },
  { label: "Mint", value: "linear-gradient(135deg, #a1ffce, #faffd1)" },
  { label: "Slate", value: "linear-gradient(135deg, #536976, #292e49)" },
  { label: "Rose", value: "linear-gradient(135deg, #ff9a9e, #fecfef)" },
];

const WallpaperPicker = ({ current, onSelect }) => (
  <div className="wallpaper-picker">
    {OPTIONS.map((opt) => (
      <button
        key={opt.label}
        className={`wallpaper-swatch ${current === opt.value ? "active" : ""}`}
        style={{ background: opt.value || "#f5f5f5" }}
        title={opt.label}
        onClick={() => onSelect(opt.value)}
      />
    ))}
  </div>
);

export default WallpaperPicker;
