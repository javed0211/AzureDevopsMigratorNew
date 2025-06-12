from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON, BigInteger
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class ADOConnection(Base):
    __tablename__ = "ado_connections"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    organization = Column(String(255), nullable=False)
    base_url = Column(String(500), nullable=False)
    pat_token = Column(Text, nullable=False)
    type = Column(String(50), default="source")  # source, target
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    projects = relationship("Project", back_populates="connection")

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(String(255), nullable=False, unique=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    process_template = Column(String(100))
    source_control = Column(String(50))
    visibility = Column(String(50))
    created_date = Column(DateTime)
    status = Column(String(50), default="ready")
    connection_id = Column(Integer, ForeignKey("ado_connections.id"))
    
    # Counts
    work_item_count = Column(Integer, default=0)
    repo_count = Column(Integer, default=0)
    test_case_count = Column(Integer, default=0)
    pipeline_count = Column(Integer, default=0)
    
    # Relationships
    connection = relationship("ADOConnection", back_populates="projects")
    work_items = relationship("WorkItem", back_populates="project")
    repositories = relationship("Repository", back_populates="project")
    pipelines = relationship("Pipeline", back_populates="project")
    test_plans = relationship("TestPlan", back_populates="project")
    boards = relationship("Board", back_populates="project")
    queries = relationship("Query", back_populates="project")
    extraction_jobs = relationship("ExtractionJob", back_populates="project")

class WorkItem(Base):
    __tablename__ = "work_items"
    
    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(Integer, nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"))
    title = Column(String(500))
    work_item_type = Column(String(100))
    state = Column(String(100))
    assigned_to = Column(String(255))
    created_date = Column(DateTime)
    changed_date = Column(DateTime)
    area_path = Column(String(500))
    iteration_path = Column(String(500))
    priority = Column(Integer)
    tags = Column(Text)
    description = Column(Text)
    fields = Column(JSON)  # All custom fields and system fields
    
    project = relationship("Project", back_populates="work_items")
    comments = relationship("WorkItemComment", back_populates="work_item")
    attachments = relationship("WorkItemAttachment", back_populates="work_item")
    revisions = relationship("WorkItemRevision", back_populates="work_item")
    relations = relationship("WorkItemRelation", foreign_keys="WorkItemRelation.source_work_item_id", back_populates="source_work_item")

class WorkItemComment(Base):
    __tablename__ = "work_item_comments"
    
    id = Column(Integer, primary_key=True, index=True)
    work_item_id = Column(Integer, ForeignKey("work_items.id"))
    text = Column(Text)
    created_by = Column(String(255))
    created_date = Column(DateTime)
    
    work_item = relationship("WorkItem", back_populates="comments")

class WorkItemAttachment(Base):
    __tablename__ = "work_item_attachments"
    
    id = Column(Integer, primary_key=True, index=True)
    work_item_id = Column(Integer, ForeignKey("work_items.id"))
    name = Column(String(255))
    url = Column(String(1000))
    size = Column(BigInteger)
    created_by = Column(String(255))
    created_date = Column(DateTime)
    
    work_item = relationship("WorkItem", back_populates="attachments")

class WorkItemRevision(Base):
    __tablename__ = "work_item_revisions"
    
    id = Column(Integer, primary_key=True, index=True)
    work_item_id = Column(Integer, ForeignKey("work_items.id"))
    revision_number = Column(Integer)
    changed_by = Column(String(255))
    changed_date = Column(DateTime)
    fields = Column(JSON)
    
    work_item = relationship("WorkItem", back_populates="revisions")

class WorkItemRelation(Base):
    __tablename__ = "work_item_relations"
    
    id = Column(Integer, primary_key=True, index=True)
    source_work_item_id = Column(Integer, ForeignKey("work_items.id"))
    target_work_item_id = Column(Integer, ForeignKey("work_items.id"))
    relation_type = Column(String(100))
    
    source_work_item = relationship("WorkItem", foreign_keys=[source_work_item_id], back_populates="relations")
    target_work_item = relationship("WorkItem", foreign_keys=[target_work_item_id])

class Repository(Base):
    __tablename__ = "repositories"
    
    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(String(255), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"))
    name = Column(String(255))
    url = Column(String(1000))
    default_branch = Column(String(255))
    size = Column(BigInteger)
    
    project = relationship("Project", back_populates="repositories")
    commits = relationship("Commit", back_populates="repository")
    pull_requests = relationship("PullRequest", back_populates="repository")

class Commit(Base):
    __tablename__ = "commits"
    
    id = Column(Integer, primary_key=True, index=True)
    repository_id = Column(Integer, ForeignKey("repositories.id"))
    commit_id = Column(String(255))
    author = Column(String(255))
    committer = Column(String(255))
    comment = Column(Text)
    commit_date = Column(DateTime)
    
    repository = relationship("Repository", back_populates="commits")

class PullRequest(Base):
    __tablename__ = "pull_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    repository_id = Column(Integer, ForeignKey("repositories.id"))
    external_id = Column(Integer)
    title = Column(String(500))
    description = Column(Text)
    created_by = Column(String(255))
    created_date = Column(DateTime)
    status = Column(String(100))
    source_branch = Column(String(255))
    target_branch = Column(String(255))
    
    repository = relationship("Repository", back_populates="pull_requests")

class Pipeline(Base):
    __tablename__ = "pipelines"
    
    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(Integer)
    project_id = Column(Integer, ForeignKey("projects.id"))
    name = Column(String(255))
    folder = Column(String(500))
    configuration_type = Column(String(100))  # yaml, designer
    yaml_path = Column(String(500))
    
    project = relationship("Project", back_populates="pipelines")
    runs = relationship("PipelineRun", back_populates="pipeline")

class PipelineRun(Base):
    __tablename__ = "pipeline_runs"
    
    id = Column(Integer, primary_key=True, index=True)
    pipeline_id = Column(Integer, ForeignKey("pipelines.id"))
    external_id = Column(Integer)
    name = Column(String(255))
    status = Column(String(100))
    result = Column(String(100))
    created_date = Column(DateTime)
    finished_date = Column(DateTime)
    
    pipeline = relationship("Pipeline", back_populates="runs")

class TestPlan(Base):
    __tablename__ = "test_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(Integer)
    project_id = Column(Integer, ForeignKey("projects.id"))
    name = Column(String(255))
    description = Column(Text)
    area_path = Column(String(500))
    iteration = Column(String(500))
    state = Column(String(100))
    
    project = relationship("Project", back_populates="test_plans")
    test_suites = relationship("TestSuite", back_populates="test_plan")

class TestSuite(Base):
    __tablename__ = "test_suites"
    
    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(Integer)
    test_plan_id = Column(Integer, ForeignKey("test_plans.id"))
    name = Column(String(255))
    suite_type = Column(String(100))
    
    test_plan = relationship("TestPlan", back_populates="test_suites")
    test_cases = relationship("TestCase", back_populates="test_suite")

class TestCase(Base):
    __tablename__ = "test_cases"
    
    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(Integer)
    test_suite_id = Column(Integer, ForeignKey("test_suites.id"))
    title = Column(String(500))
    state = Column(String(100))
    priority = Column(Integer)
    
    test_suite = relationship("TestSuite", back_populates="test_cases")

class Board(Base):
    __tablename__ = "boards"
    
    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(String(255))
    project_id = Column(Integer, ForeignKey("projects.id"))
    name = Column(String(255))
    
    project = relationship("Project", back_populates="boards")
    columns = relationship("BoardColumn", back_populates="board")

class BoardColumn(Base):
    __tablename__ = "board_columns"
    
    id = Column(Integer, primary_key=True, index=True)
    board_id = Column(Integer, ForeignKey("boards.id"))
    name = Column(String(255))
    column_type = Column(String(100))
    item_limit = Column(Integer)
    
    board = relationship("Board", back_populates="columns")

class Query(Base):
    __tablename__ = "queries"
    
    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(String(255))
    project_id = Column(Integer, ForeignKey("projects.id"))
    name = Column(String(255))
    path = Column(String(500))
    query_type = Column(String(100))
    wiql = Column(Text)
    
    project = relationship("Project", back_populates="queries")

class ExtractionJob(Base):
    __tablename__ = "extraction_jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    artifact_type = Column(String(100))  # workitems, repositories, pipelines, etc.
    status = Column(String(50), default="pending")  # pending, running, completed, failed
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    error_message = Column(Text)
    progress = Column(Integer, default=0)
    total_items = Column(Integer, default=0)
    extracted_items = Column(Integer, default=0)
    
    project = relationship("Project", back_populates="extraction_jobs")
    logs = relationship("ExtractionLog", back_populates="job")

class ExtractionLog(Base):
    __tablename__ = "extraction_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("extraction_jobs.id"))
    level = Column(String(20))  # INFO, WARNING, ERROR
    message = Column(Text)
    details = Column(JSON)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    job = relationship("ExtractionJob", back_populates="logs")