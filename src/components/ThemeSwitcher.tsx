
import * as React from "react";
import { useTheme } from "next-themes";
import { Sun, MoonStar } from "lucide-react";

export const ThemeSwitcher: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  // local state to reflect the theme for instant feedback
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <button
      className="fixed top-4 right-4 z-50 p-2 rounded-full bg-muted/60 hover:bg-muted transition text-primary shadow"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {isDark ? <Sun size={20} /> : <MoonStar size={20} />}
    </button>
  );
};
