import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Database, CheckCircle, Clock, AlertCircle, Download, FileText, GitBranch, TestTube, Play, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type ArtifactType = "workitems" | "repositories" | "testcases" | "pipelines";

export default function ExtractionOverview() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAllJobs, setShowAllJobs] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});

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

  // Start extraction job mutation
  const startExtractionMutation = useMutation({
    mutationFn: ({ projectId, artifactType }: { projectId: number; artifactType: ArtifactType }) => 
      api.extraction.startJob(projectId, artifactType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/extraction/jobs'] });
      toast({
        title: "Extraction Started",
        description: "The extraction job has been started successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Extraction Failed",
        description: `Failed to start extraction: ${error}`,
        variant: "destructive",
      });
    },
  });

  // Group jobs by project
  const jobsByProject = jobs.reduce((acc: Record<number, any[]>, job: any) => {
    if (!acc[job.projectId]) {
      acc[job.projectId] = [];
    }
    acc[job.projectId].push(job);
    return acc;
  }, {});

  // Handle start extraction
  const handleStartExtraction = (projectId: number, artifactType: ArtifactType) => {
    startExtractionMutation.mutate({ projectId, artifactType });
  };
  
  // Toggle project expansion
  const toggleProjectExpansion = (projectId: number) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Extraction Overview</h1>
        <div className="flex items-center gap-4">
          {jobsFetching && (
            <div className="flex items-center text-sm text-blue-600">
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Refreshing data...
            </div>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['/api/extraction/jobs'] });
              queryClient.invalidateQueries({ queryKey: ['/api/projects/selected'] });
              toast({
                title: "Data refreshed",
                description: "The extraction data has been refreshed.",
              });
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="work-items">Work Items</TabsTrigger>
          <TabsTrigger value="repositories">Repositories</TabsTrigger>
          <TabsTrigger value="test-cases">Test Cases</TabsTrigger>
          <TabsTrigger value="pipelines">Pipelines</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          {projectsLoading ? (
            <div className="flex items-center justify-center h-64">
              <Database className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading projects...</span>
            </div>
          ) : (
            <>
              {/* Selected Projects */}
              <Card>
                <CardHeader>
                  <CardTitle>Selected Projects</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {selectedProjects.map((project: any) => (
                      <div key={project.id} className="border rounded-lg p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-medium">{project.name}</h3>
                          <Badge variant="outline">{project.status}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="flex flex-col">
                            <div className="text-gray-500">Work Items</div>
                            <div className="font-medium">{project.workItemCount || 0}</div>
                          </div>
                          <div className="flex flex-col">
                            <div className="text-gray-500">Repositories</div>
                            <div className="font-medium">{project.repoCount || 0}</div>
                          </div>
                          <div className="flex flex-col">
                            <div className="text-gray-500">Test Cases</div>
                            <div className="font-medium">{project.testCaseCount || 0}</div>
                          </div>
                          <div className="flex flex-col">
                            <div className="text-gray-500">Pipelines</div>
                            <div className="font-medium">{project.pipelineCount || 0}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              {/* Extraction Jobs */}
              {jobs.length > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Extraction Jobs</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setShowAllJobs(!showAllJobs)}
                      >
                        {showAllJobs ? "Show Recent Jobs" : "Show All Jobs"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50 text-left">
                            <th className="px-4 py-3 font-medium">Project</th>
                            <th className="px-4 py-3 font-medium">Type</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Progress</th>
                            <th className="px-4 py-3 font-medium">Items</th>
                            <th className="px-4 py-3 font-medium">Started</th>
                            <th className="px-4 py-3 font-medium">Completed</th>
                            <th className="px-4 py-3 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Sort jobs by date and limit to 3 if not showing all */}
                          {jobs
                            .sort((a: any, b: any) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
                            .slice(0, showAllJobs ? undefined : 3)
                            .map((job: any) => (
                              <tr key={job.id} className="border-b hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium">{job.projectName || `Project ${job.projectId}`}</td>
                                <td className="px-4 py-3">{job.artifactType}</td>
                                <td className="px-4 py-3">
                                  <Badge className={
                                    job.status === 'completed' ? 'bg-green-100 text-green-800' :
                                    job.status === 'in_progress' ? 'bg-orange-100 text-orange-800' :
                                    job.status === 'failed' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                  }>
                                    {job.status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                                    {job.status === 'in_progress' && <Clock className="h-3 w-3 mr-1" />}
                                    {job.status === 'failed' && <AlertCircle className="h-3 w-3 mr-1" />}
                                    {job.status.charAt(0).toUpperCase() + job.status.slice(1).replace('_', ' ')}
                                  </Badge>
                                  {job.status === 'in_progress' && (
                                    <div className="text-blue-500 animate-pulse text-xs font-medium mt-1">
                                      Extracting...
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-3 w-40">
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
                                <td className="px-4 py-3">
                                  {job.status === 'in_progress' ? (
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      disabled
                                    >
                                      <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />
                                      Extracting...
                                    </Button>
                                  ) : job.canReExtract && (
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => {
                                        fetch(`/api/extraction/${job.id}/reextract`, {
                                          method: 'POST',
                                        })
                                          .then(response => response.json())
                                          .then(data => {
                                            toast({
                                              title: "Re-extraction started",
                                              description: `Re-extracting ${job.artifactType} for ${job.projectName}`,
                                            });
                                            queryClient.invalidateQueries({ queryKey: ['/api/extraction/jobs'] });
                                          })
                                          .catch(error => {
                                            toast({
                                              variant: "destructive",
                                              title: "Error",
                                              description: "Failed to start re-extraction",
                                            });
                                          });
                                      }}
                                    >
                                      <RefreshCw className="h-3.5 w-3.5 mr-1" />
                                      Re-extract
                                    </Button>
                                  )}
                                </td>
                              </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {jobs.length > 3 && !showAllJobs && (
                      <div className="mt-2 text-center">
                        <Button 
                          variant="link" 
                          size="sm" 
                          onClick={() => setShowAllJobs(true)}
                        >
                          Show all {jobs.length} jobs
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="work-items" className="space-y-6">
          {projectsLoading ? (
            <div className="flex items-center justify-center h-64">
              <Database className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading projects...</span>
            </div>
          ) : selectedProjects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64">
                <FileText className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Projects Selected</h3>
                <p className="text-gray-500 text-center">
                  Select projects in the Project Selection tab to extract work items.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Work Items Extraction</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-left">
                        <th className="px-4 py-3 font-medium">Project</th>
                        <th className="px-4 py-3 font-medium">Work Items</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Progress</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedProjects.map((project: any) => {
                        const workItemJobs = jobsByProject[project.id]?.filter((job: any) => job.artifactType === 'workitems') || [];
                        const latestJob = workItemJobs.length > 0 ? workItemJobs[0] : null;
                        const isExtracting = latestJob?.status === 'in_progress';
                        const isExtracted = latestJob?.status === 'completed';
                        
                        return (
                          <>
                            <tr key={project.id} className="border-b hover:bg-gray-50">
                              <td 
                                className="px-4 py-3 font-medium cursor-pointer"
                                onClick={() => toggleProjectExpansion(project.id)}
                              >
                                <div className="flex items-center">
                                  {expandedProjects[project.id] ? (
                                    <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  ) : (
                                    <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  )}
                                  {project.name}
                                </div>
                              </td>
                              <td className="px-4 py-3">{project.workItemCount || 0}</td>
                              <td className="px-4 py-3">
                                {isExtracting ? (
                                  <Badge className="bg-orange-100 text-orange-800">
                                    <Clock className="h-3 w-3 mr-1" />
                                    Extracting
                                  </Badge>
                                ) : isExtracted ? (
                                  <Badge className="bg-green-100 text-green-800">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Extracted
                                  </Badge>
                                ) : (
                                  <Badge className="bg-gray-100 text-gray-800">
                                    Not Started
                                  </Badge>
                                )}
                              </td>
                              <td className="px-4 py-3 w-40">
                                {latestJob ? (
                                  <div className="flex items-center gap-2">
                                    <Progress 
                                      value={latestJob.progress || 0} 
                                      className={`h-2 w-24 ${latestJob.status === 'completed' ? 'bg-green-100' : ''}`} 
                                    />
                                    <span className="text-xs">{latestJob.progress || 0}%</span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-500">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {isExtracting ? (
                                  <Button 
                                    size="sm" 
                                    disabled
                                    variant="outline"
                                  >
                                    <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />
                                    Extracting...
                                  </Button>
                                ) : (
                                  <Button 
                                    size="sm" 
                                    onClick={() => handleStartExtraction(project.id, 'workitems')}
                                    disabled={startExtractionMutation.isPending}
                                    variant={isExtracted ? "outline" : "default"}
                                  >
                                    {isExtracted ? (
                                      <>
                                        <RefreshCw className="h-3.5 w-3.5 mr-1" />
                                        Re-extract
                                      </>
                                    ) : (
                                      <>
                                        <Download className="h-3.5 w-3.5 mr-1" />
                                        Extract
                                      </>
                                    )}
                                  </Button>
                                )}
                              </td>
                            </tr>
                            
                            {/* Expanded Project Summary */}
                            {expandedProjects[project.id] && isExtracted && (
                              <tr className="bg-gray-50">
                                <td colSpan={5} className="px-6 py-4">
                                  <div className="space-y-4">
                                    <h4 className="text-sm font-medium">Work Item Summary</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                      <div className="bg-white p-3 rounded border">
                                        <div className="text-xs text-gray-500">Total Work Items</div>
                                        <div className="text-lg font-medium">{latestJob.extractedItems || 0}</div>
                                      </div>
                                      <div className="bg-white p-3 rounded border">
                                        <div className="text-xs text-gray-500">Last Extracted</div>
                                        <div className="text-sm">
                                          {latestJob.completedAt ? new Date(latestJob.completedAt).toLocaleString() : '-'}
                                        </div>
                                      </div>
                                      <div className="bg-white p-3 rounded border">
                                        <div className="text-xs text-gray-500">Extraction Time</div>
                                        <div className="text-sm">
                                          {latestJob.startedAt && latestJob.completedAt ? 
                                            `${Math.round((new Date(latestJob.completedAt).getTime() - new Date(latestJob.startedAt).getTime()) / 1000)} seconds` : 
                                            '-'}
                                        </div>
                                      </div>
                                      <div className="bg-white p-3 rounded border">
                                        <div className="text-xs text-gray-500">Status</div>
                                        <div className="flex items-center">
                                          <Badge className="bg-green-100 text-green-800 mt-1">
                                            <CheckCircle className="h-3 w-3 mr-1" />
                                            Completed
                                          </Badge>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Job History */}
                                    {workItemJobs.length > 1 && (
                                      <div className="mt-4">
                                        <h4 className="text-sm font-medium mb-2">Extraction History</h4>
                                        <div className="rounded border overflow-hidden">
                                          <table className="w-full text-xs">
                                            <thead>
                                              <tr className="bg-gray-100 text-left">
                                                <th className="px-3 py-2">Date</th>
                                                <th className="px-3 py-2">Items</th>
                                                <th className="px-3 py-2">Status</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {workItemJobs.slice(0, 3).map((job, idx) => (
                                                <tr key={`history-${job.id}`} className="border-t">
                                                  <td className="px-3 py-2">
                                                    {job.startedAt ? new Date(job.startedAt).toLocaleString() : '-'}
                                                  </td>
                                                  <td className="px-3 py-2">
                                                    {job.extractedItems || 0} / {job.totalItems || 0}
                                                  </td>
                                                  <td className="px-3 py-2">
                                                    <Badge className={
                                                      job.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                      job.status === 'in_progress' ? 'bg-orange-100 text-orange-800' :
                                                      job.status === 'failed' ? 'bg-red-100 text-red-800' :
                                                      'bg-gray-100 text-gray-800'
                                                    }>
                                                      {job.status.charAt(0).toUpperCase() + job.status.slice(1).replace('_', ' ')}
                                                    </Badge>
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                
                {/* Work Item Jobs */}
                {Object.values(jobsByProject).flat().filter((job: any) => job.artifactType === 'workitems').length > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium">Work Item Extraction Jobs</h3>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setShowAllJobs(!showAllJobs)}
                      >
                        {showAllJobs ? "Show Recent Jobs" : "Show All Jobs"}
                      </Button>
                    </div>
                    <div className="rounded-md border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50 text-left">
                            <th className="px-4 py-3 font-medium">Project</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Progress</th>
                            <th className="px-4 py-3 font-medium">Items</th>
                            <th className="px-4 py-3 font-medium">Started</th>
                            <th className="px-4 py-3 font-medium">Completed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.values(jobsByProject).flat()
                            .filter((job: any) => job.artifactType === 'workitems')
                            .sort((a: any, b: any) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
                            .slice(0, showAllJobs ? undefined : 3)
                            .map((job: any) => (
                              <tr key={job.id} className="border-b hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium">{job.projectName}</td>
                                <td className="px-4 py-3">
                                  <Badge className={
                                    job.status === 'completed' ? 'bg-green-100 text-green-800' :
                                    job.status === 'in_progress' ? 'bg-orange-100 text-orange-800' :
                                    job.status === 'failed' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                  }>
                                    {job.status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                                    {job.status === 'in_progress' && <Clock className="h-3 w-3 mr-1" />}
                                    {job.status === 'failed' && <AlertCircle className="h-3 w-3 mr-1" />}
                                    {job.status.charAt(0).toUpperCase() + job.status.slice(1).replace('_', ' ')}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 w-40">
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
                    {Object.values(jobsByProject).flat().filter((job: any) => job.artifactType === 'workitems').length > 3 && !showAllJobs && (
                      <div className="mt-2 text-center">
                        <Button 
                          variant="link" 
                          size="sm" 
                          onClick={() => setShowAllJobs(true)}
                        >
                          Show all {Object.values(jobsByProject).flat().filter((job: any) => job.artifactType === 'workitems').length} jobs
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="repositories" className="space-y-6">
          {projectsLoading ? (
            <div className="flex items-center justify-center h-64">
              <Database className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading projects...</span>
            </div>
          ) : selectedProjects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64">
                <GitBranch className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Projects Selected</h3>
                <p className="text-gray-500 text-center">
                  Select projects in the Project Selection tab to extract repositories.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Repositories Extraction</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-left">
                        <th className="px-4 py-3 font-medium">Project</th>
                        <th className="px-4 py-3 font-medium">Repositories</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Progress</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedProjects.map((project: any) => {
                        const repoJobs = jobsByProject[project.id]?.filter((job: any) => job.artifactType === 'repositories') || [];
                        const latestJob = repoJobs.length > 0 ? repoJobs[0] : null;
                        const isExtracting = latestJob?.status === 'in_progress';
                        const isExtracted = latestJob?.status === 'completed';
                        
                        return (
                          <>
                            <tr key={project.id} className="border-b hover:bg-gray-50">
                              <td 
                                className="px-4 py-3 font-medium cursor-pointer"
                                onClick={() => toggleProjectExpansion(project.id)}
                              >
                                <div className="flex items-center">
                                  {expandedProjects[project.id] ? (
                                    <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  ) : (
                                    <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  )}
                                  {project.name}
                                </div>
                              </td>
                              <td className="px-4 py-3">{project.repoCount || 0}</td>
                              <td className="px-4 py-3">
                                {isExtracting ? (
                                  <Badge className="bg-orange-100 text-orange-800">
                                    <Clock className="h-3 w-3 mr-1" />
                                    Extracting
                                  </Badge>
                                ) : isExtracted ? (
                                  <Badge className="bg-green-100 text-green-800">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Extracted
                                  </Badge>
                                ) : (
                                  <Badge className="bg-gray-100 text-gray-800">
                                    Not Started
                                  </Badge>
                                )}
                              </td>
                              <td className="px-4 py-3 w-40">
                                {latestJob ? (
                                  <div className="flex items-center gap-2">
                                    <Progress 
                                      value={latestJob.progress || 0} 
                                      className={`h-2 w-24 ${latestJob.status === 'completed' ? 'bg-green-100' : ''}`} 
                                    />
                                    <span className="text-xs">{latestJob.progress || 0}%</span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-500">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {isExtracting ? (
                                  <Button 
                                    size="sm" 
                                    disabled
                                    variant="outline"
                                  >
                                    <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />
                                    Extracting...
                                  </Button>
                                ) : (
                                  <Button 
                                    size="sm" 
                                    onClick={() => handleStartExtraction(project.id, 'repositories')}
                                    disabled={startExtractionMutation.isPending}
                                    variant={isExtracted ? "outline" : "default"}
                                  >
                                    {isExtracted ? (
                                      <>
                                        <RefreshCw className="h-3.5 w-3.5 mr-1" />
                                        Re-extract
                                      </>
                                    ) : (
                                      <>
                                        <Download className="h-3.5 w-3.5 mr-1" />
                                        Extract
                                      </>
                                    )}
                                  </Button>
                                )}
                              </td>
                            </tr>
                            
                            {/* Expanded Project Summary */}
                            {expandedProjects[project.id] && isExtracted && (
                              <tr className="bg-gray-50">
                                <td colSpan={5} className="px-6 py-4">
                                  <div className="space-y-4">
                                    <h4 className="text-sm font-medium">Repository Summary</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                      <div className="bg-white p-3 rounded border">
                                        <div className="text-xs text-gray-500">Total Repositories</div>
                                        <div className="text-lg font-medium">{latestJob.extractedItems || 0}</div>
                                      </div>
                                      <div className="bg-white p-3 rounded border">
                                        <div className="text-xs text-gray-500">Last Extracted</div>
                                        <div className="text-sm">
                                          {latestJob.completedAt ? new Date(latestJob.completedAt).toLocaleString() : '-'}
                                        </div>
                                      </div>
                                      <div className="bg-white p-3 rounded border">
                                        <div className="text-xs text-gray-500">Extraction Time</div>
                                        <div className="text-sm">
                                          {latestJob.startedAt && latestJob.completedAt ? 
                                            `${Math.round((new Date(latestJob.completedAt).getTime() - new Date(latestJob.startedAt).getTime()) / 1000)} seconds` : 
                                            '-'}
                                        </div>
                                      </div>
                                      <div className="bg-white p-3 rounded border">
                                        <div className="text-xs text-gray-500">Status</div>
                                        <div className="flex items-center">
                                          <Badge className="bg-green-100 text-green-800 mt-1">
                                            <CheckCircle className="h-3 w-3 mr-1" />
                                            Completed
                                          </Badge>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Job History */}
                                    {repoJobs.length > 1 && (
                                      <div className="mt-4">
                                        <h4 className="text-sm font-medium mb-2">Extraction History</h4>
                                        <div className="rounded border overflow-hidden">
                                          <table className="w-full text-xs">
                                            <thead>
                                              <tr className="bg-gray-100 text-left">
                                                <th className="px-3 py-2">Date</th>
                                                <th className="px-3 py-2">Items</th>
                                                <th className="px-3 py-2">Status</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {repoJobs.slice(0, 3).map((job, idx) => (
                                                <tr key={`history-${job.id}`} className="border-t">
                                                  <td className="px-3 py-2">
                                                    {job.startedAt ? new Date(job.startedAt).toLocaleString() : '-'}
                                                  </td>
                                                  <td className="px-3 py-2">
                                                    {job.extractedItems || 0} / {job.totalItems || 0}
                                                  </td>
                                                  <td className="px-3 py-2">
                                                    <Badge className={
                                                      job.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                      job.status === 'in_progress' ? 'bg-orange-100 text-orange-800' :
                                                      job.status === 'failed' ? 'bg-red-100 text-red-800' :
                                                      'bg-gray-100 text-gray-800'
                                                    }>
                                                      {job.status.charAt(0).toUpperCase() + job.status.slice(1).replace('_', ' ')}
                                                    </Badge>
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                {/* Repository Jobs */}
                {Object.values(jobsByProject).flat().filter((job: any) => job.artifactType === 'repositories').length > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium">Repository Extraction Jobs</h3>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setShowAllJobs(!showAllJobs)}
                      >
                        {showAllJobs ? "Show Recent Jobs" : "Show All Jobs"}
                      </Button>
                    </div>
                    <div className="rounded-md border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50 text-left">
                            <th className="px-4 py-3 font-medium">Project</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Progress</th>
                            <th className="px-4 py-3 font-medium">Items</th>
                            <th className="px-4 py-3 font-medium">Started</th>
                            <th className="px-4 py-3 font-medium">Completed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.values(jobsByProject).flat()
                            .filter((job: any) => job.artifactType === 'repositories')
                            .sort((a: any, b: any) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
                            .slice(0, showAllJobs ? undefined : 3)
                            .map((job: any) => (
                              <tr key={job.id} className="border-b hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium">{job.projectName}</td>
                                <td className="px-4 py-3">
                                  <Badge className={
                                    job.status === 'completed' ? 'bg-green-100 text-green-800' :
                                    job.status === 'in_progress' ? 'bg-orange-100 text-orange-800' :
                                    job.status === 'failed' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                  }>
                                    {job.status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                                    {job.status === 'in_progress' && <Clock className="h-3 w-3 mr-1" />}
                                    {job.status === 'failed' && <AlertCircle className="h-3 w-3 mr-1" />}
                                    {job.status.charAt(0).toUpperCase() + job.status.slice(1).replace('_', ' ')}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 w-40">
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
                    {Object.values(jobsByProject).flat().filter((job: any) => job.artifactType === 'repositories').length > 3 && !showAllJobs && (
                      <div className="mt-2 text-center">
                        <Button 
                          variant="link" 
                          size="sm" 
                          onClick={() => setShowAllJobs(true)}
                        >
                          Show all {Object.values(jobsByProject).flat().filter((job: any) => job.artifactType === 'repositories').length} jobs
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="test-cases" className="space-y-6">
          {projectsLoading ? (
            <div className="flex items-center justify-center h-64">
              <Database className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading projects...</span>
            </div>
          ) : selectedProjects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64">
                <TestTube className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Projects Selected</h3>
                <p className="text-gray-500 text-center">
                  Select projects in the Project Selection tab to extract test cases.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Test Cases Extraction</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-left">
                        <th className="px-4 py-3 font-medium">Project</th>
                        <th className="px-4 py-3 font-medium">Test Cases</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Progress</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedProjects.map((project: any) => {
                        const testCaseJobs = jobsByProject[project.id]?.filter((job: any) => job.artifactType === 'testcases') || [];
                        const latestJob = testCaseJobs.length > 0 ? testCaseJobs[0] : null;
                        const isExtracting = latestJob?.status === 'in_progress';
                        const isExtracted = latestJob?.status === 'completed';
                        
                        return (
                          <tr key={project.id} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium">{project.name}</td>
                            <td className="px-4 py-3">{project.testCaseCount || 0}</td>
                            <td className="px-4 py-3">
                              {isExtracting ? (
                                <Badge className="bg-orange-100 text-orange-800">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Extracting
                                </Badge>
                              ) : isExtracted ? (
                                <Badge className="bg-green-100 text-green-800">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Extracted
                                </Badge>
                              ) : (
                                <Badge className="bg-gray-100 text-gray-800">
                                  Not Started
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-3 w-40">
                              {latestJob ? (
                                <div className="flex items-center gap-2">
                                  <Progress 
                                    value={latestJob.progress || 0} 
                                    className={`h-2 w-24 ${latestJob.status === 'completed' ? 'bg-green-100' : ''}`} 
                                  />
                                  <span className="text-xs">{latestJob.progress || 0}%</span>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-500">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {isExtracting ? (
                                <Button 
                                  size="sm" 
                                  disabled
                                  variant="outline"
                                >
                                  <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />
                                  Extracting...
                                </Button>
                              ) : (
                                <Button 
                                  size="sm" 
                                  onClick={() => handleStartExtraction(project.id, 'testcases')}
                                  disabled={startExtractionMutation.isPending}
                                  variant={isExtracted ? "outline" : "default"}
                                >
                                  {isExtracted ? (
                                    <>
                                      <RefreshCw className="h-3.5 w-3.5 mr-1" />
                                      Re-extract
                                    </>
                                  ) : (
                                    <>
                                      <Download className="h-3.5 w-3.5 mr-1" />
                                      Extract
                                    </>
                                  )}
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                {/* Test Case Jobs */}
                {Object.values(jobsByProject).flat().filter((job: any) => job.artifactType === 'testcases').length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-medium mb-4">Test Case Extraction Jobs</h3>
                    <div className="rounded-md border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50 text-left">
                            <th className="px-4 py-3 font-medium">Project</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Progress</th>
                            <th className="px-4 py-3 font-medium">Items</th>
                            <th className="px-4 py-3 font-medium">Started</th>
                            <th className="px-4 py-3 font-medium">Completed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.values(jobsByProject).flat()
                            .filter((job: any) => job.artifactType === 'testcases')
                            .map((job: any) => (
                              <tr key={job.id} className="border-b hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium">{job.projectName}</td>
                                <td className="px-4 py-3">
                                  <Badge className={
                                    job.status === 'completed' ? 'bg-green-100 text-green-800' :
                                    job.status === 'in_progress' ? 'bg-orange-100 text-orange-800' :
                                    job.status === 'failed' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                  }>
                                    {job.status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                                    {job.status === 'in_progress' && <Clock className="h-3 w-3 mr-1" />}
                                    {job.status === 'failed' && <AlertCircle className="h-3 w-3 mr-1" />}
                                    {job.status.charAt(0).toUpperCase() + job.status.slice(1).replace('_', ' ')}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 w-40">
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
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pipelines" className="space-y-6">
          {projectsLoading ? (
            <div className="flex items-center justify-center h-64">
              <Database className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading projects...</span>
            </div>
          ) : selectedProjects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64">
                <Play className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Projects Selected</h3>
                <p className="text-gray-500 text-center">
                  Select projects in the Project Selection tab to extract pipelines.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Pipelines Extraction</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-left">
                        <th className="px-4 py-3 font-medium">Project</th>
                        <th className="px-4 py-3 font-medium">Pipelines</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Progress</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedProjects.map((project: any) => {
                        const pipelineJobs = jobsByProject[project.id]?.filter((job: any) => job.artifactType === 'pipelines') || [];
                        const latestJob = pipelineJobs.length > 0 ? pipelineJobs[0] : null;
                        const isExtracting = latestJob?.status === 'in_progress';
                        const isExtracted = latestJob?.status === 'completed';
                        
                        return (
                          <tr key={project.id} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium">{project.name}</td>
                            <td className="px-4 py-3">{project.pipelineCount || 0}</td>
                            <td className="px-4 py-3">
                              {isExtracting ? (
                                <Badge className="bg-orange-100 text-orange-800">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Extracting
                                </Badge>
                              ) : isExtracted ? (
                                <Badge className="bg-green-100 text-green-800">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Extracted
                                </Badge>
                              ) : (
                                <Badge className="bg-gray-100 text-gray-800">
                                  Not Started
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-3 w-40">
                              {latestJob ? (
                                <div className="flex items-center gap-2">
                                  <Progress 
                                    value={latestJob.progress || 0} 
                                    className={`h-2 w-24 ${latestJob.status === 'completed' ? 'bg-green-100' : ''}`} 
                                  />
                                  <span className="text-xs">{latestJob.progress || 0}%</span>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-500">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {isExtracting ? (
                                <Button 
                                  size="sm" 
                                  disabled
                                  variant="outline"
                                >
                                  <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />
                                  Extracting...
                                </Button>
                              ) : (
                                <Button 
                                  size="sm" 
                                  onClick={() => handleStartExtraction(project.id, 'pipelines')}
                                  disabled={startExtractionMutation.isPending}
                                  variant={isExtracted ? "outline" : "default"}
                                >
                                  {isExtracted ? (
                                    <>
                                      <RefreshCw className="h-3.5 w-3.5 mr-1" />
                                      Re-extract
                                    </>
                                  ) : (
                                    <>
                                      <Download className="h-3.5 w-3.5 mr-1" />
                                      Extract
                                    </>
                                  )}
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                {/* Pipeline Jobs */}
                {Object.values(jobsByProject).flat().filter((job: any) => job.artifactType === 'pipelines').length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-medium mb-4">Pipeline Extraction Jobs</h3>
                    <div className="rounded-md border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50 text-left">
                            <th className="px-4 py-3 font-medium">Project</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Progress</th>
                            <th className="px-4 py-3 font-medium">Items</th>
                            <th className="px-4 py-3 font-medium">Started</th>
                            <th className="px-4 py-3 font-medium">Completed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.values(jobsByProject).flat()
                            .filter((job: any) => job.artifactType === 'pipelines')
                            .map((job: any) => (
                              <tr key={job.id} className="border-b hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium">{job.projectName}</td>
                                <td className="px-4 py-3">
                                  <Badge className={
                                    job.status === 'completed' ? 'bg-green-100 text-green-800' :
                                    job.status === 'in_progress' ? 'bg-orange-100 text-orange-800' :
                                    job.status === 'failed' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                  }>
                                    {job.status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                                    {job.status === 'in_progress' && <Clock className="h-3 w-3 mr-1" />}
                                    {job.status === 'failed' && <AlertCircle className="h-3 w-3 mr-1" />}
                                    {job.status.charAt(0).toUpperCase() + job.status.slice(1).replace('_', ' ')}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 w-40">
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
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}