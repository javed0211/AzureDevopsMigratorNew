import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { TestTube, Save } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const [connectionTesting, setConnectionTesting] = useState(false);
  
  const [adoSettings, setAdoSettings] = useState({
    sourceOrg: "https://dev.azure.com/contoso-source",
    sourcePat: "",
    targetOrg: "https://dev.azure.com/contoso-target",
    targetPat: "",
  });

  const [migrationSettings, setMigrationSettings] = useState({
    includeWorkItems: true,
    includeRepositories: true,
    includeTestCases: true,
    includePipelines: true,
    preserveHistory: true,
    migrateAttachments: true,
  });

  const handleTestConnection = async (type: 'source' | 'target') => {
    setConnectionTesting(true);
    
    // Simulate connection test
    setTimeout(() => {
      setConnectionTesting(false);
      toast({
        title: "Connection Test",
        description: `${type === 'source' ? 'Source' : 'Target'} connection test successful!`,
      });
    }, 2000);
  };

  const handleSave = () => {
    toast({
      title: "Settings Saved",
      description: "Your configuration has been saved successfully.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Settings</h2>
        <Button onClick={handleSave} className="bg-azure-blue hover:bg-azure-dark">
          <Save className="h-4 w-4 mr-2" />
          Save Settings
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
                  <Badge className="bg-green-100 text-green-800">Connected</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                  disabled={connectionTesting}
                  className="w-full"
                >
                  <TestTube className="h-4 w-4 mr-2" />
                  {connectionTesting ? "Testing..." : "Test Connection"}
                </Button>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Target Organization
                  <Badge className="bg-green-100 text-green-800">Connected</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                  disabled={connectionTesting}
                  className="w-full"
                >
                  <TestTube className="h-4 w-4 mr-2" />
                  {connectionTesting ? "Testing..." : "Test Connection"}
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
