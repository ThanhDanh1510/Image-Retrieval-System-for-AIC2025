import { motion } from "framer-motion";
import { FiMoon, FiSun } from "react-icons/fi";
import { useTheme } from "../../context/ThemeContext";

const TOGGLE_CLASSES =
  "text-sm font-medium flex items-center gap-2 px-3 py-2 transition-colors relative z-20";

const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="relative flex w-fit items-center rounded-full border dark:border-slate-600">
      <button
        className={`${TOGGLE_CLASSES} ${
          theme === "light" ? "text-white" : "text-slate-300"
        }`}
        onClick={() => setTheme("light")}
      >
        <FiMoon className="text-lg" />
        <span>Light</span>
      </button>
      <button
        className={`${TOGGLE_CLASSES} ${
          theme === "dark" ? "text-white" : "text-slate-800"
        }`}
        onClick={() => setTheme("dark")}
      >
        <FiSun className="text-lg" />
        <span>Dark</span>
      </button>
      <div
        className={`absolute inset-0 z-0 flex ${
          theme === "dark" ? "justify-end" : "justify-start"
        }`}
      >
        <motion.span
          layout
          transition={{ type: "spring", damping: 15, stiffness: 250 }}
          className="h-full w-1/2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600"
        />
      </div>
    </div>
  );
};

export default ThemeToggle;
