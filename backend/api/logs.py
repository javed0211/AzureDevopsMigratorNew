from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta

from backend.database.models import ExtractionLog, ExtractionJob, Project
from backend.database.database import get_db
from backend.api.logger import logger

router = APIRouter()

@router.get("/logs")
async def get_logs(
    level: Optional[str] = None,
    project_id: Optional[int] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    try:
        # Start with a base query
        query = db.query(ExtractionLog).join(ExtractionJob)
        
        # Apply filters if provided
        if level:
            query = query.filter(ExtractionLog.level == level.upper())
        
        if project_id:
            query = query.filter(ExtractionJob.project_id == project_id)
        
        # Get total count for pagination
        total_count = query.count()
        
        # Order by timestamp descending and apply pagination
        logs = query.order_by(ExtractionLog.timestamp.desc()).offset(offset).limit(limit).all()
        
        # Convert to response format
        result = []
        for log in logs:
            job = log.job
            project = db.query(Project).filter(Project.id == job.project_id).first()
            project_name = project.name if project else "Unknown Project"
            
            result.append({
                "id": log.id,
                "level": log.level,
                "message": log.message,
                "details": log.details,
                "timestamp": log.timestamp,
                "project_id": job.project_id,
                "project_name": project_name,
                "job_id": log.job_id,
                "artifact_type": job.artifact_type
            })
        
        return {
            "logs": result,
            "total": total_count,
            "offset": offset,
            "limit": limit
        }
    except Exception as e:
        logger.error(f"Failed to get logs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get logs: {str(e)}")

@router.get("/logs/summary")
async def get_logs_summary(db: Session = Depends(get_db)):
    try:
        # Get counts by log level
        info_count = db.query(ExtractionLog).filter(ExtractionLog.level == "INFO").count()
        warning_count = db.query(ExtractionLog).filter(ExtractionLog.level == "WARNING").count()
        error_count = db.query(ExtractionLog).filter(ExtractionLog.level == "ERROR").count()
        total_count = info_count + warning_count + error_count
        
        # Calculate success rate
        success_rate = 100.0
        if total_count > 0:
            success_rate = round(100.0 * (1 - (error_count / total_count)), 1)
        
        # Get recent errors
        recent_errors = db.query(ExtractionLog).filter(
            ExtractionLog.level == "ERROR"
        ).order_by(ExtractionLog.timestamp.desc()).limit(5).all()
        
        error_details = []
        for error in recent_errors:
            job = error.job
            project = db.query(Project).filter(Project.id == job.project_id).first()
            project_name = project.name if project else "Unknown Project"
            
            error_details.append({
                "id": error.id,
                "message": error.message,
                "details": error.details,
                "timestamp": error.timestamp,
                "project_id": job.project_id,
                "project_name": project_name,
                "job_id": error.job_id,
                "artifact_type": job.artifact_type
            })
        
        # Get recent timeline events
        recent_jobs = db.query(ExtractionJob).order_by(
            ExtractionJob.started_at.desc()
        ).limit(10).all()
        
        timeline_events = []
        for job in recent_jobs:
            project = db.query(Project).filter(Project.id == job.project_id).first()
            project_name = project.name if project else "Unknown Project"
            
            timeline_events.append({
                "id": job.id,
                "project_id": job.project_id,
                "project_name": project_name,
                "artifact_type": job.artifact_type,
                "status": job.status,
                "started_at": job.started_at,
                "completed_at": job.completed_at,
                "progress": job.progress,
                "total_items": job.total_items,
                "extracted_items": job.extracted_items
            })
        
        return {
            "total_operations": total_count,
            "info_count": info_count,
            "warning_count": warning_count,
            "error_count": error_count,
            "success_rate": success_rate,
            "recent_errors": error_details,
            "timeline_events": timeline_events
        }
    except Exception as e:
        logger.error(f"Failed to get logs summary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get logs summary: {str(e)}")