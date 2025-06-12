#!/usr/bin/env python3
"""
Start both Vite frontend and Python FastAPI backend for development
"""
import subprocess
import os
import sys
import signal
import time
from pathlib import Path

def start_servers():
    """Start both frontend and backend servers"""
    print("Starting Azure DevOps Migration Tool - Full Stack Python")
    
    # Start Python backend on port 5000
    backend_env = os.environ.copy()
    backend_env['PORT'] = '5000'
    backend_process = subprocess.Popen([
        sys.executable, 'backend/main.py'
    ], env=backend_env)
    
    # Start Vite frontend on port 5173 (it will proxy to backend on 5000)
    frontend_process = subprocess.Popen([
        'npx', 'vite', '--host', '0.0.0.0'
    ])
    
    try:
        print("✓ Python FastAPI backend started on port 5000")
        print("✓ Vite frontend started on port 5173")
        print("Both servers are running. Press Ctrl+C to stop.")
        
        # Wait for both processes
        while True:
            if backend_process.poll() is not None:
                print("Backend process ended")
                break
            if frontend_process.poll() is not None:
                print("Frontend process ended")
                break
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\nShutting down servers...")
        backend_process.terminate()
        frontend_process.terminate()
        
        # Wait for graceful shutdown
        try:
            backend_process.wait(timeout=5)
            frontend_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            backend_process.kill()
            frontend_process.kill()

if __name__ == "__main__":
    start_servers()