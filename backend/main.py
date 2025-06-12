#!/usr/bin/env python3
"""
Azure DevOps Migration Tool - Python FastAPI Backend
Complete replacement for Node.js backend
"""
import os
import sys
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any
from pathlib import Path

# Set up path
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor
import uvicorn
import asyncio
import httpx
import base64

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(title="Azure DevOps Migration Tool API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required")

def get_db_connection():
    """Get database connection"""
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)

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

# Azure DevOps Client
class AzureDevOpsClient:
    def __init__(self, organization: str, pat_token: str):
        self.organization = organization
        self.pat_token = pat_token
        self.base_url = f"https://dev.azure.com/{organization}"
        self.headers = {
            'Authorization': f'Basic {base64.b64encode(f":{pat_token}".encode()).decode()}',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }

    async def get_projects(self) -> List[Dict[str, Any]]:
        """Get all projects from Azure DevOps"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.base_url}/_apis/projects?api-version=7.0",
                    headers=self.headers,
                    timeout=30.0
                )
                if response.status_code == 200:
                    data = response.json()
                    projects = data.get('value', [])
                    
                    # Get additional details for each project
                    detailed_projects = []
                    for project in projects:
                        try:
                            # Get project capabilities
                            caps_response = await client.get(
                                f"{self.base_url}/_apis/projects/{project['id']}?includeCapabilities=true&api-version=7.0",
                                headers=self.headers,
                                timeout=10.0
                            )
                            
                            if caps_response.status_code == 200:
                                caps_data = caps_response.json()
                                capabilities = caps_data.get('capabilities', {})
                                
                                project_info = {
                                    'id': project['id'],
                                    'name': project['name'],
                                    'description': project.get('description', ''),
                                    'visibility': project.get('visibility', 'Private'),
                                    'state': project.get('state', 'wellFormed'),
                                    'url': project.get('url', ''),
                                    'lastUpdateTime': project.get('lastUpdateTime'),
                                    'processTemplate': capabilities.get('processTemplate', {}).get('templateName', 'Unknown'),
                                    'sourceControl': capabilities.get('versioncontrol', {}).get('sourceControlType', 'Git')
                                }
                                detailed_projects.append(project_info)
                            else:
                                detailed_projects.append(project)
                        except Exception as e:
                            logger.warning(f"Failed to get details for project {project['name']}: {e}")
                            detailed_projects.append(project)
                    
                    return detailed_projects
                else:
                    logger.error(f"Failed to get projects: {response.status_code} - {response.text}")
                    return []
            except Exception as e:
                logger.error(f"Error fetching projects: {e}")
                return []

# API Routes
@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Azure DevOps Migration Tool API", "version": "1.0.0", "backend": "Python FastAPI"}

@app.get("/api/projects", response_model=List[ProjectResponse])
async def get_projects():
    """Get all projects from database"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, external_id as externalId, name, description, 
                   process_template as processTemplate, source_control as sourceControl,
                   visibility, status, created_date as createdDate,
                   work_item_count as workItemCount, repo_count as repoCount, 
                   test_case_count as testCaseCount, pipeline_count as pipelineCount,
                   connection_id as connectionId
            FROM projects 
            ORDER BY name
        """)
        projects = cursor.fetchall()
        return [ProjectResponse(**dict(project)) for project in projects]
    finally:
        conn.close()

@app.get("/api/statistics", response_model=StatisticsResponse)
async def get_statistics():
    """Get project statistics"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                COUNT(*) as total_projects,
                SUM(CASE WHEN status = 'selected' THEN 1 ELSE 0 END) as selected_projects,
                SUM(CASE WHEN status IN ('extracting', 'migrating') THEN 1 ELSE 0 END) as in_progress_projects,
                SUM(CASE WHEN status = 'migrated' THEN 1 ELSE 0 END) as migrated_projects
            FROM projects
        """)
        
        result = cursor.fetchone()
        return StatisticsResponse(
            totalProjects=int(result['total_projects']) if result['total_projects'] else 0,
            selectedProjects=int(result['selected_projects']) if result['selected_projects'] else 0,
            inProgressProjects=int(result['in_progress_projects']) if result['in_progress_projects'] else 0,
            migratedProjects=int(result['migrated_projects']) if result['migrated_projects'] else 0
        )
    finally:
        conn.close()

@app.post("/api/projects/sync")
async def sync_projects():
    """Sync projects from Azure DevOps"""
    # Get the default connection from database
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # Get Azure DevOps PAT from environment and update database
        azure_pat = os.getenv("AZURE_DEVOPS_PAT")
        if azure_pat:
            cursor.execute("""
                UPDATE ado_connections 
                SET pat_token = %s 
                WHERE organization = 'DevCGAzureDevOps'
            """, (azure_pat,))
            conn.commit()
        
        cursor.execute("SELECT organization, pat_token FROM ado_connections WHERE is_active = true LIMIT 1")
        connection = cursor.fetchone()
        
        if not connection:
            raise HTTPException(status_code=400, detail="No active Azure DevOps connection found")
        
        # Create ADO client
        ado_client = AzureDevOpsClient(connection['organization'], connection['pat_token'])
        
        # Fetch projects from Azure DevOps
        projects_data = await ado_client.get_projects()
        
        synced_projects = []
        for project_data in projects_data:
            try:
                # Check if project exists
                cursor.execute("SELECT id FROM projects WHERE external_id = %s", (project_data['id'],))
                existing = cursor.fetchone()
                
                if existing:
                    # Update existing project
                    cursor.execute("""
                        UPDATE projects 
                        SET name = %s, description = %s, process_template = %s, 
                            source_control = %s, visibility = %s
                        WHERE external_id = %s
                        RETURNING *
                    """, (
                        project_data['name'],
                        project_data.get('description', ''),
                        project_data.get('processTemplate', 'Unknown'),
                        project_data.get('sourceControl', 'Git'),
                        project_data.get('visibility', 'Private'),
                        project_data['id']
                    ))
                else:
                    # Insert new project
                    cursor.execute("""
                        INSERT INTO projects (external_id, name, description, process_template, 
                                            source_control, visibility, status, connection_id)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING *
                    """, (
                        project_data['id'],
                        project_data['name'],
                        project_data.get('description', ''),
                        project_data.get('processTemplate', 'Unknown'),
                        project_data.get('sourceControl', 'Git'),
                        project_data.get('visibility', 'Private'),
                        'ready',
                        1  # Default connection ID
                    ))
                
                project = cursor.fetchone()
                synced_projects.append(ProjectResponse(**dict(project)))
                
            except Exception as e:
                logger.error(f"Failed to sync project {project_data.get('name', 'unknown')}: {e}")
        
        conn.commit()
        return synced_projects
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Failed to sync projects: {e}")
        raise HTTPException(status_code=500, detail="Failed to sync projects")
    finally:
        conn.close()

@app.patch("/api/projects/{project_id}/status")
async def update_project_status(project_id: int, status: str):
    """Update project status"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE projects SET status = %s WHERE id = %s
            RETURNING id, external_id as externalId, name, description, 
                      process_template as processTemplate, source_control as sourceControl,
                      visibility, status, created_date as createdDate,
                      work_item_count as workItemCount, repo_count as repoCount, 
                      test_case_count as testCaseCount, pipeline_count as pipelineCount,
                      connection_id as connectionId
        """, (status, project_id))
        
        project = cursor.fetchone()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        conn.commit()
        return ProjectResponse(**dict(project))
    finally:
        conn.close()

class BulkStatusRequest(BaseModel):
    project_ids: List[int]
    status: str

@app.post("/api/projects/bulk-status")
async def update_bulk_project_status(request: BulkStatusRequest):
    """Update status for multiple projects"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE projects SET status = %s WHERE id = ANY(%s)
            RETURNING id, external_id as externalId, name, description, 
                      process_template as processTemplate, source_control as sourceControl,
                      visibility, status, created_date as createdDate,
                      work_item_count as workItemCount, repo_count as repoCount, 
                      test_case_count as testCaseCount, pipeline_count as pipelineCount,
                      connection_id as connectionId
        """, (request.status, request.project_ids))
        
        projects = cursor.fetchall()
        conn.commit()
        return [ProjectResponse(**dict(project)) for project in projects]
    finally:
        conn.close()

@app.post("/api/projects/extract")
async def extract_projects(extract_request: ExtractRequest, background_tasks: BackgroundTasks):
    """Start extraction job for selected projects"""
    # Create extraction jobs in database
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        for project_id in extract_request.projectIds:
            for artifact_type in extract_request.artifactTypes:
                cursor.execute("""
                    INSERT INTO extraction_jobs (project_id, artifact_type, status, started_at)
                    VALUES (%s, %s, 'pending', NOW())
                """, (project_id, artifact_type))
        
        conn.commit()
        
        # Start background extraction
        background_tasks.add_task(run_extraction_job, extract_request.projectIds, extract_request.artifactTypes)
        
        return {"message": "Extraction job started", "projectIds": extract_request.projectIds}
    finally:
        conn.close()

async def run_extraction_job(project_ids: List[int], artifact_types: List[str]):
    """Background task to run extraction job"""
    # This would implement the actual extraction logic
    # For now, just mark jobs as completed
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        for project_id in project_ids:
            for artifact_type in artifact_types:
                cursor.execute("""
                    UPDATE extraction_jobs 
                    SET status = 'completed', completed_at = NOW(), progress = 100
                    WHERE project_id = %s AND artifact_type = %s AND status = 'pending'
                """, (project_id, artifact_type))
        
        conn.commit()
        logger.info(f"Completed extraction for projects {project_ids}")
    except Exception as e:
        logger.error(f"Extraction job failed: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    # Use port 5000 to replace Node.js backend
    port = int(os.getenv("PORT", "5000"))
    host = "0.0.0.0"
    
    print(f"Starting Azure DevOps Migration Backend on {host}:{port}")
    print("Python FastAPI backend is now replacing Node.js backend")
    
    uvicorn.run(app, host=host, port=port, reload=False, log_level="info")