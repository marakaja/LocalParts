# Architecture

## High-Level Overview

The system is split into two applications:

- backend: Django REST API
- frontend: React SPA

Frontend communicates with backend via REST endpoints under `/api/`.

## Backend

## Main modules

- backend/backend: project configuration (`settings.py`, root URL routing)
- backend/inventory/models.py: domain entities
- backend/inventory/views.py: API logic and Mouser integration
- backend/inventory/serializers.py: request/response serialization
- backend/inventory/urls.py: API endpoint registration

## Data model

- Component: local inventory item with part data, stock, links, parameters JSON
- Tag: shared labeling entity (orders and order items)
- PurchaseOrder: order header with status and tags
- PurchaseOrderItem: line item with quantity and tags
- AppConfiguration: singleton-like app settings, currently stores Mouser API key

## Frontend

## Main modules

- frontend/src/App.tsx: routing, layout, protected navigation
- frontend/src/context/AuthContext.tsx: token/user state
- frontend/src/components/ComponentList.tsx: inventory view
- frontend/src/components/ComponentForm.tsx: add/edit component and Mouser autofill
- frontend/src/components/OrdersList.tsx: order list view
- frontend/src/components/OrderBuilder.tsx: order editing and pricing workflow
- frontend/src/components/ScannerDatasheetModal.tsx: scanner workflow and stock guidance
- frontend/src/components/AdminAccessCard.tsx: admin user management + Mouser key settings

## Authentication and Authorization

- Token auth via DRF endpoint `/api/api-token-auth/`
- Frontend stores token in localStorage and sets axios Authorization header
- Backend default permissions require authenticated user
- Admin-only views use `IsAdminUser`

## Mouser Integration Flow

1. Frontend asks backend `/api/mouser-search/` with part number
2. Backend uses configured Mouser API key
3. Backend returns normalized part details, price breaks, stock-related fields
4. Frontend uses data for scanner, forms, and order pricing decisions

## Order Workflow Notes

- Item-level tags supported
- Bulk and single-item copy/move between open orders
- Effective price logic can favor better price-break option for totals/export
- UI highlights missing Mouser stock
