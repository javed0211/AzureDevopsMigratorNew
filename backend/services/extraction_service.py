import asyncio
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_

from ..database.models import (
    Project, WorkItem, WorkItemComment, WorkItemAttachment, WorkItemRevision, WorkItemRelation,
    Repository, Commit, PullRequest, Pipeline, PipelineRun, TestPlan, TestSuite, TestCase,
    Board, BoardColumn, Query, ExtractionJob, ExtractionLog
)
from .ado_client import AzureDevOpsClient

logger = logging.getLogger(__name__)

class ExtractionService:
    def __init__(self, db: Session, ado_client: AzureDevOpsClient):
        self.db = db
        self.ado_client = ado_client

    async def extract_project_data(self, project_id: int, artifact_types: List[str]) -> Dict[str, Any]:
        """Extract comprehensive data for a project"""
        project = self.db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise ValueError(f"Project {project_id} not found")

        results = {}
        
        for artifact_type in artifact_types:
            job = self._create_extraction_job(project_id, artifact_type)
            
            try:
                if artifact_type == "workitems":
                    results[artifact_type] = await self._extract_work_items(project, job)
                elif artifact_type == "repositories":
                    results[artifact_type] = await self._extract_repositories(project, job)
                elif artifact_type == "pipelines":
                    results[artifact_type] = await self._extract_pipelines(project, job)
                elif artifact_type == "testplans":
                    results[artifact_type] = await self._extract_test_plans(project, job)
                elif artifact_type == "boards":
                    results[artifact_type] = await self._extract_boards(project, job)
                elif artifact_type == "queries":
                    results[artifact_type] = await self._extract_queries(project, job)
                
                self._complete_job(job, f"Successfully extracted {artifact_type}")
                
            except Exception as e:
                self._fail_job(job, str(e))
                logger.error(f"Failed to extract {artifact_type} for project {project.name}: {e}")
                results[artifact_type] = {"error": str(e)}

        return results

    def _create_extraction_job(self, project_id: int, artifact_type: str) -> ExtractionJob:
        """Create a new extraction job"""
        job = ExtractionJob(
            project_id=project_id,
            artifact_type=artifact_type,
            status="running",
            started_at=datetime.utcnow()
        )
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        
        self._log_extraction(job.id, "INFO", f"Started extraction of {artifact_type}")
        return job

    def _complete_job(self, job: ExtractionJob, message: str):
        """Mark job as completed"""
        job.status = "completed"
        job.completed_at = datetime.utcnow()
        job.progress = 100
        self.db.commit()
        self._log_extraction(job.id, "INFO", message)

    def _fail_job(self, job: ExtractionJob, error_message: str):
        """Mark job as failed"""
        job.status = "failed"
        job.completed_at = datetime.utcnow()
        job.error_message = error_message
        self.db.commit()
        self._log_extraction(job.id, "ERROR", error_message)

    def _log_extraction(self, job_id: int, level: str, message: str, details: Dict = None):
        """Log extraction progress"""
        log = ExtractionLog(
            job_id=job_id,
            level=level,
            message=message,
            details=details or {}
        )
        self.db.add(log)
        self.db.commit()

    async def _extract_work_items(self, project: Project, job: ExtractionJob) -> Dict[str, Any]:
        """Extract work items with full details"""
        work_items_data = await self.ado_client.get_work_items(project.name)
        
        job.total_items = len(work_items_data)
        self.db.commit()
        
        extracted_items = []
        for i, wi_data in enumerate(work_items_data):
            try:
                # Check if work item already exists
                existing_wi = self.db.query(WorkItem).filter(
                    and_(WorkItem.external_id == wi_data['id'], WorkItem.project_id == project.id)
                ).first()
                
                if existing_wi:
                    continue

                # Extract work item fields
                fields = wi_data.get('fields', {})
                
                work_item = WorkItem(
                    external_id=wi_data['id'],
                    project_id=project.id,
                    title=fields.get('System.Title', ''),
                    work_item_type=fields.get('System.WorkItemType', ''),
                    state=fields.get('System.State', ''),
                    assigned_to=fields.get('System.AssignedTo', {}).get('displayName', '') if fields.get('System.AssignedTo') else '',
                    created_date=self._parse_date(fields.get('System.CreatedDate')),
                    changed_date=self._parse_date(fields.get('System.ChangedDate')),
                    area_path=fields.get('System.AreaPath', ''),
                    iteration_path=fields.get('System.IterationPath', ''),
                    priority=fields.get('Microsoft.VSTS.Common.Priority', 0),
                    tags=fields.get('System.Tags', ''),
                    description=fields.get('System.Description', ''),
                    fields=fields
                )
                
                self.db.add(work_item)
                self.db.commit()
                self.db.refresh(work_item)

                # Extract comments
                await self._extract_work_item_comments(work_item, project.name)
                
                # Extract attachments
                await self._extract_work_item_attachments(work_item, project.name)
                
                # Extract revisions
                await self._extract_work_item_revisions(work_item, project.name)

                extracted_items.append({
                    'id': work_item.id,
                    'external_id': work_item.external_id,
                    'title': work_item.title,
                    'type': work_item.work_item_type
                })

                job.extracted_items = i + 1
                job.progress = int((i + 1) / job.total_items * 100)
                self.db.commit()

            except Exception as e:
                self._log_extraction(job.id, "WARNING", f"Failed to extract work item {wi_data.get('id', 'unknown')}: {str(e)}")

        return {
            "total": job.total_items,
            "extracted": job.extracted_items,
            "items": extracted_items
        }

    async def _extract_work_item_comments(self, work_item: WorkItem, project_name: str):
        """Extract comments for a work item"""
        comments_data = await self.ado_client.get_work_item_comments(project_name, work_item.external_id)
        
        for comment_data in comments_data:
            comment = WorkItemComment(
                work_item_id=work_item.id,
                text=comment_data.get('text', ''),
                created_by=comment_data.get('createdBy', {}).get('displayName', ''),
                created_date=self._parse_date(comment_data.get('createdDate'))
            )
            self.db.add(comment)
        
        self.db.commit()

    async def _extract_work_item_attachments(self, work_item: WorkItem, project_name: str):
        """Extract attachments for a work item"""
        attachments_data = await self.ado_client.get_work_item_attachments(project_name, work_item.external_id)
        
        for attachment_data in attachments_data:
            attachment = WorkItemAttachment(
                work_item_id=work_item.id,
                name=attachment_data.get('name', ''),
                url=attachment_data.get('url', ''),
                size=attachment_data.get('size', 0),
                created_by=attachment_data.get('createdBy', {}).get('displayName', ''),
                created_date=self._parse_date(attachment_data.get('createdDate'))
            )
            self.db.add(attachment)
        
        self.db.commit()

    async def _extract_work_item_revisions(self, work_item: WorkItem, project_name: str):
        """Extract revisions for a work item"""
        revisions_data = await self.ado_client.get_work_item_revisions(project_name, work_item.external_id)
        
        for revision_data in revisions_data:
            revision = WorkItemRevision(
                work_item_id=work_item.id,
                revision_number=revision_data.get('rev', 0),
                changed_by=revision_data.get('fields', {}).get('System.ChangedBy', {}).get('displayName', ''),
                changed_date=self._parse_date(revision_data.get('fields', {}).get('System.ChangedDate')),
                fields=revision_data.get('fields', {})
            )
            self.db.add(revision)
        
        self.db.commit()

    async def _extract_repositories(self, project: Project, job: ExtractionJob) -> Dict[str, Any]:
        """Extract repositories with commits and pull requests"""
        repos_data = await self.ado_client.get_repositories(project.name)
        
        job.total_items = len(repos_data)
        self.db.commit()

        extracted_repos = []
        for i, repo_data in enumerate(repos_data):
            try:
                # Check if repository already exists
                existing_repo = self.db.query(Repository).filter(
                    and_(Repository.external_id == repo_data['id'], Repository.project_id == project.id)
                ).first()
                
                if existing_repo:
                    continue

                repository = Repository(
                    external_id=repo_data['id'],
                    project_id=project.id,
                    name=repo_data['name'],
                    url=repo_data['webUrl'],
                    default_branch=repo_data.get('defaultBranch', ''),
                    size=repo_data.get('size', 0)
                )
                
                self.db.add(repository)
                self.db.commit()
                self.db.refresh(repository)

                # Extract commits
                await self._extract_commits(repository, project.name)
                
                # Extract pull requests
                await self._extract_pull_requests(repository, project.name)

                extracted_repos.append({
                    'id': repository.id,
                    'name': repository.name,
                    'url': repository.url
                })

                job.extracted_items = i + 1
                job.progress = int((i + 1) / job.total_items * 100)
                self.db.commit()

            except Exception as e:
                self._log_extraction(job.id, "WARNING", f"Failed to extract repository {repo_data.get('name', 'unknown')}: {str(e)}")

        return {
            "total": job.total_items,
            "extracted": job.extracted_items,
            "repositories": extracted_repos
        }

    async def _extract_commits(self, repository: Repository, project_name: str):
        """Extract commits for a repository"""
        commits_data = await self.ado_client.get_commits(project_name, repository.external_id)
        
        for commit_data in commits_data:
            commit = Commit(
                repository_id=repository.id,
                commit_id=commit_data['commitId'],
                author=commit_data.get('author', {}).get('name', ''),
                committer=commit_data.get('committer', {}).get('name', ''),
                comment=commit_data.get('comment', ''),
                commit_date=self._parse_date(commit_data.get('author', {}).get('date'))
            )
            self.db.add(commit)
        
        self.db.commit()

    async def _extract_pull_requests(self, repository: Repository, project_name: str):
        """Extract pull requests for a repository"""
        prs_data = await self.ado_client.get_pull_requests(project_name, repository.external_id)
        
        for pr_data in prs_data:
            pull_request = PullRequest(
                repository_id=repository.id,
                external_id=pr_data['pullRequestId'],
                title=pr_data.get('title', ''),
                description=pr_data.get('description', ''),
                created_by=pr_data.get('createdBy', {}).get('displayName', ''),
                created_date=self._parse_date(pr_data.get('creationDate')),
                status=pr_data.get('status', ''),
                source_branch=pr_data.get('sourceRefName', ''),
                target_branch=pr_data.get('targetRefName', '')
            )
            self.db.add(pull_request)
        
        self.db.commit()

    async def _extract_pipelines(self, project: Project, job: ExtractionJob) -> Dict[str, Any]:
        """Extract pipelines and builds"""
        pipelines_data = await self.ado_client.get_pipelines(project.name)
        builds_data = await self.ado_client.get_builds(project.name)
        
        all_pipelines = pipelines_data + builds_data
        job.total_items = len(all_pipelines)
        self.db.commit()

        extracted_pipelines = []
        for i, pipeline_data in enumerate(all_pipelines):
            try:
                pipeline = Pipeline(
                    external_id=pipeline_data.get('id'),
                    project_id=project.id,
                    name=pipeline_data['name'],
                    folder=pipeline_data.get('folder', {}).get('path', '') if pipeline_data.get('folder') else '',
                    configuration_type=pipeline_data.get('type', 'yaml'),
                    yaml_path=pipeline_data.get('configuration', {}).get('path', '') if pipeline_data.get('configuration') else ''
                )
                
                self.db.add(pipeline)
                self.db.commit()
                self.db.refresh(pipeline)

                # Extract pipeline runs if available
                if pipeline_data.get('id'):
                    await self._extract_pipeline_runs(pipeline, project.name)

                extracted_pipelines.append({
                    'id': pipeline.id,
                    'name': pipeline.name,
                    'type': pipeline.configuration_type
                })

                job.extracted_items = i + 1
                job.progress = int((i + 1) / job.total_items * 100)
                self.db.commit()

            except Exception as e:
                self._log_extraction(job.id, "WARNING", f"Failed to extract pipeline {pipeline_data.get('name', 'unknown')}: {str(e)}")

        return {
            "total": job.total_items,
            "extracted": job.extracted_items,
            "pipelines": extracted_pipelines
        }

    async def _extract_pipeline_runs(self, pipeline: Pipeline, project_name: str):
        """Extract runs for a pipeline"""
        try:
            runs_data = await self.ado_client.get_pipeline_runs(project_name, pipeline.external_id)
            
            for run_data in runs_data:
                pipeline_run = PipelineRun(
                    pipeline_id=pipeline.id,
                    external_id=run_data['id'],
                    name=run_data.get('name', ''),
                    status=run_data.get('state', ''),
                    result=run_data.get('result', ''),
                    created_date=self._parse_date(run_data.get('createdDate')),
                    finished_date=self._parse_date(run_data.get('finishedDate'))
                )
                self.db.add(pipeline_run)
            
            self.db.commit()
        except Exception as e:
            logger.warning(f"Failed to extract runs for pipeline {pipeline.name}: {e}")

    async def _extract_test_plans(self, project: Project, job: ExtractionJob) -> Dict[str, Any]:
        """Extract test plans, suites, and cases"""
        test_plans_data = await self.ado_client.get_test_plans(project.name)
        
        job.total_items = len(test_plans_data)
        self.db.commit()

        extracted_plans = []
        for i, plan_data in enumerate(test_plans_data):
            try:
                test_plan = TestPlan(
                    external_id=plan_data['id'],
                    project_id=project.id,
                    name=plan_data['name'],
                    description=plan_data.get('description', ''),
                    area_path=plan_data.get('areaPath', ''),
                    iteration=plan_data.get('iteration', ''),
                    state=plan_data.get('state', '')
                )
                
                self.db.add(test_plan)
                self.db.commit()
                self.db.refresh(test_plan)

                # Extract test suites
                await self._extract_test_suites(test_plan, project.name)

                extracted_plans.append({
                    'id': test_plan.id,
                    'name': test_plan.name,
                    'state': test_plan.state
                })

                job.extracted_items = i + 1
                job.progress = int((i + 1) / job.total_items * 100)
                self.db.commit()

            except Exception as e:
                self._log_extraction(job.id, "WARNING", f"Failed to extract test plan {plan_data.get('name', 'unknown')}: {str(e)}")

        return {
            "total": job.total_items,
            "extracted": job.extracted_items,
            "test_plans": extracted_plans
        }

    async def _extract_test_suites(self, test_plan: TestPlan, project_name: str):
        """Extract test suites for a test plan"""
        suites_data = await self.ado_client.get_test_suites(project_name, test_plan.external_id)
        
        for suite_data in suites_data:
            test_suite = TestSuite(
                external_id=suite_data['id'],
                test_plan_id=test_plan.id,
                name=suite_data['name'],
                suite_type=suite_data.get('suiteType', '')
            )
            self.db.add(test_suite)
        
        self.db.commit()

    async def _extract_boards(self, project: Project, job: ExtractionJob) -> Dict[str, Any]:
        """Extract boards and columns"""
        boards_data = await self.ado_client.get_boards(project.name)
        
        job.total_items = len(boards_data)
        self.db.commit()

        extracted_boards = []
        for i, board_data in enumerate(boards_data):
            try:
                board = Board(
                    external_id=board_data['id'],
                    project_id=project.id,
                    name=board_data['name']
                )
                
                self.db.add(board)
                self.db.commit()
                self.db.refresh(board)

                # Extract board columns if team info is available
                if 'team' in board_data:
                    await self._extract_board_columns(board, project.name, board_data.get('team', ''))

                extracted_boards.append({
                    'id': board.id,
                    'name': board.name
                })

                job.extracted_items = i + 1
                job.progress = int((i + 1) / job.total_items * 100)
                self.db.commit()

            except Exception as e:
                self._log_extraction(job.id, "WARNING", f"Failed to extract board {board_data.get('name', 'unknown')}: {str(e)}")

        return {
            "total": job.total_items,
            "extracted": job.extracted_items,
            "boards": extracted_boards
        }

    async def _extract_board_columns(self, board: Board, project_name: str, team_name: str):
        """Extract columns for a board"""
        try:
            columns_data = await self.ado_client.get_board_columns(project_name, team_name, board.external_id)
            
            for column_data in columns_data:
                board_column = BoardColumn(
                    board_id=board.id,
                    name=column_data['name'],
                    column_type=column_data.get('columnType', ''),
                    item_limit=column_data.get('itemLimit', 0)
                )
                self.db.add(board_column)
            
            self.db.commit()
        except Exception as e:
            logger.warning(f"Failed to extract columns for board {board.name}: {e}")

    async def _extract_queries(self, project: Project, job: ExtractionJob) -> Dict[str, Any]:
        """Extract queries"""
        queries_data = await self.ado_client.get_queries(project.name)
        
        job.total_items = len(queries_data)
        self.db.commit()

        extracted_queries = []
        for i, query_data in enumerate(queries_data):
            try:
                query = Query(
                    external_id=query_data['id'],
                    project_id=project.id,
                    name=query_data['name'],
                    path=query_data.get('path', ''),
                    query_type=query_data.get('queryType', ''),
                    wiql=query_data.get('wiql', '')
                )
                
                self.db.add(query)
                self.db.commit()

                extracted_queries.append({
                    'id': query.id,
                    'name': query.name,
                    'path': query.path
                })

                job.extracted_items = i + 1
                job.progress = int((i + 1) / job.total_items * 100)
                self.db.commit()

            except Exception as e:
                self._log_extraction(job.id, "WARNING", f"Failed to extract query {query_data.get('name', 'unknown')}: {str(e)}")

        return {
            "total": job.total_items,
            "extracted": job.extracted_items,
            "queries": extracted_queries
        }

    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """Parse ISO date string to datetime"""
        if not date_str:
            return None
        try:
            # Handle various date formats from Azure DevOps
            if 'T' in date_str:
                if date_str.endswith('Z'):
                    return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                else:
                    return datetime.fromisoformat(date_str)
            return datetime.fromisoformat(date_str)
        except ValueError:
            logger.warning(f"Failed to parse date: {date_str}")
            return None