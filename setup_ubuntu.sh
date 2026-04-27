#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$ROOT_DIR/.venv"

echo "==> Starting Ubuntu setup"

if [[ -f /etc/os-release ]]; then
  # shellcheck disable=SC1091
  source /etc/os-release
  if [[ "${ID:-}" != "ubuntu" ]]; then
    echo "Warning: This script is designed for Ubuntu (detected: ${ID:-unknown})."
  fi
fi

echo "==> Installing mandatory system packages"
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nodejs npm

echo "==> Creating virtual environment"
if [[ ! -d "$VENV_DIR" ]]; then
  python3 -m venv "$VENV_DIR"
fi

# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"

echo "==> Upgrading pip"
python -m pip install --upgrade pip

echo "==> Installing backend Python dependencies"
python -m pip install \
  django \
  djangorestframework \
  django-filter \
  django-cors-headers \
  requests

echo "==> Running Django migrations"
(
  cd "$ROOT_DIR/backend"
  python manage.py migrate
)

echo "==> Installing frontend dependencies"
(
  cd "$ROOT_DIR/frontend"
  npm install
)

echo "\nSetup complete."
echo "Next: chmod +x setup_ubuntu.sh run_servers_ubuntu.sh"
echo "Then run: ./run_servers_ubuntu.sh"
