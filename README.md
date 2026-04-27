# LAB Inventory & Ordering System

Web application for laboratory component inventory, scanner-assisted lookup, and Mouser purchase order preparation.

## What This Project Does

- Manages electronic components in local stock
- Supports barcode/QR scanning for fast lookup
- Integrates with Mouser for part details, stock, and price breaks
- Builds purchase orders with item-level tags/projects
- Supports copy/move of order items between open orders
- Protects the app with authentication and role-based admin features
- Lets admins manage users and configure Mouser API key from UI

## Tech Stack

- Backend: Django + Django REST Framework + SQLite
- Frontend: React + TypeScript + Vite + MUI
- Auth: DRF token authentication
- Scanner: react-qr-barcode-scanner

## Repository Structure

- backend: Django project and API
- frontend: React application
- docs: Project documentation
- .env.example: Environment variable template
- .gitignore: Git safety rules (secrets, venvs, build outputs)

## Quick Start

## 1. Prerequisites

- Python 3.11+
- Node.js 20+
- npm

## 2. Clone and configure

1. Copy environment template:
   - create `.env` in project root based on `.env.example`
2. Set values:
   - `DJANGO_SECRET_KEY`
   - `DJANGO_DEBUG`
   - `DJANGO_ALLOWED_HOSTS`

Note: `MOUSER_API_KEY` in `.env` is optional fallback. Preferred method is setting key in admin UI.

## 3. Backend setup

From project root:

```powershell
Set-Location backend
..\venv\Scripts\python.exe -m pip install django djangorestframework django-filter django-cors-headers requests
..\venv\Scripts\python.exe manage.py migrate
..\venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
```

If no admin exists, create one:

```powershell
..\venv\Scripts\python.exe manage.py createsuperuser
```

## 4. Frontend setup

From project root:

```powershell
Set-Location frontend
npm install
npm run dev
```

Vite runs on local HTTPS (default `https://localhost:5173`).

## 5. First login and Mouser key

1. Log in as admin user.
2. Open Admin Access page.
3. In Mouser API key section, paste key and save.

After that, scanner lookup and Mouser autofill are fully operational.

## Core Workflows

## Inventory

- Add/edit/delete components
- Group and filter by category/distributor
- Maintain local stock levels and metadata

## Scanner

- Scan barcode/QR code
- Resolve component locally and from Mouser
- Show local stock and Mouser stock
- Offer "Add to stock" if local stock is missing

## Orders

- Build/edit orders with tags
- Assign tags to individual order items
- View price breaks and effective totals
- Highlight zero Mouser stock rows
- Copy/move item(s) across open orders

## Security Model

- Protected routes in frontend
- Token-authenticated API access
- Admin-only endpoints for user management and Mouser key config
- Mouser API key stored on backend (never exposed to client as plain value)

For details, see [docs/SECURITY.md](docs/SECURITY.md).

## API Overview

Base URL prefix:

- `/api/`

Auth endpoint:

- `POST /api/api-token-auth/`

Main endpoints:

- Components: `/api/components/`
- Orders: `/api/orders/`
- Tags: `/api/tags/`
- Users (admin): `/api/users/`
- Profile: `/api/me/`
- Mouser search: `/api/mouser-search/?part_number=...`
- Mouser key settings (admin): `/api/mouser-api-key/`

Full API reference: [docs/API.md](docs/API.md).

## GitHub Readiness

Project includes:

- root `.gitignore` with Python, Node, env, db, and IDE exclusions
- `.env.example` for safe onboarding without secrets

Before first push, verify:

- no real keys in tracked files
- no database files committed
- no virtualenv folders committed

Checklist: [docs/REPOSITORY_HYGIENE.md](docs/REPOSITORY_HYGIENE.md).

## Documentation Index

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/API.md](docs/API.md)
- [docs/SECURITY.md](docs/SECURITY.md)
- [docs/OPERATIONS.md](docs/OPERATIONS.md)
- [docs/REPOSITORY_HYGIENE.md](docs/REPOSITORY_HYGIENE.md)
