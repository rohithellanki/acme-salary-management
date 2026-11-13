import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createDatabase } from '../server/db.js';
import { seedEmployees } from '../server/seed.js';
import { getSalaryHistory, getSummary, listEmployees, updateSalary } from '../server/service.js';

describe('salary management data services', () => {
  let directory;
  let db;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'acme-salary-test-'));
    db = createDatabase(join(directory, 'test.sqlite'));
  });

  afterEach(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('seeds the requested number of deterministic employee records', () => {
    assert.equal(seedEmployees(db, 100), 100);
    const firstSeed = db.prepare('SELECT employee_code, salary FROM employees ORDER BY id').all();
    seedEmployees(db, 100);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM employees').get().count, 100);
    assert.deepEqual(db.prepare('SELECT employee_code, salary FROM employees ORDER BY id').all(), firstSeed);
    assert.equal(new Set(firstSeed.map((employee) => employee.employee_code)).size, 100);
  });

  it('filters employees and returns bounded, stable pages', () => {
    seedEmployees(db, 480);
    const employees = listEmployees(db, { country: 'India', department: 'Engineering', page: '2', pageSize: '5' });
    assert.ok(employees.total > 5);
    assert.equal(employees.page, 2);
    assert.equal(employees.employees.length, 5);
    assert.ok(employees.employees.every((employee) => employee.country === 'India' && employee.department === 'Engineering'));
    assert.deepEqual(
      listEmployees(db, { pageSize: '5000' }).employees.length,
      100,
      'page size is capped while still returning all available rows',
    );
  });

  it('searches employee code and name and safely ignores unsupported sort columns', () => {
    seedEmployees(db, 32);
    const matching = listEmployees(db, { q: 'AC-00001', sort: 'not_a_column' });
    assert.equal(matching.total, 1);
    assert.equal(matching.employees[0].employee_code, 'AC-00001');
    assert.equal(listEmployees(db, { q: 'Morgan' }).total, 3);
  });

  it('groups payroll and average salaries by country and currency', () => {
    seedEmployees(db, 48);
    const summary = getSummary(db);
    assert.equal(summary.totalEmployees, 48);
    assert.equal(summary.payrollByCountry.length, 8);
    assert.ok(summary.payrollByCountry.every((row) => row.employee_count === 6));
    assert.ok(summary.compensationByDepartment.length > 0);
    assert.equal(summary.countries.length, 8);
    assert.equal(summary.departments.length, 6);
  });

  it('updates salary and currency atomically and records the change', () => {
    seedEmployees(db, 2);
    const employee = db.prepare('SELECT id, salary, currency FROM employees WHERE employee_code = ?').get('AC-00001');
    const changedAt = '2026-01-02T03:04:05.000Z';

    const updated = updateSalary(db, employee.id, { salary: 120_500.75, currency: 'EUR' }, () => changedAt);
    assert.equal(updated.salary, 120_500.75);
    assert.equal(updated.currency, 'EUR');
    assert.deepEqual({ ...getSalaryHistory(db, employee.id)[0] }, {
      previous_salary: employee.salary,
      previous_currency: employee.currency,
      new_salary: 120_500.75,
      new_currency: 'EUR',
      changed_at: changedAt,
    });
  });

  it('does not create history for a no-op and rejects invalid compensation values', () => {
    seedEmployees(db, 1);
    const employee = db.prepare('SELECT id, salary, currency FROM employees').get();
    assert.equal(updateSalary(db, employee.id, { salary: employee.salary, currency: employee.currency }).salary, employee.salary);
    assert.equal(getSalaryHistory(db, employee.id).length, 0);
    assert.match(updateSalary(db, employee.id, { salary: 0, currency: employee.currency }).error, /greater than 0/);
    assert.match(updateSalary(db, employee.id, { salary: 100, currency: 'XYZ' }).error, /Currency must be one of/);
    assert.equal(getSalaryHistory(db, employee.id).length, 0);
  });

  it('returns a not-found result for a missing employee', () => {
    assert.deepEqual(updateSalary(db, 999, { salary: 100, currency: 'USD' }), { notFound: true });
  });

  it('rejects invalid seed sizes rather than silently accepting them', () => {
    assert.throws(() => seedEmployees(db, -1), /non-negative integer/);
  });
});
