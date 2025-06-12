"""
Azure DevOps Migration Tool - Python FastAPI Backend
Primary backend server replacing Node.js
"""
import os
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import base64
import json
from .schemas import ConnectionResponse

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

    async def get_projects(self) -> List[Dict[str, Any]]:
        """Get all projects from Azure DevOps"""
        try:
            async with aiohttp.ClientSession() as session:
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

# API Endpoints
@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Azure DevOps Migration Tool API", "status": "running"}

@app.get("/api/projects")
async def get_projects():
    """Get all projects from database"""
    try:
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT p.id, p.external_id as externalId, p.name, p.description,
                       p.process_template as processTemplate, p.source_control as sourceControl,
                       p.visibility, p.status, p.created_date as createdDate,
                       p.work_item_count as workItemCount, p.repo_count as repoCount,
                       p.test_case_count as testCaseCount, p.pipeline_count as pipelineCount,
                       p.connection_id as connectionId
                FROM projects p
                ORDER BY p.name
            """)
            projects = cursor.fetchall()
            return [dict(project) for project in projects]
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