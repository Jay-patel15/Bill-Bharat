# Database Migrations

This directory contains incremental database migrations for BillBharat.

## Initial Schema

The initial schema is in `../schema.sql`. Apply it once on first deployment:

```bash
node scripts/init-db.js
```

## Adding Migrations

Create migration files following this naming convention:

```
migrations/
  001_add_email_verified.sql
  002_add_invoice_currency.sql
  ...
```

Each migration file should be **idempotent** (safe to run multiple times) using
`IF NOT EXISTS`, `IF EXISTS`, and `OR REPLACE` clauses where applicable.

## Running a Migration

```bash
# Apply a specific migration
psql $DATABASE_URL -f database/migrations/001_add_email_verified.sql

# Or via the Node script (future — add to scripts/migrate.js)
node scripts/migrate.js
```

## Best Practices

- Never modify existing migration files after they have been applied to production
- Always test migrations against a copy of production data first
- Back up the database before applying migrations to production
- Use transactions (`BEGIN; ... COMMIT;`) for data-modifying migrations
