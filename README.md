# SchemElect

Éditeur **web** de schémas électriques d'armoires (GTB / chaufferie) pour la S.A.R.L Dumortier.
Le schéma est un **modèle de données** : repères, renvois, numéros de fils, borniers et
nomenclature sont calculés, jamais ressaisis.

Application **SvelteKit** (Svelte 5, TypeScript) servie par Node, base **SQLite (libSQL) +
Drizzle**, déployée sur un serveur interne multi-postes : comptes simples, verrou d'édition par
projet (un seul éditeur à la fois, les autres en lecture seule).

## Installation locale

```sh
cp .env.example .env      # DATABASE_URL=file:local.db
npm install && npm run dev
```

Ouvrir <http://127.0.0.1:5300> (port fixe, voir `vite.config.ts`). La base et ses tables sont créées automatiquement.

**Premier lancement** : sans aucun compte, l'application redirige vers `/setup` pour créer
l'administrateur. Celui-ci crée ensuite les autres comptes dans **Utilisateurs**.
Le bouton **Projet de démonstration** crée un dossier d'exemple pour découvrir l'éditeur.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` / `npm run preview` | build de production (adapter-node) / aperçu |
| `npm test` | tests unitaires (Vitest) |
| `npm run test:e2e` | tests de bout en bout (Playwright + Edge, base jetable) |
| `npm run check` | vérification des types (svelte-check) |
| `npm run lint` / `npm run format` | Prettier + ESLint |
| `npm run db:studio` | explorer la base (drizzle-kit) |
| `npm run db:generate` / `db:migrate` / `db:push` | migrations drizzle-kit (optionnel : le serveur crée les tables seul) |

## Déploiement (Docker)

```sh
# Adapter ORIGIN dans docker-compose.yml (URL exacte utilisée par les postes)
docker compose up -d --build
```

- Écoute sur le port **3000** ; la base est dans `./data/schemelect.db` (volume `./data:/app/data`)
  — **sauvegarder ce dossier**.
- Variables : `DATABASE_URL`, `ORIGIN` (obligatoire pour les formulaires), `BODY_SIZE_LIMIT`
  (défaut 50M dans l'image), `COOKIE_SECURE` (automatique si `ORIGIN` est en `https://`).
  Voir `.env.example`.
- Mise à jour : `docker compose up -d --build` (les tables manquantes sont créées au démarrage).
- Sans Docker : `npm ci && npm run build && npm prune --omit=dev`, puis
  `DATABASE_URL=file:/chemin/schemelect.db ORIGIN=http://serveur:3000 node build`.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — ce qui est implémenté (à lire en premier)
- [`docs/SYMBOLES.md`](docs/SYMBOLES.md) — bibliothèque de symboles
- [`docs/CDC.md`](docs/CDC.md) — cahier des charges
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — phases de développement
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — décisions techniques
- [`docs/REFERENCE-EXEMPLE.md`](docs/REFERENCE-EXEMPLE.md) — conventions du dossier WinRelais de référence
- [`docs/JOURNAL.md`](docs/JOURNAL.md) — journal des sessions
