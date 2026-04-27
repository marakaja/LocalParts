#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$ROOT_DIR/.venv"

if [[ ! -d "$VENV_DIR" ]]; then
  echo "Virtual environment not found at $VENV_DIR"
  echo "Run ./setup_ubuntu.sh first."
  exit 1
fi

cleanup() {
  echo "\nStopping servers..."
  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [[ -n "${FRONTEND_PID:-}" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
}

trap cleanup INT TERM EXIT

echo "==> Starting Django backend on http://0.0.0.0:8000"
(
  cd "$ROOT_DIR/backend"
  # shellcheck disable=SC1091
  source "$VENV_DIR/bin/activate"
  python manage.py runserver 0.0.0.0:8000
) &
BACKEND_PID=$!

echo "==> Starting Vite frontend on http://0.0.0.0:5173"
(
  cd "$ROOT_DIR/frontend"
  npm run dev -- --host 0.0.0.0 --port 5173
) &
FRONTEND_PID=$!

echo "\nServers are running. Press Ctrl+C to stop both."
wait "$BACKEND_PID" "$FRONTEND_PID"
