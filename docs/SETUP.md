# Chess Analyzer - Setup Guide

Complete setup and configuration guide for the Chess Analyzer project.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Docker Setup](#docker-setup)
- [Local Development Setup](#local-development-setup)
- [Database Configuration](#database-configuration)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)
- [Development Workflow](#development-workflow)
- [Testing](#testing)

## Prerequisites

### Required Software

1. **Docker Desktop** (recommended) or Docker Engine + Docker Compose
   - Docker version 20.10 or higher
   - Docker Compose version 2.0 or higher
   - Install from: https://www.docker.com/products/docker-desktop/

2. **Git**
   - Install from: https://git-scm.com/downloads

3. **Node.js** (optional, for local development)
   - Version 18.x or higher
   - Install from: https://nodejs.org/

### System Requirements

- **RAM**: Minimum 4GB, recommended 8GB
- **Disk Space**: At least 2GB free space
- **OS**: Linux, macOS, or Windows 10/11 with WSL2

## Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/AndreaCadonna/chess-analyzer.git
cd chess-analyzer
```

### 2. Verify Docker Installation

```bash
# Check Docker version
docker --version

# Check Docker Compose version
docker-compose --version

# Verify Docker is running
docker ps
```

If Docker is not running, start Docker Desktop or the Docker daemon.

## Docker Setup (Recommended)

Docker setup is the recommended way to run the application as it handles all dependencies automatically.

### Quick Start

```bash
# Build and start all containers
docker-compose up --build

# Or use the npm script
npm run dev:build
```

This will start:
- **PostgreSQL** database on port 5432
- **Redis** cache on port 6379
- **Backend** API on port 3001
- **Frontend** application on port 3000

### Service Startup Order

The services start in this order:
1. PostgreSQL database (with health checks)
2. Redis cache (with health checks)
3. Backend API (waits for database and Redis to be healthy)
   - Runs `prisma generate` to generate database client
   - Runs `prisma db push` to sync database schema
   - Starts development server with hot-reload
4. Frontend application (waits for backend)
   - Starts Vite development server

### Access the Application

Once all services are running:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001/api
- **API Health Check**: http://localhost:3001/api/health

### Docker Commands

```bash
# Start services (attached mode - see logs)
docker-compose up

# Start services (detached mode - run in background)
docker-compose up -d

# Rebuild and start
docker-compose up --build

# Stop services (keeps containers)
docker-compose stop

# Stop and remove containers
docker-compose down

# Stop and remove containers + volumes (clears database)
docker-compose down -v

# View logs
docker-compose logs

# View logs for specific service
docker-compose logs backend
docker-compose logs frontend

# Follow logs in real-time
docker-compose logs -f

# Execute command in running container
docker-compose exec backend sh
docker-compose exec frontend sh

# Restart a specific service
docker-compose restart backend
```

### NPM Scripts for Docker

```bash
# Start development environment
npm run dev

# Rebuild and start
npm run dev:build

# Stop all services
npm run down
```

## Local Development Setup

If you prefer to run services locally without Docker:

### 1. Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

cd ..
```

### 2. Start PostgreSQL and Redis

You can either:
- Use Docker for just the databases:
  ```bash
  docker-compose up -d postgres redis
  ```

- Or install locally:
  - PostgreSQL 15: https://www.postgresql.org/download/
  - Redis 7: https://redis.io/download/

### 3. Configure Environment

Create `.env` file in the backend directory:

```bash
cd backend
cat > .env << EOF
NODE_ENV=development
DATABASE_URL=postgresql://postgres:password@localhost:5432/chess_analyzer
REDIS_URL=redis://localhost:6379
STOCKFISH_PATH=/usr/local/bin/stockfish
PORT=3001
EOF
```

### 4. Install Stockfish

**macOS (Homebrew)**:
```bash
brew install stockfish
```

**Ubuntu/Debian**:
```bash
sudo apt-get update
sudo apt-get install stockfish
```

**Manual Installation**:
1. Download from: https://stockfishchess.org/download/
2. Extract and place binary in `/usr/local/bin/` or update `STOCKFISH_PATH`

### 5. Setup Database

```bash
cd backend

# Generate Prisma client
npx prisma generate

# Create database and tables
npx prisma db push

# (Optional) Open Prisma Studio to view database
npx prisma studio
```

### 6. Start Development Servers

**Terminal 1 - Backend**:
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend**:
```bash
cd frontend
npm run dev
```

## Database Configuration

### Database Schema

The application uses three main tables:

1. **User** - Chess.com user accounts
2. **Game** - Imported chess games
3. **Analysis** - Move-by-move analysis results

### Prisma Commands

```bash
cd backend

# Generate Prisma client (after schema changes)
npx prisma generate

# Push schema changes to database
npx prisma db push

# Create a migration
npx prisma migrate dev --name your_migration_name

# Apply migrations in production
npx prisma migrate deploy

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Open Prisma Studio (database GUI)
npx prisma studio

# Validate schema
npx prisma validate

# Format schema file
npx prisma format
```

### Database Access

**Using Prisma Studio**:
```bash
npm run db:studio
# Opens at http://localhost:5555
```

**Using psql**:
```bash
# From host machine
psql -h localhost -p 5432 -U postgres -d chess_analyzer

# From Docker container
docker-compose exec postgres psql -U postgres -d chess_analyzer
```

**Using Database GUI Tools**:
- Connection: `postgresql://postgres:password@localhost:5432/chess_analyzer`
- Recommended tools: TablePlus, DBeaver, pgAdmin

### Database Backup and Restore

**Backup**:
```bash
docker-compose exec postgres pg_dump -U postgres chess_analyzer > backup.sql
```

**Restore**:
```bash
docker-compose exec -T postgres psql -U postgres chess_analyzer < backup.sql
```

## Environment Variables

### Backend Environment Variables

Create `backend/.env` (for local development):

```env
# Node environment
NODE_ENV=development

# Database connection
DATABASE_URL=postgresql://postgres:password@localhost:5432/chess_analyzer

# Redis connection
REDIS_URL=redis://localhost:6379

# Stockfish configuration
STOCKFISH_PATH=/usr/local/bin/stockfish

# Server configuration
PORT=3001

# Optional: Chess.com API (public API, no key required)
# Future: Add rate limiting configuration
```

### Frontend Environment Variables

Create `frontend/.env` (for local development):

```env
# API URL
VITE_API_URL=http://localhost:3001/api

# Optional: Enable polling for file watching (for some systems)
CHOKIDAR_USEPOLLING=true
```

### Docker Environment Variables

Environment variables are defined in `docker-compose.yml` for Docker setup:

**Backend**:
- `NODE_ENV=development`
- `DATABASE_URL=postgresql://postgres:password@postgres:5432/chess_analyzer`
- `REDIS_URL=redis://redis:6379`
- `STOCKFISH_PATH=/usr/local/bin/stockfish`

**Frontend**:
- `VITE_API_URL=http://localhost:3001/api`
- `CHOKIDAR_USEPOLLING=true`

## Troubleshooting

### Port Already in Use

**Error**: Port 3000, 3001, 5432, or 6379 already in use

**Solution**:
```bash
# Find process using port
lsof -i :3000
lsof -i :3001
lsof -i :5432

# Kill process (replace PID)
kill -9 <PID>

# Or change ports in docker-compose.yml
```

### Database Connection Failed

**Symptoms**: Backend fails to start with database connection error

**Solutions**:
1. Verify PostgreSQL is running:
   ```bash
   docker-compose ps postgres
   ```

2. Check database health:
   ```bash
   docker-compose exec postgres pg_isready -U postgres
   ```

3. Restart database:
   ```bash
   docker-compose restart postgres
   ```

4. Check logs:
   ```bash
   docker-compose logs postgres
   ```

### Prisma Client Not Generated

**Error**: `@prisma/client` not found or outdated

**Solution**:
```bash
cd backend
npx prisma generate

# Or rebuild backend container
docker-compose up --build backend
```

### Stockfish Not Found

**Error**: Cannot find Stockfish engine

**Solutions**:
1. **Docker**: Rebuild backend container
   ```bash
   docker-compose up --build backend
   ```

2. **Local**: Install Stockfish and update path
   ```bash
   # macOS
   brew install stockfish
   which stockfish  # Update STOCKFISH_PATH with this path

   # Ubuntu/Debian
   sudo apt-get install stockfish
   ```

### Hot Reload Not Working

**Symptoms**: Changes not reflected automatically

**Solutions**:
1. **Frontend**: Enable polling in `.env`
   ```env
   CHOKIDAR_USEPOLLING=true
   ```

2. **Backend**: Check nodemon configuration in `backend/nodemon.json`

3. **Docker volumes**: Ensure volumes are properly mounted

### Docker Build Fails

**Error**: Docker build fails with network or download errors

**Solutions**:
1. Check internet connection
2. Clear Docker cache:
   ```bash
   docker-compose down
   docker system prune -a
   docker-compose up --build
   ```

3. Check Docker disk space:
   ```bash
   docker system df
   ```

### Frontend Can't Connect to Backend

**Error**: Network errors or CORS issues

**Solutions**:
1. Verify backend is running:
   ```bash
   curl http://localhost:3001/api/health
   ```

2. Check frontend API URL:
   - Should be `http://localhost:3001/api`
   - Defined in `frontend/.env` or `docker-compose.yml`

3. Check CORS configuration in `backend/src/index.ts`

### Redis Connection Failed

**Symptoms**: Background jobs not working

**Solutions**:
1. Check Redis is running:
   ```bash
   docker-compose ps redis
   ```

2. Test Redis connection:
   ```bash
   docker-compose exec redis redis-cli ping
   # Should return: PONG
   ```

3. Restart Redis:
   ```bash
   docker-compose restart redis
   ```

## Development Workflow

### Daily Development

```bash
# 1. Start services
docker-compose up

# 2. Make code changes (files are watched and auto-reload)

# 3. View logs if needed
docker-compose logs -f backend
docker-compose logs -f frontend

# 4. Stop services when done
docker-compose down
```

### Working with Database

```bash
# View database in GUI
npm run db:studio

# After changing schema in prisma/schema.prisma
cd backend
npx prisma generate
npx prisma db push

# Or let Docker do it automatically
docker-compose restart backend
```

### Adding Dependencies

**Backend**:
```bash
cd backend
npm install <package-name>
# Rebuild container
docker-compose up --build backend
```

**Frontend**:
```bash
cd frontend
npm install <package-name>
# Rebuild container
docker-compose up --build frontend
```

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Accessing Containers

```bash
# Backend shell
docker-compose exec backend sh

# Frontend shell
docker-compose exec frontend sh

# Database shell
docker-compose exec postgres psql -U postgres -d chess_analyzer

# Redis CLI
docker-compose exec redis redis-cli
```

## Testing

### Backend Tests

```bash
cd backend

# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- userService.test.ts

# Run with coverage
npm test -- --coverage
```

### Frontend Tests

```bash
cd frontend

# Run tests (when configured)
npm test
```

### API Testing

**Using curl**:
```bash
# Health check
curl http://localhost:3001/api/health

# Create user
curl -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -d '{"chessComUsername": "magnuscarlsen", "email": "test@example.com"}'

# List users
curl http://localhost:3001/api/users
```

**Using Postman or Insomnia**:
- Import API collection
- Base URL: `http://localhost:3001/api`

## Production Deployment

### Production Build

**Frontend**:
```bash
cd frontend
npm run build
# Output in frontend/dist
```

**Backend**:
```bash
cd backend
npm run build
# Output in backend/dist
```

### Production Docker Configuration

Create `docker-compose.prod.yml`:
```yaml
version: "3.8"

services:
  # Use production-ready configurations
  # - Set NODE_ENV=production
  # - Use official images for postgres/redis
  # - Add restart policies
  # - Configure health checks
  # - Add logging
  # - Set resource limits
```

### Environment Security

For production:
1. Use strong database passwords
2. Set secure Redis configuration
3. Use environment variable secrets (not in docker-compose)
4. Configure proper CORS origins
5. Enable HTTPS/TLS
6. Add rate limiting
7. Configure monitoring and logging

## Additional Resources

- [Architecture Documentation](./ARCHITECTURE.md)
- [Project Status](./CURRENT_STATE_OF_ART.md)
- [UI Components Guide](../frontend/docs/ui_components_docs.md)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Docker Documentation](https://docs.docker.com/)
- [Stockfish Documentation](https://stockfishchess.org/download/)

## Support

For issues not covered in this guide:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review application logs
3. Open an issue on GitHub
4. Check existing documentation in `/docs`
