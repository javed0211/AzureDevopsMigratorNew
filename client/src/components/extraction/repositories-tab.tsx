import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Database, GitBranch, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Project } from "./types";
import { RepositoryList } from "./repository-list";

interface RepositoriesTabProps {
  projects: Project[];
  isLoading: boolean;
}

export const RepositoriesTab = ({ projects, isLoading }: RepositoriesTabProps) => {
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
        description: "The repositories extraction process has been started successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/extraction/jobs'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error starting extraction",
        description: error.message || "Failed to start repositories extraction process.",
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
        <h2 className="text-2xl font-bold">Repositories Extraction</h2>
        <Button 
          variant="outline" 
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/projects/selected'] });
            toast({
              title: "Refreshing Data",
              description: "Fetching the latest repositories data...",
            });
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Data
        </Button>
      </div>

      <div className="space-y-6">
        {projects.map((project) => (
          <Card key={project.id}>
            <CardHeader 
              className="bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => toggleProjectExpansion(project.id)}
            >
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center">
                  <GitBranch className="h-5 w-5 mr-2 text-blue-600" />
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
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      startExtractionMutation.mutate({ projectId: project.id, artifactType: "repositories" });
                    }}
                    disabled={startExtractionMutation.isPending && startExtractionMutation.variables?.projectId === project.id}
                  >
                    {startExtractionMutation.isPending && startExtractionMutation.variables?.projectId === project.id ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Extracting...
                      </>
                    ) : (
                      "Extract Repositories"
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            {expandedProjects[project.id] && (
              <CardContent className="pt-4">
                <RepositoryList projectId={project.id} />
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </>
  );
};