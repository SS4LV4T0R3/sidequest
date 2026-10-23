# SideQuest — Progetto UniNA
Applicazione web full-stack per la creazione, l'esplorazione e il completamento di missioni territoriali ed esperienze a tempo limitato.

Progetto integrato per gli insegnamenti di **Tecnologie Web** e **Ingegneria del Software** del Corso di Laurea Triennale in Informatica dell'**Università degli Studi di Napoli Federico II (UniNA)**, A.A. 2026/2027.

---

## Dettagli del Progetto
- **ID Gruppo:** `24`
- **Componenti:**
  - Salvatore Starita
  - Andrea Pirozzi
- **Requisiti:**
  - **Nucleo Funzionale Comune:** `R01` – `R06`
  - **Pacchetto Assegnato:** **Pacchetto E — Esplorazione Avanzata** (`R19` – `R21`)
- **Indirizzo Pubblico (Tramite Microsoft Azure):** [sidequest-unina.azurewebsites.net](https://sidequest-unina.azurewebsites.net)

---

## Stack Tecnologico (Provvisorio)

| Parte | Tecnologie e utilizzo |
| :--- | :--- |
| Frontend | Angular e TypeScript, con interfaccia adatta a PC e smartphone |
| Backend | Node.js, Express e TypeScript |
| Database | SQLite con Sequelize ORM |
| Mappe | Leaflet + OpenStreetMap, da integrare |
| Orario | Fuso orario `Europe/Rome`; controlli delle scadenze sul server |

### Test e qualità

| Strumento | Stato |
| :--- | :--- |
| Node.js Test Runner | Test unitari e di integrazione HTTP presenti nel backend |
| Playwright | Test automatici nel browser da implementare |
| SonarQube | Configurazione predisposta; analisi da eseguire |

## Struttura del repository

```text
sidequest/
├── .github/
│   └── workflows/    # Controlli e pubblicazione automatica
├── backend/
│   ├── src/         # API, servizi, modelli e configurazione
│   └── tests/       # Test del backend
├── frontend/
│   ├── public/      # Favicon e file statici
│   └── src/         # Interfaccia Angular
├── e2e/             # Test End-to-End automatici con Playwright
└── scripts/         # Preparazione del pacchetto Azure
```

La cartella `e2e/` è prevista per i test Playwright; finché è vuota non viene inclusa da Git.

---

## Pubblicazione su Azure

Il sito gira su **Azure App Service**, con piano **Windows F1 gratuito**.

| Risorsa | Nome | A cosa serve |
| :--- | :--- | :--- |
| Gruppo di risorse | `rg-sidequest-unina` | Contenitore delle risorse Azure del progetto |
| Piano App Service | `sidequest-app-plan` | Fornisce le risorse per eseguire il sito |
| App Service | `sidequest-unina` | Ospita il backend, i file del frontend e SQLite |

Express gestisce il backend e invia al browser i file di Angular. Angular mostra le pagine e comunica con le API. I controlli su password, sessioni e ruoli avvengono sul server.

### Database

| Ambiente | Percorso del database |
| :--- | :--- |
| Azure | `D:\home\data\database.sqlite` |

### Aggiornamento del sito

A ogni push su `main`, il workflow `.github/workflows/main_sidequest-unina.yml` avvia GitHub Actions:

1. Installa le dipendenze di backend e frontend.
2. Esegue i test backend e controlla il frontend.
3. Compila il progetto e prepara lo ZIP con `scripts/package-azure.ps1`.
4. Accede ad Azure tramite un'identità gestita e pubblica il pacchetto.

**Se i controlli o la compilazione falliscono, la pubblicazione non parte.** L'esito si vede nella scheda **Actions** del repository.
