# Filmovie-Server

Filmovie-Server is the backend API for the Filmovie application. It handles authentication,
account verification, and per-user movie list persistence used by the frontend.

Production API: https://filmoteka-server-oso6.onrender.com

Frontend project: https://github.com/MikeL538/Filmovie

## What It Provides

- user registration
- login
- email verification flow
- protected user endpoints
- `watched` and `queued` movie lists per user
- list synchronization for the Filmovie frontend
- CORS configuration for local development and GitHub Pages deployment

## Current Runtime Architecture

The current running backend is an Express API written in TypeScript.

At the moment, user data is persisted in `src/users.json`, which means:

- authentication and list persistence work
- email verification tokens are stored with the user record
- data storage is file-based in the current implementation

The repository also includes Prisma and PostgreSQL configuration, but the active server logic is not
using Prisma yet in the current runtime flow.

## Tech Stack

- Node.js
- TypeScript
- Express
- CORS
- bcrypt
- crypto
- dotenv
- Prisma configuration included
- Docker

## Features

### Authentication

- `POST /api/auth/register` registers a new user
- `POST /api/auth/login` logs in a verified user
- passwords are hashed with `bcrypt`
- login returns a token and the user's movie lists

### Email Verification

- registration creates a verification token
- the backend stores only the token hash
- verification is handled by `GET /api/auth/verify-email?token=...`
- unverified users cannot log in
- when login is blocked, the API returns an activation link in the response

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

Possible responses:

- `201 Created` when registration succeeds
- `409 Conflict` if login already exists
- `409 Conflict` if email already exists
- `400 Bad Request` if required fields are missing

#### `GET /api/auth/verify-email?token=...`

Possible responses:

- `200 OK` when verification succeeds
- `400 Bad Request` for missing, invalid, or expired token

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
  "token": "token-1",
  "user": {
    "id": 1,
    "login": "exampleUser"
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

### Protected routes

Protected endpoints expect an Authorization header:

```http
Authorization: Bearer token-1
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

## CORS

The backend currently allows requests from:

- `http://localhost:1234`
- `http://localhost:3000`
- `https://mikel538.github.io`

This covers local Parcel development and the deployed Filmovie frontend on GitHub Pages.

## Project Structure

```text
src/
  app.ts          Express app, routes, auth logic, list handling
  server.ts       Server bootstrap
  users.json      File-based user storage
prisma/
  schema.prisma   Prisma schema prepared for PostgreSQL
Dockerfile        Container build for production runtime
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
DATABASE_URL=your_postgresql_connection_string
```

Notes:

- `PORT` is used by the running server
- `DATABASE_URL` is relevant for the Prisma/PostgreSQL setup present in the repo
- the active file-based runtime does not require PostgreSQL to start

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
`src/users.json` for the current file-based runtime.

## Integration With Filmovie Frontend

This backend is used by Filmovie for:

- registration
- login
- verification gating before login
- downloading user lists on login
- updating watched and queued lists after user actions

The frontend integration currently lives in the Filmovie repository in:
`src/ts/api/filmotekaServerApi.ts`

## Important Notes

- the current auth token format is development-oriented: `token-{userId}`
- persistence is currently file-based, not database-backed in runtime
- Prisma and PostgreSQL setup are present but not yet connected to the active API flow
- because the production server is deployed on Render, cold starts may delay the first request
- there are no automated tests configured in this repository at the moment

## Author

**Michal Lipiak**

- GitHub: https://github.com/MikeL538
