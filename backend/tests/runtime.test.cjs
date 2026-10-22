const assert = require('node:assert/strict');
const path = require('node:path');
const { describe, it } = require('node:test');
const { createRuntimeConfig } = require('../dist/config/runtime');

describe('createRuntimeConfig', () => {
  const backendDirectory = path.resolve('backend');

  it('usa SQLite locale e una sola origine frontend', () => {
    assert.deepEqual(createRuntimeConfig({}, backendDirectory), {
      nodeEnv: 'development', host: '127.0.0.1', port: 3000,
      timezone: 'Europe/Rome', corsOrigin: 'http://localhost:4200',
      databaseStorage: path.join(backendDirectory, 'database.sqlite')
    });
  });

  it('risolve il percorso del database dalla cartella backend', () => {
    assert.equal(createRuntimeConfig({ DB_STORAGE: './local.sqlite' }, backendDirectory).databaseStorage,
      path.resolve(backendDirectory, 'local.sqlite'));
  });

  it('consente un database in memoria', () => {
    assert.equal(createRuntimeConfig({ DB_STORAGE: ':memory:' }, backendDirectory).databaseStorage, ':memory:');
  });

  it('accetta la named pipe di IIS solo in produzione Windows', { skip: process.platform !== 'win32' }, () => {
    const pipe = String.raw`\\.\pipe\sidequest`;
    assert.equal(createRuntimeConfig({ NODE_ENV: 'production', PORT: pipe }, backendDirectory).port, pipe);
    assert.throws(() => createRuntimeConfig({ NODE_ENV: 'development', PORT: pipe }, backendDirectory), /PORT/);
    assert.throws(() => createRuntimeConfig({ NODE_ENV: 'production', PORT: pipe.replace('sidequest', '') }, backendDirectory), /PORT/);
  });

  for (const port of ['0', '-1', '65536', '3000.5', '', ' ', '3000x']) {
    it(`rifiuta una porta non valida: ${JSON.stringify(port)}`, () => {
      assert.throws(() => createRuntimeConfig({ PORT: port }, backendDirectory), /PORT/);
    });
  }

  for (const port of ['1', '65535']) {
    it(`accetta la porta limite ${port}`, () => {
      assert.equal(createRuntimeConfig({ PORT: port }, backendDirectory).port, Number(port));
    });
  }

  for (const origin of ['*', 'ftp://localhost', 'http://localhost:4200/', 'http://localhost:4200/path',
    'http://user:password@localhost:4200', 'http://localhost:4200?x=1']) {
    it(`rifiuta un'origine CORS non valida: ${origin}`, () => {
      assert.throws(() => createRuntimeConfig({ CORS_ORIGIN: origin }, backendDirectory), /CORS_ORIGIN/);
    });
  }

  it('accetta una singola origine HTTPS', () => {
    assert.equal(createRuntimeConfig({ CORS_ORIGIN: 'https://sidequest.example' }, backendDirectory).corsOrigin,
      'https://sidequest.example');
  });

  it('non dichiara un supporto PostgreSQL assente', () => {
    assert.throws(() => createRuntimeConfig({ DATABASE_URL: 'postgres://localhost/sidequest' }, backendDirectory), /SQLite/);
  });

  it('richiede il fuso Europe/Rome', () => {
    assert.throws(() => createRuntimeConfig({ TZ: 'UTC' }, backendDirectory), /Europe\/Rome/);
  });

  it('rifiuta un percorso database vuoto', () => {
    assert.throws(() => createRuntimeConfig({ DB_STORAGE: ' ' }, backendDirectory), /DB_STORAGE/);
  });

  it('rifiuta un ambiente sconosciuto', () => {
    assert.throws(() => createRuntimeConfig({ NODE_ENV: 'staging' }, backendDirectory), /NODE_ENV/);
  });

  for (const host of ['', ' ']) {
    it(`rifiuta un host vuoto: ${JSON.stringify(host)}`, () => {
      assert.throws(() => createRuntimeConfig({ HOST: host }, backendDirectory), /HOST/);
    });
  }
});
