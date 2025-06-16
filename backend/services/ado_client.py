import requests
import base64
import asyncio
import aiohttp
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

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
        self.session = None

    async def _make_request(self, endpoint: str, method: str = "GET", data: dict = None) -> dict:
        """Make async HTTP request to Azure DevOps API"""
        url = f"{self.base_url}/{endpoint}"
        
        # Create a session if one doesn't exist
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession()
        
        try:
            if method == "GET":
                async with self.session.get(url, headers=self.headers) as response:
                    response.raise_for_status()
                    return await response.json()
            elif method == "POST":
                async with self.session.post(url, headers=self.headers, json=data) as response:
                    response.raise_for_status()
                    return await response.json()
        except aiohttp.ClientError as e:
            logger.error(f"Request failed for {url}: {e}")
            raise

    def _make_sync_request(self, endpoint: str, method: str = "GET", data: dict = None) -> dict:
        """Make synchronous HTTP request to Azure DevOps API"""
        url = f"{self.base_url}/{endpoint}"
        
        try:
            if method == "GET":
                response = requests.get(url, headers=self.headers)
            elif method == "POST":
                response = requests.post(url, headers=self.headers, json=data)
            
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logger.error(f"Request failed for {url}: {e}")
            raise

    async def test_connection(self) -> bool:
        """Test connection to Azure DevOps"""
        try:
            await self._make_request("_apis/projects?api-version=7.0")
            return True
        except Exception as e:
            logger.error(f"Connection test failed: {e}")
            return False

    async def get_projects(self) -> List[Dict[str, Any]]:
        """Get all projects from organization"""
        try:
            response = await self._make_request("_apis/projects?api-version=7.0")
            projects = response.get('value', [])
            
            # Get detailed information for each project
            detailed_projects = []
            for project in projects:
                try:
                    details = await self.get_project_details(project['id'])
                    project_data = {
                        'id': project['id'],
                        'name': project['name'],
                        'description': project.get('description', ''),
                        'visibility': project.get('visibility', 'Private'),
                        'state': project.get('state', 'wellFormed'),
                        'revision': project.get('revision', 0),
                        'url': project.get('url', ''),
                        'lastUpdateTime': project.get('lastUpdateTime'),
                        'capabilities': details.get('capabilities', {}),
                        'processTemplate': details.get('capabilities', {}).get('processTemplate', {}).get('templateName', 'Unknown'),
                        'sourceControl': details.get('capabilities', {}).get('versioncontrol', {}).get('sourceControlType', 'Git')
                    }
                    detailed_projects.append(project_data)
                except Exception as e:
                    logger.warning(f"Failed to get details for project {project['name']}: {e}")
                    detailed_projects.append(project)
            
            return detailed_projects
        except Exception as e:
            logger.error(f"Failed to get projects: {e}")
            return []

    async def get_project_details(self, project_id: str) -> Dict[str, Any]:
        """Get detailed project information"""
        return await self._make_request(f"_apis/projects/{project_id}?includeCapabilities=true&includeHistory=true&api-version=7.0")

    async def get_work_items(self, project_name: str, top: int = 200) -> List[Dict[str, Any]]:
        """Get work items for a project using WIQL"""
        try:
            # First, get work item IDs using WIQL
            wiql_query = {
                "query": f"""
                SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType], 
                       [System.AssignedTo], [System.CreatedDate], [System.ChangedDate],
                       [System.AreaPath], [System.IterationPath], [Microsoft.VSTS.Common.Priority],
                       [System.Tags], [System.Description]
                FROM WorkItems 
                WHERE [System.TeamProject] = '{project_name}' 
                ORDER BY [System.Id] DESC
                """
            }
            
            wiql_response = await self._make_request(
                f"{project_name}/_apis/wit/wiql?api-version=7.0",
                method="POST",
                data=wiql_query
            )
            
            work_item_ids = [wi['id'] for wi in wiql_response.get('workItems', [])]
            
            if not work_item_ids:
                return []
            
            # Get detailed work item data in batches
            batch_size = 200
            all_work_items = []
            
            for i in range(0, len(work_item_ids), batch_size):
                batch_ids = work_item_ids[i:i + batch_size]
                ids_param = ','.join(map(str, batch_ids))
                
                work_items_response = await self._make_request(
                    f"{project_name}/_apis/wit/workitems?ids={ids_param}&$expand=all&api-version=7.0"
                )
                
                all_work_items.extend(work_items_response.get('value', []))
            
            return all_work_items
            
        except Exception as e:
            logger.error(f"Failed to get work items for {project_name}: {e}")
            return []

    async def get_work_item_comments(self, project_name: str, work_item_id: int) -> List[Dict[str, Any]]:
        """Get comments for a work item"""
        try:
            response = await self._make_request(
                f"{project_name}/_apis/wit/workitems/{work_item_id}/comments?api-version=7.0"
            )
            return response.get('comments', [])
        except Exception as e:
            logger.error(f"Failed to get comments for work item {work_item_id}: {e}")
            return []

    async def get_work_item_attachments(self, project_name: str, work_item_id: int) -> List[Dict[str, Any]]:
        """Get attachments for a work item"""
        try:
            response = await self._make_request(
                f"{project_name}/_apis/wit/workitems/{work_item_id}/attachments?api-version=7.0"
            )
            return response.get('value', [])
        except Exception as e:
            logger.error(f"Failed to get attachments for work item {work_item_id}: {e}")
            return []

    async def get_work_item_revisions(self, project_name: str, work_item_id: int) -> List[Dict[str, Any]]:
        """Get revisions for a work item"""
        try:
            response = await self._make_request(
                f"{project_name}/_apis/wit/workitems/{work_item_id}/revisions?api-version=7.0"
            )
            return response.get('value', [])
        except Exception as e:
            logger.error(f"Failed to get revisions for work item {work_item_id}: {e}")
            return []

    async def get_repositories(self, project_name: str) -> List[Dict[str, Any]]:
        """Get repositories for a project"""
        try:
            response = await self._make_request(f"{project_name}/_apis/git/repositories?api-version=7.0")
            return response.get('value', [])
        except Exception as e:
            logger.error(f"Failed to get repositories for {project_name}: {e}")
            return []

    async def get_commits(self, project_name: str, repository_id: str, top: int = 100) -> List[Dict[str, Any]]:
        """Get commits for a repository"""
        try:
            response = await self._make_request(
                f"{project_name}/_apis/git/repositories/{repository_id}/commits?$top={top}&api-version=7.0"
            )
            return response.get('value', [])
        except Exception as e:
            logger.error(f"Failed to get commits for repository {repository_id}: {e}")
            return []

    async def get_pull_requests(self, project_name: str, repository_id: str) -> List[Dict[str, Any]]:
        """Get pull requests for a repository"""
        try:
            response = await self._make_request(
                f"{project_name}/_apis/git/repositories/{repository_id}/pullrequests?api-version=7.0"
            )
            return response.get('value', [])
        except Exception as e:
            logger.error(f"Failed to get pull requests for repository {repository_id}: {e}")
            return []

    async def get_pipelines(self, project_name: str) -> List[Dict[str, Any]]:
        """Get pipelines for a project"""
        try:
            response = await self._make_request(f"{project_name}/_apis/pipelines?api-version=7.0")
            return response.get('value', [])
        except Exception as e:
            logger.error(f"Failed to get pipelines for {project_name}: {e}")
            return []

    async def get_pipeline_runs(self, project_name: str, pipeline_id: int) -> List[Dict[str, Any]]:
        """Get runs for a pipeline"""
        try:
            response = await self._make_request(
                f"{project_name}/_apis/pipelines/{pipeline_id}/runs?api-version=7.0"
            )
            return response.get('value', [])
        except Exception as e:
            logger.error(f"Failed to get runs for pipeline {pipeline_id}: {e}")
            return []

    async def get_builds(self, project_name: str) -> List[Dict[str, Any]]:
        """Get build definitions for a project"""
        try:
            response = await self._make_request(f"{project_name}/_apis/build/definitions?api-version=7.0")
            return response.get('value', [])
        except Exception as e:
            logger.error(f"Failed to get builds for {project_name}: {e}")
            return []

    async def get_releases(self, project_name: str) -> List[Dict[str, Any]]:
        """Get release definitions for a project"""
        try:
            response = await self._make_request(f"{project_name}/_apis/release/definitions?api-version=7.0")
            return response.get('value', [])
        except Exception as e:
            logger.error(f"Failed to get releases for {project_name}: {e}")
            return []

    async def get_test_plans(self, project_name: str) -> List[Dict[str, Any]]:
        """Get test plans for a project"""
        try:
            response = await self._make_request(f"{project_name}/_apis/test/plans?api-version=7.0")
            return response.get('value', [])
        except Exception as e:
            logger.error(f"Failed to get test plans for {project_name}: {e}")
            return []

    async def get_test_suites(self, project_name: str, plan_id: int) -> List[Dict[str, Any]]:
        """Get test suites for a test plan"""
        try:
            response = await self._make_request(
                f"{project_name}/_apis/test/plans/{plan_id}/suites?api-version=7.0"
            )
            return response.get('value', [])
        except Exception as e:
            logger.error(f"Failed to get test suites for plan {plan_id}: {e}")
            return []

    async def get_boards(self, project_name: str) -> List[Dict[str, Any]]:
        """Get boards for a project"""
        try:
            # Get teams first
            teams_response = await self._make_request(f"_apis/projects/{project_name}/teams?api-version=7.0")
            teams = teams_response.get('value', [])
            
            all_boards = []
            for team in teams:
                try:
                    boards_response = await self._make_request(
                        f"{project_name}/{team['id']}/_apis/work/boards?api-version=7.0"
                    )
                    boards = boards_response.get('value', [])
                    for board in boards:
                        board['team'] = team['name']
                    all_boards.extend(boards)
                except Exception as e:
                    logger.warning(f"Failed to get boards for team {team['name']}: {e}")
            
            return all_boards
        except Exception as e:
            logger.error(f"Failed to get boards for {project_name}: {e}")
            return []

    async def get_board_columns(self, project_name: str, team_id: str, board_id: str) -> List[Dict[str, Any]]:
        """Get columns for a board"""
        try:
            response = await self._make_request(
                f"{project_name}/{team_id}/_apis/work/boards/{board_id}/columns?api-version=7.0"
            )
            return response.get('value', [])
        except Exception as e:
            logger.error(f"Failed to get columns for board {board_id}: {e}")
            return []

    async def get_queries(self, project_name: str) -> List[Dict[str, Any]]:
        """Get queries for a project"""
        try:
            response = await self._make_request(f"{project_name}/_apis/wit/queries?$depth=2&api-version=7.0")
            return self._flatten_queries(response.get('value', []))
        except Exception as e:
            logger.error(f"Failed to get queries for {project_name}: {e}")
            return []

    def _flatten_queries(self, queries: List[Dict[str, Any]], path: str = "") -> List[Dict[str, Any]]:
        """Flatten nested query structure"""
        flattened = []
        for query in queries:
            if query.get('isFolder'):
                folder_path = f"{path}/{query['name']}" if path else query['name']
                if 'children' in query:
                    flattened.extend(self._flatten_queries(query['children'], folder_path))
            else:
                query['path'] = path
                flattened.append(query)
        return flattened
        
    async def get_area_paths(self, project_name: str) -> List[Dict[str, Any]]:
        """Get area paths for a project"""
        try:
            # For now, we'll simulate area paths
            # In a real implementation, you would call the Azure DevOps API
            area_paths = [
                {"id": "1", "name": "Migrated", "path": "\\Migrated", "hasChildren": False},
                {"id": "2", "name": "Team A", "path": "\\Migrated\\Team A", "hasChildren": True},
                {"id": "3", "name": "Team B", "path": "\\Migrated\\Team B", "hasChildren": False},
                {"id": "4", "name": "Feature 1", "path": "\\Migrated\\Team A\\Feature 1", "hasChildren": False},
                {"id": "5", "name": "Feature 2", "path": "\\Migrated\\Team A\\Feature 2", "hasChildren": False},
            ]
            return area_paths
        except Exception as e:
            logger.error(f"Failed to get area paths for {project_name}: {e}")
            return []
            
    async def get_iteration_paths(self, project_name: str) -> List[Dict[str, Any]]:
        """Get iteration paths for a project"""
        try:
            # For now, we'll simulate iteration paths
            # In a real implementation, you would call the Azure DevOps API
            iteration_paths = [
                {"id": "1", "name": "Sprint 1", "path": "\\Migrated\\Sprint 1", "startDate": "2023-01-01", "endDate": "2023-01-15"},
                {"id": "2", "name": "Sprint 2", "path": "\\Migrated\\Sprint 2", "startDate": "2023-01-16", "endDate": "2023-01-31"},
                {"id": "3", "name": "Sprint 3", "path": "\\Migrated\\Sprint 3", "startDate": "2023-02-01", "endDate": "2023-02-15"},
                {"id": "4", "name": "Sprint 4", "path": "\\Migrated\\Sprint 4", "startDate": "2023-02-16", "endDate": "2023-02-28"},
                {"id": "5", "name": "Sprint 5", "path": "\\Migrated\\Sprint 5", "startDate": "2023-03-01", "endDate": "2023-03-15"},
                {"id": "6", "name": "Sprint 6", "path": "\\Migrated\\Sprint 6", "startDate": "2023-03-16", "endDate": "2023-03-31"},
                {"id": "7", "name": "Backlog", "path": "\\Migrated\\Backlog", "startDate": null, "endDate": null},
            ]
            return iteration_paths
        except Exception as e:
            logger.error(f"Failed to get iteration paths for {project_name}: {e}")
            return []
            
    async def close(self):
        """Close the client session"""
        if self.session and not self.session.closed:
            try:
                await self.session.close()
                logger.info("Closed ADO client session")
            except Exception as e:
                logger.error(f"Error closing client session: {e}")
                
    async def __aenter__(self):
        """Async context manager entry"""
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.close()