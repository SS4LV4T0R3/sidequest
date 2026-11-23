import { Sequelize } from 'sequelize';
import { Quest } from '../models/Quest';

export class QuestService {
  // Manteniamo il parametro nel costruttore per compatibilità con l'inizializzazione in app.ts,
  // anche se il modello Quest è già collegato globalmente al database.
  constructor(private sequelizeInstance?: Sequelize) {}

  /**
   * [R02] Logica per la Creazione di una nuova Missione.
   * Il metodo è diventato 'async' (restituisce una Promise) perché l'I/O sul disco
   * non deve bloccare il server Node.js.
   */
  public async createQuest(
    title: string, presentation: string, category: string, type: 'ORDINARY' | 'SECRET_TIMED', 
    creatorId: string, timeLimitSeconds?: number, lat?: number, lng?: number
  ): Promise<Quest> {
    
    // Sequelize genera UUID, createdAt, updatedAt in automatico e previene SQL injection
    const newQuest = await Quest.create({
      title,
      presentation,
      category,
      type,
      creatorId,
      timeLimitSeconds: timeLimitSeconds || null,
      latitude: lat || null,
      longitude: lng || null,
      status: 'DRAFT' // [R02] Tutte le missioni nascono come bozze
    });

    return newQuest;
  }

  /**
   * [R03] Logica per il recupero della lista missioni ordinate dalla più recente.
   */
  public async getAllQuests(): Promise<Quest[]> {
    return await Quest.findAll({ 
      order: [['createdAt', 'DESC']] 
    });
  }
}