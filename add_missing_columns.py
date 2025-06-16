#!/usr/bin/env python3
"""
Migration script to add missing columns to the projects table
"""
import os
import sys
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get the backend directory path
backend_dir = Path(__file__).resolve().parent / "backend"
sys.path.append(str(backend_dir.parent))

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv(backend_dir / ".env")

try:
    # Import database connection
    from backend.database.connection import get_db_connection
except ImportError as e:
    logger.error(f"Error importing database connection: {e}")
    sys.exit(1)

def add_missing_columns():
    """Add missing columns to the projects table"""
    conn = None
    cursor = None
    try:
        # Connect to the database
        logger.info("Connecting to database...")
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if columns exist
        logger.info("Checking for existing columns...")
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'projects'
        """)
        existing_columns = [row['column_name'] for row in cursor.fetchall()]
        
        # Add custom_field_count column if it doesn't exist
        if 'custom_field_count' not in existing_columns:
            logger.info("Adding custom_field_count column...")
            cursor.execute("""
                ALTER TABLE projects 
                ADD COLUMN custom_field_count INTEGER DEFAULT 0
            """)
        else:
            logger.info("custom_field_count column already exists")
        
        # Add area_path_count column if it doesn't exist
        if 'area_path_count' not in existing_columns:
            logger.info("Adding area_path_count column...")
            cursor.execute("""
                ALTER TABLE projects 
                ADD COLUMN area_path_count INTEGER DEFAULT 0
            """)
        else:
            logger.info("area_path_count column already exists")
        
        # Add iteration_path_count column if it doesn't exist
        if 'iteration_path_count' not in existing_columns:
            logger.info("Adding iteration_path_count column...")
            cursor.execute("""
                ALTER TABLE projects 
                ADD COLUMN iteration_path_count INTEGER DEFAULT 0
            """)
        else:
            logger.info("iteration_path_count column already exists")
        
        # Commit the changes
        conn.commit()
        logger.info("Database migration completed successfully")
        
    except Exception as e:
        logger.error(f"Error during migration: {e}")
        if conn:
            conn.rollback()
        sys.exit(1)
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

if __name__ == "__main__":
    add_missing_columns()