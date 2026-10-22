import { sequelize } from '../config/database';
import { AccountService } from '../services/AccountService';

async function createAdmin(): Promise<void> {
  try {
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_NICKNAME || !process.env.ADMIN_PASSWORD) {
      throw new Error('Impostare ADMIN_EMAIL, ADMIN_NICKNAME e ADMIN_PASSWORD prima di eseguire il comando.');
    }
    const user = await new AccountService().createUser({
      email: process.env.ADMIN_EMAIL,
      nickname: process.env.ADMIN_NICKNAME,
      password: process.env.ADMIN_PASSWORD
    }, 'ADMIN');
    console.log(`Amministratore creato: ${user.email}`);
  } finally {
    await sequelize.close();
  }
}

createAdmin().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Creazione amministratore non riuscita.');
  process.exitCode = 1;
});
