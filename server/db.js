import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function createDatabase(databasePath = resolve('data', 'acme.sqlite')) {
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY,
      employee_code TEXT NOT NULL UNIQUE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      country TEXT NOT NULL,
      currency TEXT NOT NULL,
      department TEXT NOT NULL,
      job_title TEXT NOT NULL,
      level TEXT NOT NULL,
      salary REAL NOT NULL CHECK (salary > 0)
    );
    CREATE INDEX IF NOT EXISTS employees_country_department
      ON employees(country, department);
    CREATE INDEX IF NOT EXISTS employees_last_first
      ON employees(last_name, first_name);
    CREATE TABLE IF NOT EXISTS salary_history (
      id INTEGER PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      previous_salary REAL NOT NULL,
      previous_currency TEXT NOT NULL,
      new_salary REAL NOT NULL,
      new_currency TEXT NOT NULL,
      changed_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS salary_history_employee
      ON salary_history(employee_id, changed_at DESC);
  `);
  return db;
}

export function withTransaction(db, operation) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = operation();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
