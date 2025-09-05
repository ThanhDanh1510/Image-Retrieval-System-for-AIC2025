FROM python:3.10-slim

WORKDIR /app

# Cài requirements nếu có
#COPY requirements.txt .
#RUN pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ code app
COPY . .

CMD ["python", "main.py"]
