import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createDatabase } from './db.js';
import { EMPLOYEE_COUNT, seedEmployees } from './seed.js';
import { getSalaryHistory, getSummary, listEmployees, updateSalary } from './service.js';

const db = createDatabase();
const existingCount = db.prepare('SELECT COUNT(*) AS count FROM employees').get().count;
if (existingCount === 0) seedEmployees(db, EMPLOYEE_COUNT);

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

async function handleApi(request, response, url) {
  if (request.method === 'GET' && url.pathname === '/api/summary') {
    sendJson(response, 200, getSummary(db));
    return true;
  }
  if (request.method === 'GET' && url.pathname === '/api/employees') {
    sendJson(response, 200, listEmployees(db, Object.fromEntries(url.searchParams)));
    return true;
  }

  const historyMatch = url.pathname.match(/^\/api\/employees\/(\d+)\/history$/);
  if (request.method === 'GET' && historyMatch) {
    const id = Number(historyMatch[1]);
    if (!db.prepare('SELECT 1 FROM employees WHERE id = ?').get(id)) {
      sendJson(response, 404, { error: 'Employee not found.' });
    } else {
      sendJson(response, 200, { history: getSalaryHistory(db, id) });
    }
    return true;
  }

  const salaryMatch = url.pathname.match(/^\/api\/employees\/(\d+)\/salary$/);
  if (request.method === 'PUT' && salaryMatch) {
    let payload;
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 10_000) {
          sendJson(response, 413, { error: 'Request body is too large.' });
          return true;
        }
        chunks.push(chunk);
      }
      payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch (error) {
      if (error instanceof SyntaxError) {
        sendJson(response, 400, { error: 'Request body must be valid JSON.' });
        return true;
      }
      throw error;
    }

    const result = updateSalary(db, Number(salaryMatch[1]), payload);
    if (result.notFound) sendJson(response, 404, { error: 'Employee not found.' });
    else if (result.error) sendJson(response, 400, { error: result.error });
    else sendJson(response, 200, { employee: result });
    return true;
  }

  if (url.pathname.startsWith('/api/')) {
    sendJson(response, 404, { error: 'API route not found.' });
    return true;
  }
  return false;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  try {
    if (await handleApi(request, response, url)) return;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendJson(response, 405, { error: 'Method not allowed.' });
      return;
    }

    const dist = resolve('dist');
    const requestedPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const filePath = resolve(dist, `.${requestedPath}`);
    if (!filePath.startsWith(`${dist}${sep}`) || !existsSync(filePath)) {
      const indexPath = resolve(dist, 'index.html');
      if (!existsSync(indexPath)) {
        sendJson(response, 404, { error: 'Built UI not found. Run npm run build first.' });
        return;
      }
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      createReadStream(indexPath).pipe(response);
      return;
    }

    response.writeHead(200, { 'Content-Type': mimeTypes[extname(filePath)] ?? 'application/octet-stream' });
    if (request.method === 'HEAD') response.end();
    else createReadStream(filePath).pipe(response);
  } catch (error) {
    console.error('Request failed:', error);
    if (!response.headersSent) sendJson(response, 500, { error: 'An unexpected server error occurred.' });
    else response.destroy(error);
  }
});

const port = Number(process.env.PORT ?? 3001);
server.listen(port, '127.0.0.1', () => {
  console.log(`ACME salary API available at http://127.0.0.1:${port}`);
  console.log(`Database contains ${existingCount || EMPLOYEE_COUNT} employee records.`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.on('uncaughtException', (error) => {
    console.error('Uncaught server error:', error);
    process.exitCode = 1;
    shutdown();
  });
}
