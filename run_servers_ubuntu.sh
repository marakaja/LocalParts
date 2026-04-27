#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$ROOT_DIR/.venv"

# Load nvm when available so frontend uses the user-selected Node version.
if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  source "$HOME/.nvm/nvm.sh"
  nvm use --silent default >/dev/null 2>&1 || true
fi

if [[ ! -d "$VENV_DIR" ]]; then
  echo "Virtual environment not found at $VENV_DIR"
  echo "Run ./setup_ubuntu.sh first."
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)"
if (( NODE_MAJOR < 20 )); then
  echo "Node.js 20+ is required for the frontend (found: $(node -v 2>/dev/null || echo 'not found'))."
  echo "Install nvm and run: nvm install 22 && nvm alias default 22"
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
  source "ls"
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
