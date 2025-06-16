#!/usr/bin/env python3
"""
Script to create the migration tables in the database
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
    print("The following tables have been created or updated:")
    print("- branches (for repository branches)")
    print("- area_paths (for work item area paths)")
    print("- iteration_paths (for work item iteration paths)")
    print("- work_item_revisions (for work item history)")
    print("- work_item_comments (for work item comments)")
    print("- work_item_attachments (for work item attachments)")
    print("- work_item_relations (for work item relations)")
    print("\nTo extract all data for migration, run the following extractions:")
    print("1. Classification (area and iteration paths)")
    print("2. Work Items (including revisions, comments, attachments, and relations)")
    print("3. Repositories (including branches, commits, and pull requests)")
    print("4. Pipelines")
    print("5. Test Cases")