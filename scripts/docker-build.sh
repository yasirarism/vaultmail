#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="${1:-vaultmail}"
DOCKERFILE_PATH="${DOCKERFILE_PATH:-Dockerfile}"

echo "Building ${IMAGE_NAME} using ${DOCKERFILE_PATH}..."
docker build -t "${IMAGE_NAME}" -f "${DOCKERFILE_PATH}" .

cat <<EOF
Build complete.
Run with:
  docker run --rm -p 3000:3000 \\
    -e MONGODB_URI="mongodb://user:pass@host:27017/vaultmail" \\
    -e MONGODB_DB="vaultmail" \\
    "${IMAGE_NAME}"
EOF
