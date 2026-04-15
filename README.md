# AbheePay v2

A full-stack role-based fintech dashboard for managing users, wallet operations, service requests, commissions, and reports.

This repository contains:
- `frontend`: React + Vite dashboard UI
- `backend`: Node.js + Express + Prisma API

## Features

- Role-based access (`ADMIN`, `SUPER`, `DISTRIBUTOR`, `RETAILER`)
- User management with hierarchy support
- Wallet and transaction flows
- Service modules:
  - Fund Requests
  - Bank Verification
  - Payout
- Commission slabs and user-level overrides
- Reports and account ledger
- Admin "Login As" support (opens impersonated session in a new tab)

## Tech Stack

- **Frontend:** React, Vite, Axios, React Router, Lucide Icons
- **Backend:** Express, TypeScript, Prisma, PostgreSQL, JWT
- **Auth:** Bearer token authentication

## Project Structure

```text
abheepay_v2/
  backend/
    src/
    prisma/
  frontend/
    src/
```

## Prerequisites

- Node.js 18+ (recommended)
- npm 9+
- PostgreSQL database

## Environment Variables

Create `backend/.env`:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/abheepay_v2?schema=public"
JWT_SECRET="replace_with_a_secure_secret"
PORT=5000
```

## Local Setup

### 1) Install dependencies

```bash
# backend
cd backend
npm install

# frontend
cd ../frontend
npm install
```

### 2) Setup database (Prisma)

From the `backend` directory:

```bash
npx prisma generate
npx prisma db push
npm run seed
```

> Note: This project currently uses `prisma db push` (no committed migrations in repo).

### 3) Run the app

Start backend:

```bash
cd backend
npm run dev
```

Start frontend in another terminal:

```bash
cd frontend
npm run dev
```

## Default URLs

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`
- Health endpoint: `http://localhost:5000/api/health`

## Seeded Login Credentials

After `npm run seed` in `backend`:

- `admin@abheepay.com` / `admin123`
- `super1@abheepay.com` / `admin123`
- `distributor1@abheepay.com` / `admin123`
- `distributor2@abheepay.com` / `admin123`
- `retailer1@abheepay.com` / `admin123`
- `retailer2@abheepay.com` / `admin123`

## Scripts

### Backend (`backend/package.json`)

- `npm run dev` - start dev server with nodemon
- `npm run build` - compile TypeScript
- `npm run start` - run compiled server
- `npm run seed` - seed admin, sample users, and default slabs

### Frontend (`frontend/package.json`)

- `npm run dev` - start Vite dev server
- `npm run build` - production build
- `npm run preview` - preview production build
- `npm run lint` - run ESLint

## API Base URL

Frontend currently calls:

`http://localhost:5000/api`

If deploying, update `frontend/src/lib/api.js` to your backend base URL.

## Deployment Notes

- Set `DATABASE_URL` and `JWT_SECRET` securely on your host
- Enable CORS for your frontend domain in backend (`src/server.ts`)
- Use HTTPS in production
- Store uploaded files using persistent storage (local `uploads` is not ideal for multi-instance deployment)

## Troubleshooting

- **Unauthorized on protected endpoints:** Check token and `JWT_SECRET`
- **Prisma connection errors:** Verify `DATABASE_URL` and database availability
- **Frontend cannot reach API:** Confirm backend is running on port `5000` and CORS is configured
- **Seed fails on duplicate data:** Seed uses upsert for users and is safe to re-run

## License

This project is currently unlicensed. Add a license before public distribution if required.

