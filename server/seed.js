import { createDatabase, withTransaction } from './db.js';
import { pathToFileURL } from 'node:url';

export const EMPLOYEE_COUNT = 10_000;

const locations = [
  { country: 'United States', currency: 'USD' },
  { country: 'United Kingdom', currency: 'GBP' },
  { country: 'Germany', currency: 'EUR' },
  { country: 'India', currency: 'INR' },
  { country: 'Canada', currency: 'CAD' },
  { country: 'Australia', currency: 'AUD' },
  { country: 'Singapore', currency: 'SGD' },
  { country: 'Japan', currency: 'JPY' },
];
const departments = ['Engineering', 'Finance', 'People', 'Product', 'Sales', 'Operations'];
const titles = ['Analyst', 'Associate', 'Manager', 'Senior Manager', 'Director', 'Specialist'];
const levels = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'];
const firstNames = ['Alex', 'Amara', 'Avery', 'Casey', 'Dev', 'Jamie', 'Jordan', 'Kai', 'Morgan', 'Riley'];
const lastNames = ['Bennett', 'Chen', 'Garcia', 'Ibrahim', 'Kim', 'Patel', 'Singh', 'Taylor', 'Wilson', 'Young'];
const salaryBands = {
  USD: [52_000, 225_000],
  GBP: [36_000, 155_000],
  EUR: [42_000, 175_000],
  INR: [900_000, 4_000_000],
  CAD: [68_000, 205_000],
  AUD: [72_000, 215_000],
  SGD: [58_000, 185_000],
  JPY: [5_500_000, 22_000_000],
};

function employeeAt(index) {
  const location = locations[index % locations.length];
  const [minimum, maximum] = salaryBands[location.currency];
  const salary = minimum + ((index * 7919) % (maximum - minimum + 1));
  const firstName = firstNames[(index * 7) % firstNames.length];
  const lastName = lastNames[(index * 3) % lastNames.length];

  return {
    employee_code: `AC-${String(index + 1).padStart(5, '0')}`,
    first_name: firstName,
    last_name: lastName,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${index + 1}@acme.example`,
    country: location.country,
    currency: location.currency,
    department: departments[(Math.floor(index / locations.length) * 5) % departments.length],
    job_title: titles[(index * 11) % titles.length],
    level: levels[(index * 13) % levels.length],
    salary,
  };
}

export function seedEmployees(db, count = EMPLOYEE_COUNT) {
  if (!Number.isInteger(count) || count < 0) {
    throw new TypeError('Employee count must be a non-negative integer.');
  }

  const clear = db.prepare('DELETE FROM employees');
  const clearHistory = db.prepare('DELETE FROM salary_history');
  const insert = db.prepare(`
    INSERT INTO employees
      (employee_code, first_name, last_name, email, country, currency, department, job_title, level, salary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  withTransaction(db, () => {
    clearHistory.run();
    clear.run();
    for (let index = 0; index < count; index += 1) {
      const employee = employeeAt(index);
      insert.run(
        employee.employee_code,
        employee.first_name,
        employee.last_name,
        employee.email,
        employee.country,
        employee.currency,
        employee.department,
        employee.job_title,
        employee.level,
        employee.salary,
      );
    }
  });
  return count;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = createDatabase();
  const count = seedEmployees(db);
  console.log(`Seeded ${count.toLocaleString()} employees.`);
  db.close();
}
