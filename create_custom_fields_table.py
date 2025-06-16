#!/usr/bin/env python3
"""
Script to create the custom_fields table if it doesn't exist
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

def create_custom_fields_table():
    """Create the custom_fields table if it doesn't exist"""
    conn = None
    cursor = None
    try:
        # Connect to the database
        logger.info("Connecting to database...")
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if table exists
        logger.info("Checking if custom_fields table exists...")
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'custom_fields'
            )
        """)
        table_exists = cursor.fetchone()['exists']
        
        if not table_exists:
            logger.info("Creating custom_fields table...")
            cursor.execute("""
                CREATE TABLE custom_fields (
                    id SERIAL PRIMARY KEY,
                    project_id INTEGER REFERENCES projects(id),
                    external_id VARCHAR(255),
                    name VARCHAR(255),
                    reference_name VARCHAR(255),
                    type VARCHAR(100),
                    usage INTEGER DEFAULT 0,
                    work_item_types TEXT
                )
            """)
            logger.info("Created custom_fields table")
        else:
            logger.info("custom_fields table already exists")
        
        # Commit the changes
        conn.commit()
        logger.info("Database setup completed successfully")
        
    except Exception as e:
        logger.error(f"Error during table creation: {e}")
        if conn:
            conn.rollback()
        sys.exit(1)
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

if __name__ == "__main__":
    create_custom_fields_table()