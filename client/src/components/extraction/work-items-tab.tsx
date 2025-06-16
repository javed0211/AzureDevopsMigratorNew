import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Database, 
  FileText, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  HelpCircle,
  Bug, 
  CheckSquare, 
  BookOpen, 
  Lightbulb, 
  Zap, 
  Layers, 
  Briefcase, 
  AlertTriangle, 
  FileQuestion,
  Settings,
  Users,
  Star,
  PenTool,
  Trello,
  ExternalLink
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Project } from "./types";
import { useLocation } from "wouter";

interface WorkItemsTabProps {
  projects: Project[];
  isLoading: boolean;
}

// Function to get the appropriate icon for a work item type
const getWorkItemIcon = (type: string) => {
  const typeLower = type.toLowerCase();
  
  if (typeLower.includes('bug')) return Bug;
  if (typeLower.includes('task')) return CheckSquare;
  if (typeLower.includes('user story') || typeLower.includes('story')) return BookOpen;
  if (typeLower.includes('feature')) return Star;
  if (typeLower.includes('epic')) return Layers;
  if (typeLower.includes('issue')) return AlertTriangle;
  if (typeLower.includes('requirement')) return Lightbulb;
  if (typeLower.includes('test')) return FileQuestion;
  if (typeLower.includes('impediment')) return AlertCircle;
  if (typeLower.includes('risk')) return AlertTriangle;
  if (typeLower.includes('scenario')) return Briefcase;
  if (typeLower.includes('feedback')) return PenTool;
  if (typeLower.includes('board')) return Trello;
  if (typeLower.includes('team')) return Users;
  if (typeLower.includes('config')) return Settings;
  
  // Default icon for unknown types
  return FileText;
};

// Function to check if a project has an active work items extraction job
const hasActiveWorkItemsJob = (project: Project): boolean => {
  if (!project.extractionHistory || project.extractionHistory.length === 0) {
    return false;
  }
  
  return project.extractionHistory.some(
    job => job.artifactType === 'workitems' && 
           (job.status === 'in_progress' || job.status === 'queued')
  );
};

export const WorkItemsTab = ({ projects, isLoading }: WorkItemsTabProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [activePollingJobs, setActivePollingJobs] = useState<Record<string, NodeJS.Timeout>>({});

  // Effect to set up polling for any active jobs when component mounts
  useEffect(() => {
    // Check if there are any active jobs that need polling
    const activeJobs = projects.flatMap(project => 
      project.extractionHistory?.filter(job => 
        job.artifactType === 'workitems' && 
        (job.status === 'in_progress' || job.status === 'queued')
      ) || []
    );
    
    // Set up polling for each active job
    activeJobs.forEach(job => {
      if (!activePollingJobs[job.id]) {
        setupPollingForJob(job.id);
      }
    });
    
    // Cleanup polling intervals on unmount
    return () => {
      Object.values(activePollingJobs).forEach(interval => clearInterval(interval));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, activePollingJobs]);
  
  // Function to set up polling for a specific job
  const setupPollingForJob = (jobId: string) => {
    // Create a polling interval
    const pollingInterval = setInterval(() => {
      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/projects/selected'] });
      
      // Check if the job is completed
      const allProjects = queryClient.getQueryData<Project[]>(['/api/projects/selected']) || [];
      const jobCompleted = allProjects.some(project => 
        project.extractionHistory?.some(job => 
          job.id === jobId && 
          (job.status === 'completed' || job.status === 'failed')
        )
      );
      
      // If job is completed, stop polling and show a notification
      if (jobCompleted) {
        clearInterval(pollingInterval);
        setActivePollingJobs(prev => {
          const newState = {...prev};
          delete newState[jobId];
          return newState;
        });
        
        // Find the job details to show in the notification
        const completedJob = allProjects.flatMap(project => 
          project.extractionHistory?.filter(job => job.id === jobId) || []
        )[0];
        
        if (completedJob) {
          const projectWithJob = allProjects.find(p => 
            p.extractionHistory?.some(j => j.id === jobId)
          );
          const projectName = projectWithJob?.name || 'Unknown project';
          
          // If job completed successfully, update the project's workItems status
          if (completedJob.status === 'completed' && projectWithJob) {
            queryClient.setQueryData(['/api/projects/selected'], (oldData: any) => {
              if (!oldData) return oldData;
              
              return oldData.map((project: Project) => {
                if (project.id === projectWithJob.id) {
                  return {
                    ...project,
                    workItems: {
                      ...project.workItems,
                      extracted: true,
                      count: completedJob.extractedItems || project.workItems?.count || 0
                    }
                  };
                }
                return project;
              });
            });
            
            // Fetch the latest work items data
            if (projectWithJob.id) {
              api.projects.getWorkItems(projectWithJob.id)
                .then(data => {
                  queryClient.setQueryData(['/api/projects/selected'], (oldData: any) => {
                    if (!oldData) return oldData;
                    
                    return oldData.map((project: Project) => {
                      if (project.id === projectWithJob.id) {
                        return {
                          ...project,
                          workItems: {
                            extracted: true,
                            count: data.workItemCount,
                            items: data.workItems || [],
                            workItemsByType: data.workItemsByType || []
                          }
                        };
                      }
                      return project;
                    });
                  });
                })
                .catch(err => console.error("Failed to fetch updated work items:", err));
            }
          }
          
          toast({
            title: completedJob.status === 'completed' ? 
              "Extraction Completed" : "Extraction Failed",
            description: `Work items extraction for ${projectName} has ${
              completedJob.status === 'completed' ? 
              `completed successfully with ${completedJob.extractedItems} items extracted.` : 
              'failed. Please check the logs for details.'
            }`,
            variant: completedJob.status === 'completed' ? 'default' : 'destructive',
          });
        }
      }
    }, 3000); // Poll every 3 seconds
    
    // Store the interval ID
    setActivePollingJobs(prev => ({
      ...prev,
      [jobId]: pollingInterval
    }));
    
    // Set a timeout to stop polling after 10 minutes (safety measure)
    setTimeout(() => {
      clearInterval(pollingInterval);
      setActivePollingJobs(prev => {
        const newState = {...prev};
        delete newState[jobId];
        return newState;
      });
    }, 600000); // 10 minutes
  };

  // Start extraction mutation
  const startExtractionMutation = useMutation({
    mutationFn: (params: { projectId: number, artifactType: string }) => 
      api.extraction.startJob(params.projectId, params.artifactType),
    onSuccess: (data, variables) => {
      toast({
        title: "Extraction started",
        description: "The work items extraction process has been started successfully.",
      });
      
      // Immediately update the project with the new extraction job
      queryClient.setQueryData(['/api/projects/selected'], (oldData: any) => {
        if (!oldData) return oldData;
        
        return oldData.map((project: Project) => {
          if (project.id === variables.projectId) {
            // Create a new job entry
            const newJob = {
              id: data.id || Date.now().toString(),
              artifactType: variables.artifactType,
              status: "in_progress",
              progress: 0,
              extractedItems: 0,
              totalItems: project.workItems?.count || 0,
              startedAt: new Date().toISOString(),
              completedAt: null
            };
            
            // Add the new job to the extraction history
            return {
              ...project,
              extractionHistory: project.extractionHistory 
                ? [newJob, ...project.extractionHistory]
                : [newJob]
            };
          }
          return project;
        });
      });
      
      // Invalidate extraction jobs to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/extraction/jobs'] });
      
      // Set up polling for the new job
      setupPollingForJob(data.id);
    },
    onError: (error: any) => {
      toast({
        title: "Error starting extraction",
        description: error.message || "Failed to start work items extraction process.",
        variant: "destructive",
      });
    },
  });

  // Toggle project expansion
  const toggleProjectExpansion = (projectId: number) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Database className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading projects...</span>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-64">
          <FileText className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-xl font-medium mb-2">No Projects Selected</h3>
          <p className="text-gray-800 text-center max-w-md">
            You haven't selected any projects for extraction yet. Go to the Project Selection page to choose projects.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">
        <div className="flex items-center">
          <div className="bg-gray-100 p-2 rounded-full mr-3">
            <FileText className="h-5 w-5 text-gray-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Work Items Extraction</h2>
            {projects.length === 1 && (
              <div className="text-sm text-gray-500 mt-1">
                Working with project: <span className="font-medium text-gray-700">{projects[0].name}</span>
              </div>
            )}
            {projects.length > 1 && (
              <div className="text-sm text-gray-500 mt-1">
                Working with <span className="font-medium text-gray-700">{projects.length}</span> selected projects
              </div>
            )}
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          className="bg-white border-blue-300 hover:bg-blue-50 hover:border-blue-400 text-blue-700"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/projects/selected'] });
            toast({
              title: "Refreshing Data",
              description: "Fetching the latest work items data...",
            });
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2 text-blue-600" />
          Refresh Data
        </Button>
      </div>

      <div className="w-full max-w-[1440px] mx-auto">
        {projects.map((project) => (
          <Card 
            key={project.id} 
            className="w-full mb-6 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden"
          >
            <CardHeader 
              className="bg-gradient-to-r from-gray-100 to-gray-200 cursor-pointer hover:from-gray-200 hover:to-gray-300 transition-colors border-b border-gray-300"
              onClick={() => toggleProjectExpansion(project.id)}
            >
              <div className="flex flex-wrap md:flex-nowrap justify-between items-center">
                <CardTitle className="flex items-center text-lg font-semibold text-gray-800">
                  <div className="bg-white p-2 rounded-full mr-3 shadow-sm border border-gray-300">
                    <FileText className="h-5 w-5 text-gray-700" />
                  </div>
                  <span className="text-gray-800">{project.name}</span>
                  <div className="ml-3 bg-white rounded-full p-1 border border-gray-300">
                    {expandedProjects[project.id] ? (
                      <svg className="h-4 w-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2 mt-2 md:mt-0">
                  <Badge variant="outline" className="bg-white border-gray-300 text-gray-700 font-medium">
                    ID: {project.id}
                  </Badge>
                  {project.workItems?.extracted && (
                    <Badge className="bg-green-700 text-white border border-green-800 font-medium px-3 py-1">
                      <CheckCircle className="h-3.5 w-3.5 mr-1 text-white" />
                      {project.workItems.count} work items extracted
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            
            {expandedProjects[project.id] && (
              <CardContent className="pt-6 px-6">
                <div className="space-y-6">
                  {/* Work Items Extraction */}
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-gray-100 to-gray-200 px-5 py-4 border-b border-gray-300">
                      <div className="flex flex-wrap md:flex-nowrap justify-between items-center">
                        <h3 className="text-md font-semibold text-gray-800 flex items-center">
                          <div className="bg-white p-1.5 rounded-md mr-2 shadow-sm border border-gray-300">
                            <Database className="h-4 w-4 text-gray-700" />
                          </div>
                          Work Items Extraction
                        </h3>
                        <div className="flex gap-2 mt-2 md:mt-0">
                          <Button 
                            size="sm" 
                            className={`${(startExtractionMutation.isPending || hasActiveWorkItemsJob(project)) ? 
                              'bg-blue-100 text-blue-800 border-blue-300 cursor-not-allowed' : 
                              'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'}`}
                            onClick={() => startExtractionMutation.mutate({ projectId: project.id, artifactType: "workitems" })}
                            disabled={startExtractionMutation.isPending || hasActiveWorkItemsJob(project)}
                          >
                            {startExtractionMutation.isPending && startExtractionMutation.variables?.projectId === project.id ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin text-blue-100" />
                                <span className="font-medium">Extracting...</span>
                              </>
                            ) : hasActiveWorkItemsJob(project) ? (
                              <>
                                <Clock className="h-4 w-4 mr-2 text-blue-600" />
                                <span className="font-medium">Extraction in Progress</span>
                              </>
                            ) : (
                              <>
                                <Database className="h-4 w-4 mr-2 text-white" />
                                <span className="font-medium">Extract Work Items</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-5">
                      {/* Progress Bar - Only show when extraction is in progress */}
                      {startExtractionMutation.isPending && startExtractionMutation.variables?.projectId === project.id && (
                        <div className="mb-5 bg-gradient-to-r from-blue-50 to-white p-4 rounded-lg border border-blue-200 shadow-inner">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-blue-800 flex items-center">
                              <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin text-blue-600" />
                              Extraction in Progress
                            </span>
                            <span className="text-xs bg-white text-blue-700 px-2.5 py-1 rounded-full border border-blue-200 shadow-sm font-medium">
                              Running
                            </span>
                          </div>
                          <Progress value={30} className="h-2.5 bg-blue-100" indicatorClassName="bg-blue-600" />
                          <p className="text-xs text-blue-700 mt-2 flex items-center">
                            <Clock className="h-3 w-3 mr-1 text-blue-500" />
                            This may take some time depending on the number of work items.
                          </p>
                        </div>
                      )}
                    
                      {/* Work Items Summary */}
                      {project.workItems?.extracted && (
                        <div>
                          {/* Work Items by Type */}
                          {project.workItems.items && project.workItems.items.length > 0 && (
                            <div>
                              <div className="flex items-center mb-4 pb-2 border-b border-gray-300">
                                <h4 className="text-base font-medium text-gray-800">Work Items by Type</h4>
                                <div className="ml-2 px-2.5 py-0.5 bg-gray-200 text-gray-800 text-xs rounded-full font-medium">
                                  {project.workItems.items.length} types
                                </div>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-1">
                                        <HelpCircle className="h-4 w-4 text-gray-400" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs p-3 bg-white border border-gray-200 shadow-md">
                                      <p className="text-sm text-gray-700">
                                        Work items are categorized by their type (e.g., Bug, Task, User Story). 
                                        Each card shows the type name, an icon representing the type, and the count of items.
                                        <br /><br />
                                        <span className="font-medium">Click on a card</span> to see more details about that work item type.
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                {project.workItems.items.map((item: any, index: number) => {
                                  const itemName = item.name || item.type;
                                  const IconComponent = getWorkItemIcon(itemName);
                                  
                                  return (
                                    <div 
                                      key={index} 
                                      className="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-300 hover:border-gray-400 hover:bg-gray-100 hover:shadow-sm transition-all cursor-pointer"
                                      onClick={() => {
                                        toast({
                                          title: `${itemName} Details`,
                                          description: `${item.count} work items of type "${itemName}" found in this project.`,
                                        });
                                      }}
                                    >
                                      <div className="flex items-center">
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <div className="w-6 h-6 rounded-md bg-gray-200 flex items-center justify-center mr-2 border border-gray-300">
                                                <IconComponent className="h-4 w-4 text-gray-700" />
                                              </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">
                                              <p>Work Item Type: {itemName}</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                        <span className="text-sm font-medium text-gray-700">{itemName}</span>
                                      </div>
                                      <Badge className="bg-white text-gray-700 border border-gray-300 ml-2 whitespace-nowrap shadow-sm">{item.count}</Badge>
                                    </div>
                                  );
                                })}
                              </div>
                              
                              {/* Total count summary */}
                              <div className="mt-4 p-4 bg-gradient-to-r from-gray-100 to-white rounded-lg border border-gray-300 shadow-sm flex justify-between items-center">
                                <div className="flex items-center">
                                  <div className="bg-white p-1.5 rounded-full mr-3 shadow-sm border border-gray-300">
                                    <CheckCircle className="h-5 w-5 text-gray-700" />
                                  </div>
                                  <div>
                                    <span className="text-md font-semibold text-gray-800">Total Work Items</span>
                                    <div className="text-xs text-gray-700 mt-0.5">Successfully extracted from Azure DevOps</div>
                                  </div>
                                </div>
                                <Badge className="bg-white border-gray-400 text-gray-700 text-sm px-4 py-1.5 shadow-sm font-bold">
                                  {project.workItems.count}
                                </Badge>
                              </div>
                            </div>
                          )}
                          
                          {/* If no items are grouped by type but we have a count */}
                          {(!project.workItems.items || project.workItems.items.length === 0) && project.workItems.count > 0 && (
                            <div>
                              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 mb-4 flex items-start">
                                <AlertCircle className="h-5 w-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
                                <div>
                                  <h4 className="text-sm font-medium text-yellow-800 mb-1">Type Information Not Available</h4>
                                  <p className="text-xs text-yellow-700">
                                    Work items have been extracted but they are not grouped by type. 
                                    This might be due to missing metadata or an incomplete extraction.
                                  </p>
                                </div>
                              </div>
                              
                              <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200 flex justify-between items-center">
                                <div className="flex items-center">
                                  <CheckCircle className="h-5 w-5 text-blue-600 mr-2" />
                                  <span className="text-md font-semibold text-blue-800">Total Work Items</span>
                                </div>
                                <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1">
                                  {project.workItems.count}
                                </Badge>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {!project.workItems?.extracted && !startExtractionMutation.isPending && (
                        <div className="p-6 bg-gradient-to-r from-gray-100 to-white rounded-lg border border-gray-300 text-center shadow-inner">
                          <div className="bg-white p-3 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center border border-gray-300 shadow-sm">
                            <FileText className="h-8 w-8 text-gray-500" />
                          </div>
                          <h4 className="text-md font-medium text-gray-800 mb-1">No Work Items Extracted</h4>
                          <p className="text-sm text-gray-700 mb-4 max-w-md mx-auto">
                            Work items haven't been extracted yet for this project. Extract them to view details and prepare for migration.
                          </p>
                          <Button 
                            size="sm"
                            className={`${startExtractionMutation.isPending ? 
                              'bg-blue-100 text-blue-800 border-blue-300 cursor-not-allowed' : 
                              'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'}`}
                            onClick={() => startExtractionMutation.mutate({ projectId: project.id, artifactType: "workitems" })}
                            disabled={startExtractionMutation.isPending}
                          >
                            {startExtractionMutation.isPending ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin text-blue-100" />
                                <span className="font-medium">Extracting...</span>
                              </>
                            ) : (
                              <>
                                <Database className="h-4 w-4 mr-2 text-white" />
                                <span className="font-medium">Extract Work Items</span>
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Extraction History */}
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-gray-100 to-gray-200 px-5 py-4 border-b border-gray-300">
                      <div className="flex justify-between items-center">
                        <h3 className="text-md font-semibold text-gray-800 flex items-center">
                          <div className="bg-white p-1.5 rounded-md mr-2 shadow-sm border border-gray-300">
                            <Clock className="h-4 w-4 text-gray-700" />
                          </div>
                          Extraction History
                        </h3>
                        {project.workItems?.extracted && project.workItems?.count > 0 && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="bg-white border-blue-300 hover:bg-blue-50 hover:border-blue-400 text-blue-700"
                            onClick={() => setLocation(`/projects/${project.id}/work-items`)}
                          >
                            <ExternalLink className="h-4 w-4 mr-2 text-blue-600" />
                            View Work Items
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <div className="p-5">
                      {/* Show current extraction job if in progress */}
                      {startExtractionMutation.isPending && startExtractionMutation.variables?.projectId === project.id && (
                        <div className="mb-5 bg-blue-50 p-4 rounded-lg border border-blue-200">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center">
                              <div className="bg-blue-100 p-1.5 rounded-full mr-3">
                                <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-blue-800">Extraction in Progress</h4>
                                <p className="text-xs text-blue-600 mt-0.5">Started {new Date().toLocaleTimeString()}</p>
                              </div>
                            </div>
                            <Badge className="bg-blue-100 text-blue-800 border border-blue-300">
                              Running
                            </Badge>
                          </div>
                          
                          <div className="mt-2">
                            <div className="flex justify-between text-xs text-blue-700 mb-1">
                              <span>Progress</span>
                              <span>~30%</span>
                            </div>
                            <div className="w-full bg-blue-100 rounded-full h-2.5">
                              <div className="bg-blue-600 h-2.5 rounded-full animate-pulse" style={{ width: '30%' }}></div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Show extraction history */}
                      {project.extractionHistory && project.extractionHistory.length > 0 ? (
                        <div>
                          <h3 className="text-sm font-medium mb-2">Recent Extraction Jobs</h3>
                          <div className="border rounded-md overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-gray-50 text-left">
                                  <th className="px-4 py-2">Type</th>
                                  <th className="px-4 py-2">Status</th>
                                  <th className="px-4 py-2">Progress</th>
                                  <th className="px-4 py-2">Items</th>
                                  <th className="px-4 py-2">Started</th>
                                  <th className="px-4 py-2">Completed</th>
                                </tr>
                              </thead>
                              <tbody>
                                {project.extractionHistory
                                  .filter(job => job.artifactType === 'workitems')
                                  .slice(0, 5)
                                  .map((job, index) => (
                                    <tr key={index} className="border-t">
                                      <td className="px-4 py-3">
                                        <span className="capitalize">Work Items</span>
                                      </td>
                                      <td className="px-4 py-3">
                                        <Badge className={
                                          job.status === 'completed' ? 'bg-green-100 text-green-800' :
                                          job.status === 'failed' ? 'bg-red-100 text-red-800' :
                                          job.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                          'bg-gray-100 text-gray-800'
                                        }>
                                          <span className="flex items-center">
                                            {job.status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                                            {job.status === 'failed' && <AlertCircle className="h-3 w-3 mr-1" />}
                                            {job.status === 'in_progress' && <RefreshCw className="h-3 w-3 mr-1 animate-spin" />}
                                            {job.status === 'queued' && <Clock className="h-3 w-3 mr-1" />}
                                            {job.status}
                                          </span>
                                        </Badge>
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                          <Progress 
                                            value={job.progress || 0} 
                                            className={`h-2 w-24 ${job.status === 'completed' ? 'bg-green-100' : ''}`} 
                                          />
                                          <span className="text-xs">{job.progress || 0}%</span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 text-xs">
                                        {job.extractedItems || 0} / {job.totalItems || 0}
                                      </td>
                                      <td className="px-4 py-3 text-xs">
                                        {job.startedAt ? new Date(job.startedAt).toLocaleString() : '-'}
                                      </td>
                                      <td className="px-4 py-3 text-xs">
                                        {job.completedAt ? new Date(job.completedAt).toLocaleString() : '-'}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : !startExtractionMutation.isPending && (
                        <div className="text-center p-6 bg-gradient-to-r from-blue-50 to-white rounded-lg border border-blue-200 shadow-inner">
                          <div className="bg-white p-2 rounded-full w-12 h-12 mx-auto mb-3 flex items-center justify-center border border-blue-200 shadow-sm">
                            <Clock className="h-6 w-6 text-blue-500" />
                          </div>
                          <h4 className="text-sm font-medium text-blue-800 mb-1">No Extraction History</h4>
                          <p className="text-xs text-blue-700 max-w-md mx-auto">
                            No previous work item extractions have been performed for this project. 
                            Use the "Extract Work Items" button to start your first extraction.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </>
  );
};