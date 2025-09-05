# ========================
# GIAI ĐOẠN 1: Build plugin & tokenizer
# ========================
FROM docker.elastic.co/elasticsearch/elasticsearch:8.7.0 AS package_builder

ENV DEBIAN_FRONTEND=noninteractive

# Chuyển sang root để cài đặt gói
USER root

# Cài đặt các công cụ cần thiết
RUN apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get update -y && \
    apt-get install -y \
    locales \
    make \
    cmake \
    unzip \
    pkg-config \
    gcc \
    g++ \
    wget \
    git \
    maven \
    openjdk-17-jdk \
    libc6 \
    libstdc++6 \
    iputils-ping && \
    locale-gen en_US.UTF-8 && \
    rm -rf /var/lib/apt/lists/*

# Thiết lập Java 17
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV PATH=$JAVA_HOME/bin:$PATH

# Sao chép mã nguồn plugin tiếng Việt
COPY ./elasticsearch-analysis-vietnamese /elasticsearch-analysis-vietnamese

# Build plugin Java bằng Maven (Elasticsearch plugin)
WORKDIR /elasticsearch-analysis-vietnamese
RUN rm -rf /root/.m2/repository/org/elasticsearch && \
    mvn -Dmaven.compiler.source=17 -Dmaven.compiler.target=17 clean package -Dmaven.test.skip

# Clone coccoc-tokenizer repo đầy đủ thay vì copy local
WORKDIR /
RUN git clone --recursive https://github.com/coccoc/coccoc-tokenizer.git

# Build coccoc-tokenizer (có JNI cho Java)
WORKDIR /coccoc-tokenizer
RUN mkdir build && cd build && cmake -DBUILD_JAVA=1 .. && make install


# ========================
# GIAI ĐOẠN 2: Image Elasticsearch cuối cùng
# ========================
FROM docker.elastic.co/elasticsearch/elasticsearch:8.7.0

# Chuyển sang root để copy file
USER root

# Copy thư viện tokenizer đã build
COPY --from=package_builder /usr/local/lib/libcoccoc_tokenizer_jni.so /usr/lib/
COPY --from=package_builder /usr/local/share/tokenizer/dicts /usr/local/share/tokenizer/dicts/

# Copy plugin đã build
COPY --from=package_builder /elasticsearch-analysis-vietnamese/target/releases/elasticsearch-analysis-vietnamese-8.7.0.zip /tmp/plugin.zip

# Cài plugin
RUN /usr/share/elasticsearch/bin/elasticsearch-plugin install --batch file:///tmp/plugin.zip && \
    rm /tmp/plugin.zip

# Quay lại user mặc định để chạy ES an toàn
USER elasticsearch
