#!/bin/bash
cd backend
exec python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload --log-level info