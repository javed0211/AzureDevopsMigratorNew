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
import { TestTube, Save } from "lucide-react";

type AdoConnection = {
  id: number;
  name: string;
  organization: string;
  type: "source" | "target";
  isActive: boolean;
};

export default function Settings() {
  const { toast } = useToast();
  const [connectionTesting, setConnectionTesting] = useState(false);
  const [sourceConnectionStatus, setSourceConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');
  const [targetConnectionStatus, setTargetConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');

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
    onSuccess: (data, variables) => {
      const type = variables.organization === adoSettings.sourceOrg ? 'source' : 'target';
      if (type === 'source') {
        setSourceConnectionStatus('connected');
      } else {
        setTargetConnectionStatus('connected');
      }
      toast({
        title: "Connection Test Successful",
        description: `${type === 'source' ? 'Source' : 'Target'} connection is working properly.`,
      });
    },
    onError: (error: any, variables) => {
      const type = variables.organization === adoSettings.sourceOrg ? 'source' : 'target';
      if (type === 'source') {
        setSourceConnectionStatus('error');
      } else {
        setTargetConnectionStatus('error');
      }
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
        <Button
          onClick={handleSave}
          disabled={saveConnectionMutation.isPending}
          className="bg-azure-blue hover:bg-azure-dark"
        >
          <Save className="h-4 w-4 mr-2" />
          {saveConnectionMutation.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      <Tabs defaultValue="connections" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="connections">ADO Connection</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="migration">Migration Options</TabsTrigger>
          <TabsTrigger value="logging">Logging</TabsTrigger>
        </TabsList>

        <TabsContent value="connections" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Source Organization
                  <Badge className={
                    sourceConnectionStatus === 'connected' ? 'bg-green-100 text-green-800' :
                      sourceConnectionStatus === 'error' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                  }>
                    {sourceConnectionStatus === 'connected' ? 'Connected' :
                      sourceConnectionStatus === 'error' ? 'Error' : 'Not Configured'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="source-display-name">Display Name</Label>
                  <Input
                    id="source-display-name"
                    value={adoSettings.sourceDisplayName}
                    onChange={(e) => setAdoSettings({ ...adoSettings, sourceDisplayName: e.target.value })}
                    placeholder="Source Organization"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="source-org">Organization URL</Label>
                  <Input
                    id="source-org"
                    value={adoSettings.sourceOrg}
                    onChange={(e) => setAdoSettings({ ...adoSettings, sourceOrg: e.target.value })}
                    placeholder="https://dev.azure.com/your-org"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="source-pat">Personal Access Token</Label>
                  <Input
                    id="source-pat"
                    type="password"
                    value={adoSettings.sourcePat}
                    onChange={(e) => setAdoSettings({ ...adoSettings, sourcePat: e.target.value })}
                    placeholder="Enter PAT token"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => handleTestConnection('source')}
                  disabled={testConnectionMutation.isPending}
                  className="w-full"
                >
                  <TestTube className="h-4 w-4 mr-2" />
                  {testConnectionMutation.isPending ? "Testing..." : "Test Connection"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Target Organization
                  <Badge className={
                    targetConnectionStatus === 'connected' ? 'bg-green-100 text-green-800' :
                      targetConnectionStatus === 'error' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                  }>
                    {targetConnectionStatus === 'connected' ? 'Connected' :
                      targetConnectionStatus === 'error' ? 'Error' : 'Not Configured'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="target-display-name">Display Name</Label>
                  <Input
                    id="target-display-name"
                    value={adoSettings.targetDisplayName}
                    onChange={(e) => setAdoSettings({ ...adoSettings, targetDisplayName: e.target.value })}
                    placeholder="Target Organization"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target-org">Organization URL</Label>
                  <Input
                    id="target-org"
                    value={adoSettings.targetOrg}
                    onChange={(e) => setAdoSettings({ ...adoSettings, targetOrg: e.target.value })}
                    placeholder="https://dev.azure.com/target-org"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target-pat">Personal Access Token</Label>
                  <Input
                    id="target-pat"
                    type="password"
                    value={adoSettings.targetPat}
                    onChange={(e) => setAdoSettings({ ...adoSettings, targetPat: e.target.value })}
                    placeholder="Enter PAT token"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => handleTestConnection('target')}
                  disabled={testConnectionMutation.isPending}
                  className="w-full"
                >
                  <TestTube className="h-4 w-4 mr-2" />
                  {testConnectionMutation.isPending ? "Testing..." : "Test Connection"}
                </Button>
              </CardContent>
            </Card>
          </div>
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
