#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-${ROOT_DIR}/backups/daily}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
RUN_DIR="${BACKUP_DIR}/${TIMESTAMP}"

mkdir -p "${RUN_DIR}"

echo "[backup] run directory: ${RUN_DIR}"

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "[backup] creating database dump"
  pg_dump "${DATABASE_URL}" -Fc -f "${RUN_DIR}/database.dump"
else
  echo "[backup] DATABASE_URL is not set, skipping database dump"
fi

if [[ -d "${ROOT_DIR}/documents" ]]; then
  echo "[backup] archiving documents"
  tar -czf "${RUN_DIR}/documents.tar.gz" -C "${ROOT_DIR}" documents
else
  echo "[backup] documents directory not found, skipping"
fi

echo "[backup] archiving configuration files"
mkdir -p "${RUN_DIR}/config"
cp -f "${ROOT_DIR}/README.md" "${RUN_DIR}/config/README.md"
cp -f "${ROOT_DIR}/render.yaml.txt" "${RUN_DIR}/config/render.yaml.txt" 2>/dev/null || true
cp -f "${ROOT_DIR}/docker-compose.yml.txt" "${RUN_DIR}/config/docker-compose.yml.txt" 2>/dev/null || true
cp -f "${ROOT_DIR}/.env.example" "${RUN_DIR}/config/.env.example" 2>/dev/null || true

if [[ -f "${RUN_DIR}/database.dump" ]]; then sha256sum "${RUN_DIR}/database.dump" > "${RUN_DIR}/database.dump.sha256"; fi
if [[ -f "${RUN_DIR}/documents.tar.gz" ]]; then sha256sum "${RUN_DIR}/documents.tar.gz" > "${RUN_DIR}/documents.tar.gz.sha256"; fi
if [[ -d "${RUN_DIR}/config" ]]; then tar -czf "${RUN_DIR}/config.tar.gz" -C "${RUN_DIR}" config; sha256sum "${RUN_DIR}/config.tar.gz" > "${RUN_DIR}/config.tar.gz.sha256"; fi

echo "[backup] completed successfully"
