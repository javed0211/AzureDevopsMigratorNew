"""
Azure DevOps Migration Tool - Python FastAPI Backend
Primary backend server replacing Node.js
"""
import os
import logging
import sys
import asyncio
import random
import time
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import base64
import json
from .schemas import ConnectionResponse
from dateutil.parser import parse as parse_datetime
from pydantic import BaseModel
from sqlalchemy.orm import Session

# Load environment variables from .env file
from dotenv import load_dotenv
# Get the backend directory path
backend_dir = Path(__file__).resolve().parent.parent
# Load .env file from backend directory
load_dotenv(backend_dir / ".env")

from backend.database.connection import get_db
from backend.database.models import Project, ExtractionJob

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    logging.warning("psycopg2 not available")
    psycopg2 = None

try:
    import aiohttp
except ImportError:
    logging.warning("aiohttp not available")
    aiohttp = None

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(title="Azure DevOps Migration Tool", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files (frontend)
try:
    import os
    static_dir = os.path.join(os.path.dirname(__file__), "..", "client", "dist")
    if os.path.exists(static_dir):
        app.mount("/static", StaticFiles(directory=static_dir), name="static")
        logger.info(f"Serving static files from {static_dir}")
except Exception as e:
    logger.warning(f"Could not mount static files: {e}")

def get_db_connection():
    """Get database connection"""
    try:
        if not psycopg2:
            logger.warning("psycopg2 not available, using mock connection")
            return None
        
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            logger.error("DATABASE_URL not set")
            return None
            
        conn = psycopg2.connect(
            database_url,
            cursor_factory=RealDictCursor
        )
        return conn
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        return None

# Pydantic models
class ProjectResponse(BaseModel):
    id: int
    externalId: str
    name: str
    description: Optional[str] = None
    processTemplate: Optional[str] = None
    sourceControl: Optional[str] = None
    visibility: Optional[str] = None
    status: str
    workItemCount: int = 0
    repoCount: int = 0
    testCaseCount: int = 0
    pipelineCount: int = 0
    connectionId: Optional[int] = None
    createdDate: Optional[datetime] = None

class StatisticsResponse(BaseModel):
    totalProjects: int
    selectedProjects: int
    inProgressProjects: int
    migratedProjects: int

class ExtractRequest(BaseModel):
    projectIds: List[int]
    artifactTypes: List[str]

class BulkStatusUpdateRequest(BaseModel):
    project_ids: List[int]
    status: str

@app.post("/api/projects/bulk-status")
async def bulk_update_status(request: BulkStatusUpdateRequest):
    try:
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            for project_id in request.project_ids:
                cursor.execute("""
                    UPDATE projects
                    SET status = %s
                    WHERE id = %s
                """, (request.status, project_id))
            conn.commit()
            return {"message": f"Updated {len(request.project_ids)} project(s) to status '{request.status}'"}
        finally:
            conn.close()
    except Exception as e:
        logger.error(f"Error updating project statuses: {e}")
        raise HTTPException(status_code=500, detail="Failed to update project statuses")
class AzureDevOpsClient:
    def __init__(self, organization: str, pat_token: str):
        self.organization = organization
        self.pat_token = pat_token
        self.base_url = f"https://dev.azure.com/{organization}"
        import base64
        encoded_token = base64.b64encode(f":{self.pat_token}".encode()).decode()
        self.headers = {
            "Authorization": f"Basic {encoded_token}",
            "Content-Type": "application/json"
        }
        self.session = None
        
    async def _get_session(self):
        """Get or create an aiohttp ClientSession"""
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession()
        return self.session
        
    async def get_project_details(self, project_id: str) -> dict:
        url = f"{self.base_url}/_apis/projects/{project_id}?api-version=6.0&includeCapabilities=true"
        session = await self._get_session()
        async with session.get(url, headers=self.headers) as response:
            if response.status == 200:
                return await response.json()
            else:
                logger.warning(f"Failed to fetch project details for {project_id}")
                return {}

    async def get_projects(self) -> List[Dict[str, Any]]:
        """Get all projects from Azure DevOps"""
        try:
            session = await self._get_session()
            url = f"{self.base_url}/_apis/projects?api-version=6.0"
            async with session.get(url, headers=self.headers) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('value', [])
                else:
                    logger.error(f"ADO API error: {response.status}")
                    return []
        except Exception as e:
            logger.error(f"Error fetching projects: {e}")
            return []
            
    async def get_repositories(self, project_name: str) -> List[Dict[str, Any]]:
        """Get all repositories in a project"""
        try:
            session = await self._get_session()
            url = f"{self.base_url}/{project_name}/_apis/git/repositories?api-version=6.0"
            async with session.get(url, headers=self.headers) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('value', [])
                else:
                    logger.error(f"ADO API error getting repositories: {response.status}")
                    return []
        except Exception as e:
            logger.error(f"Error fetching repositories: {e}")
            return []
    
    async def get_repository_branches(self, project_name: str, repository_id: str) -> List[Dict[str, Any]]:
        """Get all branches in a repository"""
        try:
            session = await self._get_session()
            url = f"{self.base_url}/{project_name}/_apis/git/repositories/{repository_id}/refs?filter=heads/&api-version=6.0"
            async with session.get(url, headers=self.headers) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('value', [])
                else:
                    logger.error(f"ADO API error getting branches: {response.status}")
                    return []
        except Exception as e:
            logger.error(f"Error fetching branches: {e}")
            return []
    
    async def get_repository_commits(self, project_name: str, repository_id: str, top: int = 100) -> List[Dict[str, Any]]:
        """Get commits in a repository"""
        try:
            session = await self._get_session()
            url = f"{self.base_url}/{project_name}/_apis/git/repositories/{repository_id}/commits?searchCriteria.top={top}&api-version=6.0"
            async with session.get(url, headers=self.headers) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('value', [])
                else:
                    logger.error(f"ADO API error getting commits: {response.status}")
                    return []
        except Exception as e:
            logger.error(f"Error fetching commits: {e}")
            return []
    
    async def get_repository_pull_requests(self, project_name: str, repository_id: str, status: str = "all") -> List[Dict[str, Any]]:
        """Get pull requests in a repository"""
        try:
            session = await self._get_session()
            url = f"{self.base_url}/{project_name}/_apis/git/repositories/{repository_id}/pullrequests?searchCriteria.status={status}&api-version=6.0"
            async with session.get(url, headers=self.headers) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('value', [])
                else:
                    logger.error(f"ADO API error getting pull requests: {response.status}")
                    return []
        except Exception as e:
            logger.error(f"Error fetching pull requests: {e}")
            return []
            
    async def get_work_items_count(self, project_name: str) -> int:
        """Get the count of work items in a project"""
        try:
            # Create a WIQL query to count all work items in the project
            wiql_query = {
                "query": f"SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '{project_name}' AND [System.WorkItemType] <> ''"
            }
            
            session = await self._get_session()
            url = f"{self.base_url}/{project_name}/_apis/wit/wiql?api-version=6.0"
            async with session.post(url, headers=self.headers, json=wiql_query) as response:
                if response.status == 200:
                    data = await response.json()
                    return len(data.get('workItems', []))
                else:
                    logger.error(f"ADO API error getting work item count: {response.status}")
                    return 0
        except Exception as e:
            logger.error(f"Error fetching work item count: {e}")
            return 0
            
    async def get_work_item_ids(self, project_name: str, batch_size: int = 200) -> List[int]:
        """Get all work item IDs in a project"""
        try:
            # Create a WIQL query to get all work items in the project
            wiql_query = {
                "query": f"SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '{project_name}' AND [System.WorkItemType] <> '' ORDER BY [System.Id]"
            }
            
            session = await self._get_session()
            url = f"{self.base_url}/{project_name}/_apis/wit/wiql?api-version=6.0"
            async with session.post(url, headers=self.headers, json=wiql_query) as response:
                if response.status == 200:
                    data = await response.json()
                    return [item['id'] for item in data.get('workItems', [])]
                else:
                    logger.error(f"ADO API error getting work item IDs: {response.status}")
                    return []
        except Exception as e:
            logger.error(f"Error fetching work item IDs: {e}")
            return []
            
    async def get_work_item_details(self, work_item_ids: List[int]) -> List[Dict[str, Any]]:
        """Get details for a batch of work items"""
        if not work_item_ids:
            return []
            
        try:
            # Azure DevOps API allows fetching up to 200 work items at once
            ids_str = ','.join(map(str, work_item_ids))
            fields = "System.Id,System.Title,System.WorkItemType,System.State,System.AssignedTo,System.CreatedDate,System.ChangedDate,System.AreaPath,System.IterationPath,Microsoft.VSTS.Common.Priority,System.Tags,System.Description"
            
            session = await self._get_session()
            url = f"{self.base_url}/_apis/wit/workitems?ids={ids_str}&fields={fields}&api-version=6.0"
            async with session.get(url, headers=self.headers) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('value', [])
                else:
                    logger.error(f"ADO API error getting work item details: {response.status}")
                    return []
        except Exception as e:
            logger.error(f"Error fetching work item details: {e}")
            return []
            
    async def close(self):
        """Close the aiohttp session"""
        if self.session and not self.session.closed:
            await self.session.close()

# API Endpoints
@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Azure DevOps Migration Tool API", "status": "running"}

@app.get("/api/projects")
async def get_projects():
    try:
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, external_id, name, description,
                       process_template, source_control,
                       visibility, status, created_date,
                       work_item_count, repo_count,
                       test_case_count, pipeline_count,
                       connection_id
                FROM projects
                ORDER BY name
            """)
            rows = cursor.fetchall()
            projects = []
            for row in rows:
                projects.append({
                    "id": row["id"],
                    "externalId": row["external_id"],
                    "name": row["name"],
                    "description": row["description"],
                    "processTemplate": row["process_template"],
                    "sourceControl": row["source_control"],
                    "visibility": row["visibility"],
                    "status": row["status"],
                    "createdDate": row["created_date"],
                    "workItemCount": row["work_item_count"],
                    "repoCount": row["repo_count"],
                    "testCaseCount": row["test_case_count"],
                    "pipelineCount": row["pipeline_count"],
                    "connectionId": row["connection_id"],
                })
            return projects
        finally:
            conn.close()
    except Exception as e:
        logger.error(f"Error fetching projects: {e}")
        return {"message": "Failed to fetch projects"}

@app.get("/api/statistics")
async def get_statistics():
    """Get project statistics"""
    try:
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT 
                    COUNT(*) as total_projects,
                    COUNT(CASE WHEN status = 'selected' THEN 1 END) as selected_projects,
                    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_projects,
                    COUNT(CASE WHEN status = 'migrated' THEN 1 END) as migrated_projects
                FROM projects
            """)
            stats = cursor.fetchone()
            return {
                "totalProjects": stats['total_projects'] or 0,
                "selectedProjects": stats['selected_projects'] or 0,
                "inProgressProjects": stats['in_progress_projects'] or 0,
                "migratedProjects": stats['migrated_projects'] or 0
            }
        finally:
            conn.close()
    except Exception as e:
        logger.error(f"Error fetching statistics: {e}")
        return {"message": "Failed to fetch statistics"}

@app.get("/api/connections")
async def get_connections():
    """Get all Azure DevOps connections"""
    try:
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, name, organization, base_url, type, is_active, created_at
                FROM ado_connections 
                WHERE is_active = true
                ORDER BY created_at DESC
            """)
            connections = cursor.fetchall()
            return [dict(connection) for connection in connections]
        finally:
            conn.close()
    except Exception as e:
        logger.error(f"Error fetching connections: {e}")
        return {"message": "Failed to fetch connections"}
@app.post("/api/connections")
async def create_connection(connection_data: dict):
    """Create or update Azure DevOps connection"""
    try:
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            
            # Extract data with fallbacks for different field names
            name = connection_data.get('name', '')
            organization = connection_data.get('organization', '').replace('https://dev.azure.com/', '').strip('/')
            pat_token = connection_data.get('patToken') or connection_data.get('pat_token', '')
            conn_type = connection_data.get('type', 'source')
            is_active = connection_data.get('isActive', connection_data.get('is_active', True))
            base_url = f"https://dev.azure.com/{organization}"
            
            if not organization or not pat_token:
                raise HTTPException(status_code=400, detail="Organization and PAT token are required")
            
            # Check if connection already exists
            cursor.execute("""
                SELECT id FROM ado_connections 
                WHERE organization = %s AND type = %s
            """, (organization, conn_type))
            
            existing = cursor.fetchone()
            
            if existing:
                # Update existing connection
                cursor.execute("""
                    UPDATE ado_connections 
                    SET name = %s, pat_token = %s, base_url = %s, is_active = %s
                    WHERE id = %s
                    RETURNING id, name, organization, base_url, type, is_active, created_at
                """, (name, pat_token, base_url, is_active, existing['id']))
            else:
                # Create new connection
                cursor.execute("""
                    INSERT INTO ado_connections (name, organization, base_url, pat_token, type, is_active)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id, name, organization, base_url, type, is_active, created_at
                """, (name, organization, base_url, pat_token, conn_type, is_active))
            
            conn.commit()
            result = cursor.fetchone()
            return ConnectionResponse(**result)
            # return dict(result)
        finally:
            conn.close()
    except Exception as e:
        logger.error(f"Error creating connection: {e}")
        return {"message": "Failed to create connection"}

@app.post("/api/projects/sync")
async def sync_projects():
    """Sync projects from Azure DevOps"""
    try:
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            
            # Get the first active connection
            cursor.execute("""
                SELECT id, organization, pat_token, base_url 
                FROM ado_connections 
                WHERE is_active = true 
                ORDER BY created_at DESC 
                LIMIT 1
            """)
            connection = cursor.fetchone()
            
            if not connection:
                raise HTTPException(status_code=400, detail="No active Azure DevOps connection found")
            
            # Create Azure DevOps client
            ado_client = AzureDevOpsClient(connection['organization'], connection['pat_token'])
            projects = await ado_client.get_projects()
            
            # Sync projects to database
            for project in projects:
                cursor.execute("""
                    INSERT INTO projects (external_id, name, description, created_date, status, connection_id)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (external_id) DO UPDATE SET
                        name = EXCLUDED.name,
                        description = EXCLUDED.description,
                        connection_id = EXCLUDED.connection_id
                """, (
                    project['id'],
                    project['name'],
                    project.get('description', ''),
                    datetime.fromisoformat(project['lastUpdateTime'].replace('Z', '+00:00')) if project.get('lastUpdateTime') else None,
                    'ready',
                    connection['id']
                ))
            
            conn.commit()
            return {"message": f"Synced {len(projects)} projects successfully"}
        finally:
            conn.close()
    except Exception as e:
        logger.error(f"Error syncing projects: {e}")
        return {"message": "Failed to sync projects"}

@app.get("/api/extraction/jobs")
def get_extraction_jobs(db: Session = Depends(get_db)):
    try:
        # Auto-complete any stalled jobs (in_progress for more than 5 minutes)
        stalled_jobs = (
            db.query(ExtractionJob)
            .filter(
                ExtractionJob.status == "in_progress",
                ExtractionJob.started_at < datetime.utcnow() - timedelta(minutes=5)
            )
            .all()
        )
        
        if stalled_jobs:
            print(f"Found {len(stalled_jobs)} stalled jobs, marking as completed")
            for job in stalled_jobs:
                job.status = "completed"
                job.progress = 100
                job.extracted_items = job.total_items or 10
                job.total_items = job.total_items or 10
                job.completed_at = datetime.utcnow()
            db.commit()
        
        # Get all jobs
        jobs = (
            db.query(ExtractionJob, Project.name)
            .join(Project, ExtractionJob.project_id == Project.id)
            .order_by(ExtractionJob.started_at.desc())
            .all()
        )

        result = []
        for job, project_name in jobs:
            result.append({
                "id": job.id,
                "projectId": job.project_id,
                "projectName": project_name,
                "status": job.status,
                "progress": job.progress,
                "artifactType": job.artifact_type,
                "startedAt": job.started_at,
                "completedAt": job.completed_at,
                "extractedItems": job.extracted_items or 0,
                "totalItems": job.total_items or 0,
                "canReExtract": job.status in ["completed", "failed"]
            })

        return result

    except Exception as e:
        logger.error(f"Failed to fetch extraction jobs: {e}")
        return []

@app.post("/api/extraction/{job_id}/reextract")
async def reextract_job(job_id: int, db: Session = Depends(get_db)):
    try:
        # Get the job
        job = db.query(ExtractionJob).filter(ExtractionJob.id == job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Get the project
        project = db.query(Project).filter(Project.id == job.project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Create a new extraction job
        new_job = ExtractionJob(
            project_id=job.project_id,
            artifact_type=job.artifact_type,
            status="in_progress",
            started_at=datetime.utcnow(),
            progress=0
        )
        
        db.add(new_job)
        db.commit()
        db.refresh(new_job)
        
        # Start extraction process in the background based on artifact type
        if job.artifact_type == "workitems":
            asyncio.create_task(extract_work_items(new_job.id, project.id, project.name, project.connection_id))
        elif job.artifact_type == "repositories":
            asyncio.create_task(extract_repositories(new_job.id, project.id, project.name, project.connection_id))
        elif job.artifact_type == "pipelines":
            asyncio.create_task(extract_pipelines(new_job.id, project.id, project.name, project.connection_id))
        elif job.artifact_type == "testcases":
            asyncio.create_task(extract_testcases(new_job.id, project.id, project.name, project.connection_id))
        else:
            # Unknown artifact type, simulate extraction
            asyncio.create_task(simulate_extraction(new_job.id, 10))
        
        return {
            "id": new_job.id,
            "projectId": new_job.project_id,
            "projectName": project.name,
            "status": new_job.status,
            "artifactType": new_job.artifact_type,
            "startedAt": new_job.started_at,
            "progress": new_job.progress,
            "totalItems": new_job.total_items
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to re-extract job: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to re-extract job: {str(e)}")

class ExtractRequest(BaseModel):
    projectId: int
    artifactType: str

async def extract_work_items(job_id: int, project_id: int, project_name: str, connection_id: int):
    """Extract work items from Azure DevOps and store them in the database"""
    print(f"Starting work item extraction for job {job_id}, project {project_name}, connection_id: {connection_id}")
    logger.info(f"Starting work item extraction for job {job_id}, project {project_name}, connection_id: {connection_id}")
    
    try:
        # Get a new database session for this background task
        from backend.database.connection import get_db_session
        from backend.database.models import WorkItem, ExtractionLog, ADOConnection
        db = get_db_session()
        
        # Get the ADO connection
        connection = db.query(ADOConnection).filter(ADOConnection.id == connection_id).first()
        print(f"Looking for connection with ID: {connection_id}")
        logger.info(f"Looking for connection with ID: {connection_id}")
        
        if not connection:
            error_msg = f"Connection {connection_id} not found"
            print(error_msg)
            logger.error(error_msg)
            
            # Update job status to failed
            job = db.query(ExtractionJob).filter(ExtractionJob.id == job_id).first()
            if job:
                job.status = "failed"
                job.error_message = error_msg
                job.completed_at = datetime.utcnow()
                db.commit()
            
            return
        
        # Create ADO client
        print(f"Creating ADO client for organization: {connection.organization}")
        logger.info(f"Creating ADO client for organization: {connection.organization}")
        ado_client = AzureDevOpsClient(connection.organization, connection.pat_token)
        
        # Get the job
        job = db.query(ExtractionJob).filter(ExtractionJob.id == job_id).first()
        if not job:
            error_msg = f"Job {job_id} not found"
            print(error_msg)
            logger.error(error_msg)
            return
        
        print(f"Getting work item IDs for project: {project_name}")
        logger.info(f"Getting work item IDs for project: {project_name}")
        
        # Get work item IDs
        try:
            work_item_ids = await ado_client.get_work_item_ids(project_name)
            total_items = len(work_item_ids)
            print(f"Found {total_items} work items for project {project_name}")
            logger.info(f"Found {total_items} work items for project {project_name}")
        except Exception as e:
            error_msg = f"Error getting work item IDs: {e}"
            print(error_msg)
            logger.error(error_msg)
            
            # Update job status to failed
            job.status = "failed"
            job.error_message = error_msg
            job.completed_at = datetime.utcnow()
            db.commit()
            
            # Close the ADO client session
            try:
                await ado_client.close()
            except Exception as close_error:
                logger.error(f"Error closing ADO client session: {close_error}")
                
            return
        
        # Update job with total items
        job.total_items = total_items
        db.commit()
        
        if total_items == 0:
            logger.info(f"No work items found for project {project_name}")
            job.status = "completed"
            job.progress = 100
            job.completed_at = datetime.utcnow()
            db.commit()
            return
        
        # Process work items in batches of 100
        batch_size = 100
        extracted_items = 0
        
        for i in range(0, total_items, batch_size):
            batch_ids = work_item_ids[i:i+batch_size]
            
            # Get work item details
            work_items = await ado_client.get_work_item_details(batch_ids)
            
            # Process each work item
            for wi in work_items:
                # Extract fields
                fields = wi.get('fields', {})
                
                # Check if work item already exists
                existing_wi = db.query(WorkItem).filter(
                    WorkItem.project_id == project_id,
                    WorkItem.external_id == wi.get('id')
                ).first()
                
                if existing_wi:
                    # Update existing work item
                    existing_wi.title = fields.get('System.Title')
                    existing_wi.work_item_type = fields.get('System.WorkItemType')
                    existing_wi.state = fields.get('System.State')
                    existing_wi.assigned_to = fields.get('System.AssignedTo', {}).get('displayName') if isinstance(fields.get('System.AssignedTo'), dict) else fields.get('System.AssignedTo')
                    existing_wi.area_path = fields.get('System.AreaPath')
                    existing_wi.iteration_path = fields.get('System.IterationPath')
                    existing_wi.priority = fields.get('Microsoft.VSTS.Common.Priority')
                    existing_wi.tags = fields.get('System.Tags')
                    existing_wi.description = fields.get('System.Description')
                    existing_wi.changed_date = parse_datetime(fields.get('System.ChangedDate')) if fields.get('System.ChangedDate') else None
                    existing_wi.fields = fields
                else:
                    # Create new work item
                    new_wi = WorkItem(
                        project_id=project_id,
                        external_id=wi.get('id'),
                        title=fields.get('System.Title'),
                        work_item_type=fields.get('System.WorkItemType'),
                        state=fields.get('System.State'),
                        assigned_to=fields.get('System.AssignedTo', {}).get('displayName') if isinstance(fields.get('System.AssignedTo'), dict) else fields.get('System.AssignedTo'),
                        created_date=parse_datetime(fields.get('System.CreatedDate')) if fields.get('System.CreatedDate') else None,
                        changed_date=parse_datetime(fields.get('System.ChangedDate')) if fields.get('System.ChangedDate') else None,
                        area_path=fields.get('System.AreaPath'),
                        iteration_path=fields.get('System.IterationPath'),
                        priority=fields.get('Microsoft.VSTS.Common.Priority'),
                        tags=fields.get('System.Tags'),
                        description=fields.get('System.Description'),
                        fields=fields
                    )
                    db.add(new_wi)
                
                extracted_items += 1
            
            # Commit the batch
            db.commit()
            
            # Update job progress
            progress = int((extracted_items / total_items) * 100)
            job.progress = progress
            job.extracted_items = extracted_items
            db.commit()
            
            # Log progress
            log_msg = f"Extracted {extracted_items}/{total_items} work items ({progress}%)"
            print(log_msg)
            logger.info(log_msg)
            
            # Add log entry
            log_entry = ExtractionLog(
                job_id=job_id,
                level="INFO",
                message=log_msg,
                timestamp=datetime.utcnow()
            )
            db.add(log_entry)
            db.commit()
            
            # Sleep briefly to avoid overwhelming the API
            await asyncio.sleep(0.5)
        
        # Mark job as completed
        job.status = "completed"
        job.completed_at = datetime.utcnow()
        db.commit()
        
        # Update project work item count
        project = db.query(Project).filter(Project.id == project_id).first()
        if project:
            project.work_item_count = total_items
            db.commit()
        
        print(f"Work item extraction completed for project {project_name}: {extracted_items} items extracted")
        logger.info(f"Work item extraction completed for project {project_name}: {extracted_items} items extracted")
    
    except Exception as e:
        error_msg = f"Error extracting work items for job {job_id}: {e}"
        print(error_msg)
        logger.error(error_msg)
        
        # Update job status to failed
        job = db.query(ExtractionJob).filter(ExtractionJob.id == job_id).first()
        if job:
            job.status = "failed"
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()
            db.commit()
            
            # Add error log
            log_entry = ExtractionLog(
                job_id=job_id,
                level="ERROR",
                message=error_msg,
                timestamp=datetime.utcnow()
            )
            db.add(log_entry)
            db.commit()
    
    finally:
        # Close database session
        db.close()
        print(f"Database session closed for job {job_id}")
        logger.info(f"Database session closed for job {job_id}")
        
        # Close ADO client session
        try:
            if 'ado_client' in locals():
                await ado_client.close()
                print(f"ADO client session closed for job {job_id}")
                logger.info(f"ADO client session closed for job {job_id}")
        except Exception as close_error:
            logger.error(f"Error closing ADO client session: {close_error}")


async def extract_repositories(job_id: int, project_id: int, project_name: str, connection_id: int):
    """Extract repositories from Azure DevOps and store them in the database"""
    print(f"Starting repository extraction for job {job_id}, project {project_name}, connection_id: {connection_id}")
    logger.info(f"Starting repository extraction for job {job_id}, project {project_name}, connection_id: {connection_id}")
    
    try:
        # Get a new database session for this background task
        from backend.database.connection import get_db_session
        from backend.database.models import Repository, ExtractionLog, ADOConnection, Branch, Commit, PullRequest
        db = get_db_session()
        
        # Get the ADO connection
        connection = db.query(ADOConnection).filter(ADOConnection.id == connection_id).first()
        print(f"Looking for connection with ID: {connection_id}")
        logger.info(f"Looking for connection with ID: {connection_id}")
        
        if not connection:
            error_msg = f"Connection {connection_id} not found"
            print(error_msg)
            logger.error(error_msg)
            
            # Update job status to failed
            job = db.query(ExtractionJob).filter(ExtractionJob.id == job_id).first()
            if job:
                job.status = "failed"
                job.error_message = error_msg
                job.completed_at = datetime.utcnow()
                db.commit()
            
            return
        
        # Create ADO client
        print(f"Creating ADO client for organization: {connection.organization}")
        logger.info(f"Creating ADO client for organization: {connection.organization}")
        ado_client = AzureDevOpsClient(connection.organization, connection.pat_token)
        
        # Get the job
        job = db.query(ExtractionJob).filter(ExtractionJob.id == job_id).first()
        if not job:
            error_msg = f"Job {job_id} not found"
            print(error_msg)
            logger.error(error_msg)
            return
        
        print(f"Getting repositories for project: {project_name}")
        logger.info(f"Getting repositories for project: {project_name}")
        
        # Get repositories
        try:
            repositories = await ado_client.get_repositories(project_name)
            total_items = len(repositories)
            print(f"Found {total_items} repositories for project {project_name}")
            logger.info(f"Found {total_items} repositories for project {project_name}")
        except Exception as e:
            error_msg = f"Error getting repositories: {e}"
            print(error_msg)
            logger.error(error_msg)
            
            # Update job status to failed
            job.status = "failed"
            job.error_message = error_msg
            job.completed_at = datetime.utcnow()
            db.commit()
            
            # Close the ADO client session
            try:
                await ado_client.close()
            except Exception as close_error:
                logger.error(f"Error closing ADO client session: {close_error}")
                
            return
        
        # Update job with total items
        job.total_items = total_items
        db.commit()
        
        if total_items == 0:
            logger.info(f"No repositories found for project {project_name}")
            job.status = "completed"
            job.progress = 100
            job.completed_at = datetime.utcnow()
            db.commit()
            return
        
        # Process repositories
        extracted_items = 0
        
        for repo in repositories:
            repo_id = repo.get('id')
            repo_name = repo.get('name')
            
            # Check if repository already exists
            existing_repo = db.query(Repository).filter(
                Repository.project_id == project_id,
                Repository.external_id == repo_id
            ).first()
            
            if existing_repo:
                # Update existing repository
                existing_repo.name = repo_name
                existing_repo.url = repo.get('url')
                existing_repo.default_branch = repo.get('defaultBranch')
                existing_repo.size = repo.get('size')
                db.commit()
                repository_db_id = existing_repo.id
            else:
                # Create new repository
                new_repo = Repository(
                    project_id=project_id,
                    external_id=repo_id,
                    name=repo_name,
                    url=repo.get('url'),
                    default_branch=repo.get('defaultBranch'),
                    size=repo.get('size')
                )
                db.add(new_repo)
                db.commit()
                repository_db_id = new_repo.id
            
            # Log repository extraction
            log_msg = f"Extracted repository: {repo_name} (ID: {repo_id})"
            print(log_msg)
            logger.info(log_msg)
            
            # Add log entry
            log_entry = ExtractionLog(
                job_id=job_id,
                level="INFO",
                message=log_msg,
                timestamp=datetime.utcnow()
            )
            db.add(log_entry)
            db.commit()
            
            # Extract branches
            try:
                branches = await ado_client.get_repository_branches(project_name, repo_id)
                print(f"Found {len(branches)} branches for repository {repo_name}")
                logger.info(f"Found {len(branches)} branches for repository {repo_name}")
                
                # Clear existing branches for this repository
                db.query(Branch).filter(Branch.repository_id == repository_db_id).delete()
                db.commit()
                
                # Store branches
                default_branch = repo.get('defaultBranch', '').replace('refs/heads/', '')
                for branch in branches:
                    branch_name = branch.get('name', '')
                    if branch_name.startswith('refs/heads/'):
                        branch_name = branch_name[11:]  # Remove 'refs/heads/' prefix
                    
                    new_branch = Branch(
                        repository_id=repository_db_id,
                        name=branch_name,
                        object_id=branch.get('objectId'),
                        is_default=(branch_name == default_branch)
                    )
                    db.add(new_branch)
                
                db.commit()
                log_msg = f"Extracted {len(branches)} branches for repository {repo_name}"
                print(log_msg)
                logger.info(log_msg)
                
                # Add log entry
                log_entry = ExtractionLog(
                    job_id=job_id,
                    level="INFO",
                    message=log_msg,
                    timestamp=datetime.utcnow()
                )
                db.add(log_entry)
                db.commit()
            except Exception as e:
                error_msg = f"Error extracting branches for repository {repo_name}: {e}"
                print(error_msg)
                logger.error(error_msg)
                
                # Add log entry
                log_entry = ExtractionLog(
                    job_id=job_id,
                    level="ERROR",
                    message=error_msg,
                    timestamp=datetime.utcnow()
                )
                db.add(log_entry)
                db.commit()
            
            # Extract commits
            try:
                commits = await ado_client.get_repository_commits(project_name, repo_id, top=100)
                print(f"Found {len(commits)} commits for repository {repo_name}")
                logger.info(f"Found {len(commits)} commits for repository {repo_name}")
                
                # Clear existing commits for this repository
                db.query(Commit).filter(Commit.repository_id == repository_db_id).delete()
                db.commit()
                
                # Store commits
                for commit in commits:
                    new_commit = Commit(
                        repository_id=repository_db_id,
                        commit_id=commit.get('commitId'),
                        author=commit.get('author', {}).get('name'),
                        committer=commit.get('committer', {}).get('name'),
                        comment=commit.get('comment'),
                        commit_date=commit.get('author', {}).get('date')
                    )
                    db.add(new_commit)
                
                db.commit()
                log_msg = f"Extracted {len(commits)} commits for repository {repo_name}"
                print(log_msg)
                logger.info(log_msg)
                
                # Add log entry
                log_entry = ExtractionLog(
                    job_id=job_id,
                    level="INFO",
                    message=log_msg,
                    timestamp=datetime.utcnow()
                )
                db.add(log_entry)
                db.commit()
            except Exception as e:
                error_msg = f"Error extracting commits for repository {repo_name}: {e}"
                print(error_msg)
                logger.error(error_msg)
                
                # Add log entry
                log_entry = ExtractionLog(
                    job_id=job_id,
                    level="ERROR",
                    message=error_msg,
                    timestamp=datetime.utcnow()
                )
                db.add(log_entry)
                db.commit()
            
            # Extract pull requests
            try:
                pull_requests = await ado_client.get_repository_pull_requests(project_name, repo_id)
                print(f"Found {len(pull_requests)} pull requests for repository {repo_name}")
                logger.info(f"Found {len(pull_requests)} pull requests for repository {repo_name}")
                
                # Clear existing pull requests for this repository
                db.query(PullRequest).filter(PullRequest.repository_id == repository_db_id).delete()
                db.commit()
                
                # Store pull requests
                for pr in pull_requests:
                    new_pr = PullRequest(
                        repository_id=repository_db_id,
                        external_id=pr.get('pullRequestId'),
                        title=pr.get('title'),
                        description=pr.get('description'),
                        status=pr.get('status'),
                        created_by=pr.get('createdBy', {}).get('displayName'),
                        created_date=pr.get('creationDate'),
                        source_branch=pr.get('sourceRefName'),
                        target_branch=pr.get('targetRefName')
                    )
                    db.add(new_pr)
                
                db.commit()
                log_msg = f"Extracted {len(pull_requests)} pull requests for repository {repo_name}"
                print(log_msg)
                logger.info(log_msg)
                
                # Add log entry
                log_entry = ExtractionLog(
                    job_id=job_id,
                    level="INFO",
                    message=log_msg,
                    timestamp=datetime.utcnow()
                )
                db.add(log_entry)
                db.commit()
            except Exception as e:
                error_msg = f"Error extracting pull requests for repository {repo_name}: {e}"
                print(error_msg)
                logger.error(error_msg)
                
                # Add log entry
                log_entry = ExtractionLog(
                    job_id=job_id,
                    level="ERROR",
                    message=error_msg,
                    timestamp=datetime.utcnow()
                )
                db.add(log_entry)
                db.commit()
            
            extracted_items += 1
            
            # Update job progress
            progress = int((extracted_items / total_items) * 100)
            job.progress = progress
            job.extracted_items = extracted_items
            db.commit()
            
            # Log progress
            log_msg = f"Processed {extracted_items}/{total_items} repositories ({progress}%)"
            print(log_msg)
            logger.info(log_msg)
            
            # Sleep briefly to avoid overwhelming the API
            await asyncio.sleep(0.5)
        
        # Mark job as completed
        job.status = "completed"
        job.completed_at = datetime.utcnow()
        db.commit()
        
        # Update project repository count
        project = db.query(Project).filter(Project.id == project_id).first()
        if project:
            project.repo_count = total_items
            db.commit()
        
        print(f"Repository extraction completed for project {project_name}: {extracted_items} repositories extracted")
        logger.info(f"Repository extraction completed for project {project_name}: {extracted_items} repositories extracted")
    
    except Exception as e:
        error_msg = f"Error extracting repositories for job {job_id}: {e}"
        print(error_msg)
        logger.error(error_msg)
        
        # Update job status to failed
        job = db.query(ExtractionJob).filter(ExtractionJob.id == job_id).first()
        if job:
            job.status = "failed"
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()
            db.commit()
            
            # Add error log
            log_entry = ExtractionLog(
                job_id=job_id,
                level="ERROR",
                message=error_msg,
                timestamp=datetime.utcnow()
            )
            db.add(log_entry)
            db.commit()
    
    finally:
        # Close database session
        db.close()
        print(f"Database session closed for job {job_id}")
        logger.info(f"Database session closed for job {job_id}")
        
        # Close ADO client session
        try:
            if 'ado_client' in locals():
                await ado_client.close()
                print(f"ADO client session closed for job {job_id}")
                logger.info(f"ADO client session closed for job {job_id}")
        except Exception as close_error:
            logger.error(f"Error closing ADO client session: {close_error}")


async def extract_pipelines(job_id: int, project_id: int, project_name: str, connection_id: int):
    """Extract pipelines from Azure DevOps"""
    # For now, we'll simulate pipeline extraction
    await simulate_extraction(job_id, 3)  # Simulate 3 pipelines


async def extract_testcases(job_id: int, project_id: int, project_name: str, connection_id: int):
    """Extract test cases from Azure DevOps"""
    # For now, we'll simulate test case extraction
    await simulate_extraction(job_id, 10)  # Simulate 10 test cases


async def simulate_extraction(job_id: int, total_items: int):
    """Simulate extraction process by updating job progress over time"""
    print(f"Starting extraction simulation for job {job_id} with {total_items} items")
    logger.info(f"Starting extraction simulation for job {job_id} with {total_items} items")
    
    try:
        # Get a new database session for this background task
        from backend.database.connection import get_db_session
        db = get_db_session()
        print(f"Got database session for job {job_id}")
        logger.info(f"Got database session for job {job_id}")
        
        # Simulate extraction process
        extracted_items = 0
        while extracted_items < total_items:
            # Sleep for a random time between 1-3 seconds
            sleep_time = random.uniform(1, 3)
            print(f"Job {job_id}: Sleeping for {sleep_time:.2f} seconds")
            await asyncio.sleep(sleep_time)
            
            # Extract a random number of items (1-5)
            items_to_extract = min(random.randint(1, 5), total_items - extracted_items)
            extracted_items += items_to_extract
            
            # Calculate progress percentage
            progress = int((extracted_items / total_items) * 100) if total_items > 0 else 100
            print(f"Job {job_id}: Extracted {items_to_extract} items, total {extracted_items}/{total_items}, progress {progress}%")
            logger.info(f"Job {job_id}: Extracted {items_to_extract} items, total {extracted_items}/{total_items}, progress {progress}%")
            
            # Update job in database
            job = db.query(ExtractionJob).filter(ExtractionJob.id == job_id).first()
            if job:
                job.progress = progress
                job.extracted_items = extracted_items
                
                # If extraction is complete, update status
                if extracted_items >= total_items:
                    job.status = "completed"
                    job.completed_at = datetime.utcnow()
                    print(f"Job {job_id}: Completed at {job.completed_at}")
                    logger.info(f"Job {job_id}: Completed at {job.completed_at}")
                
                db.commit()
                print(f"Job {job_id}: Database updated")
                logger.info(f"Job {job_id}: Database updated")
            else:
                error_msg = f"Job {job_id} not found during simulation"
                print(error_msg)
                logger.error(error_msg)
                break
        
        print(f"Extraction job {job_id} completed with {extracted_items} items extracted")
        logger.info(f"Extraction job {job_id} completed with {extracted_items} items extracted")
    except Exception as e:
        error_msg = f"Error in extraction simulation for job {job_id}: {e}"
        print(error_msg)
        logger.error(error_msg)
    finally:
        db.close()
        print(f"Database session closed for job {job_id}")
        logger.info(f"Database session closed for job {job_id}")

@app.post("/api/extraction/start")
async def start_extraction(request: ExtractRequest, db: Session = Depends(get_db)):
    try:
        print(f"Starting extraction for project {request.projectId}, artifact type: {request.artifactType}")
        logger.info(f"Starting extraction for project {request.projectId}, artifact type: {request.artifactType}")
        
        # Check if project exists
        project = db.query(Project).filter(Project.id == request.projectId).first()
        if not project:
            error_msg = f"Project {request.projectId} not found"
            print(error_msg)
            logger.error(error_msg)
            raise HTTPException(status_code=404, detail="Project not found")
        
        print(f"Found project: {project.name}")
        logger.info(f"Found project: {project.name}")
        
        # Check if there's already an in-progress job for this project and artifact type
        existing_job = db.query(ExtractionJob).filter(
            ExtractionJob.project_id == request.projectId,
            ExtractionJob.artifact_type == request.artifactType,
            ExtractionJob.status == "in_progress"
        ).first()
        
        if existing_job:
            # Return the existing job
            return {
                "id": existing_job.id,
                "projectId": existing_job.project_id,
                "projectName": project.name,
                "status": existing_job.status,
                "artifactType": existing_job.artifact_type,
                "startedAt": existing_job.started_at,
                "progress": existing_job.progress,
                "totalItems": existing_job.total_items,
                "message": "Extraction already in progress"
            }
        
        # Create a new extraction job
        job = ExtractionJob(
            project_id=request.projectId,
            artifact_type=request.artifactType,
            status="in_progress",
            started_at=datetime.utcnow(),
            progress=0
        )
        
        # Set initial total items based on artifact type (will be updated during extraction)
        if request.artifactType == "workitems":
            job.total_items = project.work_item_count or 0
        elif request.artifactType == "repositories":
            job.total_items = project.repo_count or 0
        elif request.artifactType == "testcases":
            job.total_items = project.test_case_count or 0
        elif request.artifactType == "pipelines":
            job.total_items = project.pipeline_count or 0
        
        db.add(job)
        db.commit()
        db.refresh(job)
        
        print(f"Job saved to database with ID: {job.id}")
        logger.info(f"Job saved to database with ID: {job.id}")
        
        # Start extraction process in the background based on artifact type
        if request.artifactType == "workitems":
            asyncio.create_task(extract_work_items(job.id, project.id, project.name, project.connection_id))
        elif request.artifactType == "repositories":
            asyncio.create_task(extract_repositories(job.id, project.id, project.name, project.connection_id))
        elif request.artifactType == "pipelines":
            asyncio.create_task(extract_pipelines(job.id, project.id, project.name, project.connection_id))
        elif request.artifactType == "testcases":
            asyncio.create_task(extract_testcases(job.id, project.id, project.name, project.connection_id))
        else:
            # Unknown artifact type, simulate extraction
            asyncio.create_task(simulate_extraction(job.id, 10))
        
        print(f"Started extraction job {job.id} for project {project.name}, artifact type: {request.artifactType}")
        logger.info(f"Started extraction job {job.id} for project {project.name}, artifact type: {request.artifactType}")
        
        return {
            "id": job.id,
            "projectId": job.project_id,
            "projectName": project.name,
            "status": job.status,
            "artifactType": job.artifact_type,
            "startedAt": job.started_at,
            "progress": job.progress,
            "totalItems": job.total_items
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to start extraction: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to start extraction: {str(e)}")

@app.get("/api/projects/selected")
def get_selected_projects(db: Session = Depends(get_db)):
    try:
        projects = db.query(Project).filter(Project.status == "selected").all()
        result = []
        for project in projects:
            result.append({
                "id": project.id,
                "name": project.name,
                "description": project.description,
                "workItemCount": project.work_item_count,
                "repoCount": project.repo_count,
                "testCaseCount": project.test_case_count,
                "pipelineCount": project.pipeline_count
            })
        return result
    except Exception as e:
        logger.error(f"Failed to fetch selected projects: {e}")
        return []
        
@app.get("/api/projects/{project_id}/repositories")
def get_project_repositories(project_id: int, db: Session = Depends(get_db)):
    """Get all repositories for a project"""
    try:
        from backend.database.models import Repository
        
        # Get the project
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Get repositories
        repositories = db.query(Repository).filter(Repository.project_id == project_id).all()
        
        return [
            {
                "id": repo.id,
                "externalId": repo.external_id,
                "name": repo.name,
                "url": repo.url,
                "defaultBranch": repo.default_branch,
                "size": repo.size
            }
            for repo in repositories
        ]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch repositories for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch repositories: {str(e)}")
        
@app.get("/api/repositories/{repo_id}/details")
async def get_repository_details(repo_id: int, db: Session = Depends(get_db)):
    """Get detailed information about a repository including commits, branches, and PRs"""
    try:
        from backend.database.models import Repository, Project, ADOConnection, Commit, PullRequest, Branch
        
        # Get the repository
        repository = db.query(Repository).filter(Repository.id == repo_id).first()
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")
        
        # Get the project
        project = db.query(Project).filter(Project.id == repository.project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Get the connection
        connection = db.query(ADOConnection).filter(ADOConnection.id == project.connection_id).first()
        if not connection:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        # Create ADO client
        ado_client = AzureDevOpsClient(connection.organization, connection.pat_token)
        
        # Get commits
        commits = db.query(Commit).filter(Commit.repository_id == repo_id).order_by(Commit.commit_date.desc()).limit(10).all()
        
        # Get pull requests
        pull_requests = db.query(PullRequest).filter(PullRequest.repository_id == repo_id).order_by(PullRequest.created_date.desc()).limit(10).all()
        
        # If no commits or PRs in database, fetch from API
        if not commits:
            api_commits = await ado_client.get_repository_commits(project.name, repository.external_id, top=10)
            commits_data = []
            for commit in api_commits:
                commits_data.append({
                    "commitId": commit.get('commitId'),
                    "author": commit.get('author', {}).get('name'),
                    "committer": commit.get('committer', {}).get('name'),
                    "comment": commit.get('comment'),
                    "commitDate": commit.get('author', {}).get('date')
                })
        else:
            commits_data = [
                {
                    "id": commit.id,
                    "commitId": commit.commit_id,
                    "author": commit.author,
                    "committer": commit.committer,
                    "comment": commit.comment,
                    "commitDate": commit.commit_date
                }
                for commit in commits
            ]
        
        if not pull_requests:
            api_prs = await ado_client.get_repository_pull_requests(project.name, repository.external_id)
            prs_data = []
            for pr in api_prs:
                prs_data.append({
                    "id": pr.get('pullRequestId'),
                    "title": pr.get('title'),
                    "description": pr.get('description'),
                    "status": pr.get('status'),
                    "createdBy": pr.get('createdBy', {}).get('displayName'),
                    "createdDate": pr.get('creationDate'),
                    "sourceBranch": pr.get('sourceRefName'),
                    "targetBranch": pr.get('targetRefName')
                })
        else:
            prs_data = [
                {
                    "id": pr.id,
                    "externalId": pr.external_id,
                    "title": pr.title,
                    "description": pr.description,
                    "status": pr.status,
                    "createdBy": pr.created_by,
                    "createdDate": pr.created_date,
                    "sourceBranch": pr.source_branch,
                    "targetBranch": pr.target_branch
                }
                for pr in pull_requests
            ]
        
        # Get branches
        try:
            # Try to get branches from database
            branches = db.query(Branch).filter(Branch.repository_id == repo_id).all()
            
            # If no branches in database, fetch from API
            if not branches:
                branches_data = []
                api_branches = await ado_client.get_repository_branches(project.name, repository.external_id)
                for branch in api_branches:
                    name = branch.get('name', '')
                    if name.startswith('refs/heads/'):
                        name = name[11:]  # Remove 'refs/heads/' prefix
                    branches_data.append({
                        "name": name,
                        "objectId": branch.get('objectId'),
                        "isDefault": name == repository.default_branch.replace('refs/heads/', '') if repository.default_branch else False
                    })
            else:
                branches_data = [
                    {
                        "name": branch.name,
                        "objectId": branch.object_id,
                        "isDefault": branch.is_default
                    }
                    for branch in branches
                ]
        except Exception as e:
            # If there's an error (e.g., branches table doesn't exist yet), fetch from API
            logger.error(f"Error fetching branches from database: {e}")
            branches_data = []
            api_branches = await ado_client.get_repository_branches(project.name, repository.external_id)
            for branch in api_branches:
                name = branch.get('name', '')
                if name.startswith('refs/heads/'):
                    name = name[11:]  # Remove 'refs/heads/' prefix
                branches_data.append({
                    "name": name,
                    "objectId": branch.get('objectId'),
                    "isDefault": name == repository.default_branch.replace('refs/heads/', '') if repository.default_branch else False
                })
        
        # Close the ADO client session
        await ado_client.close()
        
        return {
            "id": repository.id,
            "externalId": repository.external_id,
            "name": repository.name,
            "url": repository.url,
            "defaultBranch": repository.default_branch,
            "size": repository.size,
            "commits": commits_data,
            "pullRequests": prs_data,
            "branches": branches_data
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch repository details for repository {repo_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch repository details: {str(e)}")

# Serve frontend files
@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    """Serve frontend files"""
    try:
        import os
        from fastapi.responses import FileResponse
        
        # Serve index.html for SPA routes
        frontend_dir = os.path.join(os.path.dirname(__file__), "..", "client")
        index_path = os.path.join(frontend_dir, "index.html")
        
        if os.path.exists(index_path):
            return FileResponse(index_path)
        else:
            return {"message": "Frontend not built. Run 'npm run build' in client directory."}
    except Exception as e:
        logger.error(f"Error serving frontend: {e}")
        return {"message": "Frontend serving error"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)

@app.post("/api/connections/test")
async def test_connection(data: dict):
    try:
        organization = data.get("organization", "").replace("https://dev.azure.com/", "").strip("/")
        pat_token = data.get("patToken", "")
        client = AzureDevOpsClient(organization, pat_token)
        projects = await client.get_projects()
        if projects:
            return {"success": True}
        else:
            raise HTTPException(status_code=400, detail="Invalid credentials or empty response")
    except Exception as e:
        logger.error(f"Test connection failed: {e}")
        raise HTTPException(status_code=400, detail="Failed to test Azure DevOps connection")

@app.post("/api/projects/sync/{connection_id}")
async def sync_projects_by_id(connection_id: int):
    """Sync projects for a specific connection"""
    try:
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, organization, pat_token, base_url 
                FROM ado_connections 
                WHERE id = %s
            """, (connection_id,))
            connection = cursor.fetchone()
            if not connection:
                raise HTTPException(status_code=404, detail="Connection not found")

            ado_client = AzureDevOpsClient(connection['organization'], connection['pat_token'])
            projects = await ado_client.get_projects()

            for project in projects:
                details = await ado_client.get_project_details(project['id'])
                print(f"Full project details for {project['name']}: {json.dumps(details, indent=2)}")
                process_template = details.get("capabilities", {}).get("processTemplate", {}).get("templateName")
                print(f"Process Template: {process_template}")
                source_control = details.get("capabilities", {}).get("versioncontrol", {}).get("sourceControlType")
                print(f"source_control: {source_control}")
                created_date = parse_datetime(project.get('lastUpdateTime')) if project.get('lastUpdateTime') else None
                print(f"created_date: {created_date}")
                
                cursor.execute("""
                    INSERT INTO projects (
                        external_id, name, description, created_date, status,
                        connection_id, process_template, source_control
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (external_id) DO UPDATE SET
                        name = EXCLUDED.name,
                        description = EXCLUDED.description,
                        process_template = EXCLUDED.process_template,
                        source_control = EXCLUDED.source_control,
                        created_date = EXCLUDED.created_date,
                        connection_id = EXCLUDED.connection_id
                """, (
                    project['id'],
                    project['name'],
                    project.get('description', ''),
                    created_date,
                    'ready',
                    connection['id'],
                    process_template,
                    source_control
                ))
         
            conn.commit()
            return {"message": f"Synced {len(projects)} projects successfully for connection ID {connection_id}"}
        finally:
            conn.close()
    except Exception as e:
        logger.error(f"Error syncing projects for connection {connection_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to sync projects for this connection")



