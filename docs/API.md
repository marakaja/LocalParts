# API Reference

Base prefix: `/api/`

Auth: Token (header `Authorization: Token <token>`)

## Authentication

## Obtain token

- `POST /api/api-token-auth/`

Request body:

```json
{
  "username": "admin",
  "password": "password"
}
```

Response:

```json
{
  "token": "..."
}
```

## Profile

- `GET /api/me/`

Returns current authenticated user profile.

## Components

- `GET /api/components/`
- `POST /api/components/`
- `GET /api/components/{id}/`
- `PUT /api/components/{id}/`
- `PATCH /api/components/{id}/`
- `DELETE /api/components/{id}/`

Supported query examples:

- `/api/components/?barcode=<scanned_code>`
- `/api/components/?search=<text>`

## Tags

- `GET /api/tags/`
- `POST /api/tags/`
- `GET /api/tags/{id}/`
- `PUT /api/tags/{id}/`
- `PATCH /api/tags/{id}/`
- `DELETE /api/tags/{id}/`

## Orders

- `GET /api/orders/`
- `POST /api/orders/`
- `GET /api/orders/{id}/`
- `PUT /api/orders/{id}/`
- `PATCH /api/orders/{id}/`
- `DELETE /api/orders/{id}/`

## Order item transfer

- `POST /api/orders/{id}/copy_items/`

Request body:

```json
{
  "item_ids": [12, 13],
  "target_order_id": 5,
  "move_item": true
}
```

## Mouser

## Part lookup

- `GET /api/mouser-search/?part_number=<value>`

Returns normalized part payload including:

- basic info
- normalized parameters
- full specifications
- price breaks
- local stock estimate
- Mouser stock string

## Mouser API key settings (admin only)

- `GET /api/mouser-api-key/`
- `PUT /api/mouser-api-key/`

`PUT` request body:

```json
{
  "api_key": "new-key-value"
}
```

Response never returns the key itself, only status metadata.

## Users (admin only)

- `GET /api/users/`
- `POST /api/users/`
- `GET /api/users/{id}/`
- `PUT /api/users/{id}/`
- `PATCH /api/users/{id}/`
- `DELETE /api/users/{id}/`

## Status codes (common)

- `200` OK
- `201` Created
- `400` Validation error
- `401` Unauthenticated
- `403` Forbidden
- `404` Not found
- `503` Mouser API key not configured
