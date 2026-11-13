# ACME Salary Management — Requirements

## Goal
Give ACME's HR manager a dependable web workspace to maintain salary records for 10,000 employees across countries and quickly answer questions about how the organization pays people. Replace spreadsheet-based updates and ad hoc analysis with searchable, auditable, consistently defined data.

## Users and primary workflow
The initial user is an HR manager working on a trusted internal network. They review organization-wide pay summaries, find an employee by name or ID, narrow the list by country or department, and update an employee's annual salary and currency. Salary changes are recorded with their previous and new values and a timestamp.

## Scope and features
- Seed a local relational SQLite database with 10,000 realistic, deterministic employee records spanning multiple countries, currencies, departments, and job levels.
- Provide a responsive dashboard with employee count, total annual payroll in each local currency (never add unlike currencies), average salary by country/currency, and salary distribution by department.
- Provide server-side employee search, country/department filters, sorting, and bounded pagination so the interface does not load all 10,000 records at once.
- Allow an HR manager to edit salary and currency through a validated form; show clear success/error feedback and refresh affected figures.
- Keep a salary-change history (employee, old/new salary and currency, timestamp) for traceability.
- Include automated tests for seeding, filtering/pagination, analytics, validation, and salary-history behavior; document setup, API, and operational assumptions.

## Deliberately out of scope (and why)
- Authentication, authorization, SSO, and multi-tenant access: this assessment runs as a local demonstration and has one stated persona. It must not be exposed publicly with real payroll data until identity, least-privilege access, and deployment security are added.
- Payroll execution, tax/benefit calculations, compensation recommendations, and currency conversion: these require jurisdiction-specific policy and authoritative external data; the first release manages and describes salary records only.
- Bulk imports/exports, spreadsheet parity, and employee self-service: useful follow-ups, but not necessary to validate the core searchable single-record workflow and require additional validation/privacy decisions.
- Production cloud deployment, backups, monitoring, and compliance certification: these depend on ACME infrastructure and legal requirements unavailable in this assessment. The delivered app is locally runnable and uses synthetic data only.

## Success criteria and constraints
The seed command creates exactly 10,000 records reproducibly. The HR manager can find and update a record without transferring the full dataset to the browser. Salary analytics explicitly preserve currency boundaries. Core behavior is covered by fast, deterministic tests. Backend: Node.js with SQLite; UI: React. The app is for synthetic demonstration data, not production personal or compensation data.
