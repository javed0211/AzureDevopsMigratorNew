#!/usr/bin/env python3
"""
Script to create the branches table in the database
"""
import os
import sys
from dotenv import load_dotenv

# Load environment variables from backend/.env file
load_dotenv("backend/.env")

# Check if DATABASE_URL is set
if not os.getenv('DATABASE_URL'):
    print("ERROR: DATABASE_URL environment variable is required")
    sys.exit(1)

# Import after environment variables are loaded
from backend.database.connection import create_tables

if __name__ == "__main__":
    print("Creating database tables...")
    create_tables()
    print("Tables created successfully!")