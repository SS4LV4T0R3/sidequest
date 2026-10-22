export class QuestTimerService {
  private validateDate(value: Date, field: string): void {
    if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
      throw new Error(`${field} must be a valid Date`);
    }
  }

  public calculateExpirationDate(
    mode: 'ORDINARY' | 'SECRET_TIMED',
    acceptedAt: Date,
    durationMinutes?: number
  ): Date | null {
    this.validateDate(acceptedAt, 'acceptedAt');
    if (mode === 'ORDINARY') {
      return null;
    }
    if (mode !== 'SECRET_TIMED') {
      throw new Error('Unknown quest mode');
    }
    if (durationMinutes === undefined || !Number.isSafeInteger(durationMinutes) || durationMinutes <= 0) {
      throw new Error('Duration must be a positive integer for SECRET_TIMED quests');
    }
    const durationMs = durationMinutes * 60 * 1000;
    if (!Number.isSafeInteger(durationMs)) {
      throw new Error('Duration is too large');
    }
    const expiresAt = new Date(acceptedAt.getTime() + durationMs);
    this.validateDate(expiresAt, 'expiresAt');
    return expiresAt;
  }

  public evaluateRemainingTime(expiresAt: Date | null, serverNow: Date): {
    isExpired: boolean;
    remainingSeconds: number | null;
  } {
    this.validateDate(serverNow, 'serverNow');
    if (expiresAt === null) {
      return { isExpired: false, remainingSeconds: null };
    }
    this.validateDate(expiresAt, 'expiresAt');
    const diffMs = expiresAt.getTime() - serverNow.getTime();
    if (diffMs <= 0) {
      return { isExpired: true, remainingSeconds: 0 };
    }
    return {
      isExpired: false,
      remainingSeconds: Math.ceil(diffMs / 1000)
    };
  }
}
