# Infrastructure Implementation

## Docker Compose Setup

The infrastructure is organized in the `infra/` directory with the following components:

### Services

**API Service** (`api`)
- Built from `../backend` with `Dockerfile.api`
- Port: 8000
- Environment variables loaded from `.env`
- Depends on: `db`, `redis`
- Volume mount for development: `../backend:/app`
- Health check: `curl -f http://localhost:8000/healthz`

**Web Frontend** (`web`)
- Built from `../frontend` with `Dockerfile.web`
- Port: 3000
- Node.js volume optimization: `/app/node_modules`
- Depends on: `api`

**Web Admin** (`web-admin`)
- Built from `../frontend-admin` with `Dockerfile.web-admin`
- Port: 3001
- Uses PNPM package manager
- Depends on: `api`

**Database** (`db`)
- PostgreSQL 15 Alpine
- Internal port: 5432 (not exposed externally)
- Persistent volume: `postgres_data`
- Initialization script: `./init.sql`
- Health check: `pg_isready`

**Redis Cache** (`redis`)
- Redis 7 Alpine
- Port: 6380 (mapped from 6379)
- Persistent volume: `redis_data`
- Health check: `redis-cli ping`

### Dockerfiles

**Backend (Dockerfile.api)**
- Base: `python:3.11-slim`
- Security: Non-root user `curestry`
- Dependencies: `requirements.txt` cached layer
- Health check integrated
- Optimized for production deployment

**Frontend (Dockerfile.web)**
- Base: `node:18-alpine`
- Package manager: npm
- Development-focused with hot reload

**Admin Frontend (Dockerfile.web-admin)**
- Base: `node:18-alpine`
- Package manager: pnpm
- Separate service for admin interface

### Environment Configuration

Key environment variables:
- Database: `POSTGRES_*`, `DATABASE_URL`
- Redis: `REDIS_URL`
- OpenAI: `OPENAI_API_KEY`, model configurations
- Application: `ENV`, `LOG_LEVEL`
- Frontend: `NEXT_PUBLIC_API_BASE`

### Development Workflow

```bash
# Start services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down

# Check status
docker compose ps
```

Windows batch commands available via `dev.bat` for easier management.

### Production Considerations

- Security: Non-root containers, no exposed database ports
- Persistence: Named volumes for data
- Health checks: All services monitored
- Logging: JSON structured logs from backend
- Scalability: Services can be scaled independently
