# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chess Analyzer is a full-stack application that imports games from Chess.com, analyzes them with Stockfish 17.1 (UCI protocol), and provides interactive game review with move classification and accuracy metrics. The app streams live analysis via Server-Sent Events.

## Development Commands

### Running the full stack (Docker)
```bash
npm run dev              # docker-compose up (starts Postgres, Redis, backend, frontend)
npm run dev:build        # docker-compose up --build (rebuild containers)
npm run down             # docker-compose down
```

### Backend (from /backend)
```bash
npm run dev              # Start with nodemon hot-reload
npm run build            # TypeScript compile
npm test                 # Jest tests
npm run lint             # ESLint
```

### Frontend (from /frontend)
```bash
npm run dev              # Vite dev server
npm run build            # tsc -b && vite build
npm run lint             # ESLint
```

### Database
```bash
npm run db:migrate                                    # Run Prisma migrations
npm run db:studio                                     # Open Prisma Studio GUI
cd backend && npx prisma migrate dev --name <name>    # Create new migration
```

## Architecture

**Monorepo** with two packages (`backend/`, `frontend/`) orchestrated via Docker Compose. All services run in containers: PostgreSQL 15, Redis 7, backend (Node 18 + Stockfish binary), frontend (Node 20).

### Backend (Express.js 5.1 + TypeScript)
Layered architecture: **Routes → Controllers → Services → Prisma ORM**

Key services:
- `StockfishService` — Manages Stockfish child process, UCI protocol communication, MultiPV analysis
- `LiveAnalysisService` — Session-based real-time analysis, streams results via SSE with cleanup on disconnect
- `AnalysisService` — Orchestrates full game analysis, calculates WCL-based (Win Change Loss) accuracy scores; supports SSE-streamed progress via `/analyze/stream`
- `ChessComService` — Chess.com API integration with rate limiting
- `GameService` / `UserService` — CRUD operations through Prisma

Entry point: `backend/src/index.ts` (Express on port 3001, API prefix `/api`)

### Frontend (React 19 + Vite + TypeScript)
Page-based routing with React Router. Key patterns:
- Pages in `src/pages/`, reusable UI in `src/components/ui/`, domain components in `src/components/analysis/`
- Custom hooks (`useChessNavigation`, `useLiveAnalysis`, `useKeyboardShortcuts`, `usePagination`) extract logic from pages
- `chess.js` for client-side move validation and board state; `react-chessboard` for rendering
- Axios-based API client in `src/services/api.ts`

Frontend routes: `/` (home), `/users`, `/import/:userId`, `/games/:userId`, `/analysis/:gameId`

### Database (Prisma + PostgreSQL)
Three models in `backend/prisma/schema.prisma`:
- **User** → has many Games (identified by `chessComUsername`)
- **Game** → has many Analysis entries (stores PGN, player info, ratings)
- **Analysis** → per-move evaluation (FEN, eval score, best move, severity classification, centipawnLoss, winProbabilityLoss)

Cascade deletes: User→Games→Analysis. Schema uses `@@map` to snake_case table names.

### Real-time Communication
Live analysis uses SSE (not WebSocket). Backend creates analysis sessions, frontend connects to `/api/analysis/live/stream/:sessionId`. The `LiveAnalysisService` manages active sessions and cleans up Stockfish processes on disconnect.

## Key Technical Details

- Stockfish binary path is configured via `STOCKFISH_PATH` env var (set in docker-compose.yml)
- Backend uses `express-async-handler` for async route error handling
- Frontend Vite config proxies `/api` to backend and uses polling-based file watch for Docker compatibility
- Move severity classification: blunder, mistake, inaccuracy, good (based on centipawn loss thresholds)
- Accuracy uses Win Change Loss (WCL): win probability delta via Lichess sigmoid model, not raw ACPL
- Game analysis supports SSE streaming (`POST /api/analysis/games/:gameId/analyze/stream`) for real-time progress
- Environment: `DATABASE_URL`, `REDIS_URL`, `STOCKFISH_PATH` (backend); `VITE_API_URL` (frontend)

## Services and Ports

| Service    | Port |
|------------|------|
| Frontend   | 3000 |
| Backend    | 3001 |
| PostgreSQL | 5432 |
| Redis      | 6379 |
