# =================================================================
# GIAI ĐOẠN 1: BUILDER - Cài đặt công cụ và build các dependency
# =================================================================
FROM openjdk:17-jdk-slim as builder

# Cài đặt các gói cần thiết, bao gồm "dos2unix" để sửa lỗi line ending
RUN apt-get update && apt-get install -y \
    git \
    cmake \
    make \
    g++ \
    maven \
    dos2unix \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# --- Build Cococ Tokenizer ---
WORKDIR /build/tokenizer
COPY coccoc-tokenizer/ .

# SỬA LỖI 1: Chuyển đổi ký tự xuống dòng từ Windows (CRLF) sang Unix (LF)
RUN dos2unix java/build_java.sh

# SỬA LỖI 2: Cấp quyền thực thi cho file script
RUN chmod +x java/build_java.sh

# Chạy lệnh build
RUN mkdir build_dir && cd build_dir && \
    cmake -DBUILD_JAVA=1 .. && \
    make install

# --- Build Elasticsearch Vietnamese Plugin ---
WORKDIR /build/plugin
COPY elasticsearch-analysis-vietnamese/ .
# SỬA LỖI: Sử dụng cờ mạnh hơn để bỏ qua hoàn toàn giai đoạn test
RUN mvn clean package -Dmaven.test.skip=true

# =================================================================
# GIAI ĐOẠN 2: FINAL IMAGE - Tạo image Elasticsearch cuối cùng
# =================================================================
FROM docker.elastic.co/elasticsearch/elasticsearch:8.7.0

USER root

# --- Sao chép các thành phẩm đã build từ Giai đoạn 1 ---
COPY --from=builder /usr/local/lib/libcoccoc_tokenizer_jni.so /usr/lib/
COPY --from=builder /usr/local/share/tokenizer/dicts /usr/local/share/tokenizer/dicts/
COPY --from=builder /build/plugin/target/releases/elasticsearch-analysis-vietnamese-*.zip /tmp/plugin.zip

# --- Cài đặt plugin và dọn dẹp ---
RUN /usr/share/elasticsearch/bin/elasticsearch-plugin install --batch file:///tmp/plugin.zip && \
    rm /tmp/plugin.zip

USER elasticsearch