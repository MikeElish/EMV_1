# EMV

EMV is a Next.js application for the EMV storefront, customer CRM, staff
administration, mail, finance, warehouse, and taxi-fleet workflows.

## Requirements

- Node.js 20.9 or newer
- npm
- PostgreSQL

## Local development

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Copy `.env.example` to `.env` and set `DATABASE_URL` and a unique,
   unpredictable `SESSION_SECRET` (at least 32 characters). Never commit `.env`.
3. Apply database migrations and generate the Prisma client:

   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

The application is available at <http://localhost:3000>. The initial staff
account is configured through `/admin/setup`.

## Production

This application requires a Node.js server; it cannot be deployed as a static
export. Configure the production environment with `DATABASE_URL` and a strong,
private `SESSION_SECRET`, then run:

```bash
npm ci
npx prisma migrate deploy
npx prisma generate
npm run build
npm run start
```

Keep PostgreSQL data and `public/uploads` on persistent storage and include them
in backups. The `private` directory and `desktop-releases` are intentionally
not tracked by Git; copy any required production assets to the host separately.
Terminate HTTPS at a trusted reverse proxy and set `SITE_URL` to the canonical
public URL when it differs from the application's default.

## Checks

```bash
npm run lint
npm run build
```
