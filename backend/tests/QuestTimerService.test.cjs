const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { QuestTimerService } = require('../dist/services/QuestTimerService');

describe('QuestTimerService', () => {
  const service = new QuestTimerService();
  const acceptedAt = new Date('2026-10-20T08:00:00.000Z');

  it('non assegna una scadenza alle missioni ordinarie', () => {
    assert.equal(service.calculateExpirationDate('ORDINARY', acceptedAt), null);
  });

  it('calcola la durata senza modificare la data di accettazione', () => {
    const original = acceptedAt.getTime();
    assert.equal(service.calculateExpirationDate('SECRET_TIMED', acceptedAt, 1)?.toISOString(),
      '2026-10-20T08:01:00.000Z');
    assert.equal(acceptedAt.getTime(), original);
  });

  for (const duration of [undefined, 0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    it(`rifiuta una durata non valida: ${duration}`, () => {
      assert.throws(() => service.calculateExpirationDate('SECRET_TIMED', acceptedAt, duration));
    });
  }

  it('rifiuta una data di accettazione non valida', () => {
    assert.throws(() => service.calculateExpirationDate('ORDINARY', new Date(NaN)), /acceptedAt/);
  });

  it('rifiuta una scadenza fuori dai limiti di Date', () => {
    assert.throws(() => service.calculateExpirationDate('SECRET_TIMED', new Date(8_640_000_000_000_000), 1), /expiresAt/);
  });

  for (const [season, acceptance, expectedUtc, expectedLocal] of [
    ['primavera', '2027-03-28T01:50:00+01:00', '2027-03-28T01:20:00.000Z', '03:20'],
    ['autunno', '2026-10-25T02:50:00+02:00', '2026-10-25T01:20:00.000Z', '02:20']
  ]) {
    it(`mantiene la durata al cambio d'ora in ${season}`, () => {
      const deadline = service.calculateExpirationDate('SECRET_TIMED', new Date(acceptance), 30);
      assert.equal(deadline.toISOString(), expectedUtc);
      assert.equal(new Intl.DateTimeFormat('it-IT', {
        timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).format(deadline), expectedLocal);
    });
  }

  it('restituisce tempo residuo assente per una missione ordinaria', () => {
    assert.deepEqual(service.evaluateRemainingTime(null, acceptedAt),
      { isExpired: false, remainingSeconds: null });
  });

  const boundaries = [
    [-1, true, 0], [0, true, 0], [1, false, 1],
    [999, false, 1], [1000, false, 1], [1001, false, 2]
  ];
  for (const [difference, isExpired, remainingSeconds] of boundaries) {
    it(`controlla una scadenza a ${difference} ms dall'ora del server`, () => {
      assert.deepEqual(service.evaluateRemainingTime(new Date(acceptedAt.getTime() + difference), acceptedAt),
        { isExpired, remainingSeconds });
    });
  }

  it('usa l’ora server fornita a ogni valutazione', () => {
    const deadline = new Date('2026-10-20T08:01:00.000Z');
    assert.equal(service.evaluateRemainingTime(deadline, acceptedAt).remainingSeconds, 60);
    assert.equal(service.evaluateRemainingTime(deadline, deadline).isExpired, true);
  });

  it('rifiuta una scadenza non valida', () => {
    assert.throws(() => service.evaluateRemainingTime(new Date(NaN), acceptedAt), /expiresAt/);
  });

  it('rifiuta un orologio server non valido', () => {
    assert.throws(() => service.evaluateRemainingTime(null, new Date(NaN)), /serverNow/);
  });
});
