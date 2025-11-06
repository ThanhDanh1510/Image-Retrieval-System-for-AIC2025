// hooks/useApi.js
// NỘI DUNG ĐÃ ĐƯỢC TỐI ƯU HÓA
import { useState, useCallback } from 'react'; // Thêm useCallback

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(''); // State cho kết quả submit
  
  // 🔹 === CÁC STATE MỚI ĐỂ LƯU TRỮ SESSION === 🔹
  const [sessionId, setSessionId] = useState(null);
  const [evaluationId, setEvaluationId] = useState(null);
  const [loginStatus, setLoginStatus] = useState("Chưa đăng nhập"); // State để hiển thị trạng thái

  // Hàm apiRequest (Giữ nguyên từ file của bạn)
  const apiRequest = async (url, method = "GET", body = null) => {
    const options = {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    const response = await fetch(url, options);
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API Error (${response.status}): ${errText}`);
    }
    return response.json();
  };

  // Hàm login (Cập nhật để nhận baseUrl)
  const login = async (baseUrl, username, password) => {
    const url = `${baseUrl}/api/v2/login`; //
    const body = { username, password }; //
    const data = await apiRequest(url, "POST", body); //
    if (!data.sessionId) {
        throw new Error("Login failed or sessionId not returned.");
    }
    return data.sessionId; //
  };

  // Hàm getEvaluationID (Cập nhật để nhận baseUrl)
  const getEvaluationID = async (baseUrl, sessionID) => {
    const url = `${baseUrl}/api/v2/client/evaluation/list?session=${sessionID}`; //
    const evaluations = await apiRequest(url, "GET"); //
    if (evaluations && evaluations.length > 0) {
      return evaluations[0].id; //
    } else {
      throw new Error("No evaluations found.");
    }
  };
  
  // Hàm submitAnswer (Cập nhật để nhận baseUrl)
  const submitAnswer = async (baseUrl, sessionID, evaluationID, payload) => {
    const url = `${baseUrl}/api/v2/submit/${evaluationID}?session=${sessionID}`; //
    return await apiRequest(url, "POST", payload); //
  };

  // 🔹 === HÀM ĐĂNG NHẬP MỚI (TÁCH BIỆT) === 🔹
  
  /**
   * Thực hiện đăng nhập VÀ lấy evaluation ID, sau đó lưu vào state.
   * Được gọi MỘT LẦN bởi một nút "Login" riêng.
   * @param {string} baseUrl - URL của máy chủ DRES.
   */
  const performLogin = useCallback(async (baseUrl) => {
    // Hard-code credentials như file gốc của bạn
    const username = "team007";
    const password = "acW7qYL3Kn";

    setLoading(true);
    setLoginStatus("Đang đăng nhập...");
    setResult(''); // Xóa kết quả submit cũ

    try {
      // 1. Đăng nhập
      const sId = await login(baseUrl, username, password);
      setSessionId(sId);
      setLoginStatus("Đã đăng nhập, đang lấy ID cuộc thi...");

      // 2. Lấy Evaluation ID
      const eId = await getEvaluationID(baseUrl, sId);
      setEvaluationId(eId);
      
      // Hiển thị 6 ký tự cuối để xác nhận
      setLoginStatus(`Đã đăng nhập (Session: ...${sId.slice(-6)})`);
    } catch (error) {
      console.error("Login process failed:", error);
      setLoginStatus(`Lỗi đăng nhập: ${error.message}`);
      setSessionId(null);
      setEvaluationId(null);
    } finally {
      setLoading(false);
    }
  }, []); // Sử dụng useCallback để hàm này ổn định

  // 🔹 === HÀM handleSubmit (TỐI ƯU) === 🔹

  /**
   * Chỉ thực hiện nộp bài. TÁI SỬ DỤNG sessionId và evaluationId từ state.
   * @param {object} payload - Body JSON đã được định dạng sẵn (cho KIS, QA, hoặc TRAKE).
   * @param {string} baseUrl - URL của máy chủ DRES.
   */
  const handleSubmit = async (payload, baseUrl) => {
    
    // Kiểm tra xem đã đăng nhập chưa
    if (!sessionId || !evaluationId) {
      setResult("Lỗi: Chưa đăng nhập. Vui lòng bấm 'Login' trước.");
      return;
    }

    setLoading(true);
    setResult("Đang nộp bài...");

    try {
      // 3. Gửi payload (KHÔNG cần đăng nhập lại)
      const result = await submitAnswer(
        baseUrl,
        sessionId,
        evaluationId,
        payload
      );

      setResult(`Nộp bài thành công: ${JSON.stringify(result)}`);
    } catch (error) {
      console.error("Submission failed:", error);
      setResult(`Lỗi nộp bài: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Trả về các hàm và state mới để Sidebar có thể sử dụng
  return { 
    loading,        // Trạng thái loading
    result,         // Kết quả (cho submit)
    loginStatus,    // Trạng thái đăng nhập
    isLoggedIn: !!sessionId, // Biến boolean tiện lợi (true nếu sessionId tồn tại)
    handleSubmit,   // Hàm nộp bài
    performLogin    // Hàm đăng nhập
  };
};