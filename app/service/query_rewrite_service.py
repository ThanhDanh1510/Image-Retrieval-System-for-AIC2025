# service/query_rewrite_service.py
from __future__ import annotations

import json
import time
import re
import os
from typing import Optional, Dict, Any

# SDKs là tùy chọn; nếu không có sẽ dùng REST
try:
    import openai  # type: ignore
except Exception:  # pragma: no cover
    openai = None  # type: ignore

try:
    import google.generativeai as genai  # type: ignore
except Exception:  # pragma: no cover
    genai = None  # type: ignore

import urllib.request
import urllib.error

from core.logger import SimpleLogger
logger = SimpleLogger(__name__)



class QueryRewriteService:
    """
    Optional LLM-based query rewriter for proper nouns.
    - Provider: "openai" | "gemini"
    - Safe-by-default: on any error -> return original text.
    - No side effects to existing pipeline.
    """
    
    

    _SYS_PROMPT = (
        "You rewrite user queries that contain proper nouns (landmarks, buildings, toys, fictional characters, brands, objects) "
        "into vivid, descriptive English sentences that focus on visible appearance and distinctive physical traits. "
        "Describe what it LOOKS like: shape, size, materials, colors, structure, textures, and iconic features. "
        "Do not add history or trivia. Keep user intent. Return exactly one natural English sentence under 240 characters."
    )

    _USER_TEMPLATE = (
        "Original query: \"{q}\"\n"
        "RULES:\n"
        "• If the query is or contains a proper noun, you MUST output a concise visual description. Do NOT return the original name by itself.\n"
        "• Focus on physical/visual details only.\n"
        "• If it's a single-word proper noun (e.g., 'Labubu'), NEVER echo it back—describe its look.\n"
        "FEW-SHOT EXAMPLES:\n"
        "• Input: Landmark 81 → Output: a modern 81-story glass skyscraper in Vietnam with slim, tapering profile and blue-green reflections\n"
        "• Input: Labubu → Output: a small creature with a big head, long pointed ears, round eyes, and a wide grin showing sharp teeth; cute yet mischievous\n"
        "TASK: Rewrite the Original query accordingly."
    )

    def __init__(
        self,
        provider: str,
        api_key: str,
        timeout_ms: int = 12_000,
        openai_model: Optional[str] = None,
        gemini_model: Optional[str] = None,
        temperature: float = 0.2,
        max_output_chars: int = 240,
        enable_cache: bool = True,
        cache_ttl_seconds: int = 600,
    ) -> None:
        self.provider = provider.lower().strip()
        self.api_key = api_key
        self.timeout_ms = max(1000, int(timeout_ms))
        self.temperature = float(temperature)
        self.max_output_chars = int(max_output_chars)
        self.enable_cache = enable_cache
        self.cache_ttl = int(cache_ttl_seconds)
        self._cache: Dict[str, tuple[float, str]] = {}

        # default models (có thể override bằng env)
        self.openai_model = (
            openai_model
            or os.getenv("OPENAI_MODEL")
            or "gpt-4o-mini"
        )
        self.gemini_model = (
            gemini_model
            or os.getenv("GEMINI_MODEL")
            or "gemini-1.5-flash"
        )

        # cấu hình SDK nếu có
        if self.provider == "openai" and openai is not None:
            try:
                # openai>=1.0 style client; nếu package cũ thì vẫn dùng REST bên dưới
                openai.api_key = self.api_key  # type: ignore
            except Exception:
                pass
        if self.provider == "gemini" and genai is not None:
            try:
                genai.configure(api_key=self.api_key)  # type: ignore
            except Exception:
                pass

    # ---------- Public API ----------

    def rewrite(self, text: str) -> str:
        """
        Rewrite 'text' if it contains proper nouns; otherwise return as-is.
        Any error -> return original text (fail-open).
        """
        clean_input = (text or "").strip()
        if not clean_input:
            return clean_input

        # cache nhẹ
        if self.enable_cache:
            cached = self._cache_get(clean_input)
            if cached is not None:
                return cached

        try:
            if self.provider == "openai":
                out = self._rewrite_openai(clean_input)
            elif self.provider == "gemini":
                out = self._rewrite_gemini(clean_input)
            else:
                return clean_input  # provider không hỗ trợ -> trả gốc
        except Exception as e:
            logger.error(
                f"[RewriteError] provider={self.provider}, model={getattr(self,'openai_model',None) or getattr(self,'gemini_model',None)}: {e}"
            )
            return clean_input

        final_out = self._postprocess_output(out, clean_input)

        if self.enable_cache:
            self._cache_set(clean_input, final_out)
            
        logger.info(f"[Rewrite] {clean_input!r}  →  {final_out!r}")

        return final_out

    # ---------- Provider calls ----------

    def _rewrite_openai(self, text: str) -> str:
        payload_user = self._USER_TEMPLATE.format(q=text)
        # Nếu SDK openai>=1 có mặt, thử dùng; nếu không rơi về REST.
        if openai is not None and hasattr(openai, "chat") is False:
            # openai>=1.0 dùng OpenAI client; nhưng để tránh phụ thuộc,
            # ta sẽ dùng REST cho ổn định thay vì branch theo version.
            pass

        # REST call
        url = "https://api.openai.com/v1/chat/completions"
        body = {
            "model": self.openai_model,
            "temperature": self.temperature,
            "messages": [
                {"role": "system", "content": self._SYS_PROMPT},
                {"role": "user", "content": payload_user},
            ],
            "max_tokens": 120,  # output ngắn
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        resp = self._http_post(url, headers, body, timeout_ms=self.timeout_ms)
        try:
            data = json.loads(resp.decode("utf-8"))
            content = data["choices"][0]["message"]["content"]
            return content
        except Exception:
            # Nếu format khác (do version), fallback SDK nếu có
            if openai is not None:
                try:
                    # old SDK (openai==0.x) style
                    comp = openai.ChatCompletion.create(  # type: ignore
                        model=self.openai_model,
                        temperature=self.temperature,
                        messages=[
                            {"role": "system", "content": self._SYS_PROMPT},
                            {"role": "user", "content": payload_user},
                        ],
                        max_tokens=120,
                    )
                    return comp["choices"][0]["message"]["content"]  # type: ignore
                except Exception:
                    pass
            raise

    def _rewrite_gemini(self, text: str) -> str:
        prompt = self._SYS_PROMPT + "\n\n" + self._USER_TEMPLATE.format(q=text)

        # Nếu SDK có mặt, ưu tiên dùng
        if genai is not None:
            try:
                model = genai.GenerativeModel(self.gemini_model)  # type: ignore
                resp = model.generate_content(
                    prompt,
                    generation_config={
                        "temperature": self.temperature,
                        "max_output_tokens": 120,
                    },
                    safety_settings=None,
                    request_options={"timeout": self.timeout_ms / 1000.0},
                )
                # SDK v1 trả resp.text
                if hasattr(resp, "text") and resp.text:
                    return resp.text
                # Nếu không có .text, thử lấy từ candidates
                if hasattr(resp, "candidates") and resp.candidates:  # type: ignore
                    parts = getattr(resp.candidates[0], "content", None)  # type: ignore
                    if parts and getattr(parts, "parts", None):
                        return str(parts.parts[0].text)  # type: ignore
            except Exception:
                # Fallback REST bên dưới
                pass

        # REST
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.gemini_model}:generateContent?key={self.api_key}"
        body = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": self.temperature,
                "maxOutputTokens": 120,
            },
        }
        headers = {"Content-Type": "application/json"}
        resp = self._http_post(url, headers, body, timeout_ms=self.timeout_ms)
        try:
            data = json.loads(resp.decode("utf-8"))
            # cấu trúc trả về: candidates[0].content.parts[0].text
            cand = data["candidates"][0]
            parts = cand["content"]["parts"]
            return parts[0]["text"]
        except Exception:
            raise

    # ---------- Utilities ----------

    def _http_post(self, url: str, headers: Dict[str, str], body: Dict[str, Any], timeout_ms: int) -> bytes:
        """
        POST với 2 lần retry nhẹ, exponential backoff.
        """
        payload = json.dumps(body).encode("utf-8")
        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
        retries = 2
        delay = 0.5
        for attempt in range(retries + 1):
            try:
                with urllib.request.urlopen(req, timeout=timeout_ms / 1000.0) as resp:
                    return resp.read()
            except urllib.error.HTTPError as e:
                # 4xx/5xx -> chỉ retry nếu 429/5xx
                if e.code in (429, 500, 502, 503, 504) and attempt < retries:
                    time.sleep(delay)
                    delay *= 2
                    continue
                raise
            except Exception:
                if attempt < retries:
                    time.sleep(delay)
                    delay *= 2
                    continue
                raise

    def _postprocess_output(self, text: str, original: str) -> str:
        """
        Làm gọn đầu ra: 1 dòng, bỏ trích dẫn, cắt độ dài, giữ ASCII cơ bản.
        Nếu rỗng hoặc quá lố -> trả original.
        """
        if not text:
            return original

        s = text.strip()

        # Lấy dòng đầu tiên & bỏ markdown/quote phổ biến
        s = s.replace("\n", " ").replace("\r", " ")
        s = re.sub(r"\s+", " ", s)
        s = s.strip(" \"'`")

        # Trường hợp model trả kiểu: `Rewritten: ...`
        s = re.sub(r"^(Rewritten|Rewrite|Output)\s*:\s*", "", s, flags=re.I)

        # Giới hạn ký tự
        if len(s) > self.max_output_chars:
            s = s[: self.max_output_chars].rstrip()

        # Nếu model lỡ trả rỗng hoặc vô nghĩa -> fallback
        if not s or s.lower() in {"n/a", "none", "null"}:
            return original

        return s

    # ---------- Tiny in-memory cache ----------

    def _cache_get(self, key: str) -> Optional[str]:
        try:
            val = self._cache.get(key)
            if not val:
                return None
            ts, out = val
            if time.time() - ts > self.cache_ttl:
                # expired
                self._cache.pop(key, None)
                return None
            return out
        except Exception:
            return None

    def _cache_set(self, key: str, value: str) -> None:
        try:
            self._cache[key] = (time.time(), value)
        except Exception:
            pass
