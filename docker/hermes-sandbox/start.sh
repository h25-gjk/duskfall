#!/bin/bash
# 沙盒 Hermes 启动脚本
# 用法: ./start.sh [交互/后台]
#   交互模式(默认): 进入容器 bash，手动运行 hermes
#   后台模式: 容器在后台跑，用 docker exec 进入

set -e

IMAGE_NAME="hermes-sandbox"
CONTAINER_NAME="hermes-sandbox"
HERMES_DIR="$HOME/hermes-data"

# 创建持久化目录
mkdir -p "$HERMES_DIR"

# 构建镜像
echo "=== 构建 Docker 镜像 ==="
docker build -t "$IMAGE_NAME" "$(dirname "$0")"

# 停止旧容器（如果有）
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

# 判断模式
if [ "$1" = "background" ]; then
  echo "=== 后台启动容器 ==="
  docker run -d --name "$CONTAINER_NAME" \
    -v "$HERMES_DIR:/root/.hermes" \
    -p 3000:3000 \
    -p 8080:8080 \
    "$IMAGE_NAME"
  echo "容器已启动 (后台)"
  echo "进入容器: docker exec -it $CONTAINER_NAME bash"
  echo "运行 Hermes: docker exec -it $CONTAINER_NAME hermes"
else
  echo "=== 交互启动容器 ==="
  docker run -it --name "$CONTAINER_NAME" \
    -v "$HERMES_DIR:/root/.hermes" \
    -p 3000:3000 \
    -p 8080:8080 \
    "$IMAGE_NAME"
fi
