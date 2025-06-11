import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { toast } = useToast();
  const [adoSettings, setAdoSettings] = useState({
    sourceOrg: "",
    sourcePat: "",
    targetOrg: "",
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

  const handleSave = () => {
    toast({
      title: "Settings Saved",
      description: "Your configuration has been saved successfully.",
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="connections" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="connections">ADO Connection</TabsTrigger>
            <TabsTrigger value="storage">Storage</TabsTrigger>
            <TabsTrigger value="migration">Migration Options</TabsTrigger>
            <TabsTrigger value="logging">Logging</TabsTrigger>
          </TabsList>
          
          <TabsContent value="connections" className="space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Source Organization</h3>
                <div className="space-y-2">
                  <Label htmlFor="source-org">Organization URL</Label>
                  <Input
                    id="source-org"
                    placeholder="https://dev.azure.com/your-org"
                    value={adoSettings.sourceOrg}
                    onChange={(e) => setAdoSettings({ ...adoSettings, sourceOrg: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="source-pat">Personal Access Token</Label>
                  <Input
                    id="source-pat"
                    type="password"
                    placeholder="Enter PAT token"
                    value={adoSettings.sourcePat}
                    onChange={(e) => setAdoSettings({ ...adoSettings, sourcePat: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Target Organization</h3>
                <div className="space-y-2">
                  <Label htmlFor="target-org">Organization URL</Label>
                  <Input
                    id="target-org"
                    placeholder="https://dev.azure.com/target-org"
                    value={adoSettings.targetOrg}
                    onChange={(e) => setAdoSettings({ ...adoSettings, targetOrg: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target-pat">Personal Access Token</Label>
                  <Input
                    id="target-pat"
                    type="password"
                    placeholder="Enter PAT token"
                    value={adoSettings.targetPat}
                    onChange={(e) => setAdoSettings({ ...adoSettings, targetPat: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="storage" className="space-y-4">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Database Configuration</h3>
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
                />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="migration" className="space-y-4">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Migration Options</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="include-work-items">Include Work Items</Label>
                  <Switch
                    id="include-work-items"
                    checked={migrationSettings.includeWorkItems}
                    onCheckedChange={(checked) => 
                      setMigrationSettings({ ...migrationSettings, includeWorkItems: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="include-repos">Include Repositories</Label>
                  <Switch
                    id="include-repos"
                    checked={migrationSettings.includeRepositories}
                    onCheckedChange={(checked) => 
                      setMigrationSettings({ ...migrationSettings, includeRepositories: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="include-test-cases">Include Test Cases</Label>
                  <Switch
                    id="include-test-cases"
                    checked={migrationSettings.includeTestCases}
                    onCheckedChange={(checked) => 
                      setMigrationSettings({ ...migrationSettings, includeTestCases: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="include-pipelines">Include Pipelines</Label>
                  <Switch
                    id="include-pipelines"
                    checked={migrationSettings.includePipelines}
                    onCheckedChange={(checked) => 
                      setMigrationSettings({ ...migrationSettings, includePipelines: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="preserve-history">Preserve History</Label>
                  <Switch
                    id="preserve-history"
                    checked={migrationSettings.preserveHistory}
                    onCheckedChange={(checked) => 
                      setMigrationSettings({ ...migrationSettings, preserveHistory: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="migrate-attachments">Migrate Attachments</Label>
                  <Switch
                    id="migrate-attachments"
                    checked={migrationSettings.migrateAttachments}
                    onCheckedChange={(checked) => 
                      setMigrationSettings({ ...migrationSettings, migrateAttachments: checked })
                    }
                  />
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="logging" className="space-y-4">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Logging Configuration</h3>
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
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-azure-blue hover:bg-azure-dark">
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
