#!/usr/bin/env python3
"""
Simple Azure DevOps Migration Tool Backend Runner
"""
import uvicorn
import os
import sys
import logging
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

def main():
    """Run the FastAPI server"""
    try:
        # Import after path setup
        from api.main import app
        
        # Get port from environment or use default
        port = int(os.getenv("PYTHON_PORT", "8000"))
        host = "0.0.0.0"
        
        print(f"Starting Azure DevOps Migration Backend on {host}:{port}")
        
        # Run the server
        uvicorn.run(
            app,
            host=host,
            port=port,
            reload=True,
            log_level="info"
        )
        
    except Exception as e:
        print(f"Failed to start server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()