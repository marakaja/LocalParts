# Operations

## Local development

## Backend

```powershell
Set-Location backend
..\venv\Scripts\python.exe manage.py migrate
..\venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
```

## Frontend

```powershell
Set-Location frontend
npm install
npm run dev
```

## Useful backend commands

```powershell
..\venv\Scripts\python.exe manage.py check
..\venv\Scripts\python.exe manage.py createsuperuser
..\venv\Scripts\python.exe manage.py showmigrations
```

## Initial admin setup

1. Create superuser
2. Log in through frontend
3. Open Admin Access page
4. Set Mouser API key in dedicated section

## Troubleshooting

## Scanner cannot find component

- Verify barcode format and camera focus
- Ensure Mouser API key is configured
- Confirm backend reachable from frontend

## Mouser lookup returns error

- Check `/api/mouser-api-key/` status in admin
- Validate internet access and Mouser key validity

## New order rows not selectable

- Ensure autosave/manual save completed successfully
- IDs are hydrated from backend response after save

## Deployment notes

- Current backend uses SQLite for development convenience
- For production, prefer PostgreSQL and managed file/log strategy
- Place backend behind HTTPS reverse proxy
