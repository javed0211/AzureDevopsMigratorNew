#!/usr/bin/env python3
"""
Start Python FastAPI backend with proper error handling
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
    
    try:
        # First kill any existing processes on port 5000
        subprocess.run(['pkill', '-f', 'port.*5000'], capture_output=True)
        subprocess.run(['pkill', '-f', 'tsx'], capture_output=True)
        time.sleep(2)
        
        # Start uvicorn server directly
        cmd = [
            sys.executable, '-m', 'uvicorn', 
            'simple_working_main:app', 
            '--host', '0.0.0.0', 
            '--port', '5000',
            '--reload',
            '--log-level', 'info'
        ]
        
        print(f"Running command: {' '.join(cmd)}")
        print(f"Working directory: {backend_dir}")
        
        process = subprocess.Popen(
            cmd, 
            cwd=backend_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True
        )
        
        print(f"Python backend started (PID: {process.pid})")
        
        # Monitor the process
        for line in process.stdout:
            print(line.strip())
            if "Application startup complete" in line:
                print("Backend successfully started!")
                break
        
        # Keep the process running
        process.wait()
        
    except KeyboardInterrupt:
        print("\nShutting down Python backend...")
        if 'process' in locals():
            process.terminate()
            process.wait()
    except Exception as e:
        print(f"Error starting Python backend: {e}")
        sys.exit(1)

if __name__ == "__main__":
    start_python_backend()