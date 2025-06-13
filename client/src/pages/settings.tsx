import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { TestTube, Save, Plus, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type AdoConnection = {
  id: number;
  name: string;
  organization: string;
  patToken?: string;
  type: "source" | "target";
  isActive: boolean;
};


export default function Settings() {
  const { toast } = useToast();
  const [connectionTesting, setConnectionTesting] = useState(false);
  const [sourceConnectionStatus, setSourceConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');
  const [targetConnectionStatus, setTargetConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [newConnection, setNewConnection] = useState({ name: '', organization: '', patToken: '' });
  const [showAddDialog, setShowAddDialog] = useState(false);


  const [adoSettings, setAdoSettings] = useState({
    sourceOrg: "",
    sourcePat: "",
    targetOrg: "",
    targetPat: "",
    sourceDisplayName: "",
    targetDisplayName: "",
  });

  const [migrationSettings, setMigrationSettings] = useState({
    includeWorkItems: true,
    includeRepositories: true,
    includeTestCases: true,
    includePipelines: true,
    preserveHistory: true,
    migrateAttachments: true,
  });

  // ✅ Fix: Use proper type for useQuery
  const { data: connections = [] } = useQuery<AdoConnection[]>({
    queryKey: ['/api/connections'],
  });

  const [adoConnections, setAdoConnections] = useState<AdoConnection[]>([]);

  // Populate from DB on mount
  useEffect(() => {
    if (connections.length > 0) {
      setAdoConnections(connections);
    }
  }, [connections]);

  const handleUpdateConnection = (index: number, field: keyof AdoConnection, value: string | boolean) => {
    const updated = [...adoConnections];
    updated[index][field] = value as never;
    setAdoConnections(updated);
  };

  const handleAddConnection = () => {
    setAdoConnections(prev => [
      ...prev,
      { id: Date.now(), name: '', organization: '', type: 'source', isActive: true },
    ]);
  };


  useEffect(() => {
    if (connections.length > 0) {
      const sourceConn = connections.find((c) => c.type === 'source');
      const targetConn = connections.find((c) => c.type === 'target');

      if (sourceConn) {
        setAdoSettings(prev => ({
          ...prev,
          sourceOrg: sourceConn.organization || "",
          sourcePat: "",
          sourceDisplayName: sourceConn.name || "",
        }));
        setSourceConnectionStatus('connected');
      }

      if (targetConn) {
        setAdoSettings(prev => ({
          ...prev,
          targetOrg: targetConn.organization || "",
          targetPat: "",
          targetDisplayName: targetConn.name || "",
        }));
        setTargetConnectionStatus('connected');
      }
    }
  }, [connections]);


  const saveConnectionMutation = useMutation({
    mutationFn: async (connectionData: any) => {
      const response = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(connectionData),
      });
      if (!response.ok) throw new Error('Failed to save connection');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
      toast({
        title: "Connection Saved",
        description: "Azure DevOps connection details saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save connection details.",
        variant: "destructive",
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async ({ organization, patToken }: { organization: string; patToken: string }) => {
      const response = await fetch('/api/connections/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization, patToken }),
      });
      if (!response.ok) throw new Error('Connection test failed');
      return response.json();
    },
    onSuccess: (_data, variables) => {
      setAdoConnections(prev => prev.map(conn => {
        if (conn.organization === variables.organization) {
          return { ...conn, isActive: true }; 
        }
        return conn;
      }));

      toast({
        title: "Connection Test Successful",
        description: `Connection is working properly.`,
      });
    },
    onError: (error: any, variables) => {
      setAdoConnections(prev => prev.map(conn => {
        if (conn.organization === variables.organization) {
          return { ...conn, isActive: false };
        }
        return conn;
      }));
    
      toast({
        title: "Connection Test Failed",
        description: error.message || "Unable to connect to Azure DevOps.",
        variant: "destructive",
      });
    },
  });

  const handleTestConnection = async (type: 'source' | 'target') => {
    const organization = type === 'source' ? adoSettings.sourceOrg : adoSettings.targetOrg;
    const patToken = type === 'source' ? adoSettings.sourcePat : adoSettings.targetPat;

    if (!organization || !patToken) {
      toast({
        title: "Missing Information",
        description: "Please enter both organization URL and PAT token.",
        variant: "destructive",
      });
      return;
    }

    testConnectionMutation.mutate({ organization, patToken });
  };

  const handleSaveAllConnections = async () => {
    for (const conn of adoConnections) {
      await saveConnectionMutation.mutateAsync({
        name: conn.name,
        organization: conn.organization,
        patToken: conn.patToken,
        type: conn.type,
        isActive: conn.isActive,
      });
    }
  };


  const handleSave = async () => {
    const hasSource = adoSettings.sourceOrg && adoSettings.sourcePat;
    const hasTarget = adoSettings.targetOrg && adoSettings.targetPat;

    if (!hasSource && !hasTarget) {
      toast({
        title: "No Data to Save",
        description: "Please enter at least one connection configuration.",
        variant: "destructive",
      });
      return;
    }

    if (hasSource) {
      await saveConnectionMutation.mutateAsync({
        name: adoSettings.sourceDisplayName || "Source Organization",
        organization: adoSettings.sourceOrg,
        patToken: adoSettings.sourcePat,
        type: 'source',
        isActive: true,
      });
    }

    if (hasTarget) {
      await saveConnectionMutation.mutateAsync({
        name: adoSettings.targetDisplayName || "Target Organization",
        organization: adoSettings.targetOrg,
        patToken: adoSettings.targetPat,
        type: 'target',
        isActive: true,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Settings</h2>
        <Button onClick={handleSaveAllConnections}><Save className="h-4 w-4 mr-2" /> Save All</Button>
      </div>

      <Tabs defaultValue="connections" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="connections">ADO Connection</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="migration">Migration Options</TabsTrigger>
          <TabsTrigger value="logging">Logging</TabsTrigger>
        </TabsList>

        <TabsContent value="connections" className="space-y-6">
          <div className="flex justify-start">
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> Add ADO Connection</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add ADO Connection</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Display Name"
                    value={newConnection.name}
                    onChange={(e) => setNewConnection({ ...newConnection, name: e.target.value })}
                  />
                  <Input
                    placeholder="Organization URL"
                    value={newConnection.organization}
                    onChange={(e) => setNewConnection({ ...newConnection, organization: e.target.value })}
                  />
                  <Input
                    placeholder="Personal Access Token"
                    type="password"
                    value={newConnection.patToken}
                    onChange={(e) => setNewConnection({ ...newConnection, patToken: e.target.value })}
                  />
                  <Button
                    disabled={!newConnection.organization || !newConnection.patToken}
                    onClick={() => testConnectionMutation.mutate({
                      organization: newConnection.organization,
                      patToken: newConnection.patToken || ''
                    })}
                    variant="outline"
                    className="w-full"
                  >
                    <TestTube className="h-4 w-4 mr-2" /> Test Connection
                  </Button>
                  <Button
                    disabled={
                      !newConnection.name || !newConnection.organization || !newConnection.patToken
                    }
                    onClick={() => saveConnectionMutation.mutate({
                      name: newConnection.name,
                      organization: newConnection.organization,
                      patToken: newConnection.patToken || '',
                      type: 'source',
                      isActive: true,
                    })}
                    className="w-full"
                  >
                    Save Connection
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Name</th>
                  <th className="text-left p-2">Organization</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {adoConnections.map((conn, index) => (
                  <tr key={conn.id} className="border-b">
                    <td className="p-2">{conn.name}</td>
                    <td className="p-2">{conn.organization}</td>
                    <td className="p-2">
                      <Badge className={conn.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                        {conn.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <Button variant="outline" size="sm" onClick={() => setEditIndex(index)}>
                        <Pencil className="h-4 w-4 mr-1" /> Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editIndex !== null && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card key={adoConnections[editIndex].id}>
                <CardHeader>
                  <CardTitle>Edit ADO Connection</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    placeholder="Display Name"
                    value={adoConnections[editIndex].name}
                    onChange={(e) => handleUpdateConnection(editIndex, "name", e.target.value)}
                  />
                  <Input
                    placeholder="Organization URL"
                    value={adoConnections[editIndex].organization}
                    onChange={(e) => handleUpdateConnection(editIndex, "organization", e.target.value)}
                  />
                  <Input
                    placeholder="Personal Access Token"
                    type="password"
                    value={adoConnections[editIndex].patToken || ''}
                    onChange={(e) => handleUpdateConnection(editIndex, "patToken", e.target.value)}
                  />

                  <div className="flex gap-4">
                    <Button
                      onClick={() => testConnectionMutation.mutate({
                        organization: adoConnections[editIndex].organization,
                        patToken: adoConnections[editIndex].patToken || ''
                      })}
                      variant="outline"
                    >
                      <TestTube className="h-4 w-4 mr-2" /> Test Connection
                    </Button>

                    <Button
                      onClick={() => {
                        saveConnectionMutation.mutate({
                          name: adoConnections[editIndex].name,
                          organization: adoConnections[editIndex].organization,
                          patToken: adoConnections[editIndex].patToken || '',
                          type: adoConnections[editIndex].type || 'source',
                          isActive: true,
                        });
                        setEditIndex(null); // ✅ Close form after save
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Save Changes
                    </Button>

                    <Button
                      variant="ghost"
                      onClick={() => setEditIndex(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>

            </div>
          )}
        </TabsContent>


        <TabsContent value="storage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Database Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="db-type">Database Type</Label>
                <Select defaultValue="mongodb">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mongodb">MongoDB</SelectItem>
                    <SelectItem value="postgresql">PostgreSQL</SelectItem>
                    <SelectItem value="sqlite">SQLite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="connection-string">Connection String</Label>
                <Input
                  id="connection-string"
                  placeholder="mongodb://localhost:27017/ado-migration"
                  defaultValue="mongodb://localhost:27017/ado-migration"
                />
              </div>
              <Button variant="outline">
                <TestTube className="h-4 w-4 mr-2" />
                Test Database Connection
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="migration" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Migration Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="include-work-items">Include Work Items</Label>
                    <p className="text-sm text-gray-500">Migrate all work items including history and attachments</p>
                  </div>
                  <Switch
                    id="include-work-items"
                    checked={migrationSettings.includeWorkItems}
                    onCheckedChange={(checked) =>
                      setMigrationSettings({ ...migrationSettings, includeWorkItems: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="include-repos">Include Repositories</Label>
                    <p className="text-sm text-gray-500">Migrate Git repositories with full history</p>
                  </div>
                  <Switch
                    id="include-repos"
                    checked={migrationSettings.includeRepositories}
                    onCheckedChange={(checked) =>
                      setMigrationSettings({ ...migrationSettings, includeRepositories: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="include-test-cases">Include Test Cases</Label>
                    <p className="text-sm text-gray-500">Migrate test plans, suites, and test cases</p>
                  </div>
                  <Switch
                    id="include-test-cases"
                    checked={migrationSettings.includeTestCases}
                    onCheckedChange={(checked) =>
                      setMigrationSettings({ ...migrationSettings, includeTestCases: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="include-pipelines">Include Pipelines</Label>
                    <p className="text-sm text-gray-500">Migrate build and release pipelines</p>
                  </div>
                  <Switch
                    id="include-pipelines"
                    checked={migrationSettings.includePipelines}
                    onCheckedChange={(checked) =>
                      setMigrationSettings({ ...migrationSettings, includePipelines: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="preserve-history">Preserve History</Label>
                    <p className="text-sm text-gray-500">Maintain original timestamps and audit trail</p>
                  </div>
                  <Switch
                    id="preserve-history"
                    checked={migrationSettings.preserveHistory}
                    onCheckedChange={(checked) =>
                      setMigrationSettings({ ...migrationSettings, preserveHistory: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="migrate-attachments">Migrate Attachments</Label>
                    <p className="text-sm text-gray-500">Include file attachments and links</p>
                  </div>
                  <Switch
                    id="migrate-attachments"
                    checked={migrationSettings.migrateAttachments}
                    onCheckedChange={(checked) =>
                      setMigrationSettings({ ...migrationSettings, migrateAttachments: checked })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logging" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Logging Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="log-level">Log Level</Label>
                <Select defaultValue="info">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debug">Debug</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warn">Warning</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="log-directory">Output Directory</Label>
                <Input
                  id="log-directory"
                  placeholder="./logs"
                  defaultValue="./logs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-log-size">Maximum Log File Size (MB)</Label>
                <Input
                  id="max-log-size"
                  type="number"
                  placeholder="100"
                  defaultValue="100"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
