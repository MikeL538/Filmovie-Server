# Filmovie-Server

Filmovie-Server is the backend API for the Filmovie application. It handles authentication,
email verification, password reset, logout, and per-user movie list synchronization for the
frontend.

Production API: https://filmovie-server.onrender.com

Frontend project: https://github.com/MikeL538/Filmovie

## Runtime Architecture

The backend is an Express API written in TypeScript and backed by PostgreSQL through Prisma.
Users, auth tokens, verification flow state, and movie lists are stored in the database.

## Tech Stack

- Node.js
- TypeScript
- Express
- Prisma
- PostgreSQL
- bcrypt
- crypto
- dotenv
- Resend
- Docker

## Features

- user registration
- email verification by email link
- verification email resend flow
- login and logout
- forgot-password and reset-password flow
- protected user endpoints
- `watched` and `queued` movie lists per user
- list synchronization for the Filmovie frontend
- CORS configuration for local development and GitHub Pages deployment

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

- `400 Bad Request` for missing login or password
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
  lib/
    prisma.ts                      Prisma client instance
  services/
    authRegistration.service.ts    Registration and email verification flow
    authPassword.service.ts        Login, logout, forgot/reset password flow
    usersManagment.sevice.ts       Auth lookup and list endpoints
prisma/
  schema.prisma                    Prisma schema
  migrations/                      Prisma migrations
Dockerfile                         Container build for production runtime
```

## Requirements

- Node.js 20.19 or newer
- npm
- PostgreSQL database

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
FRONTEND_BASE_URL=http://localhost:1234/Filmovie
DATABASE_URL=your_postgresql_connection_string
```

Notes:

- `PORT` controls the local API port
- `RESEND_API_KEY` is required for registration and password-reset emails
- `API_BASE_URL` is used to generate verification links
- `FRONTEND_BASE_URL` is used to generate reset-password links
- `DATABASE_URL` points to the PostgreSQL database used by Prisma

## Available Scripts

```bash
npm run dev
npm run build
npm run start
npm run db:generate
npm run db:migrate:dev -- --name init
npm run db:migrate:deploy
```

- `npm run dev` runs the TypeScript server in watch mode
- `npm run build` generates the Prisma client and compiles the app to `dist/`
- `npm run start` runs the compiled production build
- `npm run db:generate` generates the Prisma client
- `npm run db:migrate:dev -- --name <migration_name>` creates and applies a local development migration
- `npm run db:migrate:deploy` applies existing migrations in deployment environments

## Run Locally

### Development mode

```bash
npm run dev
```

The API starts on `http://localhost:3000` unless `PORT` is overridden.

### Database setup

```bash
npm run db:migrate:dev -- --name init
```

### Production build

```bash
npm run build
npm run start
```

## Docker

The repository includes a multistage Dockerfile.

It installs dependencies, generates the Prisma client, builds the TypeScript app, prunes dev
dependencies, and runs the compiled server in production mode.

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

- session tokens, verification tokens, and reset tokens are stored as hashes
- email sending depends on Resend configuration
- because the production server is deployed on Render, cold starts may delay the first request
- there are no automated tests configured in this repository at the moment

## Author

**Michal Lipiak**

- GitHub: https://github.com/MikeL538
