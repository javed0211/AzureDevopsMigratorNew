import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Play, Pause, Square } from "lucide-react";

export default function Migration() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Migration</h2>
        <div className="flex items-center space-x-2">
          <Badge variant="outline">2 Projects Ready</Badge>
          <Button className="bg-azure-blue hover:bg-azure-dark">
            <Play className="h-4 w-4 mr-2" />
            Start Migration
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Source Organization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-gray-500">Organization</div>
                <div className="text-lg">contoso-source</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Base URL</div>
                <div className="text-sm text-gray-600">https://dev.azure.com/contoso-source</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Connection Status</div>
                <Badge className="bg-green-100 text-green-800">Connected</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Target Organization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-gray-500">Organization</div>
                <Select defaultValue="contoso-target">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contoso-target">contoso-target</SelectItem>
                    <SelectItem value="contoso-prod">contoso-prod</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Base URL</div>
                <div className="text-sm text-gray-600">https://dev.azure.com/contoso-target</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Connection Status</div>
                <Badge className="bg-green-100 text-green-800">Connected</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="queue" className="w-full">
        <TabsList>
          <TabsTrigger value="queue">Migration Queue</TabsTrigger>
          <TabsTrigger value="active">Active Migrations</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Customer Portal v2
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">Ready</Badge>
                  <Button size="sm" className="bg-azure-blue hover:bg-azure-dark">
                    <ArrowRight className="h-4 w-4 mr-1" />
                    Migrate
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Work Items</div>
                  <div className="font-medium">247</div>
                </div>
                <div>
                  <div className="text-gray-500">Repositories</div>
                  <div className="font-medium">12</div>
                </div>
                <div>
                  <div className="text-gray-500">Test Cases</div>
                  <div className="font-medium">89</div>
                </div>
                <div>
                  <div className="text-gray-500">Pipelines</div>
                  <div className="font-medium">15</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Mobile App Backend
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">Ready</Badge>
                  <Button size="sm" className="bg-azure-blue hover:bg-azure-dark">
                    <ArrowRight className="h-4 w-4 mr-1" />
                    Migrate
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Work Items</div>
                  <div className="font-medium">156</div>
                </div>
                <div>
                  <div className="text-gray-500">Repositories</div>
                  <div className="font-medium">8</div>
                </div>
                <div>
                  <div className="text-gray-500">Test Cases</div>
                  <div className="font-medium">45</div>
                </div>
                <div>
                  <div className="text-gray-500">Pipelines</div>
                  <div className="font-medium">12</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>No Active Migrations</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">No migrations are currently running.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed">
          <Card>
            <CardHeader>
              <CardTitle>Completed Migrations</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">No migrations have been completed yet.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
