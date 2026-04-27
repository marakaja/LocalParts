# Repository Hygiene (GitHub Readiness)

## Never commit

- `.env` files with real values
- API keys and passwords
- SQLite database files from local/dev (`*.sqlite3`, `*.db`)
- Virtual environments (`venv`, `.venv`)
- Node modules and build outputs
- IDE-specific user metadata

These are covered by root `.gitignore`.

## Before first push

1. Verify `.env` is ignored.
2. Verify no secrets in tracked files.
3. Verify database and virtualenv folders are ignored.
4. Confirm `.env.example` contains placeholders only.

## Quick checks

```powershell
# show tracked files containing suspicious terms
git grep -n "API_KEY\|SECRET\|TOKEN\|PASSWORD"

# list ignored files for sanity
git status --ignored
```

## If a secret was committed by mistake

1. Rotate secret immediately.
2. Remove from history using git-filter-repo/BFG.
3. Force-push cleaned history.
4. Invalidate old credentials.
