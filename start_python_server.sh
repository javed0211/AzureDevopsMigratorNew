#!/bin/bash
# Start Python FastAPI backend as primary server

echo "Starting Python FastAPI backend..."

# Kill any existing Node.js processes
pkill -f "tsx server/index.ts" 2>/dev/null || true
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "node.*5000" 2>/dev/null || true

# Wait for processes to terminate
sleep 2

# Change to backend directory and start Python server
cd backend
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

echo "Starting uvicorn server on port 5000..."
python -m uvicorn production_main:app \
    --host 0.0.0.0 \
    --port 5000 \
    --reload \
    --log-level info