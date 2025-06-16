import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { VerticalTabs, VerticalTabsContent, VerticalTabsList, VerticalTabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { api } from "@/lib/api";

// Import types
import { 
  MigrationSummary, 
  WorkItem, 
  AreaPath, 
  IterationPath, 
  CustomField, 
  User 
} from "@/components/migration-summary/types";

// Import tab components
import { SummaryTab } from "@/components/migration-summary/SummaryTab";
import { WorkItemsTab } from "@/components/migration-summary/WorkItemsTab";
import { AreaPathsTab } from "@/components/migration-summary/AreaPathsTab";
import { IterationPathsTab } from "@/components/migration-summary/IterationPathsTab";
import { RepositoriesTab } from "@/components/migration-summary/RepositoriesTab";
import { MetadataTab } from "@/components/migration-summary/MetadataTab";
import { UsersTab } from "@/components/migration-summary/UsersTab";

export default function MigrationSummaryPage() {
  const [match, params] = useRoute("/projects/:projectId/migration-summary");
  const projectId = match ? Number(params?.projectId) : null;
  const [location, setLocation] = useLocation();
  const [summary, setSummary] = useState<MigrationSummary | null>(null);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [areaPaths, setAreaPaths] = useState<AreaPath[]>([]);
  const [iterationPaths, setIterationPaths] = useState<IterationPath[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get tab from URL query parameter
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const tabFromUrl = urlParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabFromUrl || "summary");

  useEffect(() => {
    if (!projectId) {
      setError("Invalid project ID");
      setLoading(false);
      return;
    }

    const fetchSummary = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await apiRequest("GET", `/api/projects/${projectId}/migration-summary`);
        
        if (!response.ok) {
          const errorMessage = `Failed to fetch migration summary: ${response.status} ${response.statusText}`;
          console.error(errorMessage);
          setError(errorMessage);
          setLoading(false);
          return;
        }
        
        const data = await response.json();
        if (!data) {
          setError("No data returned from server");
          setLoading(false);
          return;
        }
        
        setSummary(data);
        
        // If workitems tab is active, fetch work items
        if (activeTab === "workitems") {
          fetchWorkItems();
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        console.error("Failed to fetch migration summary:", error);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [projectId, activeTab]);

  const fetchWorkItems = async () => {
    if (!projectId) return;
    try {
      const response = await apiRequest("GET", `/api/projects/${projectId}/workitems`);
      
      if (!response.ok) {
        console.error(`Failed to fetch work items: ${response.status} ${response.statusText}`);
        return;
      }
      
      const data = await response.json();
      if (data && data.workItems) {
        setWorkItems(data.workItems);
      } else {
        console.error("Work items data is not in the expected format:", data);
        setWorkItems([]);
      }
    } catch (error) {
      console.error("Failed to fetch work items:", error);
      setWorkItems([]);
    }
  };

  const fetchAreaPaths = async () => {
    if (!projectId) return;
    try {
      const data = await apiRequest("GET", `/api/projects/${projectId}/areapaths`).then(res => res.json());
      setAreaPaths(data.areaPaths);
    } catch (error) {
      console.error("Failed to fetch area paths:", error);
    }
  };

  const fetchIterationPaths = async () => {
    if (!projectId) return;
    try {
      const data = await apiRequest("GET", `/api/projects/${projectId}/iterationpaths`).then(res => res.json());
      setIterationPaths(data.iterationPaths);
    } catch (error) {
      console.error("Failed to fetch iteration paths:", error);
    }
  };

  const fetchCustomFields = async () => {
    if (!projectId) return;
    try {
      const data = await apiRequest("GET", `/api/projects/${projectId}/customfields`).then(res => res.json());
      setCustomFields(data.customFields);
    } catch (error) {
      console.error("Failed to fetch custom fields:", error);
    }
  };

  const fetchUsers = async () => {
    if (!projectId) return;
    try {
      const data = await apiRequest("GET", `/api/projects/${projectId}/users`).then(res => res.json());
      setUsers(data.users);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    
    // Update URL with the tab parameter
    setLocation(`/projects/${projectId}/migration-summary?tab=${value}`, { replace: true });
    
    // Load data for the selected tab if not already loaded
    if (value === "workitems" && workItems.length === 0) {
      fetchWorkItems();
    } else if (value === "areapaths" && areaPaths.length === 0) {
      fetchAreaPaths();
    } else if (value === "iterationpaths" && iterationPaths.length === 0) {
      fetchIterationPaths();
    } else if (value === "metadata") {
      if (customFields.length === 0) {
        fetchCustomFields();
      }
      if (users.length === 0) {
        fetchUsers();
      }
    } else if (value === "users" && users.length === 0) {
      fetchUsers();
    }
  };

  const startExtraction = async (artifactType: string) => {
    if (!projectId) return;
    try {
      await api.extraction.startJob(projectId, artifactType);
      alert(`Started extraction of ${artifactType}`);
    } catch (error) {
      console.error(`Failed to start ${artifactType} extraction:`, error);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4">Loading migration summary...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Project Not Found</h2>
          <p className="mt-2">Could not find migration summary for this project.</p>
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700 max-w-md mx-auto">
              <p className="font-semibold">Error:</p>
              <p>{error}</p>
            </div>
          )}
          <Button className="mt-4" onClick={() => setLocation("/")}>
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">{summary.projectName}</h1>
          <p className="text-gray-500">Migration Summary</p>
        </div>
        <Button onClick={() => setLocation("/")}>Back to Projects</Button>
      </div>

      <div className="flex">
        <VerticalTabs value={activeTab} onValueChange={handleTabChange} className="flex w-full">
          <div className="flex">
            <VerticalTabsList className="border-r">
              <VerticalTabsTrigger value="summary">Summary</VerticalTabsTrigger>
              <VerticalTabsTrigger value="metadata">Metadata</VerticalTabsTrigger>
              <VerticalTabsTrigger value="workitems">Work Items</VerticalTabsTrigger>
              <VerticalTabsTrigger value="areapaths">Area Paths</VerticalTabsTrigger>
              <VerticalTabsTrigger value="iterationpaths">Iteration Paths</VerticalTabsTrigger>
              <VerticalTabsTrigger value="repositories">Repositories</VerticalTabsTrigger>
              <VerticalTabsTrigger value="users">Users</VerticalTabsTrigger>
            </VerticalTabsList>
            <div className="flex-1 overflow-auto max-h-[calc(100vh-200px)]">
              <VerticalTabsContent value="summary">
                <SummaryTab summary={summary} startExtraction={startExtraction} />
              </VerticalTabsContent>

              <VerticalTabsContent value="workitems">
                <WorkItemsTab workItems={workItems} summary={summary} startExtraction={startExtraction} />
              </VerticalTabsContent>

              <VerticalTabsContent value="areapaths">
                <AreaPathsTab areaPaths={areaPaths} summary={summary} startExtraction={startExtraction} />
              </VerticalTabsContent>

              <VerticalTabsContent value="iterationpaths">
                <IterationPathsTab iterationPaths={iterationPaths} summary={summary} startExtraction={startExtraction} />
              </VerticalTabsContent>

              <VerticalTabsContent value="metadata">
                <MetadataTab 
                  customFields={customFields} 
                  users={users} 
                  summary={summary} 
                  startExtraction={startExtraction} 
                />
              </VerticalTabsContent>

              <VerticalTabsContent value="repositories">
                <RepositoriesTab summary={summary} startExtraction={startExtraction} />
              </VerticalTabsContent>

              <VerticalTabsContent value="users">
                <UsersTab users={users} summary={summary} startExtraction={startExtraction} />
              </VerticalTabsContent>
            </div>
          </div>
        </VerticalTabs>
      </div>
    </div>
  );
}