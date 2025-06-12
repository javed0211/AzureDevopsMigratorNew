#!/usr/bin/env python3
"""
Simple startup script for the Python FastAPI backend
"""
import uvicorn
import sys
import os

# Add backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    print("Starting Azure DevOps Migration Tool Python Backend...")
    print("Server will be available at http://localhost:8000")
    
    uvicorn.run(
        "final_server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )