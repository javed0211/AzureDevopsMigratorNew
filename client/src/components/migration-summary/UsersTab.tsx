import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { User, MigrationSummary } from "./types";

interface UsersTabProps {
  users: User[];
  summary: MigrationSummary;
  startExtraction: (artifactType: string) => Promise<void>;
}

export function UsersTab({ users, summary, startExtraction }: UsersTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Users</CardTitle>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No users have been extracted yet.</p>
            {!summary.extractionStatus.users && (
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
      </CardContent>
    </Card>
  );
}