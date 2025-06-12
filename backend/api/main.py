from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import asyncio
import logging

from ..database.connection import get_db, create_tables
from ..database.models import ADOConnection, Project, ExtractionJob, ExtractionLog
from ..services.ado_client import AzureDevOpsClient
from ..services.extraction_service import ExtractionService
from .schemas import (
    ConnectionCreate, ConnectionResponse, ProjectResponse, 
    ExtractionJobResponse, LogResponse, ExtractRequest
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Azure DevOps Migration Tool API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Initialize database tables on startup"""
    create_tables()
    logger.info("Database tables created successfully")

@app.get("/")
async def root():
    return {"message": "Azure DevOps Migration Tool API", "version": "1.0.0"}

# Connection Management
@app.post("/api/connections", response_model=ConnectionResponse)
async def create_connection(connection: ConnectionCreate, db: Session = Depends(get_db)):
    """Create a new Azure DevOps connection"""
    try:
        # Test connection before saving
        ado_client = AzureDevOpsClient(connection.organization, connection.pat_token)
        is_valid = await ado_client.test_connection()
        
        if not is_valid:
            raise HTTPException(status_code=400, detail="Invalid Azure DevOps connection")
        
        db_connection = ADOConnection(
            name=connection.name,
            organization=connection.organization,
            base_url=f"https://dev.azure.com/{connection.organization}",
            pat_token=connection.pat_token,
            is_active=True
        )
        
        db.add(db_connection)
        db.commit()
        db.refresh(db_connection)
        
        return ConnectionResponse.from_orm(db_connection)
    
    except Exception as e:
        logger.error(f"Failed to create connection: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/connections", response_model=List[ConnectionResponse])
async def get_connections(db: Session = Depends(get_db)):
    """Get all Azure DevOps connections"""
    connections = db.query(ADOConnection).all()
    return [ConnectionResponse.from_orm(conn) for conn in connections]

@app.post("/api/connections/{connection_id}/test")
async def test_connection(connection_id: int, db: Session = Depends(get_db)):
    """Test Azure DevOps connection"""
    connection = db.query(ADOConnection).filter(ADOConnection.id == connection_id).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    try:
        ado_client = AzureDevOpsClient(connection.organization, connection.pat_token)
        is_valid = await ado_client.test_connection()
        return {"valid": is_valid}
    except Exception as e:
        logger.error(f"Connection test failed: {e}")
        return {"valid": False, "error": str(e)}

# Project Management
@app.post("/api/projects/sync/{connection_id}")
async def sync_projects(connection_id: int, db: Session = Depends(get_db)):
    """Fetch and sync projects from Azure DevOps"""
    connection = db.query(ADOConnection).filter(ADOConnection.id == connection_id).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    try:
        ado_client = AzureDevOpsClient(connection.organization, connection.pat_token)
        projects_data = await ado_client.get_projects()
        
        synced_projects = []
        for project_data in projects_data:
            # Check if project already exists
            existing_project = db.query(Project).filter(
                Project.external_id == project_data['id']
            ).first()
            
            if existing_project:
                # Update existing project
                existing_project.name = project_data['name']
                existing_project.description = project_data.get('description', '')
                existing_project.process_template = project_data.get('processTemplate', 'Unknown')
                existing_project.source_control = project_data.get('sourceControl', 'Git')
                existing_project.visibility = project_data.get('visibility', 'Private')
                db.commit()
                synced_projects.append(existing_project)
            else:
                # Create new project
                new_project = Project(
                    external_id=project_data['id'],
                    name=project_data['name'],
                    description=project_data.get('description', ''),
                    process_template=project_data.get('processTemplate', 'Unknown'),
                    source_control=project_data.get('sourceControl', 'Git'),
                    visibility=project_data.get('visibility', 'Private'),
                    connection_id=connection_id,
                    status="ready"
                )
                db.add(new_project)
                db.commit()
                db.refresh(new_project)
                synced_projects.append(new_project)
        
        return [ProjectResponse.from_orm(project) for project in synced_projects]
    
    except Exception as e:
        logger.error(f"Failed to sync projects: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/projects", response_model=List[ProjectResponse])
async def get_projects(connection_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Get all projects, optionally filtered by connection"""
    query = db.query(Project)
    if connection_id:
        query = query.filter(Project.connection_id == connection_id)
    
    projects = query.all()
    return [ProjectResponse.from_orm(project) for project in projects]

@app.patch("/api/projects/{project_id}/status")
async def update_project_status(project_id: int, status: str, db: Session = Depends(get_db)):
    """Update project status"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project.status = status
    db.commit()
    return ProjectResponse.from_orm(project)

@app.post("/api/projects/bulk-status")
async def update_bulk_project_status(project_ids: List[int], status: str, db: Session = Depends(get_db)):
    """Update status for multiple projects"""
    projects = db.query(Project).filter(Project.id.in_(project_ids)).all()
    
    for project in projects:
        project.status = status
    
    db.commit()
    return [ProjectResponse.from_orm(project) for project in projects]

# Data Extraction
@app.post("/api/projects/{project_id}/extract")
async def extract_project_data(
    project_id: int, 
    extract_request: ExtractRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Start extraction job for project data"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    connection = db.query(ADOConnection).filter(ADOConnection.id == project.connection_id).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    # Start background extraction task
    background_tasks.add_task(
        run_extraction_job,
        project_id,
        extract_request.artifact_types,
        connection.organization,
        connection.pat_token
    )
    
    return {"message": "Extraction job started", "project_id": project_id}

async def run_extraction_job(project_id: int, artifact_types: List[str], organization: str, pat_token: str):
    """Background task to run extraction job"""
    from ..database.connection import SessionLocal
    
    db = SessionLocal()
    try:
        ado_client = AzureDevOpsClient(organization, pat_token)
        extraction_service = ExtractionService(db, ado_client)
        
        await extraction_service.extract_project_data(project_id, artifact_types)
        
    except Exception as e:
        logger.error(f"Extraction job failed: {e}")
    finally:
        db.close()

@app.get("/api/projects/{project_id}/extraction-jobs", response_model=List[ExtractionJobResponse])
async def get_extraction_jobs(project_id: int, db: Session = Depends(get_db)):
    """Get extraction jobs for a project"""
    jobs = db.query(ExtractionJob).filter(ExtractionJob.project_id == project_id).all()
    return [ExtractionJobResponse.from_orm(job) for job in jobs]

@app.get("/api/extraction-jobs/{job_id}/logs", response_model=List[LogResponse])
async def get_extraction_logs(job_id: int, db: Session = Depends(get_db)):
    """Get logs for an extraction job"""
    logs = db.query(ExtractionLog).filter(ExtractionLog.job_id == job_id).order_by(ExtractionLog.timestamp.desc()).all()
    return [LogResponse.from_orm(log) for log in logs]

# Data Retrieval Endpoints
@app.get("/api/projects/{project_id}/workitems")
async def get_project_workitems(project_id: int, db: Session = Depends(get_db)):
    """Get work items for a project"""
    from ..database.models import WorkItem
    
    work_items = db.query(WorkItem).filter(WorkItem.project_id == project_id).all()
    return [
        {
            "id": wi.id,
            "external_id": wi.external_id,
            "title": wi.title,
            "work_item_type": wi.work_item_type,
            "state": wi.state,
            "assigned_to": wi.assigned_to,
            "created_date": wi.created_date,
            "priority": wi.priority,
            "tags": wi.tags
        }
        for wi in work_items
    ]

@app.get("/api/projects/{project_id}/repositories")
async def get_project_repositories(project_id: int, db: Session = Depends(get_db)):
    """Get repositories for a project"""
    from ..database.models import Repository
    
    repositories = db.query(Repository).filter(Repository.project_id == project_id).all()
    return [
        {
            "id": repo.id,
            "external_id": repo.external_id,
            "name": repo.name,
            "url": repo.url,
            "default_branch": repo.default_branch,
            "size": repo.size
        }
        for repo in repositories
    ]

@app.get("/api/projects/{project_id}/pipelines")
async def get_project_pipelines(project_id: int, db: Session = Depends(get_db)):
    """Get pipelines for a project"""
    from ..database.models import Pipeline
    
    pipelines = db.query(Pipeline).filter(Pipeline.project_id == project_id).all()
    return [
        {
            "id": pipeline.id,
            "external_id": pipeline.external_id,
            "name": pipeline.name,
            "folder": pipeline.folder,
            "configuration_type": pipeline.configuration_type,
            "yaml_path": pipeline.yaml_path
        }
        for pipeline in pipelines
    ]

@app.get("/api/projects/{project_id}/testplans")
async def get_project_testplans(project_id: int, db: Session = Depends(get_db)):
    """Get test plans for a project"""
    from ..database.models import TestPlan
    
    test_plans = db.query(TestPlan).filter(TestPlan.project_id == project_id).all()
    return [
        {
            "id": tp.id,
            "external_id": tp.external_id,
            "name": tp.name,
            "description": tp.description,
            "area_path": tp.area_path,
            "iteration": tp.iteration,
            "state": tp.state
        }
        for tp in test_plans
    ]

@app.get("/api/projects/{project_id}/boards")
async def get_project_boards(project_id: int, db: Session = Depends(get_db)):
    """Get boards for a project"""
    from ..database.models import Board
    
    boards = db.query(Board).filter(Board.project_id == project_id).all()
    return [
        {
            "id": board.id,
            "external_id": board.external_id,
            "name": board.name
        }
        for board in boards
    ]

@app.get("/api/projects/{project_id}/queries")
async def get_project_queries(project_id: int, db: Session = Depends(get_db)):
    """Get queries for a project"""
    from ..database.models import Query
    
    queries = db.query(Query).filter(Query.project_id == project_id).all()
    return [
        {
            "id": query.id,
            "external_id": query.external_id,
            "name": query.name,
            "path": query.path,
            "query_type": query.query_type,
            "wiql": query.wiql
        }
        for query in queries
    ]

# Statistics
@app.get("/api/statistics")
async def get_statistics(db: Session = Depends(get_db)):
    """Get application statistics"""
    total_projects = db.query(Project).count()
    selected_projects = db.query(Project).filter(Project.status == "selected").count()
    in_progress_projects = db.query(Project).filter(Project.status.in_(["extracting", "migrating"])).count()
    migrated_projects = db.query(Project).filter(Project.status == "migrated").count()
    
    total_jobs = db.query(ExtractionJob).count()
    running_jobs = db.query(ExtractionJob).filter(ExtractionJob.status == "running").count()
    completed_jobs = db.query(ExtractionJob).filter(ExtractionJob.status == "completed").count()
    failed_jobs = db.query(ExtractionJob).filter(ExtractionJob.status == "failed").count()
    
    return {
        "totalProjects": total_projects,
        "selectedProjects": selected_projects,
        "inProgressProjects": in_progress_projects,
        "migratedProjects": migrated_projects,
        "totalJobs": total_jobs,
        "runningJobs": running_jobs,
        "completedJobs": completed_jobs,
        "failedJobs": failed_jobs
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)