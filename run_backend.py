#!/usr/bin/env python3
"""
Production-ready Python FastAPI backend startup script
"""
import os
import sys
import subprocess
import time
import signal

def cleanup_existing_processes():
    """Kill existing processes on port 5000"""
    try:
        # Kill Node.js processes
        subprocess.run(['pkill', '-f', 'tsx'], capture_output=True)
        subprocess.run(['pkill', '-f', 'node.*5000'], capture_output=True)
        subprocess.run(['pkill', '-f', 'uvicorn'], capture_output=True)
        time.sleep(2)
    except Exception:
        pass

def start_backend():
    """Start the FastAPI backend with proper monitoring"""
    cleanup_existing_processes()
    
    backend_dir = os.path.join(os.path.dirname(__file__), 'backend')
    
    # Start the server with uvicorn
    cmd = [
        sys.executable, '-m', 'uvicorn',
        'simple_working_main:app',
        '--host', '0.0.0.0',
        '--port', '5000',
        '--reload'
    ]
    
    print(f"Starting backend: {' '.join(cmd)}")
    print(f"Working directory: {backend_dir}")
    
    try:
        process = subprocess.Popen(
            cmd,
            cwd=backend_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            bufsize=1
        )
        
        # Monitor startup
        startup_timeout = 30
        start_time = time.time()
        
        while time.time() - start_time < startup_timeout:
            if process.poll() is not None:
                print("Process exited early")
                break
                
            # Read line by line to monitor startup
            try:
                line = process.stdout.readline()
                if line:
                    print(line.strip())
                    if "Application startup complete" in line:
                        print("Backend started successfully!")
                        break
            except:
                break
        
        # Keep process running in background
        print(f"Backend process running with PID: {process.pid}")
        return process
        
    except Exception as e:
        print(f"Failed to start backend: {e}")
        return None

if __name__ == "__main__":
    process = start_backend()
    if process:
        try:
            # Wait for the process to complete
            process.wait()
        except KeyboardInterrupt:
            print("Shutting down...")
            process.terminate()
            process.wait()