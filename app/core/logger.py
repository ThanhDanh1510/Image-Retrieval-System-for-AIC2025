# Project-relative path: app/core/logger.py
import logging
import logging.handlers
from pathlib import Path
import sys
import codecs # Thêm import này

class SimpleLogger:
    """Simple logger with console and file output, enforcing UTF-8 for console."""

    def __init__(
        self,
        name: str,
        log_dir: str = "logs",
        console_level: str = "DEBUG",
        file_level: str = "DEBUG"
    ):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.DEBUG)

        # Chỉ cấu hình handlers nếu logger chưa có handlers
        if not self.logger.handlers:
            Path(log_dir).mkdir(exist_ok=True) # Tạo thư mục logs nếu chưa có

            # --- Console Handler (sử dụng UTF-8) ---
            try:
                # Tạo writer UTF-8 cho sys.stdout
                utf8_writer = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
                console_handler = logging.StreamHandler(utf8_writer)
            except Exception:
                # Fallback về StreamHandler mặc định nếu có lỗi (ví dụ: môi trường không hỗ trợ buffer)
                print(f"Warning: Could not create UTF-8 console handler for logger '{name}'. Falling back to default.")
                console_handler = logging.StreamHandler(sys.stdout)

            console_handler.setLevel(getattr(logging, console_level.upper(), logging.DEBUG))
            # Format màu cho console (giữ nguyên)
            console_format = logging.Formatter(
                '\033[36m%(asctime)s\033[0m | \033[32m%(levelname)-8s\033[0m | %(name)s | %(funcName)s:%(lineno)d | %(message)s',
                datefmt='%H:%M:%S'
            )
            console_handler.setFormatter(console_format)
            self.logger.addHandler(console_handler)
            # ----------------------------------------

            # --- File Handler (Rotating) ---
            try:
                log_file_path = Path(log_dir) / f"{name}.log"
                file_handler = logging.handlers.RotatingFileHandler(
                    log_file_path,
                    maxBytes=10*1024*1024, # 10 MB
                    backupCount=3,
                    encoding='utf-8' # Đảm bảo file log cũng là UTF-8
                )
                file_handler.setLevel(getattr(logging, file_level.upper(), logging.DEBUG))
                file_format = logging.Formatter(
                    '%(asctime)s | %(levelname)-8s | %(name)s | %(funcName)s:%(lineno)d | %(message)s'
                )
                file_handler.setFormatter(file_format)
                self.logger.addHandler(file_handler)
            except Exception as e:
                # Ghi lỗi ra console nếu không tạo được file handler
                print(f"Error creating file handler for logger '{name}': {e}")
            # --------------------------------

            # Ngăn logger gửi log lên logger cha (root logger) để tránh log trùng lặp
            self.logger.propagate = False

    def debug(self, msg: str, *args, **kwargs):
        self.logger.debug(msg, *args, **kwargs)

    def info(self, msg: str, *args, **kwargs):
        self.logger.info(msg, *args, **kwargs)

    def warning(self, msg: str, *args, **kwargs):
        self.logger.warning(msg, *args, **kwargs)

    def error(self, msg: str, *args, **kwargs):
        # exc_info=True sẽ tự động thêm traceback vào log khi có exception
        self.logger.error(msg, *args, **kwargs)

    def critical(self, msg: str, *args, **kwargs):
        self.logger.critical(msg, *args, **kwargs)

    # Giữ lại exception cho sự tương thích, mặc dù error(exc_info=True) thường đủ
    def exception(self, msg: str, *args, **kwargs):
        self.logger.exception(msg, *args, **kwargs)