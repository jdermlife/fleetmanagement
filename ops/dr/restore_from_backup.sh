#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup_run_path>"
  exit 1
fi

BACKUP_RUN="$1"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ ! -d "$BACKUP_RUN" ]]; then
  echo "Backup run directory does not exist: $BACKUP_RUN"
  exit 1
fi

echo "[restore] restoring from $BACKUP_RUN"

if [[ -f "$BACKUP_RUN/database.dump" && -n "${DATABASE_URL:-}" ]]; then
  echo "[restore] restoring database"
  pg_restore --clean --if-exists --no-owner --no-privileges -d "$DATABASE_URL" "$BACKUP_RUN/database.dump"
else
  echo "[restore] skipping database restore (missing dump or DATABASE_URL)"
fi

if [[ -f "$BACKUP_RUN/documents.tar.gz" ]]; then
  echo "[restore] restoring documents"
  rm -rf "$ROOT_DIR/documents"
  tar -xzf "$BACKUP_RUN/documents.tar.gz" -C "$ROOT_DIR"
else
  echo "[restore] skipping documents restore"
fi

if [[ -f "$BACKUP_RUN/config.tar.gz" ]]; then
  echo "[restore] restoring config package under restore_output/config"
  mkdir -p "$ROOT_DIR/restore_output"
  tar -xzf "$BACKUP_RUN/config.tar.gz" -C "$ROOT_DIR/restore_output"
else
  echo "[restore] skipping config restore"
fi

echo "[restore] completed"
