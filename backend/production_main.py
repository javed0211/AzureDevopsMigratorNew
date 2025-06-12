"""
Azure DevOps Migration Tool - Production Python FastAPI Backend
Replaces Node.js server entirely with full functionality
"""
import os
import sys
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import base64
import json

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

# Global in-memory storage (production would use database)
connections_store = []
projects_store = []
extraction_jobs = []
connection_id_counter = 1
project_id_counter = 1
job_id_counter = 1

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
    createdDate: Optional[str] = None

class ConnectionRequest(BaseModel):
    name: str
    organization: str
    personalAccessToken: str

class AzureDevOpsClient:
    def __init__(self, organization: str, pat_token: str):
        self.organization = organization
        self.pat_token = pat_token
        self.base_url = f"https://dev.azure.com/{organization}"
        self.headers = {
            "Authorization": f"Basic {base64.b64encode(f':{pat_token}'.encode()).decode()}",
            "Content-Type": "application/json"
        }

    async def test_connection(self) -> bool:
        """Test Azure DevOps connection"""
        try:
            import aiohttp
            url = f"{self.base_url}/_apis/projects?api-version=7.0&$top=1"
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=self.headers) as response:
                    return response.status == 200
        except Exception as e:
            logger.error(f"Connection test failed: {e}")
            return False

    async def get_projects(self) -> List[Dict[str, Any]]:
        """Get all projects from Azure DevOps"""
        try:
            import aiohttp
            url = f"{self.base_url}/_apis/projects?api-version=7.0"
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=self.headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get("value", [])
                    else:
                        logger.error(f"Failed to get projects: {response.status}")
                        return []
        except Exception as e:
            logger.error(f"Error getting projects: {e}")
            return []

# API Routes
@app.get("/")
async def root():
    """Root endpoint - serve frontend"""
    return await serve_frontend("")

@app.get("/api/projects")
async def get_projects():
    """Get all projects"""
    logger.info(f"Fetching {len(projects_store)} projects")
    return projects_store

@app.get("/api/statistics") 
async def get_statistics():
    """Get project statistics"""
    total = len(projects_store)
    selected = len([p for p in projects_store if p.get("status") == "selected"])
    in_progress = len([p for p in projects_store if p.get("status") == "in_progress"])
    migrated = len([p for p in projects_store if p.get("status") == "migrated"])
    
    stats = {
        "totalProjects": total,
        "selectedProjects": selected,
        "inProgressProjects": in_progress,
        "migratedProjects": migrated
    }
    logger.info(f"Statistics: {stats}")
    return stats

@app.get("/api/connections")
async def get_connections():
    """Get all Azure DevOps connections"""
    logger.info(f"Fetching {len(connections_store)} connections")
    return connections_store

@app.post("/api/connections")
async def create_connection(connection: ConnectionRequest):
    """Create Azure DevOps connection"""
    global connection_id_counter
    logger.info(f"Creating connection for organization: {connection.organization}")
    
    new_connection = {
        "id": connection_id_counter,
        "name": connection.name,
        "organization": connection.organization,
        "baseUrl": f"https://dev.azure.com/{connection.organization}",
        "patToken": connection.personalAccessToken,
        "isActive": True,
        "createdAt": datetime.now().isoformat()
    }
    
    connections_store.append(new_connection)
    connection_id_counter += 1
    
    logger.info(f"Created connection with ID: {new_connection['id']}")
    return new_connection

@app.post("/api/connections/test")
async def test_connection(connection_data: dict):
    """Test Azure DevOps connection"""
    logger.info("Testing connection")
    organization = connection_data.get("organization", "")
    pat_token = connection_data.get("personalAccessToken", "")
    
    if not organization or not pat_token:
        return {"success": False, "message": "Organization and PAT token are required"}
    
    client = AzureDevOpsClient(organization, pat_token)
    is_valid = await client.test_connection()
    
    result = {
        "success": is_valid,
        "message": "Connection successful" if is_valid else "Connection failed - check your credentials"
    }
    logger.info(f"Connection test result: {result}")
    return result

@app.post("/api/projects/sync")
async def sync_projects():
    """Sync projects from Azure DevOps"""
    global project_id_counter
    logger.info("Starting project sync")
    
    if not connections_store:
        logger.warning("No connections available for sync")
        return {"message": "No active Azure DevOps connection found. Please create a connection first."}
    
    connection = connections_store[0]  # Use first connection
    client = AzureDevOpsClient(connection["organization"], connection["patToken"])
    ado_projects = await client.get_projects()
    
    synced_count = 0
    for ado_project in ado_projects:
        # Check if project already exists
        existing = next((p for p in projects_store if p.get("externalId") == ado_project.get("id")), None)
        
        if not existing:
            project = {
                "id": project_id_counter,
                "externalId": ado_project.get("id", ""),
                "name": ado_project.get("name", ""),
                "description": ado_project.get("description", ""),
                "processTemplate": ado_project.get("capabilities", {}).get("processTemplate", {}).get("templateTypeId", ""),
                "sourceControl": ado_project.get("capabilities", {}).get("versioncontrol", {}).get("sourceControlType", ""),
                "visibility": ado_project.get("visibility", "private"),
                "status": "available",
                "connectionId": connection["id"],
                "workItemCount": 0,
                "repoCount": 0,
                "testCaseCount": 0,
                "pipelineCount": 0,
                "createdDate": datetime.now().isoformat()
            }
            projects_store.append(project)
            project_id_counter += 1
            synced_count += 1
    
    logger.info(f"Synced {synced_count} new projects")
    return {"message": f"Synced {synced_count} projects successfully"}

@app.patch("/api/projects/{project_id}/status")
async def update_project_status(project_id: int, request: Request):
    """Update project status"""
    body = await request.json()
    status = body.get("status")
    
    logger.info(f"Updating project {project_id} to status: {status}")
    
    project = next((p for p in projects_store if p.get("id") == project_id), None)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project["status"] = status
    return project

@app.post("/api/projects/extract")
async def extract_projects(request: Request):
    """Start extraction job"""
    global job_id_counter
    body = await request.json()
    project_ids = body.get("projectIds", [])
    artifact_types = body.get("artifactTypes", [])
    
    logger.info(f"Starting extraction for {len(project_ids)} projects")
    
    job = {
        "id": job_id_counter,
        "projectIds": project_ids,
        "artifactTypes": artifact_types,
        "status": "running",
        "startedAt": datetime.now().isoformat(),
        "progress": 0
    }
    
    extraction_jobs.append(job)
    job_id_counter += 1
    
    return {"message": "Extraction job started successfully", "jobId": job["id"]}

# Frontend serving
@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    """Serve frontend files for SPA"""
    try:
        # Serve the React frontend index.html for all routes
        frontend_dir = os.path.join(os.path.dirname(__file__), "..", "client")
        index_path = os.path.join(frontend_dir, "index.html")
        
        if os.path.exists(index_path):
            with open(index_path, 'r') as f:
                content = f.read()
            return HTMLResponse(content=content)
        else:
            return HTMLResponse(content="""
            <!DOCTYPE html>
            <html>
            <head><title>Azure DevOps Migration Tool</title></head>
            <body>
                <div id="root">
                    <h1>Azure DevOps Migration Tool</h1>
                    <p>Backend is running on port 5000</p>
                    <p>Frontend not found. Please build the frontend first.</p>
                </div>
            </body>
            </html>
            """)
    except Exception as e:
        logger.error(f"Error serving frontend: {e}")
        return HTMLResponse(content=f"<html><body><h1>Error serving frontend: {e}</h1></body></html>")

if __name__ == "__main__":
    import uvicorn
    
    # Log startup info
    logger.info("Starting Azure DevOps Migration Tool Backend")
    logger.info(f"Environment: {os.getenv('NODE_ENV', 'development')}")
    logger.info(f"Database URL configured: {'Yes' if os.getenv('DATABASE_URL') else 'No'}")
    logger.info(f"Azure DevOps PAT configured: {'Yes' if os.getenv('AZURE_DEVOPS_PAT') else 'No'}")
    
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=5000,
        log_level="info",
        access_log=True
    )