import { createHash, randomBytes } from 'node:crypto';
import { Op, Transaction } from 'sequelize';
import { sequelize } from '../config/database';
import { Session, User } from '../models';
import { PasswordService } from './PasswordService';

export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const transactionOptions = { type: Transaction.TYPES.IMMEDIATE };

export class AccountError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function invalid(message: string): never {
  throw new AccountError(400, 'INVALID_INPUT', message);
}

function readObject(input: unknown, allowedKeys: string[]): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('Dati della richiesta non validi.');
  const data = input as Record<string, unknown>;
  for (const key of Object.keys(data)) {
    if (!allowedKeys.includes(key)) invalid(`Campo non consentito: ${key}.`);
  }
  return data;
}

function readEmail(value: unknown): string {
  if (typeof value !== 'string') invalid('Email non valida.');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalid('Email non valida.');
  return email;
}

function readNickname(value: unknown): string {
  if (typeof value !== 'string') invalid('Nickname non valido.');
  const nickname = value.trim();
  if (!/^[\p{L}\p{N}._-]{3,50}$/u.test(nickname)) {
    invalid('Il nickname deve contenere da 3 a 50 lettere, numeri, punti, trattini o underscore.');
  }
  return nickname;
}

function readBio(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || [...value].length > 500) invalid('La biografia può contenere al massimo 500 caratteri.');
  return value.trim() || null;
}

function readPassword(value: unknown, minimumLength: number): string {
  if (typeof value !== 'string' || [...value].length < minimumLength || [...value].length > 128) {
    invalid(`La password deve contenere da ${minimumLength} a 128 caratteri.`);
  }
  return value;
}

export function sessionDigest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function userProfile(user: User) {
  return {
    id: user.id, email: user.email, nickname: user.nickname, bio: user.bio ?? null,
    role: user.role, score: user.score, isActive: user.isActive
  };
}

export class AccountService {
  private passwords = new PasswordService();

  async createUser(input: unknown, trustedRole?: 'USER' | 'ADMIN'): Promise<User> {
    const data = readObject(input, ['email', 'nickname', 'password', 'bio', 'role']);
    const email = readEmail(data.email);
    const nickname = readNickname(data.nickname);
    const password = readPassword(data.password, 12);
    const bio = data.bio === undefined ? null : readBio(data.bio);
    // Solo per le prove: prima della consegna rimuovere data.role e il selettore nel frontend.
    const role = trustedRole ?? (data.role === undefined ? 'USER' : data.role);
    if (role !== 'USER' && role !== 'ADMIN') invalid('Ruolo non valido: scegliere utente o amministratore.');
    const passwordHash = await this.passwords.hash(password);
    return User.create({ email, nickname, passwordHash, bio, role });
  }

  async login(input: unknown, previousToken: string | null) {
    const data = readObject(input, ['email', 'password']);
    const email = readEmail(data.email);
    const password = readPassword(data.password, 1);
    const user = await User.findOne({ where: { email } });
    // Anche un account inesistente esegue il calcolo costoso della password.
    let valid = false;
    if (user) valid = await this.passwords.verify(password, user.passwordHash);
    else await this.passwords.hash(password);
    if (!user || !valid || !user.isActive) {
      throw new AccountError(401, 'INVALID_CREDENTIALS', 'Email o password non corrette.');
    }

    return sequelize.transaction(transactionOptions, async (transaction) => {
      const currentUser = await User.findByPk(user.id, { transaction });
      if (!currentUser?.isActive) {
        throw new AccountError(401, 'INVALID_CREDENTIALS', 'Email o password non corrette.');
      }
      const now = new Date();
      await Session.destroy({ where: { expiresAt: { [Op.lte]: now } }, transaction });
      if (previousToken) await Session.destroy({ where: { id: sessionDigest(previousToken) }, transaction });
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
      await Session.create({ id: sessionDigest(token), userId: user.id, expiresAt }, { transaction });
      return { user: userProfile(currentUser), token, expiresAt };
    });
  }

  async currentUser(token: string | null): Promise<User> {
    if (token && /^[a-f0-9]{64}$/.test(token)) {
      const session = await Session.findByPk(sessionDigest(token));
      if (session && session.expiresAt.getTime() > Date.now()) {
        const user = await User.findByPk(session.userId);
        if (user?.isActive) return user;
      }
      if (session) await session.destroy();
    }
    throw new AccountError(401, 'AUTH_REQUIRED', 'Accesso richiesto o sessione scaduta.');
  }

  async logout(token: string | null): Promise<void> {
    if (token) await Session.destroy({ where: { id: sessionDigest(token) } });
  }

  async updateProfile(user: User, input: unknown): Promise<User> {
    const data = readObject(input, ['nickname', 'bio']);
    if (!Object.keys(data).length) invalid('Indicare almeno un campo da modificare.');
    const changes: { nickname?: string; bio?: string | null } = {};
    if (data.nickname !== undefined) changes.nickname = readNickname(data.nickname);
    if (data.bio !== undefined) changes.bio = readBio(data.bio);
    return user.update(changes);
  }

  async listUsers(page: number, pageSize: number) {
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize)
      || pageSize < 1 || pageSize > 50 || !Number.isSafeInteger((page - 1) * pageSize)) {
      invalid('Paginazione non valida: page positiva e pageSize tra 1 e 50.');
    }
    const { rows, count } = await User.findAndCountAll({
      attributes: ['id', 'email', 'nickname', 'bio', 'role', 'score', 'isActive'],
      order: [['id', 'ASC']], limit: pageSize, offset: (page - 1) * pageSize
    });
    return { users: rows.map(userProfile), total: count, page, pageSize };
  }

  async setActive(userId: number, input: unknown): Promise<User> {
    const data = readObject(input, ['isActive']);
    const isActive = data.isActive;
    if (!Number.isSafeInteger(userId) || userId < 1 || typeof isActive !== 'boolean') {
      invalid('ID utente o stato non valido.');
    }
    return sequelize.transaction(transactionOptions, async (transaction) => {
      const user = await User.findByPk(userId, { transaction });
      if (!user) throw new AccountError(404, 'USER_NOT_FOUND', 'Utente non trovato.');
      if (user.role === 'ADMIN') {
        throw new AccountError(403, 'ADMIN_PROTECTED', 'Gli account amministrativi non si modificano da questa API.');
      }
      await user.update({ isActive }, { transaction });
      if (!isActive) await Session.destroy({ where: { userId }, transaction });
      return user;
    });
  }
}
