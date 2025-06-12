#!/usr/bin/env python3
"""
Start Python FastAPI backend as the primary server
"""
import os
import sys
import subprocess
import signal
import time

def start_python_backend():
    """Start the Python FastAPI backend"""
    print("Starting Python FastAPI backend...")
    
    # Change to backend directory
    backend_dir = os.path.join(os.path.dirname(__file__), 'backend')
    os.chdir(backend_dir)
    
    # Start uvicorn server
    cmd = [
        sys.executable, '-m', 'uvicorn', 
        'main:app', 
        '--host', '0.0.0.0', 
        '--port', '5000',  # Use port 5000 instead of 8000
        '--reload',
        '--log-level', 'info'
    ]
    
    try:
        process = subprocess.Popen(cmd)
        print(f"Python backend started on port 5000 (PID: {process.pid})")
        
        # Wait for the process to complete
        process.wait()
        
    except KeyboardInterrupt:
        print("\nShutting down Python backend...")
        process.terminate()
        process.wait()
    except Exception as e:
        print(f"Error starting Python backend: {e}")
        sys.exit(1)

if __name__ == "__main__":
    start_python_backend()