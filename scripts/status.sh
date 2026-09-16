#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="pm-mvp"
PORT="${PM_MVP_PORT:-8000}"
HEALTH_URL="http://localhost:${PORT}/api/health"

if docker ps --format '{{.Names}}' | grep -Eq "^${CONTAINER_NAME}$"; then
  echo "Container ${CONTAINER_NAME} is running."
else
  echo "Container ${CONTAINER_NAME} is not running."
fi

echo "Health endpoint: ${HEALTH_URL}"
if command -v curl >/dev/null 2>&1; then
  curl --silent --show-error --fail "${HEALTH_URL}" || echo "Health check request failed."
else
  echo "curl is not available."
fi
