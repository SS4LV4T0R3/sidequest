const assert = require('node:assert/strict');
const { before, after, it } = require('node:test');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { spawnSync } = require('node:child_process');

let directory, database, app, server, base, User, Session, sequelize, sessionDigest;
let explorer, second, administrator, cookie, adminCookie;
const password = 'Una passphrase per i test 2026';

async function request(method, route, body, session, extraHeaders = {}) {
  const headers = { 'X-Requested-With': 'XMLHttpRequest', ...extraHeaders };
  if (session) headers.Cookie = session;
  if (body !== undefined && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + route, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : null };
}

function cookieFrom(response) {
  return response.headers.get('set-cookie').split(';')[0];
}

async function listen() {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
}

async function closeServer() {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

function runScript(name, env = {}) {
  return spawnSync(process.execPath, [path.resolve(__dirname, `../dist/scripts/${name}.js`)], {
    env: { ...process.env, ...env }, encoding: 'utf8', windowsHide: true
  });
}

before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'sidequest-accounts-test-'));
  database = path.join(directory, 'accounts.sqlite');
  process.env.NODE_ENV = 'test';
  process.env.DB_STORAGE = database;
  process.env.TZ = 'Europe/Rome';
  process.env.CORS_ORIGIN = 'http://localhost:4200';
  delete process.env.DATABASE_URL;
  delete process.env.ADMIN_EMAIL;
  delete process.env.ADMIN_NICKNAME;
  delete process.env.ADMIN_PASSWORD;
  ({ app } = require('../dist/app'));
  ({ User, Session } = require('../dist/models'));
  ({ sequelize } = require('../dist/config/database'));
  ({ sessionDigest } = require('../dist/services/AccountService'));
  await sequelize.sync();
  await listen();
});

after(async () => {
  if (server?.listening) await closeServer();
  if (sequelize) await sequelize.close();
  if (directory) {
    assert(path.isAbsolute(directory) && directory.startsWith(path.join(tmpdir(), 'sidequest-accounts-test-')));
    await rm(directory, { recursive: true, force: true });
  }
});

it('registra un account normale e non restituisce password o hash', async () => {
  const result = await request('POST', '/api/auth/register', {
    email: '  Explorer@Example.test ', nickname: 'Explorer', password
  });
  assert.equal(result.response.status, 201);
  explorer = result.body.user;
  assert.equal(explorer.email, 'explorer@example.test');
  assert.equal(explorer.role, 'USER');
  assert.equal(explorer.isActive, true);
  assert.equal(explorer.score, 0);
  assert.equal(explorer.passwordHash, undefined);
  assert.equal(explorer.password, undefined);
  const saved = await User.findByPk(explorer.id);
  assert.match(saved.passwordHash, /^scrypt\$/);
  assert.notEqual(saved.passwordHash, password);
  assert.equal(result.response.headers.get('set-cookie'), null);
});

it('rifiuta duplicati e ruoli diversi da USER e ADMIN', async () => {
  assert.equal((await request('POST', '/api/auth/register', {
    email: 'EXPLORER@example.test', nickname: 'AltroNome', password
  })).response.status, 409);
  assert.equal((await request('POST', '/api/auth/register', {
    email: 'other@example.test', nickname: 'Explorer', password
  })).response.status, 409);
  assert.equal((await request('POST', '/api/auth/register', {
    email: 'invalid-role@example.test', nickname: 'InvalidRole', password, role: 'SUPERADMIN'
  })).response.status, 400);
  assert.equal(await User.count(), 1);
});

it('valida email, nickname, password e biografia prima di creare account', async () => {
  for (const invalid of [
    { email: 'non-email' }, { nickname: 'ab' }, { nickname: 'nome con spazi' },
    { password: 'a'.repeat(11) }, { password: 'a'.repeat(129) }, { bio: 'a'.repeat(501) },
    { role: null }, { role: 1 }, { role: '' }, { score: 100 }, { isActive: false }
  ]) {
    const result = await request('POST', '/api/auth/register', {
      email: 'invalid@example.test', nickname: 'Invalid', password, ...invalid
    });
    assert.equal(result.response.status, 400);
  }
  assert.equal(await User.count(), 1);
});

it('rifiuta credenziali errate e account inesistenti con lo stesso errore', async () => {
  const wrong = await request('POST', '/api/auth/login', { email: explorer.email, password: 'Sbagliata' });
  const missing = await request('POST', '/api/auth/login', { email: 'missing@example.test', password });
  assert.equal(wrong.response.status, 401);
  assert.equal(missing.response.status, 401);
  assert.deepEqual(wrong.body, missing.body);
});

it('crea una sessione persistente e un cookie HttpOnly', async () => {
  const result = await request('POST', '/api/auth/login', { email: explorer.email, password });
  assert.equal(result.response.status, 200);
  cookie = cookieFrom(result.response);
  const header = result.response.headers.get('set-cookie');
  assert.match(header, /HttpOnly/i);
  assert.match(header, /SameSite=Lax/i);
  assert.match(header, /Path=\//i);
  assert.match(header, /Max-Age=604800/i);
  const token = cookie.split('=')[1];
  const session = await Session.findOne();
  assert.notEqual(session.id, token);
  assert.equal(session.id, sessionDigest(token));
  assert.equal(session.userId, explorer.id);
  assert.equal(JSON.stringify(result.body).includes(token), false);
  const me = await request('GET', '/api/users/me', undefined, cookie);
  assert.equal(me.body.user.id, explorer.id);
  assert.equal(me.response.headers.get('cache-control'), 'no-store');
});

it('mantiene la sessione dopo il riavvio del processo server', async () => {
  // Un nuovo processo deve leggere lo stesso token dal database su file.
  const script = `
    const { AccountService } = require('./dist/services/AccountService');
    const { sequelize } = require('./dist/config/database');
    new AccountService().currentUser(process.env.TEST_SESSION_TOKEN)
      .then(user => console.log(user.id))
      .catch(error => { console.error(error.message); process.exitCode = 1; })
      .finally(() => sequelize.close());
  `;
  const child = spawnSync(process.execPath, ['-e', script], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, TEST_SESSION_TOKEN: cookie.split('=')[1] },
    encoding: 'utf8', windowsHide: true
  });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout.trim(), String(explorer.id));
});

it('modifica soltanto nickname e biografia del proprio profilo', async () => {
  const result = await request('PATCH', '/api/users/me', { nickname: 'ExplorerNuovo', bio: '  Una biografia  ' }, cookie);
  assert.equal(result.response.status, 200);
  assert.equal(result.body.user.bio, 'Una biografia');
  assert.equal((await User.findByPk(explorer.id)).nickname, 'ExplorerNuovo');
  for (const input of [{ role: 'ADMIN' }, { score: 9999 }, { id: 999 }, { email: 'new@example.test' }, {}]) {
    assert.equal((await request('PATCH', '/api/users/me', input, cookie)).response.status, 400);
  }
  assert.equal((await User.findByPk(explorer.id)).role, 'USER');
});

it('isola i profili e applica i vincoli di unicità anche in modifica', async () => {
  second = (await request('POST', '/api/auth/register', {
    email: 'second@example.test', nickname: 'Secondo', password
  })).body.user;
  assert.equal((await request('PATCH', '/api/users/me', { nickname: second.nickname }, cookie)).response.status, 409);
  assert.equal((await request('PATCH', `/api/users/${second.id}`, { nickname: 'Rubato' }, cookie)).response.status, 404);
  assert.equal((await User.findByPk(second.id)).nickname, 'Secondo');
});

it('nega accesso senza cookie, con token falsi o cookie duplicati', async () => {
  for (const invalidCookie of [undefined, 'sidequest_session=falso', `sidequest_session=${'a'.repeat(64)}`, `${cookie}; ${cookie}`]) {
    assert.equal((await request('GET', '/api/users/me', undefined, invalidCookie)).response.status, 401);
  }
});

it('verifica origine e header delle richieste che modificano lo stato', async () => {
  assert.equal((await request('PATCH', '/api/users/me', { bio: 'Attacco' }, cookie,
    { Origin: 'https://evil.example' })).response.status, 403);
  assert.equal((await request('PATCH', '/api/users/me', { bio: 'Attacco' }, cookie,
    { 'X-Requested-With': '' })).response.status, 403);
  assert.equal((await request('PATCH', '/api/users/me', { bio: 'Valida' }, cookie,
    { Origin: 'http://localhost:4200' })).response.status, 200);
  assert.equal((await request('PATCH', '/api/users/me', { bio: 'Attacco' }, cookie,
    { 'Sec-Fetch-Site': 'cross-site' })).response.status, 403);
  const profile = await request('GET', '/api/users/me', undefined, cookie);
  assert.equal(profile.response.status, 200);
  assert.equal(profile.response.headers.get('access-control-allow-origin'), null);
  const preflight = await request('OPTIONS', '/auth/login', undefined, undefined, {
    Origin: 'https://evil.example',
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'X-Requested-With'
  });
  assert.equal(preflight.response.headers.get('access-control-allow-origin'), null);
});

it('sostituisce il token precedente quando si effettua un nuovo login', async () => {
  const previous = cookie;
  const result = await request('POST', '/api/auth/login', { email: explorer.email, password }, previous);
  cookie = cookieFrom(result.response);
  assert.notEqual(cookie, previous);
  assert.equal((await request('GET', '/api/users/me', undefined, previous)).response.status, 401);
});

it('revoca la sessione al logout e consente di ripetere il logout', async () => {
  assert.equal((await request('POST', '/api/auth/logout', undefined, cookie)).response.status, 204);
  assert.equal((await request('GET', '/api/users/me', undefined, cookie)).response.status, 401);
  assert.equal((await request('POST', '/api/auth/logout', undefined, cookie)).response.status, 204);
});

it('riconosce una sessione scaduta secondo il tempo server', async () => {
  cookie = cookieFrom((await request('POST', '/api/auth/login', { email: explorer.email, password })).response);
  await Session.update({ expiresAt: new Date(Date.now() - 1000) }, { where: { userId: explorer.id } });
  assert.equal((await request('GET', '/api/users/me', undefined, cookie)).response.status, 401);
  assert.equal(await Session.count({ where: { userId: explorer.id } }), 0);
});

it('mantiene disponibile la creazione di un amministratore da comando', async () => {
  assert.notEqual(runScript('createAdmin').status, 0);
  const result = runScript('createAdmin', {
    ADMIN_EMAIL: 'admin@example.test', ADMIN_NICKNAME: 'Amministratore', ADMIN_PASSWORD: password
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.includes(password), false);
  administrator = await User.findOne({ where: { email: 'admin@example.test' } });
  assert.equal(administrator.role, 'ADMIN');
  adminCookie = cookieFrom((await request('POST', '/api/auth/login', { email: administrator.email, password })).response);
});

it('riserva elenco utenti e gestione degli account agli amministratori', async () => {
  cookie = cookieFrom((await request('POST', '/api/auth/login', { email: explorer.email, password })).response);
  assert.equal((await request('GET', '/api/admin/users', undefined, cookie)).response.status, 403);
  assert.equal((await request('PATCH', `/api/admin/users/${second.id}/status`, { isActive: false }, cookie)).response.status, 403);
  const result = await request('GET', '/api/admin/users?page=1&pageSize=2', undefined, adminCookie);
  assert.equal(result.response.status, 200);
  assert.equal(result.body.users.length, 2);
  assert.equal(result.body.total, 3);
  const complete = await request('GET', '/api/admin/users', undefined, adminCookie);
  assert.deepEqual(new Set(complete.body.users.map(user => user.role)), new Set(['USER', 'ADMIN']));
  assert.equal(JSON.stringify(result.body).includes('passwordHash'), false);
  assert.equal((await request('GET', '/api/admin/users?pageSize=10000', undefined, adminCookie)).response.status, 400);
});

it('consente temporaneamente la registrazione ADMIN e accetta esattamente 12 caratteri', async () => {
  const input = { email: 'temporary-admin@example.test', nickname: 'AdminTemporaneo', password: 'Abcdef123456', role: 'ADMIN' };
  const created = await request('POST', '/api/auth/register', input);
  assert.equal(created.response.status, 201);
  assert.equal(created.body.user.role, 'ADMIN');
  const login = await request('POST', '/api/auth/login', { email: input.email, password: input.password });
  assert.equal(login.response.status, 200);
  const list = await request('GET', '/api/admin/users', undefined, cookieFrom(login.response));
  assert.equal(list.response.status, 200);
  assert(list.body.users.some(user => user.id === created.body.user.id && user.role === 'ADMIN'));
  assert(list.body.users.some(user => user.role === 'USER'));
  await User.destroy({ where: { id: created.body.user.id } });
});

it('disattiva account, revoca tutte le sessioni e richiede un nuovo login dopo la riattivazione', async () => {
  const anotherCookie = cookieFrom((await request('POST', '/api/auth/login', { email: explorer.email, password })).response);
  assert.equal(await Session.count({ where: { userId: explorer.id } }), 2);
  assert.equal((await request('PATCH', `/api/admin/users/${explorer.id}/status`, { isActive: false }, adminCookie)).response.status, 200);
  assert.equal(await Session.count({ where: { userId: explorer.id } }), 0);
  assert.equal((await request('GET', '/api/users/me', undefined, cookie)).response.status, 401);
  assert.equal((await request('GET', '/api/users/me', undefined, anotherCookie)).response.status, 401);
  assert.equal((await request('POST', '/api/auth/login', { email: explorer.email, password })).response.status, 401);
  assert.equal((await request('PATCH', `/api/admin/users/${explorer.id}/status`, { isActive: true }, adminCookie)).response.status, 200);
  assert.equal((await request('GET', '/api/users/me', undefined, anotherCookie)).response.status, 401);
  assert.equal((await request('POST', '/api/auth/login', { email: explorer.email, password })).response.status, 200);
});

it('non modifica gli amministratori e valida stato e destinatario', async () => {
  assert.equal((await request('PATCH', `/api/admin/users/${administrator.id}/status`, { isActive: false }, adminCookie)).response.status, 403);
  assert.equal((await request('PATCH', '/api/admin/users/999999/status', { isActive: false }, adminCookie)).response.status, 404);
  assert.equal((await request('PATCH', `/api/admin/users/${second.id}/status`, { isActive: 'false' }, adminCookie)).response.status, 400);
});

it('gestisce registrazioni duplicate e accessi concorrenti su SQLite', async () => {
  const input = { email: 'concurrent@example.test', nickname: 'Concorrente', password };
  const registrations = await Promise.all([
    request('POST', '/api/auth/register', input), request('POST', '/api/auth/register', input)
  ]);
  assert.deepEqual(registrations.map(result => result.response.status).sort(), [201, 409]);
  const logins = await Promise.all([
    request('POST', '/api/auth/login', { email: input.email, password }),
    request('POST', '/api/auth/login', { email: input.email, password })
  ]);
  assert.deepEqual(logins.map(result => result.response.status), [200, 200]);
  assert.notEqual(cookieFrom(logins[0].response), cookieFrom(logins[1].response));
});

it('in produzione imposta Secure e il prefisso __Host- sul cookie', async () => {
  const script = `
    const { app } = require('./dist/app');
    const { sequelize } = require('./dist/config/database');
    const server = app.listen(0, '127.0.0.1', async () => {
      try {
        const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/auth/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body: JSON.stringify({email: 'explorer@example.test', password: process.env.TEST_ACCOUNT_PASSWORD})
        });
        const header = response.headers.get('set-cookie') || '';
        console.log(JSON.stringify({ status: response.status, secure: header.includes('; Secure'),
          httpOnly: header.includes('HttpOnly'), hostPrefix: header.startsWith('__Host-sidequest_session=') }));
      } catch(error) { console.error(error.message); process.exitCode = 1; }
      finally { server.close(() => sequelize.close()); }
    });
  `;
  const child = spawnSync(process.execPath, ['-e', script], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'production', TEST_ACCOUNT_PASSWORD: password },
    encoding: 'utf8', windowsHide: true
  });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), { status: 200, secure: true, httpOnly: true, hostPrefix: true });
});

it('limita i tentativi di autenticazione e restituisce Retry-After', async () => {
  let response;
  for (let attempt = 0; attempt < 41; attempt++) {
    response = (await request('POST', '/api/auth/login', {})).response;
    if (response.status === 429) break;
    assert.equal(response.status, 400);
  }
  assert.equal(response.status, 429);
  assert(Number(response.headers.get('retry-after')) > 0);
});

it('inizializza SQLite anche in produzione senza perdere gli utenti esistenti', async () => {
  const initializedFile = path.join(directory, 'initialized.sqlite');
  const initial = runScript('initDatabase', { DB_STORAGE: initializedFile });
  assert.equal(initial.status, 0, initial.stderr);
  const { Sequelize } = require('sequelize');
  const existing = new Sequelize({ dialect: 'sqlite', storage: initializedFile, logging: false });
  try {
    await existing.query(`INSERT INTO users
      (id, email, passwordHash, nickname, role, isActive, score, createdAt, updatedAt) VALUES
      (1, 'existing@example.test', 'hash-preesistente', 'Esistente', 'USER', 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
  } finally { await existing.close(); }
  const repeated = runScript('initDatabase', { DB_STORAGE: initializedFile, NODE_ENV: 'production' });
  assert.equal(repeated.status, 0, repeated.stderr);
  const check = new Sequelize({ dialect: 'sqlite', storage: initializedFile, logging: false });
  try {
    const [rows] = await check.query('SELECT email, passwordHash, isActive FROM users');
    assert.deepEqual(rows, [{ email: 'existing@example.test', passwordHash: 'hash-preesistente', isActive: 1 }]);
  } finally { await check.close(); }
  assert.equal(runScript('initDatabase', { DB_STORAGE: initializedFile }).status, 0);
});
