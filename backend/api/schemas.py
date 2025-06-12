from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class ConnectionCreate(BaseModel):
    name: str
    organization: str
    pat_token: str

class ConnectionResponse(BaseModel):
    id: int
    name: str
    organization: str
    base_url: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class ProjectResponse(BaseModel):
    id: int
    external_id: str
    name: str
    description: Optional[str] = None
    process_template: Optional[str] = None
    source_control: Optional[str] = None
    visibility: Optional[str] = None
    status: str
    work_item_count: int = 0
    repo_count: int = 0
    test_case_count: int = 0
    pipeline_count: int = 0
    
    class Config:
        from_attributes = True

class ExtractRequest(BaseModel):
    artifact_types: List[str]  # ["workitems", "repositories", "pipelines", "testplans", "boards", "queries"]

class ExtractionJobResponse(BaseModel):
    id: int
    project_id: int
    artifact_type: str
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    progress: int = 0
    total_items: int = 0
    extracted_items: int = 0
    
    class Config:
        from_attributes = True

class LogResponse(BaseModel):
    id: int
    job_id: int
    level: str
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime
    
    class Config:
        from_attributes = True