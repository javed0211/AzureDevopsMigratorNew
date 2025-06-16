#!/usr/bin/env python3
"""
Script to create the users table and add user_count column to projects table
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

def create_users_table():
    """Create the users table and add user_count column to projects table"""
    conn = None
    cursor = None
    try:
        # Connect to the database
        logger.info("Connecting to database...")
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if user_count column exists in projects table
        logger.info("Checking if user_count column exists in projects table...")
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'projects' AND column_name = 'user_count'
        """)
        column_exists = cursor.fetchone() is not None
        
        if not column_exists:
            logger.info("Adding user_count column to projects table...")
            cursor.execute("""
                ALTER TABLE projects 
                ADD COLUMN user_count INTEGER DEFAULT 0
            """)
            logger.info("Added user_count column to projects table")
        else:
            logger.info("user_count column already exists in projects table")
        
        # Check if users table exists
        logger.info("Checking if users table exists...")
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'users'
            )
        """)
        table_exists = cursor.fetchone()['exists']
        
        if not table_exists:
            logger.info("Creating users table...")
            cursor.execute("""
                CREATE TABLE users (
                    id SERIAL PRIMARY KEY,
                    project_id INTEGER REFERENCES projects(id),
                    external_id VARCHAR(255),
                    display_name VARCHAR(255),
                    unique_name VARCHAR(255),
                    email VARCHAR(255),
                    work_item_count INTEGER DEFAULT 0
                )
            """)
            logger.info("Created users table")
        else:
            logger.info("users table already exists")
        
        # Commit the changes
        conn.commit()
        logger.info("Database setup completed successfully")
        
    except Exception as e:
        logger.error(f"Error during database setup: {e}")
        if conn:
            conn.rollback()
        sys.exit(1)
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

if __name__ == "__main__":
    create_users_table()