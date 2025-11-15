# Chess Analyzer - Technical Architecture

Comprehensive technical documentation for the Chess Analyzer platform.

## Table of Contents

- [System Overview](#system-overview)
- [Architecture Patterns](#architecture-patterns)
- [Backend Architecture](#backend-architecture)
- [Frontend Architecture](#frontend-architecture)
- [Database Design](#database-design)
- [External Integrations](#external-integrations)
- [Real-Time Features](#real-time-features)
- [Data Flow](#data-flow)
- [Security Considerations](#security-considerations)
- [Performance Optimizations](#performance-optimizations)
- [Deployment Architecture](#deployment-architecture)

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Browser                           │
│                     (React 19 + TypeScript)                      │
└─────────────────┬───────────────────────────────────────────────┘
                  │ HTTP/HTTPS + SSE
                  │
┌─────────────────▼───────────────────────────────────────────────┐
│                      Backend API Server                          │
│                  (Express 5 + TypeScript)                        │
│  ┌────────────┬─────────────┬──────────────┬──────────────┐    │
│  │   Routes   │ Controllers │   Services   │  Middleware  │    │
│  └────────────┴─────────────┴──────────────┴──────────────┘    │
└───┬────────────┬────────────────────┬────────────────────┬──────┘
    │            │                    │                    │
    │            │                    │                    │
┌───▼────┐  ┌───▼────────┐  ┌───────▼─────────┐  ┌──────▼──────┐
│ Postgres│  │   Redis    │  │   Stockfish    │  │ Chess.com   │
│   DB    │  │  Cache +   │  │ Chess Engine   │  │     API     │
│         │  │   Queue    │  │  (UCI Proto)   │  │  (Public)   │
└─────────┘  └────────────┘  └────────────────┘  └─────────────┘
```

### Technology Stack

| Layer        | Technology                      | Purpose                           |
|--------------|---------------------------------|-----------------------------------|
| Frontend     | React 19 + TypeScript           | User interface                    |
| Build Tool   | Vite 6.3                        | Fast development and bundling     |
| Backend      | Express.js 5 + TypeScript       | REST API server                   |
| Database     | PostgreSQL 15                   | Primary data store                |
| ORM          | Prisma 6.9                      | Database access and migrations    |
| Cache/Queue  | Redis 7                         | Caching and background jobs       |
| Chess Engine | Stockfish 17.1                  | Chess analysis                    |
| Job Queue    | Bull 4.16                       | Background job processing         |
| Real-time    | Server-Sent Events (SSE)        | Live analysis updates             |
| Container    | Docker + Docker Compose         | Development and deployment        |

### Core Features

1. **User Management** - Chess.com account integration
2. **Game Import** - Bulk import from Chess.com API
3. **Chess Analysis** - Stockfish-powered move analysis
4. **Live Analysis** - Real-time position evaluation
5. **Interactive Review** - Visual game replay with analysis
6. **Performance Tracking** - Statistical insights and trends

## Architecture Patterns

### Design Principles

1. **Separation of Concerns** - Clear boundaries between layers
2. **Type Safety** - TypeScript throughout the stack
3. **Error Handling** - Comprehensive error handling at all levels
4. **Scalability** - Background jobs for heavy operations
5. **Maintainability** - Modular code with single responsibility
6. **Testability** - Services isolated for unit testing

### Layered Architecture

```
┌─────────────────────────────────────────────┐
│            Presentation Layer               │
│        (Routes + Controllers)               │
├─────────────────────────────────────────────┤
│            Business Logic Layer             │
│              (Services)                     │
├─────────────────────────────────────────────┤
│            Data Access Layer                │
│         (Prisma ORM + Models)              │
├─────────────────────────────────────────────┤
│           External Services Layer           │
│   (Stockfish, Chess.com API, Redis)        │
└─────────────────────────────────────────────┘
```

### Request Flow

```
Client Request
    ↓
Express Middleware (CORS, Helmet, Body Parser)
    ↓
Route Handler
    ↓
Controller (Request Validation)
    ↓
Service (Business Logic)
    ↓
Data Access (Prisma/External APIs)
    ↓
Response Formatting
    ↓
Client Response
```

## Backend Architecture

### Directory Structure

```
backend/src/
├── index.ts                    # Application entry point
├── config/
│   └── database.ts            # Prisma client singleton
├── routes/                    # API endpoint definitions
│   ├── health.ts             # Health check routes
│   ├── users.ts              # User CRUD routes
│   ├── games.ts              # Game management routes
│   ├── analysis.ts           # Analysis routes
│   ├── liveAnalysis.ts       # SSE routes for live analysis
│   └── chesscom.ts           # Chess.com integration routes
├── controllers/               # Request handlers
│   └── userController.ts     # User business logic
├── services/                  # Core business logic
│   ├── userService.ts        # User management
│   ├── gameService.ts        # Game operations
│   ├── analysisService.ts    # Analysis orchestration
│   ├── stockfishService.ts   # Chess engine communication
│   ├── liveAnalysisService.ts # Live analysis with SSE
│   ├── chesscomService.ts    # Chess.com API client
│   └── httpClient.ts         # Shared HTTP client
├── middleware/
│   ├── errorHandler.ts       # Global error handling
│   └── notFound.ts           # 404 handler
├── types/
│   └── chesscom.ts           # External API types
├── utils/
│   └── pgnParser.ts          # PGN file parsing
└── prisma/
    └── schema.prisma         # Database schema
```

### Core Services

#### 1. User Service (`userService.ts`)

**Responsibilities**:
- User creation and validation
- Chess.com username verification
- User lookup and deletion

**Key Methods**:
```typescript
createUser(data: CreateUserDto): Promise<User>
getUserById(id: string): Promise<User | null>
getAllUsers(): Promise<User[]>
deleteUser(id: string): Promise<void>
```

#### 2. Game Service (`gameService.ts`)

**Responsibilities**:
- Game import from Chess.com
- PGN parsing and validation
- Game storage and retrieval
- Pagination and filtering

**Key Methods**:
```typescript
importGames(userId: string, params: ImportParams): Promise<ImportResult>
getGameById(id: string): Promise<Game | null>
getAllGames(pagination: PaginationParams): Promise<PaginatedGames>
deleteGame(id: string): Promise<void>
```

#### 3. Stockfish Service (`stockfishService.ts`)

**Responsibilities**:
- UCI protocol communication
- Chess engine lifecycle management
- Multi-line position analysis (MultiPV)
- Move evaluation with multiple variations
- Health monitoring and auto-restart

**Key Features**:
- **Process Management**: Spawns and manages Stockfish process
- **UCI Protocol**: Sends commands (uci, position, go, quit)
- **MultiPV Support**: Analyzes top N variations simultaneously
- **Rate Limiting**: Limits engine updates to 5 per second (prevents UI lag)
- **Health Checks**: Periodic heartbeat validation (every 30s)
- **Auto-Restart**: Attempts restart on failure (max 3 attempts)
- **Mate Score Conversion**: Converts mate-in-N to comparable centipawn values

**Key Methods**:
```typescript
analyzePosition(fen: string, options: AnalysisOptions): Promise<PositionAnalysis>
// Returns: { lines: AnalysisLine[], timeSpent: number, ...backwards compat getters }
//   where each AnalysisLine contains:
//   - evaluation: number (centipawns)
//   - mateIn?: number
//   - bestMove: string (UCI format)
//   - pv: string[] (principal variation)
//   - depth: number
//   - multiPvIndex: number (1=best, 2=second best, etc.)
//   - nodes, nps: performance metrics

getEngineHealth(): EngineHealth
restart(): Promise<void>
shutdown(): Promise<void>
```

**UCI Communication Flow**:
```
Initialize
    → Send: uci
    ← Receive: uciok
    → Send: setoption name Threads value 2
    → Send: setoption name Hash value 128
    → Send: setoption name MultiPV value 3
    → Send: isready
    ← Receive: readyok

Analyze Position (with MultiPV=3)
    → Send: ucinewgame
    → Send: position fen <FEN>
    → Send: go depth 15
    ← Receive: info depth 1 multipv 1 score cp 25 pv e2e4
    ← Receive: info depth 1 multipv 2 score cp 20 pv d2d4
    ← Receive: info depth 1 multipv 3 score cp 15 pv g1f3
    ← Receive: info depth 2 multipv 1 score cp 30 pv e2e4 e7e5
    ...
    ← Receive: bestmove e2e4 ponder e7e5

Rate Limited Updates
    - Engine sends many info messages as depth increases
    - Service rate-limits to 5 updates/sec (200ms interval)
    - Prevents UI lag from rapid updates
```

#### 4. Analysis Service (`analysisService.ts`)

**Responsibilities**:
- Orchestrate game analysis workflow
- Parse PGN and extract positions
- Classify moves using MultiPV-based evaluation
- Store analysis results with accurate centipawn loss
- Calculate statistics (accuracy, mistakes, etc.)

**Analysis Algorithm (MultiPV-Based)**:
```typescript
1. Parse game PGN with chess.js
2. Extract move history
3. For each position:
   a. Analyze with MultiPV=3 to get top 3 engine moves
   b. Find player's move in engine lines (UCI format match)
   c. If found in top 3:
      - Calculate exact centipawn loss from best line
      - Classify based on which line (1st/2nd/3rd best)
   d. If NOT in top 3:
      - Apply player's move and analyze resulting position
      - Calculate centipawn loss from player's perspective
   e. Store analysis with accurate evaluation
4. Generate summary statistics

Performance Improvement:
- OLD: 2 analyses per move (before + after) = 2N total
- NEW: 1 analysis per move (MultiPV) + fallback only for outliers ≈ 1.1N total
- Result: ~45% faster analysis for typical games
```

**Move Classification Logic** (Player Perspective):
```typescript
// Calculate centipawn loss from player's perspective
// Stockfish evals are ALWAYS from White's perspective

if (isWhiteMove) {
  // For White: lower eval = worse position
  centipawnLoss = bestEval - playerEval
} else {
  // For Black: higher eval = worse for Black
  centipawnLoss = playerEval - bestEval
}

// Clamp to 0 minimum (can't have negative loss)
centipawnLoss = Math.max(0, centipawnLoss)

// Classify based on centipawn loss
centipawnLoss >= 300  → Blunder
centipawnLoss >= 150  → Mistake
centipawnLoss >= 50   → Inaccuracy
centipawnLoss <= 10   → Excellent
Otherwise             → Good

Examples:
  Move is 1st best (0 cp loss)   → Excellent
  Move is 2nd best (20 cp loss)  → Good
  Move is 3rd best (50 cp loss)  → Inaccuracy
  Move outside top 3 (400 cp)    → Blunder
```

#### 5. Live Analysis Service (`liveAnalysisService.ts`)

**Responsibilities**:
- Real-time position analysis via SSE
- Session management
- Concurrent analysis handling
- Resource cleanup

**Features**:
- **Server-Sent Events**: Push updates to clients
- **Session Tracking**: Manage multiple concurrent sessions
- **Graceful Shutdown**: Clean up resources on server stop
- **Error Recovery**: Handle engine failures gracefully

**SSE Message Format**:
```typescript
{
  type: 'analysis' | 'error' | 'complete',
  data: {
    evaluation: number,
    bestMove: string,
    principalVariation: string[],
    depth: number
  }
}
```

#### 6. Chess.com Service (`chesscomService.ts`)

**Responsibilities**:
- Chess.com API integration
- Player validation
- Game fetching by date range
- Rate limiting handling

**API Endpoints Used**:
- `GET /pub/player/{username}` - Validate player
- `GET /pub/player/{username}/games/{YYYY}/{MM}` - Fetch games

### Middleware Stack

#### Global Middleware (Applied to all routes)

```typescript
app.use(helmet())              // Security headers
app.use(cors())               // Cross-origin requests
app.use(express.json())       // JSON body parser
app.use(express.urlencoded()) // URL-encoded parser
```

#### Error Handling Middleware

```typescript
app.use(notFoundHandler)      // 404 handler
app.use(errorHandler)         // Global error handler
```

**Error Response Format**:
```json
{
  "error": "Error message",
  "details": "Additional details",
  "stack": "Stack trace (dev only)"
}
```

### API Design

#### RESTful Endpoints

| Method | Endpoint                  | Description                |
|--------|---------------------------|----------------------------|
| GET    | /api/health              | Health check               |
| POST   | /api/users               | Create user                |
| GET    | /api/users               | List users                 |
| GET    | /api/users/:id           | Get user                   |
| DELETE | /api/users/:id           | Delete user                |
| POST   | /api/games/import        | Import games               |
| GET    | /api/games               | List games (paginated)     |
| GET    | /api/games/:id           | Get game details           |
| DELETE | /api/games/:id           | Delete game                |
| POST   | /api/games/:id/analyze   | Start analysis             |
| GET    | /api/games/:id/analysis  | Get analysis results       |
| GET    | /api/analysis/live       | Live analysis (SSE)        |
| GET    | /api/chesscom/player/:u  | Validate Chess.com player  |
| GET    | /api/chesscom/games/:u   | Fetch Chess.com games      |

#### Request/Response Examples

**Create User**:
```http
POST /api/users
Content-Type: application/json

{
  "chessComUsername": "magnuscarlsen",
  "email": "magnus@chess.com"
}

Response 201:
{
  "id": "clx123...",
  "chessComUsername": "magnuscarlsen",
  "email": "magnus@chess.com",
  "createdAt": "2025-01-15T...",
  "updatedAt": "2025-01-15T..."
}
```

**Start Analysis**:
```http
POST /api/games/clx456.../analyze
Content-Type: application/json

{
  "depth": 20,
  "skipOpeningMoves": 5,
  "maxPositions": 100
}

Response 200:
{
  "message": "Analysis started",
  "gameId": "clx456...",
  "totalMoves": 45,
  "estimatedTime": "2-3 minutes"
}
```

**Live Analysis (SSE)**:
```http
GET /api/analysis/live?fen=<FEN>&depth=20
Accept: text/event-stream

Response (stream):
data: {"type":"analysis","data":{"evaluation":0.5,"bestMove":"e2e4"}}

data: {"type":"analysis","data":{"evaluation":0.6,"bestMove":"d2d4"}}

data: {"type":"complete","data":{"finalEval":0.5}}
```

## Frontend Architecture

### Directory Structure

```
frontend/src/
├── main.tsx                   # Application entry point
├── App.tsx                    # Root component with routing
├── pages/                     # Route-based page components
│   ├── UserManagement.tsx    # User CRUD interface
│   ├── ImportPage.tsx        # Game import interface
│   ├── GamesList.tsx         # Games list with pagination
│   └── GameAnalysisPage.tsx  # Main analysis interface
├── components/
│   ├── ui/                   # Reusable UI components
│   │   ├── Button/
│   │   ├── Alert/
│   │   ├── Modal/
│   │   ├── LoadingSpinner/
│   │   └── ProgressBar/
│   └── analysis/             # Analysis-specific components
│       ├── BoardSection/
│       ├── MoveList/
│       ├── CurrentMoveInfo/
│       ├── AnalysisSummary/
│       ├── EngineStatusPanel/
│       ├── LiveAnalysisControls/
│       └── AnalysisActions/
├── services/                  # API communication
│   ├── api.ts                # Main API client
│   └── analysisApi.ts        # Analysis endpoints
├── hooks/                     # Custom React hooks
│   └── useLiveAnalysis.ts    # Live analysis hook with SSE
├── types/
│   └── api.ts                # TypeScript interfaces
├── utils/
│   └── chessUtils.ts         # Chess utility functions
└── assets/                    # Static files
```

### Component Architecture

#### UI Component Library

All UI components follow these patterns:

1. **Type Safety**: Full TypeScript with prop interfaces
2. **Polymorphism**: Support for `as` prop to render as different elements
3. **Variants**: Multiple visual styles (primary, secondary, success, etc.)
4. **States**: Disabled, loading, active states
5. **Accessibility**: ARIA labels, keyboard navigation, focus management
6. **Composition**: Accept children and custom classNames

**Example: Button Component**
```typescript
interface ButtonProps<T extends React.ElementType = 'button'> {
  as?: T
  variant?: 'primary' | 'secondary' | 'success' | 'danger'
  size?: 'small' | 'medium' | 'large'
  loading?: boolean
  disabled?: boolean
  children: React.ReactNode
}

<Button variant="primary" size="large">
  Click Me
</Button>
```

#### Analysis Components

**BoardSection**:
- Integrates `react-chessboard` library
- Handles position display and board orientation
- Responsive sizing

**MoveList**:
- Displays game moves in table format
- Highlights current move
- Shows move evaluations and classifications
- Clickable moves for navigation

**CurrentMoveInfo**:
- Shows evaluation bar (visual representation)
- Displays current position FEN
- Shows best move suggestion
- Displays analysis depth

**AnalysisSummary**:
- Overall game statistics
- Accuracy percentages
- Mistake counts by type
- Best/worst moves

**LiveAnalysisControls**:
- Start/stop live analysis
- Depth configuration
- Multi-PV settings

### State Management

#### Local State Pattern

Uses React hooks for state management:

```typescript
// Game Analysis Page State
const [game, setGame] = useState<Game | null>(null)
const [analysis, setAnalysis] = useState<Analysis[]>([])
const [currentMove, setCurrentMove] = useState<number>(0)
const [loading, setLoading] = useState<boolean>(false)
const [error, setError] = useState<string | null>(null)
```

#### API Communication

**Centralized API Client** (`services/api.ts`):
```typescript
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Interceptors for error handling
api.interceptors.response.use(
  response => response,
  error => {
    // Global error handling
    return Promise.reject(error)
  }
)
```

**Service Functions**:
```typescript
export const gameApi = {
  importGames: (userId: string, params: ImportParams) =>
    api.post(`/games/import`, { userId, ...params }),

  getGames: (page: number, limit: number) =>
    api.get(`/games?page=${page}&limit=${limit}`),

  getGame: (id: string) =>
    api.get(`/games/${id}`),

  analyzeGame: (id: string, options: AnalysisOptions) =>
    api.post(`/games/${id}/analyze`, options)
}
```

### Routing

**React Router v7 Configuration**:
```typescript
<BrowserRouter>
  <Routes>
    <Route path="/" element={<UserManagement />} />
    <Route path="/import" element={<ImportPage />} />
    <Route path="/games" element={<GamesList />} />
    <Route path="/games/:id" element={<GameAnalysisPage />} />
  </Routes>
</BrowserRouter>
```

### Custom Hooks

#### useLiveAnalysis Hook

**Purpose**: Manage Server-Sent Events connection for live analysis

**Features**:
- Automatic connection management
- Reconnection on failure
- Message parsing
- Cleanup on unmount

**Usage**:
```typescript
const {
  data,
  error,
  isConnected,
  startAnalysis,
  stopAnalysis
} = useLiveAnalysis()

// Start live analysis for a position
startAnalysis({ fen: currentPosition, depth: 20 })

// Receive updates
useEffect(() => {
  if (data) {
    console.log('Evaluation:', data.evaluation)
    console.log('Best move:', data.bestMove)
  }
}, [data])
```

## Database Design

### Entity Relationship Diagram

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│     User     │         │     Game     │         │   Analysis   │
├──────────────┤         ├──────────────┤         ├──────────────┤
│ id (PK)      │────────<│ id (PK)      │────────<│ id (PK)      │
│ chessComUser │     1:N │ userId (FK)  │     1:N │ gameId (FK)  │
│ email        │         │ chessComGID  │         │ positionFen  │
│ createdAt    │         │ pgn          │         │ moveNumber   │
│ updatedAt    │         │ whitePlayer  │         │ playerMove   │
└──────────────┘         │ blackPlayer  │         │ evaluation   │
                          │ result       │         │ bestMove     │
                          │ timeControl  │         │ bestLine     │
                          │ whiteRating  │         │ depth        │
                          │ blackRating  │         │ severity     │
                          │ playedAt     │         │ timeSpentMs  │
                          │ importedAt   │         │ createdAt    │
                          └──────────────┘         └──────────────┘
```

### Prisma Schema

```prisma
model User {
  id               String   @id @default(cuid())
  chessComUsername String   @unique
  email            String?  @unique
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  games            Game[]
}

model Game {
  id              String     @id @default(cuid())
  userId          String
  user            User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  chessComGameId  String     @unique
  pgn             String
  whitePlayer     String
  blackPlayer     String
  result          String
  timeControl     String
  whiteRating     Int?
  blackRating     Int?
  playedAt        DateTime
  importedAt      DateTime   @default(now())
  analysis        Analysis[]

  @@index([userId])
  @@index([playedAt])
}

model Analysis {
  id                  String   @id @default(cuid())
  gameId              String
  game                Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)
  positionFen         String
  moveNumber          Int
  playerMove          String
  stockfishEvaluation Float
  bestMove            String
  bestLine            String?
  analysisDepth       Int      @default(15)
  mistakeSeverity     String   // blunder | mistake | inaccuracy | good | excellent
  timeSpentMs         Int?
  createdAt           DateTime @default(now())

  @@index([gameId])
  @@index([moveNumber])
}
```

### Database Indexes

**User Table**:
- Primary key on `id`
- Unique index on `chessComUsername`
- Unique index on `email`

**Game Table**:
- Primary key on `id`
- Unique index on `chessComGameId` (prevent duplicates)
- Index on `userId` (foreign key, frequent joins)
- Index on `playedAt` (time-based queries)

**Analysis Table**:
- Primary key on `id`
- Index on `gameId` (foreign key, frequent joins)
- Index on `moveNumber` (sequential access)

### Cascade Deletion

- Deleting a **User** deletes all their **Games**
- Deleting a **Game** deletes all its **Analysis** records

## External Integrations

### Chess.com API

**Base URL**: `https://api.chess.com/pub`

**Endpoints Used**:
```
GET /pub/player/{username}
GET /pub/player/{username}/games/{YYYY}/{MM}
```

**Features**:
- Public API (no authentication required)
- Rate limiting: ~10 requests/second
- Returns PGN format games
- Includes ratings, time controls, results

**Error Handling**:
- 404: Player not found
- 429: Rate limit exceeded
- 5xx: Chess.com server errors

### Stockfish Chess Engine

**Version**: 17.1

**Protocol**: UCI (Universal Chess Interface)

**Communication**: Standard I/O (stdin/stdout)

**Setup**:
- Docker: Downloaded and installed during image build
- Local: System package or manual installation

**UCI Commands Used**:
```
uci          - Initialize engine
isready      - Check engine ready
position fen - Set board position
go depth N   - Analyze to depth N
stop         - Stop analysis
quit         - Shutdown engine
```

**Evaluation Format**:
- Centipawns (cp): 100 = 1 pawn advantage
- Mate: Mate in N moves
- Principal Variation (PV): Best move sequence

## Real-Time Features

### Server-Sent Events (SSE)

**Why SSE over WebSockets**:
- Simpler for one-way server→client communication
- Automatic reconnection
- HTTP/HTTPS compatible
- No need for WebSocket infrastructure

**Implementation**:

**Server Side** (`liveAnalysisService.ts`):
```typescript
class LiveAnalysisService {
  private sessions: Map<string, Response> = new Map()

  createSession(res: Response, sessionId: string) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    this.sessions.set(sessionId, res)
  }

  sendUpdate(sessionId: string, data: AnalysisUpdate) {
    const res = this.sessions.get(sessionId)
    if (res) {
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    }
  }

  closeSession(sessionId: string) {
    const res = this.sessions.get(sessionId)
    if (res) {
      res.end()
      this.sessions.delete(sessionId)
    }
  }
}
```

**Client Side** (`useLiveAnalysis.ts`):
```typescript
const useLiveAnalysis = () => {
  const [data, setData] = useState(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const startAnalysis = (params: AnalysisParams) => {
    const url = `/api/analysis/live?fen=${params.fen}&depth=${params.depth}`
    const eventSource = new EventSource(url)

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      setData(data)
    }

    eventSource.onerror = () => {
      eventSource.close()
      // Implement reconnection logic
    }

    eventSourceRef.current = eventSource
  }

  const stopAnalysis = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }
  }

  useEffect(() => {
    return () => stopAnalysis()
  }, [])

  return { data, startAnalysis, stopAnalysis }
}
```

### Background Job Processing

**Bull Queue with Redis**:

```typescript
import Bull from 'bull'

const analysisQueue = new Bull('game-analysis', {
  redis: process.env.REDIS_URL
})

// Add job to queue
analysisQueue.add({
  gameId: 'clx123...',
  userId: 'user123',
  options: { depth: 20 }
}, {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000
  }
})

// Process jobs
analysisQueue.process(async (job) => {
  const { gameId, options } = job.data

  // Update progress
  job.progress(10)

  // Perform analysis
  const result = await analysisService.analyzeGame(gameId, options)

  job.progress(100)
  return result
})

// Listen for events
analysisQueue.on('completed', (job, result) => {
  console.log(`Analysis completed for ${job.data.gameId}`)
})

analysisQueue.on('failed', (job, err) => {
  console.error(`Analysis failed: ${err.message}`)
})
```

## Data Flow

### Game Import Flow

```
User enters Chess.com username and date range
    ↓
Frontend validates input
    ↓
POST /api/games/import
    ↓
Backend: ChessComService.fetchGames()
    ↓
For each game:
    - Parse PGN
    - Check if already imported (chessComGameId)
    - Create Game record
    ↓
Return import summary
    ↓
Frontend displays results and updates UI
```

### Analysis Flow

```
User clicks "Analyze Game"
    ↓
Frontend sends analysis options (depth, skipOpeningMoves, etc.)
    ↓
POST /api/games/:id/analyze
    ↓
Backend: AnalysisService.analyzeGame()
    ↓
For each move:
    1. Extract position (FEN)
    2. StockfishService.analyzePosition(fen, { depth: 15, multiPV: 3 })
       ← Returns top 3 engine moves with evaluations
    3. Find player's move in engine lines (UCI format)
    4. If found:
         - Calculate centipawn loss from best move
         - Classify based on exact loss
       Else (move not in top 3):
         - Analyze position after player's move
         - Calculate centipawn loss
    5. Create Analysis record with:
       - positionFen, moveNumber, playerMove
       - stockfishEvaluation (best move eval)
       - bestMove, bestLine (from engine)
       - mistakeSeverity, analysisDepth, timeSpentMs
    ↓
Calculate game statistics:
    - Accuracy percentages (White/Black/Overall)
    - Mistake counts (blunders/mistakes/inaccuracies)
    - Total moves analyzed
    ↓
Return completion status with summary
    ↓
Frontend polls or receives notification
    ↓
GET /api/games/:id/analysis
    ↓
Frontend displays results (board, move list, statistics)
```

### Live Analysis Flow

```
User navigates to a move
    ↓
Frontend triggers live analysis
    ↓
GET /api/analysis/live?fen=...&depth=20
    ↓
Backend creates SSE session
    ↓
StockfishService analyzes position
    ↓
Send updates via SSE:
    - Evaluation changes
    - Best move updates
    - Principal variation
    ↓
Frontend receives and displays updates in real-time
    ↓
User navigates away or stops
    ↓
Close SSE connection
```

## Security Considerations

### Current Implementation

1. **CORS**: Configured for development (localhost)
2. **Helmet**: Security headers for common vulnerabilities
3. **Input Validation**: Type checking and sanitization
4. **SQL Injection**: Prevented by Prisma ORM (parameterized queries)
5. **Error Handling**: No sensitive information in error responses

### Production Recommendations

1. **Authentication & Authorization**
   - Implement JWT-based authentication
   - Role-based access control
   - Session management

2. **Rate Limiting**
   ```typescript
   import rateLimit from 'express-rate-limit'

   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 100 // limit each IP to 100 requests per windowMs
   })

   app.use('/api/', limiter)
   ```

3. **Input Validation**
   ```typescript
   import { z } from 'zod'

   const createUserSchema = z.object({
     chessComUsername: z.string().min(3).max(50),
     email: z.string().email().optional()
   })
   ```

4. **HTTPS/TLS**
   - Force HTTPS in production
   - Secure cookies
   - HSTS headers

5. **Environment Variables**
   - Use secrets management (AWS Secrets Manager, HashiCorp Vault)
   - Never commit `.env` files
   - Rotate database passwords regularly

6. **Database Security**
   - Use connection pooling
   - Limit database user permissions
   - Enable SSL for database connections

7. **Dependency Security**
   ```bash
   npm audit
   npm audit fix
   ```

## Performance Optimizations

### Current Optimizations

1. **Database Indexes**: On foreign keys and frequently queried fields
2. **Connection Pooling**: Prisma manages connection pool
3. **Redis Caching**: For frequently accessed data
4. **Lazy Loading**: Games list pagination
5. **Docker Caching**: Multi-stage builds with layer caching

### Recommended Improvements

1. **Caching Strategy**
   ```typescript
   // Cache analysis results
   const getCachedAnalysis = async (gameId: string) => {
     const cached = await redis.get(`analysis:${gameId}`)
     if (cached) return JSON.parse(cached)

     const analysis = await db.analysis.findMany({ where: { gameId } })
     await redis.set(`analysis:${gameId}`, JSON.stringify(analysis), 'EX', 3600)
     return analysis
   }
   ```

2. **Database Query Optimization**
   ```typescript
   // Use select to limit returned fields
   const games = await db.game.findMany({
     select: {
       id: true,
       whitePlayer: true,
       blackPlayer: true,
       result: true,
       playedAt: true
     },
     where: { userId },
     orderBy: { playedAt: 'desc' },
     take: 20
   })
   ```

3. **Frontend Optimization**
   - Code splitting with React.lazy()
   - Memoization with useMemo/useCallback
   - Virtualized lists for long move lists
   - Service workers for offline support

4. **CDN for Static Assets**
   - Use CDN for chess piece images
   - Cache frontend bundle
   - Compression (gzip/brotli)

5. **Background Job Optimization**
   - Batch analysis for multiple games
   - Priority queues
   - Job result caching

## Deployment Architecture

### Development Environment

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s

  backend:
    build: ./backend
    ports:
      - "3001:3001"
    volumes:
      - ./backend:/app
      - /app/node_modules
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    depends_on:
      - backend
```

### Production Recommendations

**Infrastructure**:
- Container orchestration (Kubernetes, ECS, or Cloud Run)
- Load balancer for backend (nginx, ALB)
- CDN for frontend (CloudFront, Cloudflare)
- Managed database (RDS, Cloud SQL)
- Managed Redis (ElastiCache, Cloud Memorystore)

**Monitoring & Logging**:
- Application monitoring (Datadog, New Relic)
- Error tracking (Sentry)
- Log aggregation (ELK stack, CloudWatch)
- Performance metrics (Prometheus + Grafana)

**CI/CD Pipeline**:
```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run tests
        run: npm test

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Build images
        run: docker-compose build
      - name: Push to registry
        run: docker push ...

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: kubectl apply -f k8s/
```

**Scaling Considerations**:
- Horizontal scaling for backend (multiple instances)
- Read replicas for database
- Redis cluster for high availability
- Separate Stockfish service pool
- Job queue workers scaling

## Additional Resources

- [Setup Guide](./SETUP.md) - Installation and configuration
- [Project Status](./CURRENT_STATE_OF_ART.md) - Current development status
- [UI Components](../frontend/docs/ui_components_docs.md) - Component library
- [Prisma Documentation](https://www.prisma.io/docs) - ORM reference
- [Stockfish](https://stockfishchess.org/) - Chess engine
- [Chess.com API](https://www.chess.com/news/view/published-data-api) - Public API docs
