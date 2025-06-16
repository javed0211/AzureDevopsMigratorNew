import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  VerticalTabs, VerticalTabsContent, VerticalTabsList, VerticalTabsTrigger
} from "@/components/ui/tabs";
import { 
  RefreshCw, 
  LayoutDashboard, 
  Database, 
  FileText, 
  GitBranch, 
  TestTube, 
  GitPullRequest 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { 
  Project, 
  ExtractionJob,
  OverviewTab,
  MetadataTab,
  WorkItemsTab,
  RepositoriesTab,
  TestManagementTab,
  PipelinesTab
} from "@/components/extraction";

export default function ExtractionOverview() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAllJobs, setShowAllJobs] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [expandedMetadataProjects, setExpandedMetadataProjects] = useState<Record<string, boolean>>({});

  // Fetch extraction jobs with conditional auto-refresh
  const { data: jobs = [], isLoading: jobsLoading, isFetching: jobsFetching } = useQuery({
    queryKey: ['/api/extraction/jobs'],
    select: (data) => Array.isArray(data) ? data : [],
    refetchInterval: (data) => {
      // Only poll if there are active jobs
      const hasActiveJobs = Array.isArray(data) && data.some(job => job.status === 'in_progress');
      return hasActiveJobs ? 2000 : 10000; // Poll every 2 seconds if active jobs, otherwise every 10 seconds
    },
    refetchOnWindowFocus: true,
    staleTime: 2000, // Consider data stale after 2 seconds
  });

  // Fetch selected projects
  const { data: selectedProjects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['/api/projects/selected'],
    select: (data) => Array.isArray(data) ? data : [],
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // State for enhanced projects with metadata
  const [enhancedProjects, setEnhancedProjects] = useState<Project[]>([]);

  // Fetch and enhance projects with area paths and iteration paths
  useEffect(() => {
    if (!selectedProjects.length) return;
    
    const enhanceProjects = async () => {
      const enhanced = await Promise.all(
        selectedProjects.map(async (project: any) => {
          try {
            // Get area paths
            const areaPathsResponse = await api.projects.getAreaPaths(project.id);
            // Get iteration paths
            const iterationPathsResponse = await api.projects.getIterationPaths(project.id);
            
            // Enhance project with area paths and iteration paths
            return {
              ...project,
              areaPaths: {
                extracted: areaPathsResponse.areaPathCount > 0,
                count: areaPathsResponse.areaPathCount,
                items: areaPathsResponse.areaPaths || []
              },
              iterationPaths: {
                extracted: iterationPathsResponse.iterationPathCount > 0,
                count: iterationPathsResponse.iterationPathCount,
                items: iterationPathsResponse.iterationPaths || []
              }
            };
          } catch (error) {
            console.error(`Error enhancing project ${project.id}:`, error);
            return project;
          }
        })
      );
      
      // Further enhance with work item types, custom fields, board columns, and wiki pages
      const fullyEnhanced = await Promise.all(
        enhanced.map(async (project: any) => {
          try {
            // Get work item types
            const workItemTypesResponse = await api.projects.getWorkItemTypes(project.id);
            // Get custom fields
            const customFieldsResponse = await api.projects.getCustomFields(project.id);
            // Get board columns
            const boardColumnsResponse = await api.projects.getBoardColumns(project.id);
            // Get wiki pages
            const wikiPagesResponse = await api.projects.getWikiPages(project.id);
            // Get work items
            const workItemsResponse = await api.projects.getWorkItems(project.id);
            // Get extraction history
            const extractionHistoryResponse = await api.projects.getExtractionHistory(project.id);
            
            return {
              ...project,
              workItemTypes: {
                extracted: workItemTypesResponse.workItemTypeCount > 0,
                count: workItemTypesResponse.workItemTypeCount,
                items: workItemTypesResponse.workItemTypes || []
              },
              workItems: {
                extracted: workItemsResponse.workItemCount > 0,
                count: workItemsResponse.workItemCount,
                items: workItemsResponse.workItemsByType || [],
                workItemsByType: workItemsResponse.workItemsByType || []
              },
              customFields: {
                extracted: customFieldsResponse.customFieldCount > 0,
                count: customFieldsResponse.customFieldCount,
                items: customFieldsResponse.customFields || []
              },
              boardColumns: {
                extracted: boardColumnsResponse.boardColumnCount > 0,
                count: boardColumnsResponse.boardColumnCount,
                items: boardColumnsResponse.boardColumns || []
              },
              wikiPages: {
                extracted: wikiPagesResponse.wikiPageCount > 0,
                count: wikiPagesResponse.wikiPageCount,
                items: wikiPagesResponse.wikiPages || []
              },
              extractionHistory: extractionHistoryResponse.history || []
            };
          } catch (error) {
            console.error(`Error fully enhancing project ${project.id}:`, error);
            return project;
          }
        })
      );
      
      setEnhancedProjects(fullyEnhanced);
    };
    
    enhanceProjects();
  }, [selectedProjects]);
  
  // Toggle project expansion
  const toggleProjectExpansion = (projectId: number) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
  };
  
  // Toggle metadata project expansion
  const toggleMetadataProjectExpansion = (projectId: number) => {
    setExpandedMetadataProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-300">
        <div className="flex items-center">
          <div className="bg-gray-200 p-2 rounded-full mr-3 border border-gray-300">
            <Database className="h-5 w-5 text-gray-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Extraction Overview</h1>
            <p className="text-sm text-gray-600 mt-1">
              Extract and manage your Azure DevOps project data
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {jobsFetching && (
            <div className="flex items-center text-sm text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              <RefreshCw className="h-4 w-4 mr-2 animate-spin text-blue-600" />
              Refreshing data...
            </div>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            className="bg-white border-blue-300 hover:bg-blue-50 hover:border-blue-400 text-blue-700"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['/api/extraction/jobs'] });
              queryClient.invalidateQueries({ queryKey: ['/api/projects/selected'] });
              toast({
                title: "Data refreshed",
                description: "The extraction data has been refreshed.",
              });
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2 text-blue-600" />
            Refresh Data
          </Button>
        </div>
      </div>
      
      <VerticalTabs defaultValue="overview" className="flex">
        <div className="flex w-full max-w-[1440px] mx-auto">
          <VerticalTabsList className="bg-gray-100 border-r border-gray-300">
            <VerticalTabsTrigger value="overview" className="group">
              <LayoutDashboard className="h-5 w-5 mr-3 text-gray-700 group-data-[state=active]:text-blue-600" />
              Overview
            </VerticalTabsTrigger>
            <VerticalTabsTrigger value="metadata" className="group">
              <Database className="h-5 w-5 mr-3 text-gray-700 group-data-[state=active]:text-blue-600" />
              Project Metadata
            </VerticalTabsTrigger>
            <VerticalTabsTrigger value="work-items" className="group">
              <FileText className="h-5 w-5 mr-3 text-gray-700 group-data-[state=active]:text-blue-600" />
              Work Items
            </VerticalTabsTrigger>
            <VerticalTabsTrigger value="repositories" className="group">
              <GitBranch className="h-5 w-5 mr-3 text-gray-700 group-data-[state=active]:text-blue-600" />
              Repositories
            </VerticalTabsTrigger>
            <VerticalTabsTrigger value="test-cases" className="group">
              <TestTube className="h-5 w-5 mr-3 text-gray-700 group-data-[state=active]:text-blue-600" />
              Test Management
            </VerticalTabsTrigger>
            <VerticalTabsTrigger value="pipelines" className="group">
              <GitPullRequest className="h-5 w-5 mr-3 text-gray-700 group-data-[state=active]:text-blue-600" />
              Pipelines
            </VerticalTabsTrigger>
          </VerticalTabsList>
          <div className="flex-1 overflow-auto max-h-[calc(100vh-200px)] w-full">
        
            <VerticalTabsContent value="overview" className="space-y-6 p-4">
              <OverviewTab 
                projects={enhancedProjects}
                jobs={jobs}
                isLoading={projectsLoading || (selectedProjects.length > 0 && enhancedProjects.length === 0)}
                showAllJobs={showAllJobs}
                setShowAllJobs={setShowAllJobs}
                expandedProjects={expandedProjects}
                toggleProjectExpansion={toggleProjectExpansion}
              />
            </VerticalTabsContent>

            <VerticalTabsContent value="metadata" className="space-y-6 p-4">
              <MetadataTab 
                projects={enhancedProjects}
                isLoading={projectsLoading || (selectedProjects.length > 0 && enhancedProjects.length === 0)}
                expandedProjects={expandedMetadataProjects}
                toggleProjectExpansion={toggleMetadataProjectExpansion}
              />
            </VerticalTabsContent>

            <VerticalTabsContent value="work-items" className="space-y-6 p-4">
              <WorkItemsTab 
                projects={enhancedProjects}
                isLoading={projectsLoading || (selectedProjects.length > 0 && enhancedProjects.length === 0)}
              />
            </VerticalTabsContent>

            <VerticalTabsContent value="repositories" className="space-y-6 p-4">
              <RepositoriesTab 
                projects={enhancedProjects}
                isLoading={projectsLoading || (selectedProjects.length > 0 && enhancedProjects.length === 0)}
              />
            </VerticalTabsContent>

            <VerticalTabsContent value="test-cases" className="space-y-6 p-4">
              <TestManagementTab 
                projects={enhancedProjects}
                isLoading={projectsLoading || (selectedProjects.length > 0 && enhancedProjects.length === 0)}
              />
            </VerticalTabsContent>

            <VerticalTabsContent value="pipelines" className="space-y-6 p-4">
              <PipelinesTab 
                projects={enhancedProjects}
                isLoading={projectsLoading || (selectedProjects.length > 0 && enhancedProjects.length === 0)}
              />
            </VerticalTabsContent>
          </div>
        </div>
      </VerticalTabs>
    </div>
  );
}