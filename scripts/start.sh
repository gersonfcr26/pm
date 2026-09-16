#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="pm-mvp:local"
CONTAINER_NAME="pm-mvp"
PORT="${PM_MVP_PORT:-8000}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${REPO_ROOT}/.env"

echo "Building Docker image ${IMAGE_NAME}..."
docker build -t "${IMAGE_NAME}" .

if docker ps -a --format '{{.Names}}' | grep -Eq "^${CONTAINER_NAME}$"; then
  echo "Removing existing container ${CONTAINER_NAME}..."
  docker rm -f "${CONTAINER_NAME}" >/dev/null
fi

echo "Starting container ${CONTAINER_NAME} on http://localhost:${PORT}..."
RUN_ARGS=( -d --name "${CONTAINER_NAME}" -p "${PORT}:8000" )

if [[ -f "${ENV_FILE}" ]]; then
  RUN_ARGS+=( --env-file "${ENV_FILE}" )
else
  echo "Warning: .env file not found at ${ENV_FILE}. OPENROUTER_API_KEY will be unavailable unless provided by other environment settings."
fi

docker run "${RUN_ARGS[@]}" "${IMAGE_NAME}" >/dev/null

echo "Done."
echo "- App:    http://localhost:${PORT}/"
echo "- Health: http://localhost:${PORT}/api/health"
