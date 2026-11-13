import { withTransaction } from './db.js';

export const CURRENCIES = ['AUD', 'CAD', 'EUR', 'GBP', 'INR', 'JPY', 'SGD', 'USD'];
export const EMPLOYEE_FIELDS = [
  'id',
  'employee_code',
  'first_name',
  'last_name',
  'email',
  'country',
  'currency',
  'department',
  'job_title',
  'level',
  'salary',
];

const SORT_COLUMNS = {
  name: 'last_name',
  country: 'country',
  department: 'department',
  salary: 'salary',
  employee_code: 'employee_code',
};

function toPositiveInteger(value, fallback, maximum) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

export function getSummary(db) {
  const totalEmployees = db.prepare('SELECT COUNT(*) AS count FROM employees').get().count;
  const payrollByCountry = db.prepare(`
    SELECT country, currency, COUNT(*) AS employee_count, SUM(salary) AS total_payroll,
      ROUND(AVG(salary), 2) AS average_salary
    FROM employees
    GROUP BY country, currency
    ORDER BY country
  `).all();
  const compensationByDepartment = db.prepare(`
    SELECT department, currency, COUNT(*) AS employee_count,
      ROUND(AVG(salary), 2) AS average_salary,
      MIN(salary) AS minimum_salary, MAX(salary) AS maximum_salary
    FROM employees
    GROUP BY department, currency
    ORDER BY department, currency
  `).all();
  const countries = db.prepare('SELECT DISTINCT country FROM employees ORDER BY country').all().map((row) => row.country);
  const departments = db.prepare('SELECT DISTINCT department FROM employees ORDER BY department').all().map((row) => row.department);

  return { totalEmployees, payrollByCountry, compensationByDepartment, countries, departments };
}

export function listEmployees(db, query = {}) {
  const page = toPositiveInteger(query.page, 1, 1_000_000);
  const pageSize = toPositiveInteger(query.pageSize, 25, 100);
  const sort = SORT_COLUMNS[query.sort] ?? SORT_COLUMNS.name;
  const direction = query.direction === 'desc' ? 'DESC' : 'ASC';
  const conditions = [];
  const parameters = [];

  if (typeof query.q === 'string' && query.q.trim()) {
    const search = `%${query.q.trim()}%`;
    conditions.push('(employee_code LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)');
    parameters.push(search, search, search, search);
  }
  if (typeof query.country === 'string' && query.country) {
    conditions.push('country = ?');
    parameters.push(query.country);
  }
  if (typeof query.department === 'string' && query.department) {
    conditions.push('department = ?');
    parameters.push(query.department);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS count FROM employees ${where}`).get(...parameters).count;
  const employees = db.prepare(`
    SELECT ${EMPLOYEE_FIELDS.join(', ')} FROM employees ${where}
    ORDER BY ${sort} ${direction}, employee_code ASC
    LIMIT ? OFFSET ?
  `).all(...parameters, pageSize, (page - 1) * pageSize);

  return { employees, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

export function updateSalary(db, employeeId, payload, now = () => new Date().toISOString()) {
  const salary = Number(payload?.salary);
  const currency = payload?.currency;
  if (!Number.isFinite(salary) || salary <= 0 || salary > 100_000_000) {
    return { error: 'Salary must be greater than 0 and no more than 100,000,000.' };
  }
  if (!CURRENCIES.includes(currency)) {
    return { error: `Currency must be one of: ${CURRENCIES.join(', ')}.` };
  }

  const employee = db.prepare('SELECT id, salary, currency FROM employees WHERE id = ?').get(employeeId);
  if (!employee) return { notFound: true };

  const normalizedSalary = Math.round(salary * 100) / 100;
  if (employee.salary !== normalizedSalary || employee.currency !== currency) {
    withTransaction(db, () => {
      db.prepare('UPDATE employees SET salary = ?, currency = ? WHERE id = ?')
        .run(normalizedSalary, currency, employeeId);
      db.prepare(`
        INSERT INTO salary_history
          (employee_id, previous_salary, previous_currency, new_salary, new_currency, changed_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(employeeId, employee.salary, employee.currency, normalizedSalary, currency, now());
    });
  }

  return db.prepare(`SELECT ${EMPLOYEE_FIELDS.join(', ')} FROM employees WHERE id = ?`).get(employeeId);
}

export function getSalaryHistory(db, employeeId) {
  return db.prepare(`
    SELECT previous_salary, previous_currency, new_salary, new_currency, changed_at
    FROM salary_history WHERE employee_id = ? ORDER BY id DESC
  `).all(employeeId);
}
