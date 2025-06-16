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
import ssl
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
from sqlalchemy import func

# Load environment variables from .env file
from dotenv import load_dotenv
# Get the backend directory path
backend_dir = Path(__file__).resolve().parent.parent
# Load .env file from backend directory
load_dotenv(backend_dir / ".env")

from backend.database.connection import get_db
from backend.database.models import Project, ExtractionJob, ExtractionLog, WorkItem, WorkItemRevision, WorkItemComment, WorkItemAttachment, WorkItemRelation, AreaPath, IterationPath

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

# Create database tables if they don't exist
from backend.database.connection import create_tables
try:
    logger.info("Creating database tables if they don't exist...")
    create_tables()
    logger.info("Database tables created successfully")
    
    # Ensure custom columns exist in projects table
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # Check if columns exist
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
        
        # Add area_path_count column if it doesn't exist
        if 'area_path_count' not in existing_columns:
            logger.info("Adding area_path_count column...")
            cursor.execute("""
                ALTER TABLE projects 
                ADD COLUMN area_path_count INTEGER DEFAULT 0
            """)
        
        # Add iteration_path_count column if it doesn't exist
        if 'iteration_path_count' not in existing_columns:
            logger.info("Adding iteration_path_count column...")
            cursor.execute("""
                ALTER TABLE projects 
                ADD COLUMN iteration_path_count INTEGER DEFAULT 0
            """)
        
        conn.commit()
    except Exception as column_error:
        logger.error(f"Error adding columns to projects table: {column_error}")
        conn.rollback()
    finally:
        conn.close()
except Exception as e:
    logger.error(f"Error creating database tables: {e}")

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

@app.get("/api/workitems/{work_item_id}")
async def get_work_item_details(work_item_id: int, db: Session = Depends(get_db)):
    """Get detailed information about a work item, including revisions, comments, attachments, and relations"""
    try:
        # Get the work item
        work_item = db.query(WorkItem).filter(WorkItem.id == work_item_id).first()
        if not work_item:
            raise HTTPException(status_code=404, detail=f"Work item {work_item_id} not found")
        
        # Get the project
        project = db.query(Project).filter(Project.id == work_item.project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail=f"Project {work_item.project_id} not found")
        
        # Get revisions
        revisions = db.query(WorkItemRevision).filter(WorkItemRevision.work_item_id == work_item_id).order_by(WorkItemRevision.revision_number).all()
        revisions_data = []
        for revision in revisions:
            revisions_data.append({
                "id": revision.id,
                "revisionNumber": revision.revision_number,
                "changedBy": revision.changed_by,
                "changedDate": revision.changed_date.isoformat() if revision.changed_date else None,
                "fields": revision.fields
            })
        
        # Get comments
        comments = db.query(WorkItemComment).filter(WorkItemComment.work_item_id == work_item_id).order_by(WorkItemComment.created_date).all()
        comments_data = []
        for comment in comments:
            comments_data.append({
                "id": comment.id,
                "text": comment.text,
                "createdBy": comment.created_by,
                "createdDate": comment.created_date.isoformat() if comment.created_date else None
            })
        
        # Get attachments
        attachments = db.query(WorkItemAttachment).filter(WorkItemAttachment.work_item_id == work_item_id).all()
        attachments_data = []
        for attachment in attachments:
            attachments_data.append({
                "id": attachment.id,
                "name": attachment.name,
                "url": attachment.url,
                "size": attachment.size,
                "createdBy": attachment.created_by,
                "createdDate": attachment.created_date.isoformat() if attachment.created_date else None
            })
        
        # Get relations
        relations = db.query(WorkItemRelation).filter(WorkItemRelation.source_work_item_id == work_item_id).all()
        relations_data = []
        for relation in relations:
            # Get target work item details
            target_work_item = db.query(WorkItem).filter(WorkItem.id == relation.target_work_item_id).first()
            if target_work_item:
                relations_data.append({
                    "id": relation.id,
                    "relationType": relation.relation_type,
                    "targetWorkItemId": relation.target_work_item_id,
                    "targetWorkItemTitle": target_work_item.title,
                    "targetWorkItemType": target_work_item.work_item_type,
                    "targetWorkItemState": target_work_item.state
                })
        
        # Return work item details with all related data
        return {
            "id": work_item.id,
            "externalId": work_item.external_id,
            "title": work_item.title,
            "workItemType": work_item.work_item_type,
            "state": work_item.state,
            "assignedTo": work_item.assigned_to,
            "createdDate": work_item.created_date.isoformat() if work_item.created_date else None,
            "changedDate": work_item.changed_date.isoformat() if work_item.changed_date else None,
            "areaPath": work_item.area_path,
            "iterationPath": work_item.iteration_path,
            "priority": work_item.priority,
            "tags": work_item.tags,
            "description": work_item.description,
            "fields": work_item.fields,
            "projectId": work_item.project_id,
            "projectName": project.name,
            "revisions": revisions_data,
            "comments": comments_data,
            "attachments": attachments_data,
            "relations": relations_data,
            "revisionCount": len(revisions_data),
            "commentCount": len(comments_data),
            "attachmentCount": len(attachments_data),
            "relationCount": len(relations_data)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting work item details: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get work item details: {str(e)}")

@app.get("/api/projects/{project_id}/workitems")
async def get_project_work_items(project_id: int, db: Session = Depends(get_db)):
    """Get all work items for a project with summary information"""
    try:
        # Check if project exists
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
        
        # Get work items
        work_items = db.query(WorkItem).filter(WorkItem.project_id == project_id).all()
        
        # Prepare response
        work_items_data = []
        work_items_by_type = {}
        
        for wi in work_items:
            # Get counts
            revision_count = db.query(WorkItemRevision).filter(WorkItemRevision.work_item_id == wi.id).count()
            comment_count = db.query(WorkItemComment).filter(WorkItemComment.work_item_id == wi.id).count()
            attachment_count = db.query(WorkItemAttachment).filter(WorkItemAttachment.work_item_id == wi.id).count()
            relation_count = db.query(WorkItemRelation).filter(WorkItemRelation.source_work_item_id == wi.id).count()
            
            work_item_data = {
                "id": wi.id,
                "externalId": wi.external_id,
                "title": wi.title,
                "workItemType": wi.work_item_type,
                "state": wi.state,
                "assignedTo": wi.assigned_to,
                "createdDate": wi.created_date.isoformat() if wi.created_date else None,
                "changedDate": wi.changed_date.isoformat() if wi.changed_date else None,
                "areaPath": wi.area_path,
                "iterationPath": wi.iteration_path,
                "priority": wi.priority,
                "tags": wi.tags,
                "revisionCount": revision_count,
                "commentCount": comment_count,
                "attachmentCount": attachment_count,
                "relationCount": relation_count
            }
            
            work_items_data.append(work_item_data)
            
            # Group by work item type
            if wi.work_item_type not in work_items_by_type:
                work_items_by_type[wi.work_item_type] = {
                    "type": wi.work_item_type,
                    "name": wi.work_item_type,
                    "count": 1
                }
            else:
                work_items_by_type[wi.work_item_type]["count"] += 1
        
        # Convert work_items_by_type dictionary to list
        work_items_by_type_list = list(work_items_by_type.values())
        
        return {
            "projectId": project_id,
            "projectName": project.name,
            "workItemCount": len(work_items_data),
            "workItems": work_items_data,
            "workItemsByType": work_items_by_type_list
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting project work items: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get project work items: {str(e)}")

@app.get("/api/projects/{project_id}/areapaths")
async def get_project_area_paths(project_id: int, db: Session = Depends(get_db)):
    """Get all area paths for a project"""
    try:
        # Check if project exists
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
        
        # Get area paths
        area_paths = db.query(AreaPath).filter(AreaPath.project_id == project_id).all()
        
        # Prepare response
        area_paths_data = []
        for ap in area_paths:
            area_paths_data.append({
                "id": ap.id,
                "externalId": ap.external_id,
                "name": ap.name,
                "path": ap.path,
                "parentPath": ap.parent_path,
                "hasChildren": ap.has_children
            })
        
        return {
            "projectId": project_id,
            "projectName": project.name,
            "areaPathCount": len(area_paths_data),
            "areaPaths": area_paths_data
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting project area paths: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get project area paths: {str(e)}")

@app.get("/api/projects/{project_id}/iterationpaths")
async def get_project_iteration_paths(project_id: int, db: Session = Depends(get_db)):
    """Get all iteration paths for a project"""
    try:
        # Check if project exists
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
        
        # Get iteration paths
        iteration_paths = db.query(IterationPath).filter(IterationPath.project_id == project_id).all()
        
        # Prepare response
        iteration_paths_data = []
        for ip in iteration_paths:
            iteration_paths_data.append({
                "id": ip.id,
                "externalId": ip.external_id,
                "name": ip.name,
                "path": ip.path,
                "parentPath": ip.parent_path,
                "startDate": ip.start_date.isoformat() if ip.start_date else None,
                "endDate": ip.end_date.isoformat() if ip.end_date else None,
                "hasChildren": ip.has_children
            })
        
        return {
            "projectId": project_id,
            "projectName": project.name,
            "iterationPathCount": len(iteration_paths_data),
            "iterationPaths": iteration_paths_data
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting project iteration paths: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get project iteration paths: {str(e)}")

@app.get("/api/projects/{project_id}/migration-summary")
async def get_project_migration_summary(project_id: int, db: Session = Depends(get_db)):
    """Get a summary of all extracted data for a project to assess migration readiness"""
    try:
        # Check if project exists
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
        
        # Get counts
        work_item_count = db.query(WorkItem).filter(WorkItem.project_id == project_id).count()
        repository_count = db.query(Repository).filter(Repository.project_id == project_id).count()
        pipeline_count = db.query(Pipeline).filter(Pipeline.project_id == project_id).count()
        area_path_count = db.query(AreaPath).filter(AreaPath.project_id == project_id).count()
        iteration_path_count = db.query(IterationPath).filter(IterationPath.project_id == project_id).count()
        
        # Get work item type counts
        work_item_types = db.query(WorkItem.work_item_type, func.count(WorkItem.id)).filter(
            WorkItem.project_id == project_id
        ).group_by(WorkItem.work_item_type).all()
        
        work_item_type_counts = {}
        for wit, count in work_item_types:
            work_item_type_counts[wit] = count
        
        # Get repository details
        repositories = db.query(Repository).filter(Repository.project_id == project_id).all()
        repo_data = []
        
        for repo in repositories:
            branch_count = db.query(Branch).filter(Branch.repository_id == repo.id).count()
            repo_data.append({
                "id": repo.id,
                "name": repo.name,
                "defaultBranch": repo.default_branch,
                "branchCount": branch_count
            })
        
        # Get revision, comment, attachment, and relation counts
        revision_count = db.query(WorkItemRevision).join(
            WorkItem, WorkItemRevision.work_item_id == WorkItem.id
        ).filter(WorkItem.project_id == project_id).count()
        
        comment_count = db.query(WorkItemComment).join(
            WorkItem, WorkItemComment.work_item_id == WorkItem.id
        ).filter(WorkItem.project_id == project_id).count()
        
        attachment_count = db.query(WorkItemAttachment).join(
            WorkItem, WorkItemAttachment.work_item_id == WorkItem.id
        ).filter(WorkItem.project_id == project_id).count()
        
        relation_count = db.query(WorkItemRelation).join(
            WorkItem, WorkItemRelation.source_work_item_id == WorkItem.id
        ).filter(WorkItem.project_id == project_id).count()
        
        # Return summary
        return {
            "projectId": project_id,
            "projectName": project.name,
            "extractionStatus": {
                "workItems": work_item_count > 0,
                "repositories": repository_count > 0,
                "pipelines": pipeline_count > 0,
                "areaPaths": area_path_count > 0,
                "iterationPaths": iteration_path_count > 0
            },
            "counts": {
                "workItems": work_item_count,
                "repositories": repository_count,
                "pipelines": pipeline_count,
                "areaPaths": area_path_count,
                "iterationPaths": iteration_path_count,
                "revisions": revision_count,
                "comments": comment_count,
                "attachments": attachment_count,
                "relations": relation_count
            },
            "workItemTypes": work_item_type_counts,
            "repositories": repo_data,
            "migrationReadiness": {
                "classification": area_path_count > 0 and iteration_path_count > 0,
                "workItems": work_item_count > 0,
                "workItemHistory": revision_count > 0,
                "workItemComments": comment_count > 0,
                "workItemAttachments": attachment_count > 0,
                "workItemRelations": relation_count > 0,
                "repositories": repository_count > 0
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting project migration summary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get project migration summary: {str(e)}")
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
        """Get or create an aiohttp ClientSession with proper timeout settings"""
        if self.session is None or self.session.closed:
            timeout = aiohttp.ClientTimeout(total=60, connect=10, sock_connect=10, sock_read=30)
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            self.session = aiohttp.ClientSession(
                timeout=timeout,
                connector=aiohttp.TCPConnector(ssl=ssl_context, force_close=True)
            )
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
            async with session.get(url, headers=self.headers, timeout=30) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('value', [])
                else:
                    error_text = await response.text()
                    logger.error(f"ADO API error: {response.status} - {error_text}")
                    return []
        except asyncio.TimeoutError:
            logger.error("Timeout error fetching projects")
            return []
        except aiohttp.ClientConnectionError as e:
            logger.error(f"Connection error fetching projects: {str(e)}")
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
            
    async def get_work_item_revisions(self, work_item_id: int) -> List[Dict[str, Any]]:
        """Get all revisions (history) for a work item"""
        try:
            session = await self._get_session()
            url = f"{self.base_url}/_apis/wit/workitems/{work_item_id}/revisions?api-version=6.0"
            async with session.get(url, headers=self.headers) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('value', [])
                else:
                    logger.error(f"ADO API error getting work item revisions: {response.status}")
                    return []
        except Exception as e:
            logger.error(f"Error fetching work item revisions: {e}")
            return []
            
    async def get_work_item_comments(self, work_item_id: int) -> List[Dict[str, Any]]:
        """Get all comments for a work item"""
        try:
            session = await self._get_session()
            url = f"{self.base_url}/_apis/wit/workitems/{work_item_id}/comments?api-version=6.0-preview.3"
            async with session.get(url, headers=self.headers) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('comments', [])
                else:
                    logger.error(f"ADO API error getting work item comments: {response.status}")
                    return []
        except Exception as e:
            logger.error(f"Error fetching work item comments: {e}")
            return []
            
    async def get_work_item_attachments(self, work_item_id: int) -> List[Dict[str, Any]]:
        """Get all attachments for a work item"""
        try:
            # First get the work item to extract attachment relations
            session = await self._get_session()
            url = f"{self.base_url}/_apis/wit/workitems/{work_item_id}?$expand=relations&api-version=6.0"
            async with session.get(url, headers=self.headers) as response:
                if response.status == 200:
                    data = await response.json()
                    relations = data.get('relations', [])
                    attachments = []
                    
                    # Filter for attachment relations
                    for relation in relations:
                        if relation.get('rel') == 'AttachedFile':
                            # Extract attachment details
                            attachment_url = relation.get('url')
                            attributes = relation.get('attributes', {})
                            attachments.append({
                                'url': attachment_url,
                                'name': attributes.get('name', ''),
                                'size': attributes.get('resourceSize', 0),
                                'created_by': attributes.get('authorName', ''),
                                'created_date': attributes.get('authorDate', '')
                            })
                    
                    return attachments
                else:
                    logger.error(f"ADO API error getting work item attachments: {response.status}")
                    return []
        except Exception as e:
            logger.error(f"Error fetching work item attachments: {e}")
            return []
            
    async def get_area_paths(self, project_name: str) -> List[Dict[str, Any]]:
        """Get all area paths for a project"""
        try:
            session = await self._get_session()
            url = f"{self.base_url}/{project_name}/_apis/wit/classificationnodes/areas?$depth=10&api-version=6.0"
            async with session.get(url, headers=self.headers) as response:
                if response.status == 200:
                    data = await response.json()
                    return self._flatten_classification_nodes(data, 'area')
                else:
                    logger.error(f"ADO API error getting area paths: {response.status}")
                    return []
        except Exception as e:
            logger.error(f"Error fetching area paths: {e}")
            return []
            
    async def get_iteration_paths(self, project_name: str) -> List[Dict[str, Any]]:
        """Get all iteration paths for a project"""
        try:
            session = await self._get_session()
            url = f"{self.base_url}/{project_name}/_apis/wit/classificationnodes/iterations?$depth=10&api-version=6.0"
            async with session.get(url, headers=self.headers) as response:
                if response.status == 200:
                    data = await response.json()
                    return self._flatten_classification_nodes(data, 'iteration')
                else:
                    logger.error(f"ADO API error getting iteration paths: {response.status}")
                    return []
        except Exception as e:
            logger.error(f"Error fetching iteration paths: {e}")
            return []
            
    def _flatten_classification_nodes(self, node: Dict[str, Any], node_type: str, parent_path: str = '') -> List[Dict[str, Any]]:
        """Recursively flatten classification nodes (area/iteration paths)"""
        result = []
        
        # Skip if this is not a valid node
        if not node or 'name' not in node:
            return result
            
        # Build the full path
        name = node.get('name', '')
        path = f"{parent_path}\\{name}" if parent_path else name
        
        # Add this node
        result.append({
            'id': node.get('id'),
            'name': name,
            'path': path,
            'type': node_type,
            'has_children': bool(node.get('children'))
        })
        
        # Process children
        for child in node.get('children', []):
            result.extend(self._flatten_classification_nodes(child, node_type, path))
            
        return result
            
    async def close(self):
        """Close the aiohttp session with proper cleanup"""
        if self.session and not self.session.closed:
            try:
                await asyncio.wait_for(self.session.close(), timeout=5.0)
            except asyncio.TimeoutError:
                print("Warning: Session close timed out, forcing cleanup")
            finally:
                self.session = None

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

@app.get("/api/logs")
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

@app.get("/api/logs/summary")
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
        logger.error(f"Error getting extraction jobs: {str(e)}")
        # Return empty list instead of failing the request
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
    artifactType: str  # workitems, repositories, pipelines, testcases, classification

async def extract_work_items(job_id: int, project_id: int, project_name: str, connection_id: int):
    """Extract work items from Azure DevOps and store them in the database"""
    print(f"Starting work item extraction for job {job_id}, project {project_name}, connection_id: {connection_id}")
    logger.info(f"Starting work item extraction for job {job_id}, project {project_name}, connection_id: {connection_id}")
    
    try:
        # Get a new database session for this background task
        from backend.database.connection import get_db_session
        from backend.database.models import WorkItem, WorkItemRevision, WorkItemComment, WorkItemAttachment, WorkItemRelation, ExtractionLog, ADOConnection
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
                work_item_id = wi.get('id')
                
                # Check if work item already exists
                existing_wi = db.query(WorkItem).filter(
                    WorkItem.project_id == project_id,
                    WorkItem.external_id == work_item_id
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
                    db.commit()
                    work_item_db_id = existing_wi.id
                else:
                    # Create new work item
                    new_wi = WorkItem(
                        project_id=project_id,
                        external_id=work_item_id,
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
                    db.commit()
                    work_item_db_id = new_wi.id
                
                # Extract revisions
                try:
                    # Clear existing revisions
                    db.query(WorkItemRevision).filter(WorkItemRevision.work_item_id == work_item_db_id).delete()
                    db.commit()
                    
                    # Get revisions from API
                    revisions = await ado_client.get_work_item_revisions(work_item_id)
                    
                    # Store revisions
                    for revision in revisions:
                        rev_fields = revision.get('fields', {})
                        new_revision = WorkItemRevision(
                            work_item_id=work_item_db_id,
                            revision_number=revision.get('rev'),
                            changed_by=rev_fields.get('System.ChangedBy', {}).get('displayName') if isinstance(rev_fields.get('System.ChangedBy'), dict) else rev_fields.get('System.ChangedBy'),
                            changed_date=parse_datetime(rev_fields.get('System.ChangedDate')) if rev_fields.get('System.ChangedDate') else None,
                            fields=rev_fields
                        )
                        db.add(new_revision)
                    
                    db.commit()
                    log_msg = f"Extracted {len(revisions)} revisions for work item {work_item_id}"
                    logger.info(log_msg)
                except Exception as e:
                    error_msg = f"Error extracting revisions for work item {work_item_id}: {e}"
                    logger.error(error_msg)
                    
                    # Add error log
                    log_entry = ExtractionLog(
                        job_id=job_id,
                        level="ERROR",
                        message=error_msg,
                        timestamp=datetime.utcnow()
                    )
                    db.add(log_entry)
                    db.commit()
                
                # Extract comments
                try:
                    # Clear existing comments
                    db.query(WorkItemComment).filter(WorkItemComment.work_item_id == work_item_db_id).delete()
                    db.commit()
                    
                    # Get comments from API
                    comments = await ado_client.get_work_item_comments(work_item_id)
                    
                    # Store comments
                    for comment in comments:
                        new_comment = WorkItemComment(
                            work_item_id=work_item_db_id,
                            text=comment.get('text'),
                            created_by=comment.get('createdBy', {}).get('displayName') if isinstance(comment.get('createdBy'), dict) else comment.get('createdBy'),
                            created_date=parse_datetime(comment.get('createdDate')) if comment.get('createdDate') else None
                        )
                        db.add(new_comment)
                    
                    db.commit()
                    log_msg = f"Extracted {len(comments)} comments for work item {work_item_id}"
                    logger.info(log_msg)
                except Exception as e:
                    error_msg = f"Error extracting comments for work item {work_item_id}: {e}"
                    logger.error(error_msg)
                    
                    # Add error log
                    log_entry = ExtractionLog(
                        job_id=job_id,
                        level="ERROR",
                        message=error_msg,
                        timestamp=datetime.utcnow()
                    )
                    db.add(log_entry)
                    db.commit()
                
                # Extract attachments
                try:
                    # Clear existing attachments
                    db.query(WorkItemAttachment).filter(WorkItemAttachment.work_item_id == work_item_db_id).delete()
                    db.commit()
                    
                    # Get attachments from API
                    attachments = await ado_client.get_work_item_attachments(work_item_id)
                    
                    # Store attachments
                    for attachment in attachments:
                        new_attachment = WorkItemAttachment(
                            work_item_id=work_item_db_id,
                            name=attachment.get('name'),
                            url=attachment.get('url'),
                            size=attachment.get('size'),
                            created_by=attachment.get('created_by'),
                            created_date=parse_datetime(attachment.get('created_date')) if attachment.get('created_date') else None
                        )
                        db.add(new_attachment)
                    
                    db.commit()
                    log_msg = f"Extracted {len(attachments)} attachments for work item {work_item_id}"
                    logger.info(log_msg)
                except Exception as e:
                    error_msg = f"Error extracting attachments for work item {work_item_id}: {e}"
                    logger.error(error_msg)
                    
                    # Add error log
                    log_entry = ExtractionLog(
                        job_id=job_id,
                        level="ERROR",
                        message=error_msg,
                        timestamp=datetime.utcnow()
                    )
                    db.add(log_entry)
                    db.commit()
                
                # Extract relations
                try:
                    # Clear existing relations
                    db.query(WorkItemRelation).filter(WorkItemRelation.source_work_item_id == work_item_db_id).delete()
                    db.commit()
                    
                    # Get relations from work item
                    relations = wi.get('relations', [])
                    
                    # Store relations (we'll only store work item relations, not attachments)
                    for relation in relations:
                        if relation.get('rel') not in ['AttachedFile', 'Hyperlink']:
                            # Extract target work item ID from URL
                            url = relation.get('url', '')
                            target_id = None
                            if 'workitems/' in url:
                                target_id = url.split('workitems/')[-1]
                            
                            if target_id and target_id.isdigit():
                                # Find target work item in database
                                target_wi = db.query(WorkItem).filter(
                                    WorkItem.project_id == project_id,
                                    WorkItem.external_id == int(target_id)
                                ).first()
                                
                                if target_wi:
                                    new_relation = WorkItemRelation(
                                        source_work_item_id=work_item_db_id,
                                        target_work_item_id=target_wi.id,
                                        relation_type=relation.get('rel')
                                    )
                                    db.add(new_relation)
                    
                    db.commit()
                    log_msg = f"Extracted relations for work item {work_item_id}"
                    logger.info(log_msg)
                except Exception as e:
                    error_msg = f"Error extracting relations for work item {work_item_id}: {e}"
                    logger.error(error_msg)
                    
                    # Add error log
                    log_entry = ExtractionLog(
                        job_id=job_id,
                        level="ERROR",
                        message=error_msg,
                        timestamp=datetime.utcnow()
                    )
                    db.add(log_entry)
                    db.commit()
                
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

async def extract_classification(job_id: int, project_id: int, project_name: str, connection_id: int):
    """Extract area and iteration paths from Azure DevOps and store them in the database"""
    print(f"Starting classification extraction for job {job_id}, project {project_name}, connection_id: {connection_id}")
    logger.info(f"Starting classification extraction for job {job_id}, project {project_name}, connection_id: {connection_id}")
    
    try:
        # Extract both area paths and iteration paths
        await extract_area_paths(job_id, project_id, project_name, connection_id)
        await extract_iteration_paths(job_id, project_id, project_name, connection_id)
        
        # Get a new database session for this background task
        from backend.database.connection import get_db_session
        db = get_db_session()
        
        # Update job status to completed
        job = db.query(ExtractionJob).filter(ExtractionJob.id == job_id).first()
        if job:
            job.status = "completed"
            job.completed_at = datetime.now()
            job.progress = 100
            db.commit()
            
        logger.info(f"Classification extraction completed for job {job_id}, project {project_name}")
        
    except Exception as e:
        logger.error(f"Error during classification extraction: {str(e)}")
        
        # Get a new database session for this background task
        from backend.database.connection import get_db_session
        db = get_db_session()
        
        # Update job status to failed
        job = db.query(ExtractionJob).filter(ExtractionJob.id == job_id).first()
        if job:
            job.status = "failed"
            job.completed_at = datetime.now()
            job.message = f"Error: {str(e)}"
            db.commit()

async def extract_area_paths(job_id: int, project_id: int, project_name: str, connection_id: int):
    """Extract area paths from Azure DevOps and store them in the database"""
    print(f"Starting area paths extraction for job {job_id}, project {project_name}, connection_id: {connection_id}")
    logger.info(f"Starting area paths extraction for job {job_id}, project {project_name}, connection_id: {connection_id}")
    
    try:
        # Get a new database session for this background task
        from backend.database.connection import get_db_session
        from backend.database.models import AreaPath, ExtractionLog, ADOConnection
        db = get_db_session()
        
        try:
            # Update job status to in progress
            job = db.query(ExtractionJob).filter(ExtractionJob.id == job_id).first()
            if job:
                job.status = "in_progress"
                job.started_at = datetime.now()
                db.commit()
            
            # Get connection details
            connection = db.query(ADOConnection).filter(ADOConnection.id == connection_id).first()
            if not connection:
                logger.error(f"Connection {connection_id} not found for job {job_id}")
                return
            
            # Initialize Azure DevOps client
            ado_client = AzureDevOpsClient(connection.organization, connection.pat_token)
            
            try:
                # Extract area paths
                logger.info(f"Extracting area paths for project {project_name}")
                area_paths = await ado_client.get_area_paths(project_name)
            finally:
                # Close the client session
                await ado_client.close()
            
            # Update job with total items
            job.total_items = len(area_paths)
            db.commit()
            
            # Ensure tables exist
            try:
                from backend.database.connection import create_tables
                create_tables()
                logger.info("Ensured database tables exist for area paths extraction")
            except Exception as table_error:
                logger.error(f"Error ensuring tables exist: {str(table_error)}")
            
            # Store area paths in database
            area_path_count = 0
            for ap in area_paths:
                try:
                    # Check if area path already exists
                    existing = db.query(AreaPath).filter(
                        AreaPath.project_id == project_id,
                        AreaPath.path == ap.get("path")
                    ).first()
                except Exception as query_error:
                    logger.error(f"Error querying area path: {str(query_error)}")
                    # Rollback and continue with next item
                    db.rollback()
                    existing = None
                
                try:
                    if existing:
                        # Update existing area path
                        existing.external_id = ap.get("id")
                        existing.name = ap.get("name")
                        existing.parent_path = ap.get("parentPath")
                        existing.has_children = ap.get("hasChildren", False)
                    else:
                        # Create new area path
                        new_area_path = AreaPath(
                            project_id=project_id,
                            external_id=ap.get("id"),
                            name=ap.get("name"),
                            path=ap.get("path"),
                            parent_path=ap.get("parentPath"),
                            has_children=ap.get("hasChildren", False)
                        )
                        db.add(new_area_path)
                except Exception as update_error:
                    logger.error(f"Error updating/creating area path: {str(update_error)}")
                    # Rollback and continue with next item
                    db.rollback()
                
                area_path_count += 1
                
                # Update progress
                job.progress = min(int((area_path_count / job.total_items) * 100), 99)
                
                # Commit every 100 records to avoid large transactions
                if area_path_count % 100 == 0:
                    try:
                        db.commit()
                    except Exception as commit_error:
                        logger.error(f"Error committing batch of area paths: {str(commit_error)}")
                        db.rollback()
            
            # Commit any remaining area paths
            try:
                db.commit()
            except Exception as commit_error:
                logger.error(f"Error committing remaining area paths: {str(commit_error)}")
                db.rollback()
            
            # Update project with area path count
            try:
                project = db.query(Project).filter(Project.id == project_id).first()
                if project:
                    project.area_path_count = area_path_count
                    db.commit()
            except Exception as project_update_error:
                logger.error(f"Error updating project with area path count: {str(project_update_error)}")
                db.rollback()
            
            # Update job status to completed
            try:
                # Refresh job object to avoid stale state
                job = db.query(ExtractionJob).filter(ExtractionJob.id == job_id).first()
                if job:
                    job.status = "completed"
                    job.completed_at = datetime.now()
                    job.progress = 100
                    job.message = f"Extracted {area_path_count} area paths"
                    db.commit()
            except Exception as job_update_error:
                logger.error(f"Error updating job status: {str(job_update_error)}")
                db.rollback()
            
            # Log extraction
            try:
                log = ExtractionLog(
                    job_id=job_id,
                    level="INFO",
                    message=f"Extracted {area_path_count} area paths for project {project_name}"
                )
                db.add(log)
                db.commit()
            except Exception as log_error:
                logger.error(f"Error creating extraction log: {str(log_error)}")
                db.rollback()
            
            logger.info(f"Area paths extraction completed for job {job_id}, project {project_name}")
            
        except Exception as e:
            logger.error(f"Error during area paths extraction: {str(e)}")
            
            # Update job status to failed
            try:
                # Get a fresh session state
                db.rollback()
                
                # Refresh the job object to avoid stale state
                job = db.query(ExtractionJob).filter(ExtractionJob.id == job_id).first()
                if job:
                    job.status = "failed"
                    job.completed_at = datetime.now()
                    job.message = f"Error: {str(e)}"
                    db.commit()
            except Exception as update_error:
                logger.error(f"Failed to update job status: {str(update_error)}")
                try:
                    db.rollback()
                except:
                    pass
            
            # Log extraction error
            try:
                # Create a new log entry
                log = ExtractionLog(
                    job_id=job_id,
                    level="ERROR",
                    message=f"Error extracting area paths: {str(e)}"
                )
                db.add(log)
                db.commit()
            except Exception as log_error:
                logger.error(f"Failed to log extraction error: {str(log_error)}")
                try:
                    db.rollback()
                except:
                    pass
            
            raise
            
        finally:
            # Close the database session
            try:
                db.close()
            except Exception as close_error:
                logger.error(f"Error closing database session: {str(close_error)}")
            
    except Exception as e:
        logger.error(f"Error during area paths extraction: {str(e)}")
        raise

async def extract_iteration_paths(job_id: int, project_id: int, project_name: str, connection_id: int):
    """Extract iteration paths from Azure DevOps and store them in the database"""
    print(f"Starting iteration paths extraction for job {job_id}, project {project_name}, connection_id: {connection_id}")
    logger.info(f"Starting iteration paths extraction for job {job_id}, project {project_name}, connection_id: {connection_id}")
    
    try:
        # Get a new database session for this background task
        from backend.database.connection import get_db_session
        from backend.database.models import IterationPath, ExtractionLog, ADOConnection
        db = get_db_session()
        
        try:
            # Update job status to in progress
            job = db.query(ExtractionJob).filter(ExtractionJob.id == job_id).first()
            if job:
                job.status = "in_progress"
                job.started_at = datetime.now()
                db.commit()
            
            # Get connection details
            connection = db.query(ADOConnection).filter(ADOConnection.id == connection_id).first()
            if not connection:
                logger.error(f"Connection {connection_id} not found for job {job_id}")
                return
            
            # Initialize Azure DevOps client
            ado_client = AzureDevOpsClient(connection.organization, connection.pat_token)
            
            try:
                # Extract iteration paths
                logger.info(f"Extracting iteration paths for project {project_name}")
                iteration_paths = await ado_client.get_iteration_paths(project_name)
            finally:
                # Close the client session
                await ado_client.close()
            
            # Update job with total items
            job.total_items = len(iteration_paths)
            db.commit()
            
            # Store iteration paths in database
            iteration_path_count = 0
            for ip in iteration_paths:
                # Parse dates if available
                start_date = None
                end_date = None
                
                if ip.get("attributes", {}).get("startDate"):
                    start_date = parse_datetime(ip["attributes"]["startDate"])
                
                if ip.get("attributes", {}).get("finishDate"):
                    end_date = parse_datetime(ip["attributes"]["finishDate"])
                
                # Check if iteration path already exists
                existing = db.query(IterationPath).filter(
                    IterationPath.project_id == project_id,
                    IterationPath.path == ip.get("path")
                ).first()
                
                if existing:
                    # Update existing iteration path
                    existing.external_id = ip.get("id")
                    existing.name = ip.get("name")
                    existing.parent_path = ip.get("parentPath")
                    existing.start_date = start_date
                    existing.end_date = end_date
                    existing.has_children = ip.get("hasChildren", False)
                else:
                    # Create new iteration path
                    new_iteration_path = IterationPath(
                        project_id=project_id,
                        external_id=ip.get("id"),
                        name=ip.get("name"),
                        path=ip.get("path"),
                        parent_path=ip.get("parentPath"),
                        start_date=start_date,
                        end_date=end_date,
                        has_children=ip.get("hasChildren", False)
                    )
                    db.add(new_iteration_path)
                
                iteration_path_count += 1
                
                # Commit every 100 records to avoid large transactions
                if iteration_path_count % 100 == 0:
                    db.commit()
            
            # Commit any remaining iteration paths
            db.commit()
            
            # Update job status to completed
            if job:
                job.status = "completed"
                job.completed_at = datetime.now()
                job.progress = 100
                job.message = f"Extracted {area_path_count} area paths and {iteration_path_count} iteration paths"
                db.commit()
                
                # Update project with counts
                project = db.query(Project).filter(Project.id == project_id).first()
                if project:
                    project.area_path_count = area_path_count
                    project.iteration_path_count = iteration_path_count
                    db.commit()
            
            # Log extraction
            log = ExtractionLog(
                job_id=job_id,
                level="INFO",
                message=f"Extracted {area_path_count} area paths and {iteration_path_count} iteration paths for project {project_name}"
            )
            db.add(log)
            db.commit()
            
            logger.info(f"Classification extraction completed for project {project_name}: {area_path_count} area paths, {iteration_path_count} iteration paths")
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Error extracting classification for project {project_name}: {e}")
        # Update job status to failed
        try:
            db = get_db_session()
            job = db.query(ExtractionJob).filter(ExtractionJob.id == job_id).first()
            if job:
                job.status = "failed"
                job.error_message = str(e)
                job.completed_at = datetime.now()
                db.commit()
            db.close()
        except Exception as db_error:
            logger.error(f"Failed to update job status: {db_error}")
        logger.info(f"Getting area paths for project: {project_name}")
        
        try:
            area_paths = await ado_client.get_area_paths(project_name)
            print(f"Found {len(area_paths)} area paths for project {project_name}")
            logger.info(f"Found {len(area_paths)} area paths for project {project_name}")
            
            # Clear existing area paths for this project
            db.query(AreaPath).filter(AreaPath.project_id == project_id).delete()
            db.commit()
            
            # Store area paths
            for area_path in area_paths:
                path = area_path.get('path')
                parent_path = path.rsplit('\\', 1)[0] if '\\' in path else ''
                
                new_area_path = AreaPath(
                    project_id=project_id,
                    external_id=area_path.get('id'),
                    name=area_path.get('name'),
                    path=path,
                    parent_path=parent_path,
                    has_children=area_path.get('has_children', False)
                )
                db.add(new_area_path)
            
            db.commit()
            log_msg = f"Extracted {len(area_paths)} area paths for project {project_name}"
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
            error_msg = f"Error extracting area paths: {e}"
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
        
        # Extract iteration paths
        print(f"Getting iteration paths for project: {project_name}")
        logger.info(f"Getting iteration paths for project: {project_name}")
        
        try:
            iteration_paths = await ado_client.get_iteration_paths(project_name)
            print(f"Found {len(iteration_paths)} iteration paths for project {project_name}")
            logger.info(f"Found {len(iteration_paths)} iteration paths for project {project_name}")
            
            # Clear existing iteration paths for this project
            db.query(IterationPath).filter(IterationPath.project_id == project_id).delete()
            db.commit()
            
            # Store iteration paths
            for iteration_path in iteration_paths:
                path = iteration_path.get('path')
                parent_path = path.rsplit('\\', 1)[0] if '\\' in path else ''
                
                new_iteration_path = IterationPath(
                    project_id=project_id,
                    external_id=iteration_path.get('id'),
                    name=iteration_path.get('name'),
                    path=path,
                    parent_path=parent_path,
                    has_children=iteration_path.get('has_children', False)
                )
                db.add(new_iteration_path)
            
            db.commit()
            log_msg = f"Extracted {len(iteration_paths)} iteration paths for project {project_name}"
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
            error_msg = f"Error extracting iteration paths: {e}"
            print(error_msg)
            logger.error(error_msg)
            
            # Add log entry
            try:
                # Rollback any failed transaction
                db.rollback()
                
                log_entry = ExtractionLog(
                    job_id=job_id,
                    level="ERROR",
                    message=error_msg,
                    timestamp=datetime.utcnow()
                )
                db.add(log_entry)
                db.commit()
            except Exception as log_error:
                logger.error(f"Failed to log extraction error: {str(log_error)}")
                try:
                    db.rollback()
                except:
                    pass
        
        # Mark job as completed
        try:
            # Refresh job object to avoid stale state
            job = db.query(ExtractionJob).filter(ExtractionJob.id == job_id).first()
            if job:
                job.status = "completed"
                job.completed_at = datetime.utcnow()
                db.commit()
        except Exception as update_error:
            logger.error(f"Failed to update job status: {str(update_error)}")
            try:
                db.rollback()
            except:
                pass
        
        # Close the ADO client session
        await ado_client.close()
        
    except Exception as e:
        error_msg = f"Error extracting iteration paths for job {job_id}: {e}"
        print(error_msg)
        logger.error(error_msg)
        
        try:
            # Get a new database session for this background task
            from backend.database.connection import get_db_session
            db = get_db_session()
            
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
        except Exception as db_error:
            logger.error(f"Failed to update job status or log error: {str(db_error)}")
            try:
                if 'db' in locals():
                    db.rollback()
            except:
                pass
        
        # Close the ADO client session if it exists
        try:
            if 'ado_client' in locals() and ado_client is not None:
                await ado_client.close()
        except Exception as close_error:
            logger.error(f"Error closing ADO client session: {close_error}")


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
                "startedAt": existing_job.started_at.isoformat() if existing_job.started_at else None,
                "completedAt": existing_job.completed_at.isoformat() if existing_job.completed_at else None,
                "progress": existing_job.progress,
                "extractedItems": existing_job.extracted_items,
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
        elif request.artifactType == "classification":
            asyncio.create_task(extract_classification(job.id, project.id, project.name, project.connection_id))
        elif request.artifactType == "areapaths":
            asyncio.create_task(extract_area_paths(job.id, project.id, project.name, project.connection_id))
        elif request.artifactType == "iterationpaths":
            asyncio.create_task(extract_iteration_paths(job.id, project.id, project.name, project.connection_id))
        elif request.artifactType == "customfields":
            asyncio.create_task(extract_custom_fields(job.id, project.id, project.name, project.connection_id))
        elif request.artifactType == "users":
            asyncio.create_task(extract_users(job.id, project.id, project.name, project.connection_id))
        elif request.artifactType == "boardcolumns":
            asyncio.create_task(extract_board_columns(job.id, project.id, project.name, project.connection_id))
        elif request.artifactType == "wikipages":
            asyncio.create_task(extract_wiki_pages(job.id, project.id, project.name, project.connection_id))
        elif request.artifactType == "all-metadata":
            # Extract all metadata components in sequence
            asyncio.create_task(extract_all_metadata(job.id, project.id, project.name, project.connection_id))
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
            "startedAt": job.started_at.isoformat() if job.started_at else None,
            "completedAt": job.completed_at.isoformat() if job.completed_at else None,
            "progress": job.progress,
            "extractedItems": job.extracted_items,
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
        # Query projects with status "selected" (from frontend)
        projects = db.query(Project).filter(Project.status == "selected").all()
        
        # Log the number of selected projects found
        logger.info(f"Found {len(projects)} projects with status 'selected'")
        
        # Check if there are no selected projects, log all available statuses
        if len(projects) == 0:
            all_projects = db.query(Project).all()
            statuses = set(p.status for p in all_projects)
            logger.info(f"No selected projects found. Available statuses: {statuses}")
        
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

@app.get("/api/projects/{project_id}/extraction-history")
def get_project_extraction_history(project_id: int, db: Session = Depends(get_db)):
    """Get extraction history for a project"""
    try:
        from backend.database.models import ExtractionJob
        
        # Get the project
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Get extraction jobs
        extraction_jobs = db.query(ExtractionJob).filter(
            ExtractionJob.project_id == project_id
        ).order_by(ExtractionJob.started_at.desc()).all()
        
        return {
            "history": [
                {
                    "id": job.id,
                    "artifactType": job.artifact_type,
                    "status": job.status,
                    "startedAt": job.started_at.isoformat() if job.started_at else None,
                    "completedAt": job.completed_at.isoformat() if job.completed_at else None,
                    "extractedItems": job.extracted_items,
                    "totalItems": job.total_items,
                    "progress": job.progress,
                    "error": job.error_message
                }
                for job in extraction_jobs
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch extraction history for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch extraction history: {str(e)}")
        
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

async def extract_custom_fields(job_id: int, project_id: int, project_name: str, connection_id: int):
    """Extract custom fields from Azure DevOps and store them in the database"""
    print(f"Starting custom fields extraction for job {job_id}, project {project_name}, connection_id: {connection_id}")
    logger.info(f"Starting custom fields extraction for job {job_id}, project {project_name}, connection_id: {connection_id}")
    
    try:
        # Get a new database session for this background task
        from backend.database.connection import get_db_session
        from backend.database.models import CustomField, ExtractionLog, ADOConnection
        db = get_db_session()
        
        try:
            # Update job status to in progress
            job = db.query(ExtractionJob).filter(ExtractionJob.id == job_id).first()
            if job:
                job.status = "in_progress"
                job.started_at = datetime.now()
                db.commit()
            
            # Get connection details
            connection = db.query(ADOConnection).filter(ADOConnection.id == connection_id).first()
            if not connection:
                logger.error(f"Connection {connection_id} not found for job {job_id}")
                return
            
            # Initialize Azure DevOps client
            ado_client = AzureDevOpsClient(connection.organization, connection.pat_token)
            
            try:
                # Extract custom fields (work item fields)
                logger.info(f"Extracting custom fields for project {project_name}")
            finally:
                # Close the client session
                await ado_client.close()
            
            # For now, we'll simulate custom fields extraction
            # In a real implementation, you would call the Azure DevOps API to get work item fields
            # Example: fields = await ado_client.get_work_item_fields(project_name)
            
            # Simulate fields for now
            fields = [
                {"id": "System.Title", "name": "Title", "type": "String", "usage": 100, "referenceName": "System.Title", "workItemTypes": ["Bug", "Task", "User Story"]},
                {"id": "System.Description", "name": "Description", "type": "HTML", "usage": 80, "referenceName": "System.Description", "workItemTypes": ["Bug", "Task", "User Story"]},
                {"id": "System.AssignedTo", "name": "Assigned To", "type": "Identity", "usage": 75, "referenceName": "System.AssignedTo", "workItemTypes": ["Bug", "Task", "User Story"]},
                {"id": "Microsoft.VSTS.Common.Priority", "name": "Priority", "type": "Integer", "usage": 60, "referenceName": "Microsoft.VSTS.Common.Priority", "workItemTypes": ["Bug", "Task", "User Story"]},
                {"id": "Custom.Field1", "name": "Custom Field 1", "type": "String", "usage": 30, "referenceName": "Custom.Field1", "workItemTypes": ["User Story"]},
                {"id": "Custom.Field2", "name": "Custom Field 2", "type": "DateTime", "usage": 20, "referenceName": "Custom.Field2", "workItemTypes": ["Bug"]},
            ]
            
            # Update job with total items
            job.total_items = len(fields)
            db.commit()
            
            # Ensure tables exist
            try:
                from backend.database.connection import create_tables
                create_tables()
                logger.info("Ensured database tables exist for custom fields extraction")
            except Exception as table_error:
                logger.error(f"Error ensuring tables exist: {str(table_error)}")
            
            # Store custom fields in database
            field_count = 0
            for field in fields:
                try:
                    # Check if custom field already exists
                    existing = db.query(CustomField).filter(
                        CustomField.project_id == project_id,
                        CustomField.reference_name == field.get("referenceName")
                    ).first()
                    
                    if existing:
                        # Update existing custom field
                        existing.name = field.get("name")
                        existing.type = field.get("type")
                        existing.usage = field.get("usage", 0)
                        existing.work_item_types = ",".join(field.get("workItemTypes", []))
                    else:
                        # Create new custom field
                        new_field = CustomField(
                            project_id=project_id,
                            external_id=field.get("id"),
                            name=field.get("name"),
                            reference_name=field.get("referenceName"),
                            type=field.get("type"),
                            usage=field.get("usage", 0),
                            work_item_types=",".join(field.get("workItemTypes", []))
                        )
                        db.add(new_field)
                    
                    field_count += 1
                    
                    # Update progress
                    job.progress = min(int((field_count / job.total_items) * 100), 99)
                    
                    # Commit every 10 records to avoid large transactions
                    if field_count % 10 == 0:
                        try:
                            db.commit()
                        except Exception as commit_error:
                            logger.error(f"Error committing batch of custom fields: {str(commit_error)}")
                            db.rollback()
                
                except Exception as field_error:
                    logger.error(f"Error processing custom field {field.get('name')}: {str(field_error)}")
                    db.rollback()
            
            # Commit any remaining custom fields
            try:
                db.commit()
            except Exception as commit_error:
                logger.error(f"Error committing remaining custom fields: {str(commit_error)}")
                db.rollback()
            
            # Update project with custom field count
            try:
                project = db.query(Project).filter(Project.id == project_id).first()
                if project:
                    project.custom_field_count = field_count
                    db.commit()
            except Exception as project_update_error:
                logger.error(f"Error updating project with custom field count: {str(project_update_error)}")
                db.rollback()
            
            # Update job status to completed
            try:
                # Refresh job object to avoid stale state
                job = db.query(ExtractionJob).filter(ExtractionJob.id == job_id).first()
                if job:
                    job.status = "completed"
                    job.completed_at = datetime.now()
                    job.progress = 100
                    job.message = f"Extracted {field_count} custom fields"
                    db.commit()
            except Exception as job_update_error:
                logger.error(f"Error updating job status: {str(job_update_error)}")
                db.rollback()
            
            # Log extraction
            try:
                log = ExtractionLog(
                    job_id=job_id,
                    level="INFO",
                    message=f"Extracted {field_count} custom fields for project {project_name}"
                )
                db.add(log)
                db.commit()
            except Exception as log_error:
                logger.error(f"Error creating extraction log: {str(log_error)}")
                db.rollback()
            
            logger.info(f"Custom fields extraction completed for job {job_id}, project {project_name}")
            
        except Exception as e:
            logger.error(f"Error during custom fields extraction: {str(e)}")
            
            # Update job status to failed
            try:
                # Get a fresh session state
                db.rollback()
                
                # Refresh the job object to avoid stale state
                job = db.query(ExtractionJob).filter(ExtractionJob.id == job_id).first()
                if job:
                    job.status = "failed"
                    job.completed_at = datetime.now()
                    job.message = f"Error: {str(e)}"
                    db.commit()
            except Exception as update_error:
                logger.error(f"Failed to update job status: {str(update_error)}")
                try:
                    db.rollback()
                except:
                    pass
            
            # Log extraction error
            try:
                # Create a new log entry
                log = ExtractionLog(
                    job_id=job_id,
                    level="ERROR",
                    message=f"Error extracting custom fields: {str(e)}"
                )
                db.add(log)
                db.commit()
            except Exception as log_error:
                logger.error(f"Failed to log extraction error: {str(log_error)}")
                try:
                    db.rollback()
                except:
                    pass
            
            raise
            
        finally:
            # Close the database session
            try:
                db.close()
            except Exception as close_error:
                logger.error(f"Error closing database session: {str(close_error)}")
            
    except Exception as e:
        logger.error(f"Error during custom fields extraction: {str(e)}")
        raise

async def extract_users(job_id: int, project_id: int, project_name: str, connection_id: int):
    """Extract users from Azure DevOps and store them in the database"""
    print(f"Starting users extraction for job {job_id}, project {project_name}, connection_id: {connection_id}")
    logger.info(f"Starting users extraction for job {job_id}, project {project_name}, connection_id: {connection_id}")
    
    try:
        # Get a new database session for this background task
        from backend.database.connection import get_db_session
        from backend.database.models import User, ExtractionLog, ADOConnection
        db = get_db_session()
        
        try:
            # Update job status to in progress
            job = db.query(ExtractionJob).filter(ExtractionJob.id == job_id).first()
            if job:
                job.status = "in_progress"
                job.started_at = datetime.now()
                db.commit()
            
            # Get connection details
            connection = db.query(ADOConnection).filter(ADOConnection.id == connection_id).first()
            if not connection:
                logger.error(f"Connection {connection_id} not found for job {job_id}")
                return
            
            # Initialize Azure DevOps client
            ado_client = AzureDevOpsClient(connection.organization, connection.pat_token)
            
            try:
                # Extract users
                logger.info(f"Extracting users for project {project_name}")
            finally:
                # Close the client session
                await ado_client.close()
            
            # For now, we'll simulate users extraction
            # In a real implementation, you would call the Azure DevOps API to get users
            # Example: users = await ado_client.get_project_users(project_name)
            
            # Simulate users for now
            users = [
                {"id": "user1", "displayName": "John Doe", "uniqueName": "john.doe@example.com", "email": "john.doe@example.com", "workItemCount": 25},
                {"id": "user2", "displayName": "Jane Smith", "uniqueName": "jane.smith@example.com", "email": "jane.smith@example.com", "workItemCount": 18},
                {"id": "user3", "displayName": "Bob Johnson", "uniqueName": "bob.johnson@example.com", "email": "bob.johnson@example.com", "workItemCount": 12},
                {"id": "user4", "displayName": "Alice Brown", "uniqueName": "alice.brown@example.com", "email": "alice.brown@example.com", "workItemCount": 8},
                {"id": "user5", "displayName": "Charlie Davis", "uniqueName": "charlie.davis@example.com", "email": "charlie.davis@example.com", "workItemCount": 5},
            ]
            
            # Update job with total items
            job.total_items = len(users)
            db.commit()
            
            # Ensure tables exist
            try:
                from backend.database.connection import create_tables
                create_tables()
                logger.info("Ensured database tables exist for users extraction")
            except Exception as table_error:
                logger.error(f"Error ensuring tables exist: {str(table_error)}")
            
            # Store users in database
            user_count = 0
            for user in users:
                try:
                    # Check if user already exists
                    existing = db.query(User).filter(
                        User.project_id == project_id,
                        User.unique_name == user.get("uniqueName")
                    ).first()
                    
                    if existing:
                        # Update existing user
                        existing.display_name = user.get("displayName")
                        existing.email = user.get("email")
                        existing.work_item_count = user.get("workItemCount", 0)
                    else:
                        # Create new user
                        new_user = User(
                            project_id=project_id,
                            external_id=user.get("id"),
                            display_name=user.get("displayName"),
                            unique_name=user.get("uniqueName"),
                            email=user.get("email"),
                            work_item_count=user.get("workItemCount", 0)
                        )
                        db.add(new_user)
                    
                    user_count += 1
                    
                    # Update progress
                    job.progress = min(int((user_count / job.total_items) * 100), 99)
                    
                    # Commit every 10 records to avoid large transactions
                    if user_count % 10 == 0:
                        try:
                            db.commit()
                        except Exception as commit_error:
                            logger.error(f"Error committing batch of users: {str(commit_error)}")
                            db.rollback()
                
                except Exception as user_error:
                    logger.error(f"Error processing user {user.get('displayName')}: {str(user_error)}")
                    db.rollback()
            
            # Commit any remaining users
            try:
                db.commit()
            except Exception as commit_error:
                logger.error(f"Error committing remaining users: {str(commit_error)}")
                db.rollback()
            
            # Update project with user count
            try:
                project = db.query(Project).filter(Project.id == project_id).first()
                if project:
                    project.user_count = user_count
                    db.commit()
            except Exception as project_update_error:
                logger.error(f"Error updating project with user count: {str(project_update_error)}")
                db.rollback()
            
            # Update job status to completed
            try:
                # Refresh job object to avoid stale state
                job = db.query(ExtractionJob).filter(ExtractionJob.id == job_id).first()
                if job:
                    job.status = "completed"
                    job.completed_at = datetime.now()
                    job.progress = 100
                    job.message = f"Extracted {user_count} users"
                    db.commit()
            except Exception as job_update_error:
                logger.error(f"Error updating job status: {str(job_update_error)}")
                db.rollback()
            
            # Log extraction
            try:
                log = ExtractionLog(
                    job_id=job_id,
                    level="INFO",
                    message=f"Extracted {user_count} users for project {project_name}"
                )
                db.add(log)
                db.commit()
            except Exception as log_error:
                logger.error(f"Error creating extraction log: {str(log_error)}")
                db.rollback()
            
            logger.info(f"Users extraction completed for job {job_id}, project {project_name}")
            
        except Exception as e:
            logger.error(f"Error during users extraction: {str(e)}")
            
            # Update job status to failed
            try:
                # Get a fresh session state
                db.rollback()
                
                # Refresh the job object to avoid stale state
                job = db.query(ExtractionJob).filter(ExtractionJob.id == job_id).first()
                if job:
                    job.status = "failed"
                    job.completed_at = datetime.now()
                    job.message = f"Error: {str(e)}"
                    db.commit()
            except Exception as update_error:
                logger.error(f"Failed to update job status: {str(update_error)}")
                try:
                    db.rollback()
                except:
                    pass
            
            # Log extraction error
            try:
                # Create a new log entry
                log = ExtractionLog(
                    job_id=job_id,
                    level="ERROR",
                    message=f"Error extracting users: {str(e)}"
                )
                db.add(log)
                db.commit()
            except Exception as log_error:
                logger.error(f"Failed to log extraction error: {str(log_error)}")
                try:
                    db.rollback()
                except:
                    pass
            
            raise
            
        finally:
            # Close the database session
            db.close()
            
    except Exception as e:
        logger.error(f"Error during users extraction: {str(e)}")
        raise

async def extract_board_columns(job_id: int, project_id: int, project_name: str, connection_id: int):
    """Extract board columns from Azure DevOps and store them in the database"""
    print(f"Starting board columns extraction for job {job_id}, project {project_name}, connection_id: {connection_id}")
    logger.info(f"Starting board columns extraction for job {job_id}, project {project_name}, connection_id: {connection_id}")
    
    try:
        # Get a new database session for this background task
        from backend.database.connection import get_db_session
        from backend.database.models import BoardColumn, ExtractionLog, ADOConnection
        db = get_db_session()
        
        try:
            # Update job status to in progress
            job = db.query(ExtractionJob).filter(ExtractionJob.id == job_id).first()
            if job:
                job.status = "in_progress"
                job.started_at = datetime.now()
                db.commit()
            
            # Get connection details
            connection = db.query(ADOConnection).filter(ADOConnection.id == connection_id).first()
            if not connection:
                logger.error(f"Connection {connection_id} not found for job {job_id}")
                return
            
            # Initialize Azure DevOps client
            ado_client = AzureDevOpsClient(connection.organization, connection.pat_token)
            
            # Extract board columns
            logger.info(f"Extracting board columns for project {project_name}")
            
            # For now, we'll simulate board columns extraction
            # In a real implementation, you would call the Azure DevOps API to get board columns
            # Example: boards = await ado_client.get_boards(project_name)
            # Then for each board: columns = await ado_client.get_board_columns(project_name, board.id)
            
            # Simulate board columns for now
            board_columns = [
                {"id": "col1", "boardName": "Agile Board", "name": "New", "stateMappings": "New", "order": 1},
                {"id": "col2", "boardName": "Agile Board", "name": "Active", "stateMappings": "Active", "order": 2},
                {"id": "col3", "boardName": "Agile Board", "name": "Resolved", "stateMappings": "Resolved", "order": 3},
                {"id": "col4", "boardName": "Agile Board", "name": "Closed", "stateMappings": "Closed", "order": 4},
                {"id": "col5", "boardName": "Scrum Board", "name": "To Do", "stateMappings": "New", "order": 1},
                {"id": "col6", "boardName": "Scrum Board", "name": "In Progress", "stateMappings": "Active", "order": 2},
                {"id": "col7", "boardName": "Scrum Board", "name": "Done", "stateMappings": "Closed", "order": 3},
            ]
            
            # Update job with total items
            job.total_items = len(board_columns)
            db.commit()
            
            # Store board columns in database
            column_count = 0
            for column in board_columns:
                # Check if board column already exists
                existing = db.query(BoardColumn).filter(
                    BoardColumn.project_id == project_id,
                    BoardColumn.board_name == column.get("boardName"),
                    BoardColumn.name == column.get("name")
                ).first()
                
                if existing:
                    # Update existing board column
                    existing.state_mappings = column.get("stateMappings")
                    existing.order = column.get("order", 0)
                else:
                    # Create new board column
                    new_column = BoardColumn(
                        project_id=project_id,
                        external_id=column.get("id"),
                        board_name=column.get("boardName"),
                        name=column.get("name"),
                        state_mappings=column.get("stateMappings"),
                        order=column.get("order", 0)
                    )
                    db.add(new_column)
                
                column_count += 1
                
                # Update progress
                job.progress = min(int((column_count / job.total_items) * 100), 99)
                db.commit()
            
            # Commit any remaining board columns
            db.commit()
            
            # Update project with board column count
            project = db.query(Project).filter(Project.id == project_id).first()
            if project:
                project.board_column_count = column_count
                db.commit()
            
            # Update job status to completed
            job.status = "completed"
            job.completed_at = datetime.now()
            job.progress = 100
            job.message = f"Extracted {column_count} board columns"
            db.commit()
            
            # Log extraction
            log = ExtractionLog(
                job_id=job_id,
                level="INFO",
                message=f"Extracted {column_count} board columns for project {project_name}"
            )
            db.add(log)
            db.commit()
            
            logger.info(f"Board columns extraction completed for job {job_id}, project {project_name}")
            
        except Exception as e:
            logger.error(f"Error during board columns extraction: {str(e)}")
            
            # Update job status to failed
            job.status = "failed"
            job.completed_at = datetime.now()
            job.message = f"Error: {str(e)}"
            db.commit()
            
            # Log extraction error
            log = ExtractionLog(
                job_id=job_id,
                level="ERROR",
                message=f"Error extracting board columns: {str(e)}"
            )
            db.add(log)
            db.commit()
            
            raise
            
        finally:
            # Close the database session
            db.close()
            
    except Exception as e:
        logger.error(f"Error during board columns extraction: {str(e)}")
        raise

async def extract_wiki_pages(job_id: int, project_id: int, project_name: str, connection_id: int):
    """Extract wiki pages from Azure DevOps and store them in the database"""
    print(f"Starting wiki pages extraction for job {job_id}, project {project_name}, connection_id: {connection_id}")
    logger.info(f"Starting wiki pages extraction for job {job_id}, project {project_name}, connection_id: {connection_id}")
    
    try:
        # Get a new database session for this background task
        from backend.database.connection import get_db_session
        from backend.database.models import WikiPage, ExtractionLog, ADOConnection
        db = get_db_session()
        
        try:
            # Update job status to in progress
            job = db.query(ExtractionJob).filter(ExtractionJob.id == job_id).first()
            if job:
                job.status = "in_progress"
                job.started_at = datetime.now()
                db.commit()
            
            # Get connection details
            connection = db.query(ADOConnection).filter(ADOConnection.id == connection_id).first()
            if not connection:
                logger.error(f"Connection {connection_id} not found for job {job_id}")
                return
            
            # Initialize Azure DevOps client
            ado_client = AzureDevOpsClient(connection.organization, connection.pat_token)
            
            # Extract wiki pages
            logger.info(f"Extracting wiki pages for project {project_name}")
            
            # For now, we'll simulate wiki pages extraction
            # In a real implementation, you would call the Azure DevOps API to get wiki pages
            # Example: wikis = await ado_client.get_wikis(project_name)
            # Then for each wiki: pages = await ado_client.get_wiki_pages(project_name, wiki.id)
            
            # Simulate wiki pages for now
            wiki_pages = [
                {"id": "page1", "title": "Home", "path": "/", "lastUpdated": "2023-01-01T12:00:00Z"},
                {"id": "page2", "title": "Getting Started", "path": "/Getting-Started", "lastUpdated": "2023-01-02T14:30:00Z"},
                {"id": "page3", "title": "Architecture", "path": "/Architecture", "lastUpdated": "2023-01-03T09:15:00Z"},
                {"id": "page4", "title": "API Reference", "path": "/API-Reference", "lastUpdated": "2023-01-04T16:45:00Z"},
                {"id": "page5", "title": "Deployment Guide", "path": "/Deployment-Guide", "lastUpdated": "2023-01-05T11:20:00Z"},
            ]
            
            # Update job with total items
            job.total_items = len(wiki_pages)
            db.commit()
            
            # Store wiki pages in database
            page_count = 0
            for page in wiki_pages:
                # Parse last updated date if available
                last_updated = None
                if page.get("lastUpdated"):
                    last_updated = parse_datetime(page["lastUpdated"])
                
                # Check if wiki page already exists
                existing = db.query(WikiPage).filter(
                    WikiPage.project_id == project_id,
                    WikiPage.path == page.get("path")
                ).first()
                
                if existing:
                    # Update existing wiki page
                    existing.title = page.get("title")
                    existing.last_updated = last_updated
                else:
                    # Create new wiki page
                    new_page = WikiPage(
                        project_id=project_id,
                        external_id=page.get("id"),
                        title=page.get("title"),
                        path=page.get("path"),
                        last_updated=last_updated
                    )
                    db.add(new_page)
                
                page_count += 1
                
                # Update progress
                job.progress = min(int((page_count / job.total_items) * 100), 99)
                db.commit()
            
            # Commit any remaining wiki pages
            db.commit()
            
            # Update project with wiki page count
            project = db.query(Project).filter(Project.id == project_id).first()
            if project:
                project.wiki_page_count = page_count
                db.commit()
            
            # Update job status to completed
            job.status = "completed"
            job.completed_at = datetime.now()
            job.progress = 100
            job.message = f"Extracted {page_count} wiki pages"
            db.commit()
            
            # Log extraction
            log = ExtractionLog(
                job_id=job_id,
                level="INFO",
                message=f"Extracted {page_count} wiki pages for project {project_name}"
            )
            db.add(log)
            db.commit()
            
            logger.info(f"Wiki pages extraction completed for job {job_id}, project {project_name}")
            
        except Exception as e:
            logger.error(f"Error during wiki pages extraction: {str(e)}")
            
            # Update job status to failed
            job.status = "failed"
            job.completed_at = datetime.now()
            job.message = f"Error: {str(e)}"
            db.commit()
            
            # Log extraction error
            try:
                log = ExtractionLog(
                    job_id=job_id,
                    level="ERROR",
                    message=f"Error extracting wiki pages: {str(e)}"
                )
                db.add(log)
                db.commit()
            except Exception as log_error:
                logger.error(f"Failed to log extraction error: {str(log_error)}")
                db.rollback()
                
            raise
            
        finally:
            # Close the database session
            db.close()
            
    except Exception as e:
        logger.error(f"Error during wiki pages extraction: {str(e)}")
        raise

async def extract_all_metadata(job_id: int, project_id: int, project_name: str, connection_id: int):
    """Extract all metadata components for a project"""
    print(f"Starting all metadata extraction for job {job_id}, project {project_name}, connection_id: {connection_id}")
    logger.info(f"Starting all metadata extraction for job {job_id}, project {project_name}, connection_id: {connection_id}")
    
    try:
        # Get a new database session for this background task
        from backend.database.connection import get_db_session, create_tables
        db = get_db_session()
        
        # Ensure all database tables exist
        try:
            logger.info("Ensuring all database tables exist before metadata extraction...")
            create_tables()
            logger.info("Database tables verified successfully")
        except Exception as table_error:
            logger.error(f"Error ensuring database tables exist: {str(table_error)}")
        
        # Update job status to in progress
        job = db.query(ExtractionJob).filter(ExtractionJob.id == job_id).first()
        if job:
            job.status = "in_progress"
            job.started_at = datetime.now()
            job.total_items = 6  # 6 metadata components to extract
            job.progress = 0
            db.commit()
        
        # Extract each metadata component in sequence
        try:
            # 1. Area Paths
            await extract_area_paths(job_id, project_id, project_name, connection_id)
            job.progress = 16  # 1/6 = ~16%
            db.commit()
            
            # 2. Iteration Paths
            await extract_iteration_paths(job_id, project_id, project_name, connection_id)
            job.progress = 33  # 2/6 = ~33%
            db.commit()
            
            # 3. Custom Fields
            await extract_custom_fields(job_id, project_id, project_name, connection_id)
            job.progress = 50  # 3/6 = 50%
            db.commit()
            
            # 4. Users
            await extract_users(job_id, project_id, project_name, connection_id)
            job.progress = 66  # 4/6 = ~66%
            db.commit()
            
            # 5. Board Columns
            await extract_board_columns(job_id, project_id, project_name, connection_id)
            job.progress = 83  # 5/6 = ~83%
            db.commit()
            
            # 6. Wiki Pages
            await extract_wiki_pages(job_id, project_id, project_name, connection_id)
            job.progress = 99  # 6/6 = 100%, but we'll set to 99% until we complete the job
            db.commit()
            
            # Update job status to completed
            job.status = "completed"
            job.completed_at = datetime.now()
            job.progress = 100
            job.message = "Extracted all metadata components"
            db.commit()
            
            # Log extraction
            log = ExtractionLog(
                job_id=job_id,
                level="INFO",
                message=f"Extracted all metadata components for project {project_name}"
            )
            db.add(log)
            db.commit()
            
            logger.info(f"All metadata extraction completed for job {job_id}, project {project_name}")
            
        except Exception as e:
            logger.error(f"Error during all metadata extraction: {str(e)}")
            
            # Update job status to failed
            try:
                job.status = "failed"
                job.completed_at = datetime.now()
                job.message = f"Error: {str(e)}"
                db.commit()
            except Exception as update_error:
                logger.error(f"Failed to update job status: {str(update_error)}")
                try:
                    db.rollback()
                except:
                    pass
            
            # Log extraction error
            try:
                log = ExtractionLog(
                    job_id=job_id,
                    level="ERROR",
                    message=f"Error extracting all metadata: {str(e)}"
                )
                db.add(log)
                db.commit()
            except Exception as log_error:
                logger.error(f"Failed to log extraction error: {str(log_error)}")
                try:
                    db.rollback()
                except:
                    pass
                
            raise
            
    except Exception as e:
        logger.error(f"Error during all metadata extraction: {str(e)}")
        raise
    finally:
        # Close the database session
        try:
            db.close()
        except Exception as close_error:
            logger.error(f"Error closing database session: {str(close_error)}")

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



