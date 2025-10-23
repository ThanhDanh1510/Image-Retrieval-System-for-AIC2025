# Bắt đầu từ image Python 3.10 phiên bản slim (nhẹ)
FROM python:3.10

# Thiết lập thư mục làm việc bên trong container
WORKDIR /app

# Sao chép toàn bộ source code của backend vào thư mục làm việc /app
COPY . .

# Thông báo cho Docker biết container sẽ lắng nghe trên port 8000
EXPOSE 8000

# Lệnh mặc định để chạy khi container khởi động
# Chạy uvicorn, trỏ đến file main.py và đối tượng app trong thư mục app/
# --host 0.0.0.0 để có thể truy cập từ bên ngoài container
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]