const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { PasswordService } = require('../dist/services/PasswordService');

describe('PasswordService', () => {
  const passwords = new PasswordService();
  const password = 'Una password di prova lunga';

  it('salva un hash diverso dalla password e verifica quella corretta', async () => {
    const hash = await passwords.hash(password);
    assert.notEqual(hash, password);
    assert.equal(await passwords.verify(password, hash), true);
    assert.equal(await passwords.verify('Una password sbagliata', hash), false);
  });

  it('usa un sale diverso per la stessa password', async () => {
    const first = await passwords.hash(password);
    const second = await passwords.hash(password);
    assert.notEqual(first, second);
    assert.equal(await passwords.verify(password, second), true);
  });

  it('non taglia la password a 72 byte', async () => {
    const long = 'a'.repeat(80);
    const hash = await passwords.hash(long);
    assert.equal(await passwords.verify(long, hash), true);
    assert.equal(await passwords.verify('a'.repeat(79) + 'b', hash), false);
  });

  it('preserva spazi e caratteri Unicode nella password', async () => {
    const unicode = '  Una passphrase con accènti 🌍  ';
    const hash = await passwords.hash(unicode);
    assert.equal(await passwords.verify(unicode, hash), true);
    assert.equal(await passwords.verify(unicode.trim(), hash), false);
  });

  for (const hash of ['', 'password', 'scrypt$32768$8$3$no$no', 'scrypt$999999999$8$3$no$no']) {
    it(`rifiuta un hash non valido: ${hash || '(vuoto)'}`, async () => {
      assert.equal(await passwords.verify(password, hash), false);
    });
  }
});
