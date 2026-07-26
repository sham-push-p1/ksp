#!/bin/bash
echo "========================================================"
echo " 🚔 KSP Crime Intelligence - Production Server (Linux/Mac) "
echo "========================================================"
echo ""

export NODE_ENV=production
export PORT=3001

echo "[1/2] Changing directory to backend..."
cd backend

echo "[2/2] Starting server..."
echo "Access the application at http://localhost:3001"
echo ""

node server.js
