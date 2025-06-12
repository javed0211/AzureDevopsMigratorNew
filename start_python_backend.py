#!/usr/bin/env python3
"""
Start the Python FastAPI backend for Azure DevOps Migration Tool
"""
import subprocess
import os
import sys
import time

def start_backend():
    """Start the FastAPI backend server"""
    print("Starting Azure DevOps Migration Tool - Python Backend")
    
    # Change to backend directory
    backend_dir = os.path.join(os.getcwd(), 'backend')
    
    # Start the FastAPI server on port 5000 to match frontend expectations
    try:
        env = os.environ.copy()
        env['PYTHON_PORT'] = '5000'
        
        subprocess.run([
            sys.executable, 'run.py'
        ], cwd=backend_dir, env=env)
        
    except KeyboardInterrupt:
        print("\nShutting down Python backend...")
    except Exception as e:
        print(f"Error starting Python backend: {e}")
        sys.exit(1)

if __name__ == "__main__":
    start_backend()