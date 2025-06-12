#!/usr/bin/env python3
"""
Azure DevOps Migration Tool - Python FastAPI Backend
"""
import uvicorn
import os
import sys
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))
sys.path.insert(0, str(backend_dir.parent))

def main():
    """Run the FastAPI server"""
    try:
        # Import the FastAPI app
        from backend.api.main import app
        
        # Use port 5000 to replace Node.js backend
        port = int(os.getenv("PORT", "5000"))
        host = "0.0.0.0"
        
        print(f"Starting Azure DevOps Migration Backend on {host}:{port}")
        print("Python FastAPI backend is now replacing Node.js backend")
        
        # Run the server
        uvicorn.run(
            app,
            host=host,
            port=port,
            reload=False,
            log_level="info"
        )
        
    except Exception as e:
        print(f"Failed to start server: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()