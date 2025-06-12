"""
Azure DevOps Migration Tool - Simplified Python FastAPI Backend
"""
import os
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
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

# In-memory storage for development
connections_store = []
projects_store = []
connection_id_counter = 1
project_id_counter = 1

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

class ConnectionResponse(BaseModel):
    id: int
    name: str
    organization: str
    isActive: bool

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
    """Root endpoint"""
    return {"message": "Azure DevOps Migration Tool API", "version": "1.0.0", "status": "running"}

@app.get("/api/projects")
async def get_projects():
    """Get all projects"""
    logger.info("Fetching projects")
    return projects_store

@app.get("/api/statistics") 
async def get_statistics():
    """Get project statistics"""
    logger.info("Fetching statistics")
    total = len(projects_store)
    selected = len([p for p in projects_store if p.get("status") == "selected"])
    in_progress = len([p for p in projects_store if p.get("status") == "in_progress"])
    migrated = len([p for p in projects_store if p.get("status") == "migrated"])
    
    return {
        "totalProjects": total,
        "selectedProjects": selected,
        "inProgressProjects": in_progress,
        "migratedProjects": migrated
    }

@app.get("/api/connections")
async def get_connections():
    """Get all Azure DevOps connections"""
    logger.info("Fetching connections")
    return connections_store

@app.post("/api/connections")
async def create_connection(connection_data: dict):
    """Create Azure DevOps connection"""
    global connection_id_counter
    logger.info(f"Creating connection: {connection_data}")
    
    connection = {
        "id": connection_id_counter,
        "name": connection_data.get("name", "Default Connection"),
        "organization": connection_data.get("organization", ""),
        "baseUrl": f"https://dev.azure.com/{connection_data.get('organization', '')}",
        "patToken": connection_data.get("personalAccessToken", ""),
        "isActive": True,
        "createdAt": datetime.now().isoformat()
    }
    
    connections_store.append(connection)
    connection_id_counter += 1
    
    return connection

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
    
    return {
        "success": is_valid,
        "message": "Connection successful" if is_valid else "Connection failed - check your credentials"
    }

@app.post("/api/projects/sync")
async def sync_projects():
    """Sync projects from Azure DevOps"""
    global project_id_counter
    logger.info("Syncing projects")
    
    if not connections_store:
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
    
    return {"message": f"Synced {synced_count} projects successfully"}

@app.patch("/api/projects/{project_id}/status")
async def update_project_status(project_id: int, status_data: dict):
    """Update project status"""
    logger.info(f"Updating project {project_id} status")
    
    project = next((p for p in projects_store if p.get("id") == project_id), None)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project["status"] = status_data.get("status", project["status"])
    return project

@app.post("/api/projects/extract")
async def extract_projects(extract_data: dict):
    """Start extraction job"""
    logger.info(f"Starting extraction: {extract_data}")
    return {"message": "Extraction job started successfully", "jobId": 1}

# Serve frontend files for SPA
@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    """Serve frontend files"""
    try:
        # For now, just return a message indicating the frontend should be served separately
        return {"message": "Frontend should be served by Vite on port 5173"}
    except Exception as e:
        logger.error(f"Error serving frontend: {e}")
        return {"message": "Frontend serving error"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)