#!/usr/bin/env python3
"""
Production-ready Python FastAPI backend for Azure DevOps Migration Tool
"""
import os
import sys
import subprocess
from pathlib import Path

def start_backend():
    """Start the Python FastAPI backend with proper environment"""
    print("Starting Python FastAPI Backend on port 5000")
    
    # Set environment variables
    env = os.environ.copy()
    env['PORT'] = '5000'
    env['PYTHONPATH'] = str(Path.cwd())
    
    # Start the backend
    result = subprocess.run([
        sys.executable, 'backend/main.py'
    ], env=env)
    
    return result.returncode

if __name__ == "__main__":
    exit_code = start_backend()
    sys.exit(exit_code)