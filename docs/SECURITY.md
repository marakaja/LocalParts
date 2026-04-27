# Security Guide

## Secrets management

- Do not store production secrets in source files.
- Use environment variables for:
  - `DJANGO_SECRET_KEY`
  - `DJANGO_DEBUG`
  - `DJANGO_ALLOWED_HOSTS`
- Mouser API key is managed in admin UI and stored server-side in `AppConfiguration`.
- Optional env fallback `MOUSER_API_KEY` can be used for initial setup.

## Access control

- API defaults to authenticated access.
- Admin-only operations use DRF `IsAdminUser`.
- Admin-sensitive endpoints:
  - `/api/users/`
  - `/api/mouser-api-key/`

## Frontend safety

- API key is never sent back to frontend.
- Frontend only receives API key status (`configured`, `updated_at`).
- Token is stored in localStorage; enforce HTTPS in production.

## Production hardening checklist

1. Set `DJANGO_DEBUG=false`.
2. Set strict `DJANGO_ALLOWED_HOSTS`.
3. Use strong random `DJANGO_SECRET_KEY`.
4. Restrict CORS (replace `CORS_ALLOW_ALL_ORIGINS=True` with allow-list).
5. Use HTTPS and secure reverse proxy.
6. Rotate admin credentials and API keys regularly.
7. Add periodic backup strategy for database.

## Logging and monitoring

- Avoid logging secrets or full tokens.
- Audit admin actions for user and API-key changes.
- Add application-level error monitoring in production.
