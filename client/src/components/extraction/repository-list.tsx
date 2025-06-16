import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Code, GitBranch, GitCommit, GitPullRequest } from "lucide-react";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Branch } from "./types";

// Repository List Component
export const RepositoryList = ({ projectId }: { projectId: number }) => {
  const [selectedRepo, setSelectedRepo] = useState<number | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  
  // Fetch repositories for the project
  const { data: repositories = [], isLoading } = useQuery({
    queryKey: [`projects-repositories-${projectId}`],
    queryFn: async () => {
      console.log(`Fetching repositories for project ${projectId}`);
      try {
        const data = await api.projects.getRepositories(projectId);
        console.log(`Fetched ${data.length} repositories:`, data);
        return data;
      } catch (error) {
        console.error('Error fetching repositories:', error);
        throw error;
      }
    },
    enabled: !!projectId,
  });
  
  // Fetch repository details when a repo is selected
  const { data: repoDetails, isLoading: detailsLoading } = useQuery({
    queryKey: [`repository-details-${selectedRepo}`],
    queryFn: async () => {
      try {
        if (!selectedRepo) throw new Error('No repository selected');
        const details = await api.repositories.getDetails(selectedRepo);
        
        // Set default branch when details are loaded
        if (details.defaultBranch) {
          const defaultBranchName = details.defaultBranch.replace('refs/heads/', '');
          setSelectedBranch(defaultBranchName);
        }
        
        return details;
      } catch (error) {
        console.error('Error fetching repository details:', error);
        throw error;
      }
    },
    enabled: !!selectedRepo,
  });
  
  console.log("RepositoryList render:", { projectId, isLoading, repositories });

  if (isLoading) {
    return (
      <div className="p-4 text-center">
        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
        <p>Loading repositories...</p>
      </div>
    );
  }
  
  if (repositories.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <Code className="h-8 w-8 mx-auto mb-2" />
        <p>No repositories found for this project (ID: {projectId}).</p>
        <p className="text-xs mt-2">Try extracting repositories for this project first.</p>
      </div>
    );
  }
  
  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Default Branch</th>
            <th className="px-4 py-2 font-medium">Size</th>
            <th className="px-4 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {repositories.map((repo: any) => (
            <tr key={repo.id} className="border-t">
              <td className="px-4 py-2 font-medium">{repo.name}</td>
              <td className="px-4 py-2">
                <div className="flex items-center">
                  <GitBranch className="h-3.5 w-3.5 mr-1 text-gray-500" />
                  {repo.defaultBranch || 'main'}
                </div>
              </td>
              <td className="px-4 py-2">
                {repo.size ? `${Math.round(repo.size / 1024)} KB` : 'Unknown'}
              </td>
              <td className="px-4 py-2">
                <Dialog onOpenChange={(open) => {
                  if (!open) {
                    // Reset selected branch when dialog closes
                    setSelectedBranch("");
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedRepo(repo.id)}
                    >
                      View Details
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>{repo.name}</DialogTitle>
                    </DialogHeader>
                    
                    {detailsLoading ? (
                      <div className="p-8 text-center">
                        <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
                        <p>Loading repository details...</p>
                      </div>
                    ) : repoDetails ? (
                      <div className="space-y-6 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">Repository URL</p>
                            <p className="text-sm text-gray-500 break-all">{repoDetails.url}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium">Default Branch</p>
                            <p className="text-sm text-gray-500 flex items-center">
                              <GitBranch className="h-3.5 w-3.5 mr-1.5 text-gray-500" />
                              {repoDetails.defaultBranch?.replace('refs/heads/', '') || 'main'}
                            </p>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-medium mb-2">Branches</h4>
                          <div className="relative">
                            <select 
                              className="w-full p-2 pr-8 border rounded bg-white text-sm appearance-none cursor-pointer"
                              value={selectedBranch || ""}
                              onChange={(e) => setSelectedBranch(e.target.value)}
                            >
                              <option value="" disabled>Select a branch to view</option>
                              {repoDetails.branches?.map((branch: Branch, idx: number) => (
                                <option key={idx} value={branch.name}>
                                  {branch.name}
                                </option>
                              ))}
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                              <GitBranch className="h-4 w-4 text-gray-500" />
                            </div>
                            <div className="mt-2 text-xs text-gray-500">
                              {repoDetails.branches?.length} branches available • Default: {repoDetails.defaultBranch?.replace('refs/heads/', '') || 'main'}
                            </div>
                            
                            {selectedBranch && (
                              <div className="mt-3 p-3 bg-gray-50 rounded border">
                                <div className="flex items-center text-sm font-medium mb-1">
                                  <GitBranch className="h-3.5 w-3.5 mr-1.5" />
                                  {selectedBranch}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {repoDetails.branches?.find((b: Branch) => b.name === selectedBranch)?.objectId && (
                                    <span className="font-mono">
                                      {repoDetails.branches?.find((b: Branch) => b.name === selectedBranch)?.objectId.substring(0, 7)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-medium mb-2">Recent Commits</h4>
                          <div className="border rounded overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-gray-50 text-left">
                                  <th className="px-3 py-2">Commit</th>
                                  <th className="px-3 py-2">Author</th>
                                  <th className="px-3 py-2">Date</th>
                                </tr>
                              </thead>
                              <tbody>
                                {repoDetails.commits?.slice(0, 5).map((commit: any, idx: number) => (
                                  <tr key={idx} className="border-t">
                                    <td className="px-3 py-2">
                                      <div className="flex items-start">
                                        <GitCommit className="h-3.5 w-3.5 mr-2 mt-0.5 text-gray-500" />
                                        <div>
                                          <div className="font-mono text-xs text-gray-500">{commit.commitId?.substring(0, 7)}</div>
                                          <div className="text-sm truncate max-w-[200px]">{commit.comment}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-3 py-2">{commit.author}</td>
                                    <td className="px-3 py-2 text-xs">
                                      {commit.commitDate ? new Date(commit.commitDate).toLocaleString() : '-'}
                                    </td>
                                  </tr>
                                ))}
                                {(!repoDetails.commits || repoDetails.commits.length === 0) && (
                                  <tr>
                                    <td colSpan={3} className="px-3 py-4 text-center text-gray-500">
                                      No commits found
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-medium mb-2">Pull Requests</h4>
                          <div className="border rounded overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-gray-50 text-left">
                                  <th className="px-3 py-2">Title</th>
                                  <th className="px-3 py-2">Status</th>
                                  <th className="px-3 py-2">Created By</th>
                                </tr>
                              </thead>
                              <tbody>
                                {repoDetails.pullRequests?.slice(0, 3).map((pr: any, idx: number) => (
                                  <tr key={idx} className="border-t">
                                    <td className="px-3 py-2">
                                      <div className="flex items-start">
                                        <GitPullRequest className="h-3.5 w-3.5 mr-2 mt-0.5 text-gray-500" />
                                        <div className="truncate max-w-[200px]">{pr.title}</div>
                                      </div>
                                    </td>
                                    <td className="px-3 py-2">
                                      <Badge className={
                                        pr.status === 'completed' ? 'bg-green-100 text-green-800' :
                                        pr.status === 'active' ? 'bg-blue-100 text-blue-800' :
                                        'bg-gray-100 text-gray-800'
                                      }>
                                        {pr.status}
                                      </Badge>
                                    </td>
                                    <td className="px-3 py-2">{pr.createdBy}</td>
                                  </tr>
                                ))}
                                {(!repoDetails.pullRequests || repoDetails.pullRequests.length === 0) && (
                                  <tr>
                                    <td colSpan={3} className="px-3 py-4 text-center text-gray-500">
                                      No pull requests found
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 text-center text-gray-500">
                        Failed to load repository details
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};