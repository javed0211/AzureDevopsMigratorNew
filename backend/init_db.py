#!/usr/bin/env python3
"""
Initialize the PostgreSQL database with Azure DevOps migration tables
"""
import os
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

def init_database():
    """Initialize database tables"""
    try:
        from database.connection import create_tables, engine
        from database.models import Base
        
        print("Creating database tables...")
        
        # Create all tables
        Base.metadata.create_all(bind=engine)
        
        print("✓ Database tables created successfully")
        
        # Test connection
        from sqlalchemy import text
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            print("✓ Database connection test successful")
            
    except Exception as e:
        print(f"✗ Database initialization failed: {e}")
        return False
    
    return True

if __name__ == "__main__":
    if init_database():
        print("Database initialization complete!")
        sys.exit(0)
    else:
        print("Database initialization failed!")
        sys.exit(1)