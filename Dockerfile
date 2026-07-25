# Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps

COPY frontend/ ./
# Build the React app (output will be in /app/frontend/build)
RUN npm run build

# Build Backend & Serve
FROM node:20-alpine
WORKDIR /app/backend

# Need build tools for sqlite3 node-gyp if prebuilt binaries are unavailable
RUN apk add --no-cache python3 make g++ 

COPY backend/package*.json ./
RUN npm install --production

COPY backend/ ./

# Copy built frontend assets into the backend's public directory
COPY --from=frontend-builder /app/frontend/build ./public

# Environment Configuration
ENV NODE_ENV=production
ENV PORT=3001
ENV FRONTEND_ORIGIN=http://localhost:3001
ENV DB_PATH=/app/data/database.sqlite

# Create volume for persistent SQLite DB
VOLUME [ "/app/data" ]

EXPOSE 3001

CMD ["node", "server.js"]
