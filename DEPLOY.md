# Deployment Guide

The KSP Crime Intelligence platform is fully containerized and production-ready.

## Prerequisites
- Docker & Docker Compose
- Ensure Ollama is running on the host machine and has the required models pulled (`qwen:3b` / `qwen3:8b` and `nomic-embed-text`). Run:
  `ollama run qwen:3b` and `ollama run nomic-embed-text`
- A `.env` file at the root of the project (copy `.env.example` to `.env` and configure `DB_PASSWORD` and `FRONTEND_ORIGIN`).

## Deploying the Stack

### 1. Configure Environment
Copy the example environment file and fill in your strong passwords:
```bash
cp .env.example .env
# Edit .env with your favorite editor
```

### 2. Stop local development servers
If you have local development servers running (e.g. `npm start` or `node server.js`), **stop them now** by pressing `Ctrl+C` in their respective terminal windows to free up the ports.

### 3. Boot the cluster
From the root of the project (`d:\flutter_projects\ksp`), run:
```bash
docker-compose up --build -d
```
The `-d` flag runs the containers in the background. 

### 3. Verification
- **Database Initialization**: The backend container will automatically wait for PostgreSQL to boot. Once connected, Knex.js will construct all the schemas and seed the database with the 12,000+ KSP dummy records.
- **Access the Platform**: Nginx exposes the React frontend directly on port 80. Open your browser and navigate to `http://localhost`.

### Troubleshooting
- To view backend logs (e.g. to verify the database seeded correctly):
  `docker-compose logs -f backend`
- If you see any errors about the port already being in use, ensure you have killed your existing local Node servers!
