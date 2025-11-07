import React, { useState } from "react";
import { useEffect } from "react";
import Button from "./Button"; // Giả định bạn có file Button.js
import SidebarLogo from "./Logo"; // Giả định bạn có file Logo.js
import { useApi } from "../../hooks/UseAPI"; // Đảm bảo đường dẫn này đúng
import {
  FiChevronsRight,
  FiClock,
  FiYoutube,
  FiMessageSquare,
  FiFileText, // Icon cho KIS
  FiList,     // Icon cho TRAKE
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
  // === BẮT ĐẦU THÊM MỚI: Lắng nghe sự kiện phím tắt 'M' ===
  useEffect(() => {
    // 1. Định nghĩa hàm xử lý khi nhận được event
    const handleAutoCopy = (event) => {
      const { video_name, name_img, time_ms } = event.detail;

      // 2. Lấy taskType *hiện tại* từ state
      // Hàm này sẽ tự động lấy giá trị state mới nhất
      setTaskType((currentTaskType) => {
        
        // 3. Tự động điền form dựa trên taskType đang chọn
        if (currentTaskType === "QA") {
          setVideoID(video_name);
          setTimeMs(time_ms.toString());
          setQaAnswer(""); // Xóa câu trả lời cũ
        } 
        else if (currentTaskType === "KIS") {
          setVideoID(video_name);
          setTimeMs(time_ms.toString());
          setTimeMsEnd(""); // Reset End time
        } 
        else if (currentTaskType === "TRAKE") {
          setVideoID(video_name);
          
          // === BẮT ĐẦU THAY THẾ: Dùng Set để chống duplicate ===
          setTrakeFrames((currentFrames) => {
            // 1. Không làm gì nếu frame ID mới là rỗng
            if (!name_img) {
              return currentFrames;
            }

            // 2. Tách các frame hiện tại thành mảng, lọc bỏ rỗng/khoảng trắng
            const framesArray = currentFrames.split(/[,\s]+/).filter(Boolean);

            // 3. Dùng Set để tự động xử lý tính duy nhất
            const framesSet = new Set(framesArray);

            // 4. Thêm frame mới vào Set (Nếu đã tồn tại, Set sẽ bỏ qua)
            framesSet.add(name_img);

            // 5. Chuyển Set trở lại thành chuỗi, nối bằng ", "
            //    (Array.from để đảm bảo thứ tự)
            return Array.from(framesSet).join(', ');
          });
          // === KẾT THÚC THAY ĐỔI ===
        }
        
        // Phải return giá trị taskType...
        return currentTaskType; 
      });

      // Mở sidebar lên nếu nó đang đóng
      setOpen(true);
    };

    // 4. Đăng ký listener
    document.addEventListener('copyToSidebar', handleAutoCopy);

    // 5. Dọn dẹp listener khi component bị hủy
    return () => {
      document.removeEventListener('copyToSidebar', handleAutoCopy);
    };
  }, []); // [] đảm bảo effect này chỉ chạy 1 lần lúc component mount
  // === KẾT THÚC THÊM MỚI ===

  // === CÁC STATE CHO LOGIC NHẬP LIỆU ===
  const [taskType, setTaskType] = useState("QA"); // "QA", "KIS", "TRAKE"
  const [videoID, setVideoID] = useState("");
  const [timeMs, setTimeMs] = useState("");          // Dùng cho QA (thời điểm) và KIS (start time)
  const [timeMsEnd, setTimeMsEnd] = useState("");    // Dùng riêng cho KIS (end time)
  const [qaAnswer, setQaAnswer] = useState("");      // Dùng riêng cho QA
  const [trakeFrames, setTrakeFrames] = useState("");// Dùng riêng cho TRAKE
  
  // State Base URL
  const [baseUrl, setBaseUrl] = useState("https://eventretrieval.oj.io.vn"); // Đặt sẵn server thi thử

  // === LẤY CÁC HÀM VÀ STATE TỪ HOOK useApi ĐÃ TỐI ƯU ===
  const { 
    loading, 
    result, 
    handleSubmit,    // Hàm nộp bài
    performLogin,    // Hàm đăng nhập
    loginStatus,     // Trạng thái đăng nhập
    isLoggedIn       // Biến boolean (true/false)
  } = useApi();

  // === HÀM XỬ LÝ SỰ KIỆN ===

  // === BẮT ĐẦU THÊM MỚI: Phím tắt 'I' để xóa inputs ===
  useEffect(() => {
    const handleClearInputs = (e) => {
      // 1. Chỉ chạy nếu phím là 'i' hoặc 'I'
      if (e.key !== 'i' && e.key !== 'I') {
        return;
      }

      // 2. QUAN TRỌNG: Ngăn không cho chạy nếu bạn đang gõ
      //    bên trong một ô input hoặc textarea.
      const targetElement = e.target;
      if (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA') {
        return;
      }

      // 3. Ngăn hành vi mặc định (nếu có)
      e.preventDefault();

      // 4. Xóa tất cả state của các ô nhập liệu
      setVideoID("");
      setTimeMs("");
      setTimeMsEnd("");
      setQaAnswer("");
      setTrakeFrames("");
    };

    // 5. Đăng ký listener
    document.addEventListener('keydown', handleClearInputs);

    // 6. Dọn dẹp listener khi component bị hủy
    return () => {
      document.removeEventListener('keydown', handleClearInputs);
    };
  }, []); // [] đảm bảo effect này chỉ chạy 1 lần lúc component mount
  // === KẾT THÚC THÊM MỚI ===

  // Hàm này gọi performLogin với baseUrl từ state
  const handleLoginClick = () => {
    performLogin(baseUrl); //
  };

  // Hàm này xây dựng payload và gọi handleSubmit (đã tối ưu)
  const handleButtonSubmit = () => {
    let payload = {};
    let validationError = "";

    // Dựa vào taskType đã chọn để tạo payload
    if (taskType === "QA") {
      const timeMsInt = parseInt(timeMs);
      if (!videoID || !timeMs || isNaN(timeMsInt) || !qaAnswer) {
        validationError = "Vui lòng nhập Video ID, Time (ms), và Q&A Answer.";
      } else {
        // Tạo payload cho QA
        payload = {
          "answerSets": [{
            "answers": [{
              "text": `QA-${qaAnswer}-${videoID}-${timeMsInt}`
            }]
          }]
        };
      }
    } else if (taskType === "KIS") {
      const startTime = parseInt(timeMs);
      // Nếu End Time (ms) không được nhập, mặc định nó bằng Start Time
      const endTime = timeMsEnd ? parseInt(timeMsEnd) : startTime;
      
      if (!videoID || isNaN(startTime)) {
        validationError = "Vui lòng nhập Video ID và Start Time (ms).";
      } else {
        // Tạo payload cho KIS
        payload = {
          "answerSets": [{
            "answers": [{
              "mediaItemName": videoID,
              "start": startTime,
              "end": endTime
            }]
          }]
        };
      }
    } else if (taskType === "TRAKE") {
      if (!videoID || !trakeFrames) {
        validationError = "Vui lòng nhập Video ID và danh sách Frame IDs.";
      } else {
        // Tạo payload cho TRAKE
        payload = {
          "answerSets": [{
            "answers": [{
              "text": `TR-${videoID}-${trakeFrames.replace(/\s/g, '')}` // Xóa khoảng trắng
            }]
          }]
        };
      }
    }

    if (validationError) {
      alert(validationError);
      return;
    }

    // Gọi hàm handleSubmit (đã tối ưu) từ useApi
    // Hàm này sẽ tái sử dụng session
    handleSubmit(payload, baseUrl); 
  };
  
  // State 'selected' này dường như chỉ để highlight, không ảnh hưởng logic
  const [selected, setSelected] = useState("");

  return (
    <motion.nav
      layout
      className="sticky top-0 h-screen shrink-0 grow-0 border-r border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2 z-10"
      style={{
        width: open ? "225px" : "fit-content",
      }}
    >
      
      {/* ===== BẮT ĐẦU FIX LỖI CUỘN/CHÈN NÚT ===== */}
      {/* 1. Thêm DIV bọc với overflow-y-auto và padding-bottom (pb-14) */}
      <div className="h-full overflow-y-auto pb-14">
        
        <TitleSection open={open} />

        <div className="space-y-3">
          
          {/* === BỘ CHỌN TÁC VỤ (TASK TYPE) === */}
          {open && (
              <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                  <label className="block text-sm font-semibold mb-1 dark:text-white">Task Type</label>
                  <select
                      value={taskType}
                      onChange={(e) => setTaskType(e.target.value)}
                      className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-2 py-2 shadow-sm text-sm focus:border-blue-500 dark:focus:border-blue-400"
                  >
                      <option value="QA">Q&A (Hỏi đáp)</option>
                      <option value="KIS">KIS (Tìm kiếm item)</option>
                      <option value="TRAKE">TRAKE (Xếp hạng sự kiện)</option>
                  </select>
              </motion.div>
          )}

          {/* === CÁC Ô NHẬP LIỆU ĐỘNG THEO TÁC VỤ === */}

          {/* --- 1. TÁC VỤ QA --- */}
          {taskType === "QA" && (
            <>
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
                    placeholder="Q&A-answer (bắt buộc)"
                    value={qaAnswer}
                    onChange={(e) => setQaAnswer(e.target.value)}
                    className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-2 py-2 shadow-sm text-sm focus:border-blue-500 dark:focus:border-blue-400"
                  />
                </motion.div>
              )}
            </>
          )}

          {/* --- 2. TÁC VỤ KIS --- */}
          {taskType === "KIS" && (
            <>
              <Option Icon={FiYoutube} title="Video-id" selected={selected} setSelected={setSelected} open={open} />
              {open && (
                <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.225 }}>
                  <input
                    type="text"
                    placeholder="Video-ID... (mediaItemName)"
                    value={videoID}
                    onChange={(e) => setVideoID(e.target.value)}
                    className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-2 py-2 shadow-sm text-sm focus:border-blue-500 dark:focus:border-blue-400"
                  />
                </motion.div>
              )}

              <Option Icon={FiClock} title="Start Time (ms)" selected={selected} setSelected={setSelected} open={open} />
              {open && (
                <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.225 }}>
                  <input
                    type="number"
                    placeholder="Start Time (ms)"
                    min="0"
                    step="100"
                    value={timeMs}
                    onChange={(e) => setTimeMs(e.target.value)}
                    className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-2 py-2 shadow-sm text-sm focus:border-blue-500 dark:focus:border-blue-400"
                  />
                </motion.div>
              )}

              <Option Icon={FiFileText} title="End Time (ms)" selected={selected} setSelected={setSelected} open={open} />
              {open && (
                <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.225 }}>
                  <input
                    type="number"
                    placeholder="End Time (ms) (để trống = start)"
                    min="0"
                    step="100"
                    value={timeMsEnd}
                    onChange={(e) => setTimeMsEnd(e.target.value)}
                    className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-2 py-2 shadow-sm text-sm focus:border-blue-500 dark:focus:border-blue-400"
                  />
                </motion.div>
              )}
            </>
          )}

          {/* --- 3. TÁC VỤ TRAKE --- */}
          {taskType === "TRAKE" && (
            <>
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

              <Option Icon={FiList} title="Frame IDs" selected={selected} setSelected={setSelected} open={open} />
              {open && (
                <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.225 }}>
                  <input
                    type="text"
                    placeholder="VD: 100, 250, 300"
                    value={trakeFrames}
                    onChange={(e) => setTrakeFrames(e.target.value)}
                    className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-2 py-2 shadow-sm text-sm focus:border-blue-500 dark:focus:border-blue-400"
                  />
                </motion.div>
              )}
            </>
          )}
        </div>

        {/* === KHU VỰC ĐĂNG NHẬP VÀ SUBMIT === */}
        {open && (
          <motion.div
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.225 }}
            className="mt-4 pt-2"
          >
            {/* Ô nhập Base URL (Dời lên trên) */}
            <div className="mb-3">
              <label className="block text-sm font-semibold mb-1 dark:text-white">API Base URL</label>
              <input
                type="text"
                placeholder="https://eventretrieval.oj.io.vn"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                disabled={loading} // Vô hiệu hóa khi đang loading
                className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-2 text-xs shadow-sm focus:border-blue-500 dark:focus:border-blue-400"
              />
            </div>

            {/* NÚT LOGIN (TỐI ƯU) */}
            <button
              onClick={handleLoginClick}
              disabled={loading || !baseUrl} // Vô hiệu hóa khi đang loading hoặc chưa nhập URL
              className="w-full p-2 mb-2 rounded text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500"
            >
              {loading ? "Đang xử lý..." : "Login (Lấy Session)"}
            </button>
            
            {/* Hiển thị trạng thái đăng nhập */}
            <div className="text-xs text-gray-600 dark:text-gray-400 p-2 mb-2 bg-gray-100 dark:bg-gray-700 rounded max-h-20 overflow-y-auto">
              Trạng thái: {loginStatus}
            </div>

            {/* NÚT SUBMIT (TỐI ƯU) */}
            <Button 
              onSubmit={handleButtonSubmit}
              loading={loading}
              // Vô hiệu hóa nếu đang load, hoặc CHƯA ĐĂNG NHẬP (isLoggedIn = false)
              disabled={!isLoggedIn || loading}
            />
            
            {/* Hiển thị kết quả SUBMIT */}
            {result && (
              <div className="text-xs text-gray-600 dark:text-gray-400 p-2 mt-2 bg-gray-100 dark:bg-gray-700 rounded max-h-20 overflow-y-auto">
                Kết quả nộp bài: {result}
              </div>
            )}

          </motion.div>
        )}
      </div> 
      {/* 2. Đóng DIV bọc lại */}
      {/* ===== KẾT THÚC FIX LỖI CUỘN/CHÈN NÚT ===== */}


      {/* Nút ToggleClose giữ nguyên bên ngoài div cuộn */}
      <ToggleClose open={open} setOpen={setOpen} />
    </motion.nav>
  );
};


// === CÁC COMPONENT PHỤ (Giữ nguyên) ===

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
      // Thêm màu nền (bg-white dark:bg-gray-800) để che nội dung cuộn bên dưới
      className="absolute bottom-0 left-0 right-0 border-t border-slate-300 dark:border-gray-600 transition-colors hover:bg-slate-100 dark:hover:bg-gray-700 bg-white dark:bg-gray-800"
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

// Component này chỉ để demo, không ảnh hưởng chức năng
const ExampleContent = () => <div className="h-[200vh] w-full bg-gray-100 dark:bg-gray-900"></div>;