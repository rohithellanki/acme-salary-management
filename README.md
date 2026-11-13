# ACME Salary Management

A locally runnable employee compensation workspace built with React, Node.js, and SQLite. It is designed for an HR manager maintaining synthetic salary records and reviewing pay across multiple countries without combining unlike currencies.

## Requirements

- Node.js 22.13+ (uses the built-in `node:sqlite` module)
- npm

## Run locally

```powershell
npm install
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://127.0.0.1:5173`). The API starts on `http://127.0.0.1:3001`; its first run creates `data/acme.sqlite` and seeds 10,000 synthetic employee records.

To create/recreate the deterministic 10,000-row dataset:

```powershell
npm run seed
```

Build and run the production bundle locally:

```powershell
npm run build
npm start
```

The server serves the built UI and API on port 3001. Set `PORT` to change the API port. The SQLite database is local and is excluded from Git.

## Render preview deployment

The repository includes a Render Blueprint in `render.yaml`. In Render, choose **New → Blueprint**, connect `rohithellanki/acme-salary-management`, and deploy the `acme-salary-management` service. The Blueprint builds the React UI, starts the Node API, binds to Render's public interface, and uses `/api/health` for health checks.

This assessment uses the **free preview** configuration. Its SQLite database is on ephemeral storage: employee edits and salary history may be lost after a restart, redeploy, or instance spin-down. The app seeds synthetic data again when the database is empty. Do not use this preview for real compensation data. For durable operation, use a paid instance with a persistent disk and set `DB_PATH` to a file on the mounted disk (for example `/var/data/acme.sqlite`); arrange backups and access controls before using sensitive data.

## What it does

- Browse the compensation dashboard with employee count, payroll by location/local currency, and average pay by department/currency.
- Search by employee name, email, or employee code; filter by country and department; sort and page through employee records.
- Edit an employee's salary and currency. Valid changes are stored with previous/new values and a timestamp in salary history.
- Validate inputs and show API failures in the UI.

## API

- `GET /api/summary` — organization count, payroll by country/currency, department compensation groups, and filter values.
- `GET /api/employees?page=1&pageSize=10&q=&country=&department=&sort=name&direction=asc` — filtered, sorted, bounded employee page.
- `PUT /api/employees/:id/salary` — update `{ "salary": 120000, "currency": "USD" }`.
- `GET /api/employees/:id/history` — salary change history.

## Quality checks

```powershell
npm test
npm run build
```

The fast Node test suite uses isolated temporary SQLite databases and covers repeatable seeding, search/filter/pagination, grouped compensation, salary validation, and history behavior.

## Security and deployment note

This assessment build uses synthetic data and has no authentication or authorization. The API binds to loopback by default and must not be exposed publicly or used with real employee data. Before production deployment, add organization SSO, role-based authorization, CSRF protections, secure hosting, encrypted backups, retention controls, audit access controls, and jurisdictional privacy/compliance review. No currency conversion, payroll execution, tax/benefit calculation, or external import is included.

## Assessment artifacts

- [Requirements](./requirements.md) — goal, scope, exclusions, and success criteria.
- This README — runbook, API contract, and deployment assumptions.
