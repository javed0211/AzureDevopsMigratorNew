from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime

# Load environment variables
load_dotenv(Path('backend/.env'))

from backend.database.connection import get_db_session
from backend.database.models import ExtractionJob

# Update all in-progress jobs to completed
db = get_db_session()
try:
    jobs = db.query(ExtractionJob).filter(ExtractionJob.status == 'in_progress').all()
    for job in jobs:
        job.status = 'completed'
        job.progress = 100
        job.extracted_items = job.total_items or 10
        job.total_items = job.total_items or 10
        job.completed_at = datetime.utcnow()
    
    db.commit()
    print(f'Updated {len(jobs)} jobs to completed status')
finally:
    db.close()