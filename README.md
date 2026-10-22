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
- **Front-end:** Angular (Single Page Application responsive) e TypeScript. Mappa interattiva prevista con Leaflet + OpenStreetMap.
- **Back-end:** Node.js ed Express con TypeScript.
- **Database:** SQLite gestito tramite Sequelize ORM, sia in locale sia online su Azure.
- **Fuso Orario:** `Europe/Rome`. Scadenza e controllo dei timer gestiti esclusivamente dal server.
- **Testing & Qualità:**
  - Node.js Test Runner integrato per test unitari e di integrazione HTTP.
  - Test End-to-End automatici con Playwright previsti, ancora da implementare.
  - Configurazione SonarQube predisposta; analisi statica del back-end da eseguire.

---

## Struttura del Repository
```text
sidequest/
├── backend/       # Server Express + TypeScript (routes, services, models)
│   ├── src/       # Sorgenti dell'applicazione e configurazione
│   └── tests/     # Suite test con Node.js Test Runner
├── frontend/      # Single Page Application in Angular
│   └── src/       # Componenti, servizi e layout responsive
├── e2e/           # Test End-to-End automatici con Playwright
└── scripts/       # Preparazione del pacchetto per Azure
```