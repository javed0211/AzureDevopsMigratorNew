"""
Azure DevOps Migration Tool - Working Database-Connected Backend
"""
import os
import sys
import logging
import asyncio
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import psycopg2
import psycopg2.extras
import base64
import json

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

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
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Database connection
def get_db_connection():
    """Get database connection"""
    try:
        conn = psycopg2.connect(
            host=os.getenv('PGHOST', 'localhost'),
            database=os.getenv('PGDATABASE', 'main'),
            user=os.getenv('PGUSER', 'main'),
            password=os.getenv('PGPASSWORD', ''),
            port=os.getenv('PGPORT', '5432')
        )
        return conn
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return None

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

# API Routes
@app.get("/")
async def root():
    """Root endpoint - health check"""
    return {
        "message": "Azure DevOps Migration Tool API",
        "version": "1.0.0",
        "status": "running",
        "backend": "Python FastAPI with PostgreSQL",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/projects")
async def get_projects():
    """Get all projects"""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT id, external_id as "externalId", name, description, 
                       process_template as "processTemplate", source_control as "sourceControl",
                       visibility, status, work_item_count as "workItemCount",
                       repo_count as "repoCount", test_case_count as "testCaseCount",
                       pipeline_count as "pipelineCount", connection_id as "connectionId",
                       created_date as "createdDate"
                FROM projects ORDER BY id
            """)
            projects = cur.fetchall()
            return [dict(row) for row in projects]
    except Exception as e:
        logger.error(f"Error fetching projects: {e}")
        return []
    finally:
        conn.close()

@app.get("/api/statistics") 
async def get_statistics():
    """Get project statistics"""
    conn = get_db_connection()
    if not conn:
        return {"totalProjects": 0, "selectedProjects": 0, "inProgressProjects": 0, "migratedProjects": 0}
    
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM projects")
            total = cur.fetchone()[0] or 0
            
            cur.execute("SELECT COUNT(*) FROM projects WHERE status = 'selected'")
            selected = cur.fetchone()[0] or 0
            
            cur.execute("SELECT COUNT(*) FROM projects WHERE status = 'in_progress'")
            in_progress = cur.fetchone()[0] or 0
            
            cur.execute("SELECT COUNT(*) FROM projects WHERE status = 'migrated'")
            migrated = cur.fetchone()[0] or 0
            
            return {
                "totalProjects": total,
                "selectedProjects": selected,
                "inProgressProjects": in_progress,
                "migratedProjects": migrated
            }
    except Exception as e:
        logger.error(f"Error fetching statistics: {e}")
        return {"totalProjects": 0, "selectedProjects": 0, "inProgressProjects": 0, "migratedProjects": 0}
    finally:
        conn.close()

@app.get("/api/connections")
async def get_connections():
    """Get all Azure DevOps connections"""
    conn = get_db_connection()
    if not conn:
        return []
    
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT id, name, organization, base_url as "baseUrl", 
                       is_active as "isActive", created_at as "createdAt"
                FROM ado_connections ORDER BY id
            """)
            connections = cur.fetchall()
            return [dict(row) for row in connections]
    except Exception as e:
        logger.error(f"Error fetching connections: {e}")
        return []
    finally:
        conn.close()

@app.post("/api/connections")
async def create_connection(connection: ConnectionRequest):
    """Create Azure DevOps connection"""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO ado_connections (name, organization, base_url, pat_token, is_active, created_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id, name, organization, base_url as "baseUrl", is_active as "isActive", created_at as "createdAt"
            """, (
                connection.name,
                connection.organization,
                f"https://dev.azure.com/{connection.organization}",
                connection.personalAccessToken,
                True,
                datetime.now()
            ))
            
            new_connection = dict(cur.fetchone())
            conn.commit()
            logger.info(f"Created connection with ID: {new_connection['id']}")
            return new_connection
            
    except Exception as e:
        logger.error(f"Error creating connection: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail="Failed to create connection")
    finally:
        conn.close()

@app.post("/api/connections/test")
async def test_connection(connection_data: dict):
    """Test Azure DevOps connection"""
    logger.info("Testing Azure DevOps connection")
    organization = connection_data.get("organization", "")
    pat_token = connection_data.get("personalAccessToken", "")
    
    if not organization or not pat_token:
        return {"success": False, "message": "Organization and PAT token are required"}
    
    try:
        import aiohttp
        headers = {
            "Authorization": f"Basic {base64.b64encode(f':{pat_token}'.encode()).decode()}",
            "Content-Type": "application/json"
        }
        url = f"https://dev.azure.com/{organization}/_apis/projects?api-version=7.0&$top=1"
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers) as response:
                is_valid = response.status == 200
                result = {
                    "success": is_valid,
                    "message": "Connection successful" if is_valid else f"Connection failed - Status: {response.status}"
                }
                logger.info(f"Connection test result: {result}")
                return result
                
    except Exception as e:
        logger.error(f"Connection test error: {e}")
        return {"success": False, "message": f"Connection failed: {str(e)}"}

@app.post("/api/projects/sync")
async def sync_projects():
    """Sync projects from Azure DevOps"""
    conn = get_db_connection()
    if not conn:
        return {"message": "Database connection failed"}
    
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Get active connection
            cur.execute("SELECT * FROM ado_connections WHERE is_active = true LIMIT 1")
            connection = cur.fetchone()
            
            if not connection:
                return {"message": "No active Azure DevOps connection found. Please create a connection first."}
            
            # For now, return success message - actual ADO sync would happen here
            return {"message": "Ready to sync projects. Connect to Azure DevOps with valid credentials to fetch real projects."}
            
    except Exception as e:
        logger.error(f"Error in sync: {e}")
        return {"message": f"Sync failed: {str(e)}"}
    finally:
        conn.close()

@app.patch("/api/projects/{project_id}/status")
async def update_project_status(project_id: int, status_update: StatusUpdate):
    """Update project status"""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                UPDATE projects SET status = %s WHERE id = %s
                RETURNING id, external_id as "externalId", name, status
            """, (status_update.status, project_id))
            
            updated_project = cur.fetchone()
            if not updated_project:
                raise HTTPException(status_code=404, detail="Project not found")
            
            conn.commit()
            return dict(updated_project)
            
    except Exception as e:
        logger.error(f"Error updating project status: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail="Failed to update project status")
    finally:
        conn.close()

@app.post("/api/projects/extract")
async def extract_projects(extraction_request: ExtractionRequest):
    """Start extraction job"""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO extraction_jobs (project_ids, artifact_types, status, started_at, progress)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
            """, (
                json.dumps(extraction_request.projectIds),
                json.dumps(extraction_request.artifactTypes),
                'running',
                datetime.now(),
                0
            ))
            
            job = cur.fetchone()
            conn.commit()
            
            return {
                "message": "Extraction job started successfully", 
                "jobId": job['id']
            }
            
    except Exception as e:
        logger.error(f"Error starting extraction: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail="Failed to start extraction job")
    finally:
        conn.close()

if __name__ == "__main__":
    import uvicorn
    
    logger.info("=" * 50)
    logger.info("Starting Azure DevOps Migration Tool Backend")
    logger.info("=" * 50)
    logger.info(f"Database URL configured: {'Yes' if os.getenv('DATABASE_URL') else 'No'}")
    
    # Test database connection
    test_conn = get_db_connection()
    if test_conn:
        logger.info("Database connection successful")
        test_conn.close()
    else:
        logger.error("Database connection failed")
    
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8000,
        log_level="info"
    )