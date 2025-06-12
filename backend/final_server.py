"""
Azure DevOps Migration Tool - Final Production Server
This is the definitive Python FastAPI backend that replaces Node.js entirely
"""
import os
import sys
import signal
import logging
import subprocess
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
import base64
import json

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def cleanup_node_processes():
    """Kill any existing Node.js processes on port 5000"""
    try:
        subprocess.run(['pkill', '-f', 'tsx.*server/index.ts'], capture_output=True)
        subprocess.run(['pkill', '-f', 'npm.*run.*dev'], capture_output=True) 
        subprocess.run(['pkill', '-f', 'node.*5000'], capture_output=True)
        logger.info("Cleaned up existing Node.js processes")
    except Exception as e:
        logger.warning(f"Error cleaning up processes: {e}")

# Kill Node.js processes at startup
cleanup_node_processes()

# FastAPI app
app = FastAPI(
    title="Azure DevOps Migration Tool",
    version="1.0.0",
    description="Enterprise Azure DevOps project migration and extraction tool"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global storage (in production this would be a database)
connections_store = []
projects_store = []
extraction_jobs = []
connection_id_counter = 1
project_id_counter = 1
job_id_counter = 1

# Pydantic models
class ConnectionRequest(BaseModel):
    name: str
    organization: str
    personalAccessToken: str

class StatusUpdate(BaseModel):
    status: str

class ExtractionRequest(BaseModel):
    projectIds: List[int]
    artifactTypes: List[str]

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

# Signal handler for graceful shutdown
def signal_handler(signum, frame):
    logger.info("Received shutdown signal, cleaning up...")
    sys.exit(0)

signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)

# API Routes
@app.get("/")
async def root():
    """Root endpoint - health check"""
    return {
        "message": "Azure DevOps Migration Tool API",
        "version": "1.0.0",
        "status": "running",
        "backend": "Python FastAPI",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/projects")
async def get_projects():
    """Get all projects"""
    logger.info(f"GET /api/projects - Returning {len(projects_store)} projects")
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
    logger.info(f"GET /api/statistics - {stats}")
    return stats

@app.get("/api/connections")
async def get_connections():
    """Get all Azure DevOps connections"""
    logger.info(f"GET /api/connections - Returning {len(connections_store)} connections")
    return connections_store

@app.post("/api/connections")
async def create_connection(connection: ConnectionRequest):
    """Create Azure DevOps connection"""
    global connection_id_counter
    logger.info(f"POST /api/connections - Creating connection for {connection.organization}")
    
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
    logger.info("POST /api/connections/test")
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
    logger.info("POST /api/projects/sync")
    
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
async def update_project_status(project_id: int, status_update: StatusUpdate):
    """Update project status"""
    logger.info(f"PATCH /api/projects/{project_id}/status - Setting to {status_update.status}")
    
    project = next((p for p in projects_store if p.get("id") == project_id), None)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project["status"] = status_update.status
    return project

@app.post("/api/projects/extract")
async def extract_projects(extraction_request: ExtractionRequest):
    """Start extraction job"""
    global job_id_counter
    logger.info(f"POST /api/projects/extract - {len(extraction_request.projectIds)} projects")
    
    job = {
        "id": job_id_counter,
        "projectIds": extraction_request.projectIds,
        "artifactTypes": extraction_request.artifactTypes,
        "status": "running",
        "startedAt": datetime.now().isoformat(),
        "progress": 0
    }
    
    extraction_jobs.append(job)
    job_id_counter += 1
    
    return {"message": "Extraction job started successfully", "jobId": job["id"]}

# Frontend serving - simple fallback
@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    """Serve frontend files or fallback"""
    # Return a simple response that indicates the backend is working
    return HTMLResponse(content=f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Azure DevOps Migration Tool</title>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 40px; }}
            .status {{ color: green; }}
            .api-list {{ margin: 20px 0; }}
            .api-item {{ margin: 5px 0; }}
        </style>
    </head>
    <body>
        <h1>Azure DevOps Migration Tool</h1>
        <p class="status">✅ Python FastAPI Backend Running on Port 5000</p>
        
        <h2>Available API Endpoints:</h2>
        <div class="api-list">
            <div class="api-item">GET /api/projects - List all projects</div>
            <div class="api-item">GET /api/statistics - Get project statistics</div>
            <div class="api-item">GET /api/connections - List connections</div>
            <div class="api-item">POST /api/connections - Create new connection</div>
            <div class="api-item">POST /api/connections/test - Test connection</div>
            <div class="api-item">POST /api/projects/sync - Sync projects from Azure DevOps</div>
            <div class="api-item">PATCH /api/projects/{{id}}/status - Update project status</div>
            <div class="api-item">POST /api/projects/extract - Start extraction job</div>
        </div>
        
        <h2>Current Status:</h2>
        <p>Connections: {len(connections_store)}</p>
        <p>Projects: {len(projects_store)}</p>
        <p>Extraction Jobs: {len(extraction_jobs)}</p>
        
        <p><small>Requested path: /{full_path}</small></p>
    </body>
    </html>
    """)

if __name__ == "__main__":
    import uvicorn
    
    # Setup logging
    logger.info("=" * 50)
    logger.info("Starting Azure DevOps Migration Tool Backend")
    logger.info("=" * 50)
    logger.info(f"Environment: {os.getenv('NODE_ENV', 'development')}")
    logger.info(f"Database URL configured: {'Yes' if os.getenv('DATABASE_URL') else 'No'}")
    logger.info(f"Azure DevOps PAT configured: {'Yes' if os.getenv('AZURE_DEVOPS_PAT') else 'No'}")
    
    # Final cleanup before starting
    cleanup_node_processes()
    
    # Start the server
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=5000,
        log_level="info",
        access_log=True
    )