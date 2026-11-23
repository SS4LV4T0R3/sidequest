import { Router } from 'express';
import { QuestService } from '../services/QuestService';
import { requireUser, handle } from './accounts'; // [R02] Importiamo il guardiano e il gestore errori del tuo compagno
import { User } from '../models'; // [R02] Importiamo il modello User per leggere l'ID

export function questsRouter(questService: QuestService) {
  const router = Router();

  /**
   * [R02] Endpoint per creare una nuova missione.
   * Usiamo 'requireUser' per bloccare i non loggati e 'handle' per catturare gli errori asincroni.
   */
  router.post('/', requireUser, handle(async (req, res) => {
    const { title, presentation, category, type, timeLimitSeconds, latitude, longitude } = req.body;
    
    // Il tuo compagno salva i dati dell'utente loggato in res.locals.user
    const creatorUser = res.locals.user as User;
    const creatorId = String(creatorUser.id);

    if (!title || !presentation || !category || !type) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Campi obbligatori mancanti.' } });
      return;
    }

    const newQuest = await questService.createQuest(
      title, presentation, category, type, creatorId, timeLimitSeconds, latitude, longitude
    );

    res.status(201).json(newQuest);
  }));

  /**
   * [R03] Endpoint per leggere la lista delle missioni.
   */
  router.get('/', handle(async (req, res) => {
    const quests = await questService.getAllQuests();
    res.status(200).json(quests);
  }));

  return router;
}