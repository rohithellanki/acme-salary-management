import { useCallback, useEffect, useMemo, useState } from 'react';

const currencyNames = new Intl.DisplayNames(['en'], { type: 'currency' });

function money(value, currency, compact = false) {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 0,
  }).format(value);
}

function formatNumber(value) {
  return new Intl.NumberFormat('en').format(value);
}

async function request(path, options) {
  const response = await fetch(path, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'The request could not be completed.');
  return result;
}

function App() {
  const [summary, setSummary] = useState(null);
  const [employees, setEmployees] = useState({ employees: [], page: 1, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ search: '', country: '', department: '' });
  const [query, setQuery] = useState(filters.search);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ field: 'name', direction: 'asc' });
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState(
    () => window.location.hash === '#employees' ? 'employees' : 'overview',
  );

  useEffect(() => {
    function updateActiveSection() {
      const employeeSection = document.getElementById('employees');
      setActiveSection(
        employeeSection && employeeSection.getBoundingClientRect().top <= window.innerHeight * 0.55
          ? 'employees'
          : 'overview',
      );
    }

    window.addEventListener('scroll', updateActiveSection, { passive: true });
    window.addEventListener('resize', updateActiveSection);
    updateActiveSection();
    return () => {
      window.removeEventListener('scroll', updateActiveSection);
      window.removeEventListener('resize', updateActiveSection);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(filters.search), 250);
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '10',
        sort: sort.field,
        direction: sort.direction,
      });
      if (query.trim()) params.set('q', query.trim());
      if (filters.country) params.set('country', filters.country);
      if (filters.department) params.set('department', filters.department);
      const [nextSummary, nextEmployees] = await Promise.all([
        request('/api/summary'),
        request(`/api/employees?${params}`),
      ]);
      setSummary(nextSummary);
      setEmployees(nextEmployees);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [filters.country, filters.department, page, query, sort]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const countries = useMemo(() => summary?.payrollByCountry ?? [], [summary]);
  const largestLocation = useMemo(() => {
    const groups = summary?.payrollByCountry ?? [];
    if (!groups.length) return null;
    const largest = [...groups].sort((a, b) => b.employee_count - a.employee_count)[0];
    return largest;
  }, [summary]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  function sortBy(field) {
    setSort((current) => ({
      field,
      direction: current.field === field && current.direction === 'asc' ? 'desc' : 'asc',
    }));
    setPage(1);
  }

  async function saveSalary(employeeId, salary, currency) {
    try {
      await request(`/api/employees/${employeeId}/salary`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salary, currency }),
      });
      setSelectedEmployee(null);
      setNotice('Salary details saved and added to the change history.');
      await loadData();
    } catch (saveError) {
      throw saveError;
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="ACME home">
          <span className="brand-mark">a</span>
          <span>acme<span className="brand-dot">.</span></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          <a className={`nav-item${activeSection === 'overview' ? ' active' : ''}`} aria-current={activeSection === 'overview' ? 'location' : undefined} href="#overview" onClick={() => setActiveSection('overview')}><span className="nav-icon">◫</span> Overview</a>
          <a className={`nav-item${activeSection === 'employees' ? ' active' : ''}`} aria-current={activeSection === 'employees' ? 'location' : undefined} href="#employees" onClick={() => setActiveSection('employees')}><span className="nav-icon">♙</span> Employees</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-note"><span className="status-dot" /> Demo environment</div>
          <div className="profile">
            <div className="avatar">HR</div>
            <div><strong>HR Manager</strong><small>ACME Corporation</small></div>
            <span className="profile-menu">···</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">People <span>/</span> Compensation</div>
          <div className="topbar-actions"><span className="secure-label"><span>●</span> Synthetic data</span><button className="icon-button" aria-label="Help">?</button></div>
        </header>

        <section className="page-content" id="overview">
          <div className="page-heading" id="overview">
            <div>
              <div className="eyebrow">PEOPLE OPERATIONS <span className="eyebrow-line" /></div>
              <h1>Compensation overview</h1>
              <p className="subtitle">A clear view of how your organization pays people.</p>
            </div>
            <div className="updated-label"><span className="refresh-icon">↻</span> Live data</div>
          </div>

          {error && <div className="alert error-alert" role="alert">{error}<button onClick={loadData}>Try again</button></div>}
          {notice && <div className="alert success-alert" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}

          <section className="metrics-grid" aria-label="Organization summary">
            <article className="metric-card">
              <div className="metric-top"><span>Total employees</span><span className="metric-icon purple">♙</span></div>
              <div className="metric-value">{summary ? formatNumber(summary.totalEmployees) : '—'}</div>
              <div className="metric-foot"><span className="metric-dot" /> Across {countries.length || '—'} countries</div>
            </article>
            <article className="metric-card">
              <div className="metric-top"><span>Countries covered</span><span className="metric-icon blue">◎</span></div>
              <div className="metric-value">{summary ? formatNumber(countries.length) : '—'}</div>
              <div className="metric-foot">Local currency reporting</div>
            </article>
            <article className="metric-card">
              <div className="metric-top"><span>Largest workforce</span><span className="metric-icon orange">↗</span></div>
              <div className="metric-value metric-location">{largestLocation?.country ?? '—'}</div>
              <div className="metric-foot">{largestLocation ? `${formatNumber(largestLocation.employee_count)} employees` : 'By country'}</div>
            </article>
            <article className="metric-card">
              <div className="metric-top"><span>Departments</span><span className="metric-icon green">▥</span></div>
              <div className="metric-value">{summary ? formatNumber(summary.departments.length) : '—'}</div>
              <div className="metric-foot">Compensation groups below</div>
            </article>
          </section>

          <section className="insights-grid">
            <article className="panel payroll-panel">
              <div className="panel-heading">
                <div><h2>Payroll by location</h2><p>Annual payroll shown in each local currency</p></div>
                <span className="panel-icon">↗</span>
              </div>
              <div className="payroll-list">
                {countries.map((row) => {
                  const max = Math.max(...countries.map((item) => item.total_payroll));
                  return (
                    <div className="payroll-row" key={row.country}>
                      <div className="location-name"><span className="country-dot">{row.country.slice(0, 1)}</span><strong>{row.country}</strong><span className="location-count">{formatNumber(row.employee_count)}</span></div>
                      <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.max(3, (row.total_payroll / max) * 100)}%` }} /></div>
                      <div className="payroll-amount">{money(row.total_payroll, row.currency, true)}</div>
                    </div>
                  );
                })}
                {!countries.length && <div className="empty-state">Loading location data…</div>}
              </div>
              <div className="panel-footnote"><span className="info-icon">i</span> Payroll totals are not converted or combined across currencies.</div>
            </article>

            <article className="panel distribution-panel">
              <div className="panel-heading">
                <div><h2>Pay by department</h2><p>Average salary by department and currency</p></div>
                <button className="text-button" onClick={() => document.getElementById('employees')?.scrollIntoView({ behavior: 'smooth' })}>View team <span>→</span></button>
              </div>
              <div className="distribution-table">
                <div className="distribution-head"><span>DEPARTMENT</span><span>TEAM</span><span>AVERAGE PAY</span></div>
                {(summary?.compensationByDepartment ?? []).map((row, index) => (
                  <div className="distribution-row" key={`${row.department}-${row.currency}`}>
                    <span className="department-cell"><span className={`department-marker marker-${index % 4}`} />{row.department}<small>{currencyNames.of(row.currency)}</small></span>
                    <span className="team-count">{formatNumber(row.employee_count)}</span>
                    <span className="average-pay"><strong>{money(row.average_salary, row.currency)}</strong><small>{money(row.minimum_salary, row.currency)} – {money(row.maximum_salary, row.currency)}</small></span>
                  </div>
                ))}
                {!summary && <div className="empty-state">Loading compensation data…</div>}
              </div>
              <div className="panel-footnote"><span className="info-icon">i</span> Comparisons are separated by currency for accuracy.</div>
            </article>
          </section>

          <section className="panel employee-panel" id="employees">
            <div className="employee-panel-heading">
              <div><h2>Employee directory</h2><p>Search and manage individual compensation</p></div>
              <div className="directory-total"><span className="directory-dot" /> {formatNumber(employees.total)} employees</div>
            </div>
            <div className="filters">
              <label className="search-box"><span className="search-icon">⌕</span><input aria-label="Search employees" placeholder="Search name, email or ID..." value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} /><kbd>⌘ K</kbd></label>
              <label className="filter-select"><span className="filter-icon">⌄</span><select aria-label="Filter by country" value={filters.country} onChange={(event) => updateFilter('country', event.target.value)}><option value="">All countries</option>{(summary?.countries ?? []).map((country) => <option key={country}>{country}</option>)}</select></label>
              <label className="filter-select"><span className="filter-icon">⌄</span><select aria-label="Filter by department" value={filters.department} onChange={(event) => updateFilter('department', event.target.value)}><option value="">All departments</option>{(summary?.departments ?? []).map((department) => <option key={department}>{department}</option>)}</select></label>
            </div>
            <div className="table-scroll">
              <table>
                <thead><tr>
                  <th><button onClick={() => sortBy('name')}>EMPLOYEE <span>{sort.field === 'name' ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span></button></th>
                  <th><button onClick={() => sortBy('country')}>LOCATION <span>{sort.field === 'country' ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span></button></th>
                  <th><button onClick={() => sortBy('department')}>DEPARTMENT <span>{sort.field === 'department' ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span></button></th>
                  <th>ROLE &amp; LEVEL</th>
                  <th><button onClick={() => sortBy('salary')}>ANNUAL SALARY <span>{sort.field === 'salary' ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span></button></th>
                  <th aria-label="Actions" />
                </tr></thead>
                <tbody>
                  {employees.employees.map((employee) => (
                    <tr key={employee.employee_code}>
                      <td><div className="employee-cell"><div className="employee-avatar">{employee.first_name[0]}{employee.last_name[0]}</div><div><strong>{employee.first_name} {employee.last_name}</strong><small>{employee.employee_code} · {employee.email}</small></div></div></td>
                      <td><span className="table-country">{employee.country}</span><small className="table-currency">{employee.currency}</small></td>
                      <td>{employee.department}</td>
                      <td><span className="role-name">{employee.job_title}</span><span className="level-pill">{employee.level}</span></td>
                      <td className="salary-cell">{money(employee.salary, employee.currency)}</td>
                      <td><button className="edit-button" onClick={() => setSelectedEmployee(employee)} aria-label={`Edit salary for ${employee.first_name} ${employee.last_name}`}>Edit</button></td>
                    </tr>
                  ))}
                  {!loading && employees.employees.length === 0 && <tr><td className="no-results" colSpan="6">No employees match your search. Try another name or filter.</td></tr>}
                  {loading && employees.employees.length === 0 && <tr><td className="no-results" colSpan="6">Loading employees…</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>Showing <strong>{employees.total ? (page - 1) * 10 + 1 : 0}–{Math.min(page * 10, employees.total)}</strong> of <strong>{formatNumber(employees.total)}</strong></span>
              <div className="pagination-actions"><button disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>← <span>Previous</span></button><span className="page-number">{page}</span><button disabled={page >= employees.totalPages} onClick={() => setPage((current) => current + 1)}><span>Next</span> →</button></div>
            </div>
          </section>

          <footer className="page-footer"><span>ACME People Operations</span><span>Compensation data · Internal use only</span></footer>
        </section>
      </main>
      {selectedEmployee && <SalaryDialog employee={selectedEmployee} onClose={() => setSelectedEmployee(null)} onSave={saveSalary} />}
    </div>
  );
}

function SalaryDialog({ employee, onClose, onSave }) {
  const [salary, setSalary] = useState(String(employee.salary));
  const [currency, setCurrency] = useState(employee.currency);
  const [history, setHistory] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    request(`/api/employees/${employee.id}/history`)
      .then((result) => setHistory(result.history))
      .catch((historyError) => setError(historyError.message));
  }, [employee.employee_code]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave(employee.id, Number(salary), currency);
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="salary-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="dialog-heading"><div><div className="eyebrow">COMPENSATION RECORD</div><h2 id="dialog-title">Update salary</h2></div><button className="close-button" onClick={onClose} aria-label="Close dialog">×</button></div>
        <div className="dialog-employee"><div className="employee-avatar large">{employee.first_name[0]}{employee.last_name[0]}</div><div><strong>{employee.first_name} {employee.last_name}</strong><small>{employee.employee_code} · {employee.country}</small></div></div>
        <form onSubmit={submit}>
          <label className="form-label" htmlFor="salary">Annual salary</label>
          <div className="salary-input-row"><input id="salary" type="number" min="0.01" max="100000000" step="0.01" required value={salary} onChange={(event) => setSalary(event.target.value)} /><select aria-label="Salary currency" value={currency} onChange={(event) => setCurrency(event.target.value)}>{['AUD', 'CAD', 'EUR', 'GBP', 'INR', 'JPY', 'SGD', 'USD'].map((code) => <option key={code} value={code}>{code} — {currencyNames.of(code)}</option>)}</select></div>
          {error && <div className="dialog-error" role="alert">{error}</div>}
          <div className="dialog-actions"><button type="button" className="cancel-button" onClick={onClose}>Cancel</button><button type="submit" className="save-button" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div>
        </form>
        <div className="history-section"><h3>Recent changes</h3>{history === null ? <p className="history-empty">Loading history…</p> : history.length ? history.slice(0, 4).map((item, index) => <div className="history-row" key={`${item.changed_at}-${index}`}><span className="history-dot" /><div><strong>{money(item.previous_salary, item.previous_currency)} <span>→</span> {money(item.new_salary, item.new_currency)}</strong><small>{new Date(item.changed_at).toLocaleString()}</small></div></div>) : <p className="history-empty">No salary changes recorded yet.</p>}</div>
        <p className="dialog-footnote"><span className="info-icon">i</span> All changes are recorded for audit purposes.</p>
      </section>
    </div>
  );
}

export default App;
