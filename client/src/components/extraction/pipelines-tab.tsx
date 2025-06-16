import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Database, Play, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Project } from "./types";

interface PipelinesTabProps {
  projects: Project[];
  isLoading: boolean;
}

export const PipelinesTab = ({ projects, isLoading }: PipelinesTabProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});

  // Start extraction mutation
  const startExtractionMutation = useMutation({
    mutationFn: (params: { projectId: number, artifactType: string }) => 
      api.extraction.startJob(params.projectId, params.artifactType),
    onSuccess: () => {
      toast({
        title: "Extraction started",
        description: "The pipelines extraction process has been started successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/extraction/jobs'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error starting extraction",
        description: error.message || "Failed to start pipelines extraction process.",
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

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Pipelines Extraction</h2>
        <Button 
          variant="outline" 
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/projects/selected'] });
            toast({
              title: "Refreshing Data",
              description: "Fetching the latest pipelines data...",
            });
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Data
        </Button>
      </div>

      <div className="space-y-6">
        {projects.map((project) => (
          <Card key={project.id} className="w-full" style={{ width: '100%' }}>
            <CardHeader 
              className="bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors w-full"
              onClick={() => toggleProjectExpansion(project.id)}
            >
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center">
                  <Play className="h-5 w-5 mr-2 text-blue-600" />
                  {project.name}
                  <div className="ml-3">
                    {expandedProjects[project.id] ? (
                      <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="ml-2">ID: {project.id}</Badge>
                  {(project.buildPipelines?.extracted || project.releasePipelines?.extracted) && (
                    <Badge className="bg-green-100 text-green-800">
                      Pipelines Extracted
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            
            {expandedProjects[project.id] && (
              <CardContent className="pt-4">
                <div className="space-y-6">
                  {/* Pipeline Options */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Build Pipelines */}
                    <div className="p-4 bg-gray-50 rounded-md">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-medium">Build Pipelines</h3>
                        <Badge className={
                          project.buildPipelines?.extracted ? 'bg-green-100 text-green-800' : 
                          project.buildPipelines?.error ? 'bg-red-100 text-red-800' : 
                          'bg-gray-100 text-gray-800'
                        }>
                          {project.buildPipelines?.extracted ? `${project.buildPipelines.count} extracted` : 
                           project.buildPipelines?.error ? 'Failed' : 'Not extracted'}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-500 mb-3">
                        Extract build pipeline definitions, including YAML pipelines and classic build definitions.
                      </div>
                      <Button 
                        size="sm"
                        onClick={() => startExtractionMutation.mutate({ projectId: project.id, artifactType: "buildpipelines" })}
                        disabled={startExtractionMutation.isPending && startExtractionMutation.variables?.projectId === project.id}
                      >
                        {startExtractionMutation.isPending && startExtractionMutation.variables?.projectId === project.id && startExtractionMutation.variables?.artifactType === "buildpipelines" ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Extracting...
                          </>
                        ) : (
                          "Extract Build Pipelines"
                        )}
                      </Button>
                    </div>
                    
                    {/* Release Pipelines */}
                    <div className="p-4 bg-gray-50 rounded-md">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-medium">Release Pipelines</h3>
                        <Badge className={
                          project.releasePipelines?.extracted ? 'bg-green-100 text-green-800' : 
                          project.releasePipelines?.error ? 'bg-red-100 text-red-800' : 
                          'bg-gray-100 text-gray-800'
                        }>
                          {project.releasePipelines?.extracted ? `${project.releasePipelines.count} extracted` : 
                           project.releasePipelines?.error ? 'Failed' : 'Not extracted'}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-500 mb-3">
                        Extract release pipeline definitions, including stages, environments, and tasks.
                      </div>
                      <Button 
                        size="sm"
                        onClick={() => startExtractionMutation.mutate({ projectId: project.id, artifactType: "releasepipelines" })}
                        disabled={startExtractionMutation.isPending && startExtractionMutation.variables?.projectId === project.id}
                      >
                        {startExtractionMutation.isPending && startExtractionMutation.variables?.projectId === project.id && startExtractionMutation.variables?.artifactType === "releasepipelines" ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Extracting...
                          </>
                        ) : (
                          "Extract Release Pipelines"
                        )}
                      </Button>
                    </div>
                    
                    {/* Pipeline Runs */}
                    <div className="p-4 bg-gray-50 rounded-md">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-medium">Pipeline Runs</h3>
                        <Badge className="bg-yellow-100 text-yellow-800">
                          May take longer
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-500 mb-3">
                        Extract pipeline run history, including build and release runs, with their status and results.
                      </div>
                      <Button 
                        size="sm"
                        onClick={() => startExtractionMutation.mutate({ projectId: project.id, artifactType: "pipelineruns" })}
                        disabled={startExtractionMutation.isPending && startExtractionMutation.variables?.projectId === project.id}
                      >
                        {startExtractionMutation.isPending && startExtractionMutation.variables?.projectId === project.id && startExtractionMutation.variables?.artifactType === "pipelineruns" ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Extracting...
                          </>
                        ) : (
                          "Extract Pipeline Runs"
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Extracted Pipelines Summary */}
                  {(project.buildPipelines?.extracted || project.releasePipelines?.extracted) && (
                    <div className="p-4 bg-gray-50 rounded-md">
                      <h3 className="text-sm font-medium mb-3">Extracted Pipelines</h3>
                      <div className="space-y-3">
                        {project.buildPipelines?.extracted && project.buildPipelines.items && (
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 mb-2">Build Pipelines</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {project.buildPipelines.items.slice(0, 4).map((pipeline: any, index: number) => (
                                <div key={index} className="flex justify-between items-center p-2 bg-white rounded border">
                                  <span className="text-xs font-medium truncate max-w-[200px]">{pipeline.name}</span>
                                  <Badge variant="outline">{pipeline.type || "YAML"}</Badge>
                                </div>
                              ))}
                            </div>
                            {project.buildPipelines.items.length > 4 && (
                              <div className="text-xs text-blue-600 mt-1">
                                +{project.buildPipelines.items.length - 4} more build pipelines
                              </div>
                            )}
                          </div>
                        )}
                        
                        {project.releasePipelines?.extracted && project.releasePipelines.items && (
                          <div className="mt-4">
                            <h4 className="text-xs font-medium text-gray-500 mb-2">Release Pipelines</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {project.releasePipelines.items.slice(0, 4).map((pipeline: any, index: number) => (
                                <div key={index} className="flex justify-between items-center p-2 bg-white rounded border">
                                  <span className="text-xs font-medium truncate max-w-[200px]">{pipeline.name}</span>
                                  <Badge variant="outline">{pipeline.environments || pipeline.stages} stages</Badge>
                                </div>
                              ))}
                            </div>
                            {project.releasePipelines.items.length > 4 && (
                              <div className="text-xs text-blue-600 mt-1">
                                +{project.releasePipelines.items.length - 4} more release pipelines
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Extraction History */}
                  <div className="p-4 bg-gray-50 rounded-md">
                    <h3 className="text-sm font-medium mb-3">Extraction History</h3>
                    {project.extractionHistory && project.extractionHistory.length > 0 ? (
                      <div className="border rounded-md overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-100 text-left">
                              <th className="px-4 py-2">Type</th>
                              <th className="px-4 py-2">Status</th>
                              <th className="px-4 py-2">Items</th>
                              <th className="px-4 py-2">Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {project.extractionHistory
                              .filter(job => ['buildpipelines', 'releasepipelines', 'pipelineruns'].includes(job.artifactType))
                              .slice(0, 5)
                              .map((job, index) => (
                                <tr key={index} className="border-t">
                                  <td className="px-4 py-2">
                                    {job.artifactType === 'buildpipelines' ? 'Build Pipelines' :
                                     job.artifactType === 'releasepipelines' ? 'Release Pipelines' : 'Pipeline Runs'}
                                  </td>
                                  <td className="px-4 py-2">
                                    <Badge className={
                                      job.status === 'completed' ? 'bg-green-100 text-green-800' :
                                      job.status === 'failed' ? 'bg-red-100 text-red-800' :
                                      'bg-blue-100 text-blue-800'
                                    }>
                                      {job.status}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-2">{job.count || 0}</td>
                                  <td className="px-4 py-2 text-xs">{new Date(job.date).toLocaleString()}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">
                        No extraction history available.
                      </div>
                    )}
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