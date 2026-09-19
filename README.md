# KickerLiga

KickerLiga is a web app for the table football league of our faculty. Players are registered,
matches are recorded with their final score, and every match updates the Elo ratings of the
players. A ranking shows who is currently on top.

This repository is the running example of the module "AI in Software Development"
(Hochschule Hannover, WS 2026/27). Every lecture starts from a Git tag (`vl01` to `vl12`).
Tag `vl01` contains the project setup only: no features, no tests, no agent configuration.

## Stack

React 19, TypeScript (strict), Vite, Tailwind CSS v4, react-router-dom 7, supabase-js v2,
Vitest, ESLint 9. The backend is a Supabase cloud project; there is no application server.

## Setup

    npm install
    cp .env.example .env.local   # then fill in URL and anon key of your Supabase project
    npm run dev

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | development server |
| `npm run build` | type check and production build |
| `npm run typecheck` | type check only |
| `npm run lint` | ESLint |
| `npm test` | Vitest, single run |

## Licence

MIT
