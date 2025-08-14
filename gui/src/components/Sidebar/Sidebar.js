import React, { useState } from "react";
import Button from "./Button";
import SidebarLogo from "./Logo"
import { useApi } from "../../hooks/UseAPI";
import {
  FiChevronsRight,
  FiClock,
  FiYoutube,
  FiMessageSquare,
} from "react-icons/fi";
import { motion } from "framer-motion";

const SidebarComponent = () => {
  return (
    <div className="flex min-h-screen"> {/* Giữ để đảm bảo height đầy đủ */}
      <Sidebar />
      <ExampleContent />
    </div>
  );
};

export default SidebarComponent;

const Sidebar = () => {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState("Video-id");

  // States cho 3 ô input
  const [videoID, setVideoID] = useState("");
  const [timeMs, setTimeMs] = useState("");
  const [qaAnswer, setQaAnswer] = useState("");
  
  // 🔹 Thêm state Base URL
  const [baseUrl, setBaseUrl] = useState("http://localhost:8000");

  // API hook
  const { loading, result, handleSubmit } = useApi();

  // Handle form submission
  const handleButtonSubmit = () => {
    const timeMsInt = parseInt(timeMs);
    if (!videoID || isNaN(timeMsInt)) {
      alert("Please fill Video ID and valid Time (ms)");
      return;
    }
    // Có thể truyền baseUrl vào handleSubmit nếu cần
    handleSubmit(videoID, timeMsInt, qaAnswer, baseUrl);
  };

  return (
    <motion.nav
      layout
      className="sticky top-0 h-screen shrink-0 grow-0 border-r border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2 z-10"
      style={{
        width: open ? "225px" : "fit-content",
      }}
    >
      <TitleSection open={open} />

      <div className="space-y-3">
        {/* Các option input cũ */}
        <Option Icon={FiYoutube} title="Video-id" selected={selected} setSelected={setSelected} open={open} />
        {open && (
          <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.225 }}>
            <input
              type="text"
              placeholder="Video-ID..."
              value={videoID}
              onChange={(e) => setVideoID(e.target.value)}
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-2 py-2 shadow-sm text-sm focus:border-blue-500 dark:focus:border-blue-400"
            />
          </motion.div>
        )}

        <Option Icon={FiClock} title="Time-ms" selected={selected} setSelected={setSelected} open={open} />
        {open && (
          <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.225 }}>
            <input
              type="number"
              placeholder="Time (ms)"
              min="0"
              step="100"
              value={timeMs}
              onChange={(e) => setTimeMs(e.target.value)}
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-2 py-2 shadow-sm text-sm focus:border-blue-500 dark:focus:border-blue-400"
            />
          </motion.div>
        )}

        <Option Icon={FiMessageSquare} title="Q&A-answer" selected={selected} setSelected={setSelected} open={open} />
        {open && (
          <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.225 }}>
            <input
              type="text"
              placeholder="Q&A-answer (optional)"
              value={qaAnswer}
              onChange={(e) => setQaAnswer(e.target.value)}
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-2 py-2 shadow-sm text-sm focus:border-blue-500 dark:focus:border-blue-400"
            />
          </motion.div>
        )}
      </div>

      {open && (
        <motion.div
          layout
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.225 }}
          className="mt-4 pt-2"
        >
          {/* Nút submit */}
          <Button 
            onSubmit={handleButtonSubmit}
            loading={loading}
            disabled={!videoID || !timeMs}
          />

          {/* 🔹 Ô nhập Base URL mới thêm */}
          <div className="mt-3">
            <label className="block text-sm font-semibold mb-1 dark:text-white">API Base URL</label>
            <input
              type="text"
              placeholder="http://localhost:8000"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-2 text-xs shadow-sm focus:border-blue-500 dark:focus:border-blue-400"
            />
          </div>

          {/* Hiển thị kết quả */}
          {result && (
            <div className="text-xs text-gray-600 dark:text-gray-400 p-2 mt-2 bg-gray-100 dark:bg-gray-700 rounded max-h-20 overflow-y-auto">
              {result}
            </div>
          )}
        </motion.div>
      )}

      <ToggleClose open={open} setOpen={setOpen} />
    </motion.nav>
  );
};


// Các component còn lại giữ nguyên (Option, TitleSection, Logo, ToggleClose, ExampleContent)
const Option = ({ Icon, title, selected, setSelected, open }) => {
  return (
    <motion.button
      layout
      onClick={() => setSelected(title)}
      className={`relative flex h-10 w-full items-center rounded-md transition-colors ${selected === title ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200" : "text-slate-500 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700"}`}
    >
      <motion.div
        layout
        className="grid h-full w-10 place-content-center text-xl"
      >
        <Icon />
      </motion.div>
      {open && (
        <motion.span
          layout
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.125 }}
          className="text-sm font-medium"
        >
          {title}
        </motion.span>
      )}

      
    </motion.button>
  );
};

const TitleSection = ({ open }) => {
  return (
    <div className="mb-3 border-b border-slate-300 dark:border-gray-600 pb-3">
      <div className="flex cursor-pointer items-center justify-between rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-gray-700">
        <div className="flex items-center gap-2">
          <motion.div layout={false}>
            <SidebarLogo />
          </motion.div>
          {open && (
            <motion.div
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.125 }}
            >
              <span className="block text-sm font-semibold dark:text-white">AIO_Owlgorithm</span>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};


const ToggleClose = ({ open, setOpen }) => {
  return (
    <motion.button
      layout
      onClick={() => setOpen((pv) => !pv)}
      className="absolute bottom-0 left-0 right-0 border-t border-slate-300 dark:border-gray-600 transition-colors hover:bg-slate-100 dark:hover:bg-gray-700"
    >
      <div className="flex items-center p-2">
        <motion.div
          layout
          className="grid size-10 place-content-center text-lg"
        >
          <FiChevronsRight
            className={`transition-transform text-slate-500 dark:text-gray-300 ${open && "rotate-180"}`}
          />
        </motion.div>
        {open && (
          <motion.span
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.125 }}
            className="text-sm font-medium dark:text-white"
          >
            Hide
          </motion.span>
        )}
      </div>
    </motion.button>
  );
};

const ExampleContent = () => <div className="h-[200vh] w-full bg-gray-100 dark:bg-gray-900"></div>;
