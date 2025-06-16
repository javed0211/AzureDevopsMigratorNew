import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { VerticalTabs, VerticalTabsContent, VerticalTabsList, VerticalTabsTrigger } from "@/components/ui/tabs";
import { CustomField, User, MigrationSummary } from "./types";

interface MetadataTabProps {
  customFields: CustomField[];
  users: User[];
  summary: MigrationSummary;
  startExtraction: (artifactType: string) => Promise<void>;
}

export function MetadataTab({ customFields, users, summary, startExtraction }: MetadataTabProps) {
  const [activeSection, setActiveSection] = useState("customfields");

  return (
    <div className="grid grid-cols-1 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-100 p-4 rounded-lg">
              <div className="text-3xl font-bold">{customFields.length}</div>
              <div className="text-sm text-gray-500">Custom Fields</div>
            </div>
            <div className="bg-gray-100 p-4 rounded-lg">
              <div className="text-3xl font-bold">{users.length}</div>
              <div className="text-sm text-gray-500">Users</div>
            </div>
          </div>

          <VerticalTabs value={activeSection} onValueChange={setActiveSection} className="flex border rounded-md">
            <div className="flex">
              <VerticalTabsList className="w-48 border-r">
                <VerticalTabsTrigger value="customfields">Custom Fields</VerticalTabsTrigger>
                <VerticalTabsTrigger value="users">Users</VerticalTabsTrigger>
              </VerticalTabsList>
              
              <div className="flex-1 p-4 overflow-auto">
                <VerticalTabsContent value="customfields">
                  <h3 className="text-lg font-semibold mb-4">Custom Fields</h3>
                  {customFields.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No custom fields have been extracted yet.</p>
                      {!summary.extractionStatus.metadata && (
                        <Button className="mt-4" onClick={() => startExtraction("metadata")}>
                          Extract Metadata
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Reference Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Usage Count</TableHead>
                            <TableHead>Work Item Types</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customFields.map((field) => (
                            <TableRow key={field.id}>
                              <TableCell>{field.name}</TableCell>
                              <TableCell>{field.referenceName}</TableCell>
                              <TableCell>{field.type}</TableCell>
                              <TableCell>{field.usage}</TableCell>
                              <TableCell>{field.workItemTypes.join(", ")}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </VerticalTabsContent>

                <VerticalTabsContent value="users">
                  <h3 className="text-lg font-semibold mb-4">Users</h3>
                  {users.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No users have been extracted yet.</p>
                      {!summary.extractionStatus.metadata && (
                        <Button className="mt-4" onClick={() => startExtraction("metadata")}>
                          Extract Metadata
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Display Name</TableHead>
                            <TableHead>Username</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Work Item Count</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {users.map((user) => (
                            <TableRow key={user.id}>
                              <TableCell>{user.displayName}</TableCell>
                              <TableCell>{user.uniqueName}</TableCell>
                              <TableCell>{user.email || "-"}</TableCell>
                              <TableCell>{user.workItemCount}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </VerticalTabsContent>
              </div>
            </div>
          </VerticalTabs>
        </CardContent>
      </Card>
    </div>
  );
}