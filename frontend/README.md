# Frontend

React + TypeScript + Vite frontend for LAB Inventory system.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
npm run lint
```

## Main Frontend Modules

- `src/App.tsx`: routing, layout, protected routes
- `src/context/AuthContext.tsx`: token and user profile state
- `src/components/ComponentList.tsx`: inventory list and filtering
- `src/components/ComponentForm.tsx`: add/edit form and Mouser autofill
- `src/components/OrdersList.tsx`: order list
- `src/components/OrderBuilder.tsx`: order creation and pricing workflow
- `src/components/ScannerDatasheetModal.tsx`: scanner flow + add-to-stock guidance
- `src/components/AdminAccessCard.tsx`: admin account access and Mouser key UI

## API Dependency

Frontend expects backend API under `/api/` and token auth endpoint under `/api/api-token-auth/`.

## Full Project Documentation

Use root docs for complete context:

- `../README.md`
- `../docs/ARCHITECTURE.md`
- `../docs/API.md`
- `../docs/SECURITY.md`
- `../docs/OPERATIONS.md`
- `../docs/REPOSITORY_HYGIENE.md`
