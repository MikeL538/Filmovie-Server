# Filmovie-Server

Filmovie-Server is the backend API for the Filmovie application. It handles authentication,
email verification, password reset, logout, and per-user movie list synchronization for the
frontend.

Production API: https://filmovie-server.onrender.com

Frontend project: https://github.com/MikeL538/Filmovie

## What It Provides

- user registration
- email verification by email link
- verification email resend flow
- login and logout
- forgot-password and reset-password flow
- protected user endpoints
- `watched` and `queued` movie lists per user
- list synchronization for the Filmovie frontend
- CORS configuration for local development and GitHub Pages deployment

## Current Runtime Architecture

The current running backend is an Express API written in TypeScript.

The project is moving toward a database-backed architecture with Prisma and PostgreSQL, but the
current runtime still persists users and lists in `src/users.json`.

That means:

- the active runtime is still file-based
- Prisma and PostgreSQL are already configured in the repository
- the README should treat database support as the target architecture, not the current persistence
  layer

## Tech Stack

- Node.js
- TypeScript
- Express
- CORS
- bcrypt
- crypto
- dotenv
- Prisma
- PostgreSQL-ready configuration
- Resend
- Docker

## Features

### Authentication

- `POST /api/auth/register` creates a new account
- `POST /api/auth/login` logs in a verified user
- `POST /api/auth/logout` clears the current session token
- passwords are hashed with `bcrypt`
- session tokens are random values, stored only as SHA-256 hashes
- login returns the current user lists together with the session token

### Email Verification

- registration creates a verification token
- the backend stores only the verification token hash
- verification is handled by `GET /api/auth/verify-email?token=...`
- `GET /api/auth/resend-verify-email?login=...` sends a new verification email
- unverified users cannot log in

### Password Reset

- `POST /api/auth/forgot-password` sends a reset-password email
- reset links point to the frontend reset page
- `POST /api/auth/reset-password` sets a new password using the reset token
- reset tokens are stored only as hashes and expire after a limited time

### User Lists

- `GET /api/users/me/lists` returns the authenticated user's lists
- `PUT /api/users/me/lists/watched` updates the watched list
- `PUT /api/users/me/lists/queued` updates the queued list

## API Overview

### Health check

- `GET /`
- `GET /health`

Both return a simple JSON response confirming the service is running.

### Auth routes

#### `POST /api/auth/register`

Request body:

```json
{
  "login": "exampleUser",
  "password": "strongPassword",
  "email": "user@example.com"
}
```

Behavior:

- normalizes login to `Firstletterrestlowercase`
- rejects duplicate login or email
- hashes password before saving
- sends a verification email before returning success

Possible responses:

- `201 Created` when registration succeeds
- `400 Bad Request` if required fields are missing
- `401` or `422` for invalid login/password length
- `409 Conflict` if login or email already exists
- `502 Bad Gateway` if verification email sending fails

#### `GET /api/auth/verify-email?token=...`

Possible responses:

- `200 OK` when verification succeeds
- `400 Bad Request` for missing, invalid, or expired token

#### `GET /api/auth/resend-verify-email?login=...`

Possible responses:

- `200 OK` when a new verification email is sent
- `400 Bad Request` if login is missing or user is already verified
- `404 Not Found` if user does not exist
- `429 Too Many Requests` if resend is requested too early

#### `POST /api/auth/login`

Request body:

```json
{
  "login": "exampleUser",
  "password": "strongPassword"
}
```

Success response includes:

```json
{
  "token": "random-session-token",
  "user": {
    "id": 1,
    "loginFormat": "Exampleuser"
  },
  "lists": {
    "watched": [],
    "queued": []
  }
}
```

Possible error cases:

- `401 Unauthorized` for invalid credentials
- `403 Forbidden` for unverified accounts

#### `POST /api/auth/forgot-password`

Request body:

```json
{
  "email": "user@example.com"
}
```

Possible responses:

- `200 OK` when the reset email is sent
- `400 Bad Request` if email is missing
- `401 Unauthorized` if no matching user exists
- `500` if email provider is not configured
- `502 Bad Gateway` if email sending fails

#### `POST /api/auth/reset-password`

Request body:

```json
{
  "token": "reset-token",
  "password": "newStrongPassword"
}
```

Possible responses:

- `200 OK` when password reset succeeds
- `400 Bad Request` for missing, invalid, or expired token

#### `POST /api/auth/logout`

Requires:

```http
Authorization: Bearer <session-token>
```

Possible responses:

- `200 OK` when logout succeeds
- `400 Bad Request` for missing or invalid token

### Protected routes

Protected endpoints expect an Authorization header:

```http
Authorization: Bearer <session-token>
```

#### `GET /api/users/me/lists`

Returns:

```json
{
  "watched": [1265609],
  "queued": [1159559]
}
```

#### `PUT /api/users/me/lists/:listName`

Allowed values for `listName`:

- `watched`
- `queued`

Request body:

```json
{
  "movieIds": [1265609, 1159559]
}
```

Response returns the updated lists:

```json
{
  "watched": [1265609],
  "queued": [1159559]
}
```

## CORS

The backend currently allows requests from:

- `http://localhost:1234`
- `http://localhost:3000`
- `https://mikel538.github.io`

This covers local development and the deployed Filmovie frontend on GitHub Pages.

## Project Structure

```text
src/
  app.ts                           Express app, routes, middleware, runtime config
  server.ts                        Server bootstrap
  types.ts                         Runtime user type
  users.json                       Current file-based persistence
  services/
    authRegistration.service.ts    Registration and email verification flow
    authPassword.service.ts        Login, logout, forgot/reset password flow
    usersManagment.sevice.ts       User loading, auth lookup, and list endpoints
prisma/
  schema.prisma                    Prisma schema and PostgreSQL datasource
Dockerfile                         Container build for production runtime
```

## Requirements

- Node.js 20.19 or newer
- npm

## Installation

```bash
npm install
```

## Environment Variables

Create a `.env` file in the project root when running locally:

```env
PORT=3000
RESEND_API_KEY=your_resend_api_key
API_BASE_URL=http://localhost:3000
FRONTEND_BASE_URL=http://localhost:1234
DATABASE_URL=your_postgresql_connection_string
```

Notes:

- `PORT` controls the local API port
- `RESEND_API_KEY` is required for registration and password-reset emails
- `API_BASE_URL` is used to generate verification links
- `FRONTEND_BASE_URL` is used to generate reset-password links
- `DATABASE_URL` is currently for the Prisma/PostgreSQL layer prepared in the repo
- the current runtime can still start without PostgreSQL because active persistence is file-based

## Available Scripts

```bash
npm run dev
npm run build
npm run start
```

- `npm run dev` runs the TypeScript server in watch mode
- `npm run build` compiles the app to `dist/`
- `npm run start` runs the compiled production build

## Run Locally

### Development mode

```bash
npm run dev
```

The API starts on `http://localhost:3000` unless `PORT` is overridden.

### Production build

```bash
npm run build
npm run start
```

## Docker

The repository includes a multistage Dockerfile.

It builds the TypeScript server, prunes dev dependencies, copies `dist/`, and includes
`src/users.json` for the current runtime.

## Integration With Filmovie Frontend

This backend is used by Filmovie for:

- registration
- account verification
- verification-email resend
- login and logout
- password reset
- downloading user lists on login
- updating watched and queued lists after user actions

The frontend integration currently lives in:
`src/ts/api/filmovieServerApi.ts`

## Important Notes

- the repository is being prepared for database-backed runtime, but active persistence is still
  `src/users.json`
- session tokens, verification tokens, and reset tokens are stored as hashes
- email sending depends on Resend configuration
- because the production server is deployed on Render, cold starts may delay the first request
- there are no automated tests configured in this repository at the moment

## Author

**Michal Lipiak**

- GitHub: https://github.com/MikeL538
