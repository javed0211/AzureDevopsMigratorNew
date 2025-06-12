import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ExtractionPreviewModal } from "@/components/modals/extraction-preview-modal";
import { Eye, Settings, Download, Settings2, CheckCircle, ChartGantt, Clock, ChevronLeft, ChevronRight, Cloud } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { Project } from "@shared/schema";

export default function ProjectSelection() {
  const [selectedProjects, setSelectedProjects] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [processFilter, setProcessFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [previewProject, setPreviewProject] = useState<Project | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch statistics
  const { data: statistics } = useQuery<{
    totalProjects: number;
    selectedProjects: number;
    inProgressProjects: number;
    migratedProjects: number;
  }>({
    queryKey: ["/api/statistics"],
    refetchInterval: 5000,
  });

  // Fetch projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    refetchInterval: 5000,
  });

  // Sync projects mutation
  const syncProjectsMutation = useMutation({
    mutationFn: () => api.projects.sync(1), // Using default connection ID
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });
      toast({
        title: "Projects Synced",
        description: "Projects have been synchronized from Azure DevOps.",
      });
    },
    onError: () => {
      toast({
        title: "Sync Failed",
        description: "Failed to synchronize projects from Azure DevOps.",
        variant: "destructive",
      });
    },
  });

  // Bulk select mutation
  const bulkSelectMutation = useMutation({
    mutationFn: ({ projectIds, status }: { projectIds: number[], status: string }) =>
      api.projects.bulkSelect(projectIds, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });
      toast({
        title: "Projects Updated",
        description: "Selected projects have been updated.",
      });
    },
  });

  // Initialize projects on component mount
  useEffect(() => {
    if (projects.length === 0) {
      syncProjectsMutation.mutate();
    }
  }, []);

  // Filter projects
  const filteredProjects = projects.filter((project: Project) => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (project.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesProcess = processFilter === "all" || project.processTemplate.toLowerCase() === processFilter.toLowerCase();
    const matchesVisibility = visibilityFilter === "all" || project.visibility.toLowerCase() === visibilityFilter.toLowerCase();
    
    return matchesSearch && matchesProcess && matchesVisibility;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProjects(filteredProjects.map((p: Project) => p.id));
    } else {
      setSelectedProjects([]);
    }
  };

  const handleSelectProject = (projectId: number, checked: boolean) => {
    if (checked) {
      setSelectedProjects([...selectedProjects, projectId]);
    } else {
      setSelectedProjects(selectedProjects.filter(id => id !== projectId));
    }
  };

  const handlePreviewProject = (project: Project) => {
    setPreviewProject(project);
    setShowPreviewModal(true);
  };

  const handleStartExtraction = () => {
    if (selectedProjects.length === 0) {
      toast({
        title: "No Projects Selected",
        description: "Please select at least one project to extract.",
        variant: "destructive",
      });
      return;
    }

    bulkSelectMutation.mutate({
      projectIds: selectedProjects,
      status: "selected"
    });
  };

  const handleConfirmExtraction = () => {
    if (previewProject) {
      bulkSelectMutation.mutate({
        projectIds: [previewProject.id],
        status: "extracting"
      });
    }
    setShowPreviewModal(false);
    setPreviewProject(null);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      ready: { color: "bg-green-100 text-green-800", icon: "🟢", label: "Ready" },
      selected: { color: "bg-blue-100 text-blue-800", icon: "🔵", label: "Selected" },
      extracting: { color: "bg-orange-100 text-orange-800", icon: "🟠", label: "Extracting" },
      extracted: { color: "bg-purple-100 text-purple-800", icon: "🟣", label: "Extracted" },
      migrating: { color: "bg-yellow-100 text-yellow-800", icon: "🟡", label: "Migrating" },
      migrated: { color: "bg-green-100 text-green-800", icon: "🟢", label: "Migrated" },
      error: { color: "bg-red-100 text-red-800", icon: "🔴", label: "Error" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.ready;
    return (
      <Badge className={`${config.color} hover:${config.color}`}>
        <span className="mr-1">{config.icon}</span>
        {config.label}
      </Badge>
    );
  };

  const getProcessTemplateBadge = (template: string) => {
    const colors = {
      agile: "bg-blue-100 text-blue-800",
      scrum: "bg-purple-100 text-purple-800",
      cmmi: "bg-green-100 text-green-800",
    };
    const color = colors[template.toLowerCase() as keyof typeof colors] || "bg-gray-100 text-gray-800";
    return <Badge className={`${color} hover:${color}`}>{template}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartGantt className="text-azure-blue text-2xl" />
              </div>
              <div className="ml-4">
                <dt className="text-sm font-medium text-gray-500">Total Projects</dt>
                <dd className="text-2xl font-semibold text-gray-900">
                  {statistics?.totalProjects || 0}
                </dd>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="text-green-500 text-2xl" />
              </div>
              <div className="ml-4">
                <dt className="text-sm font-medium text-gray-500">Selected</dt>
                <dd className="text-2xl font-semibold text-gray-900">
                  {statistics?.selectedProjects || 0}
                </dd>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Clock className="text-orange-500 text-2xl" />
              </div>
              <div className="ml-4">
                <dt className="text-sm font-medium text-gray-500">In Progress</dt>
                <dd className="text-2xl font-semibold text-gray-900">
                  {statistics?.inProgressProjects || 0}
                </dd>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Download className="text-azure-blue text-2xl" />
              </div>
              <div className="ml-4">
                <dt className="text-sm font-medium text-gray-500">Migrated</dt>
                <dd className="text-2xl font-semibold text-gray-900">
                  {statistics?.migratedProjects || 0}
                </dd>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 mb-6">
            <div className="flex-1 min-w-0">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Eye className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Select value={processFilter} onValueChange={setProcessFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Process Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Process Types</SelectItem>
                  <SelectItem value="agile">Agile</SelectItem>
                  <SelectItem value="scrum">Scrum</SelectItem>
                  <SelectItem value="cmmi">CMMI</SelectItem>
                </SelectContent>
              </Select>
              <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Visibility</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Projects Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="relative px-6 py-3 text-left">
                    <Checkbox
                      checked={selectedProjects.length === filteredProjects.length && filteredProjects.length > 0}
                      onCheckedChange={handleSelectAll}
                      className="text-azure-blue focus:ring-azure-blue"
                    />
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Process Template
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source Control
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProjects.map((project: Project) => (
                  <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Checkbox
                        checked={selectedProjects.includes(project.id)}
                        onCheckedChange={(checked) => handleSelectProject(project.id, checked as boolean)}
                        className="text-azure-blue focus:ring-azure-blue"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Cloud className="text-azure-blue mr-3 text-lg" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{project.name}</div>
                          <div className="text-sm text-gray-500">{project.description}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getProcessTemplateBadge(project.processTemplate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {project.sourceControl}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {project.createdDate ? new Date(project.createdDate).toLocaleDateString() : "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(project.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePreviewProject(project)}
                        className="text-azure-blue hover:text-azure-dark mr-3"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <Button variant="outline" size="sm">
                Previous
              </Button>
              <Button variant="outline" size="sm" className="ml-3">
                Next
              </Button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">1</span> to{" "}
                  <span className="font-medium">{Math.min(10, filteredProjects.length)}</span> of{" "}
                  <span className="font-medium">{filteredProjects.length}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <Button variant="outline" size="sm" className="rounded-l-md">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="bg-azure-blue text-white border-azure-blue">
                    1
                  </Button>
                  <Button variant="outline" size="sm">
                    2
                  </Button>
                  <Button variant="outline" size="sm">
                    3
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-r-md">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </nav>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Panel */}
      {selectedProjects.length > 0 && (
        <Card className="bg-azure-blue text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <CheckCircle className="text-2xl" />
                <div>
                  <h3 className="text-lg font-medium">
                    {selectedProjects.length} Project{selectedProjects.length === 1 ? "" : "s"} Selected
                  </h3>
                  <p className="text-blue-100">Ready to extract project data and begin migration process</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  className="border-white/20 text-white bg-white/10 hover:bg-white/20"
                >
                  <Settings2 className="h-4 w-4 mr-2" />
                  Bulk Settings
                </Button>
                <Button
                  onClick={handleStartExtraction}
                  disabled={bulkSelectMutation.isPending}
                  className="bg-white text-azure-blue hover:bg-gray-50"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {bulkSelectMutation.isPending ? "Processing..." : "Start Extraction"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Extraction Preview Modal */}
      <ExtractionPreviewModal
        isOpen={showPreviewModal}
        onClose={() => {
          setShowPreviewModal(false);
          setPreviewProject(null);
        }}
        onConfirm={handleConfirmExtraction}
        project={previewProject}
      />
    </div>
  );
}
