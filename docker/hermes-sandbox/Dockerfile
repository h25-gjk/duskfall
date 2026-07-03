FROM python:3.12-slim

# 系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# 工作目录
WORKDIR /app

# 安装 Hermes
RUN pip install --no-cache-dir hermes-agent

# 持久化目录
RUN mkdir -p /root/.hermes
VOLUME /root/.hermes

# 暴露端口（dashboard / proxy / API server 等）
EXPOSE 3000 8080

# 默认保持容器运行（后台模式），用 docker exec 进入交互
CMD ["sleep", "infinity"]
