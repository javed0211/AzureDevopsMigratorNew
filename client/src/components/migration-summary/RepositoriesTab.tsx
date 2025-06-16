import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MigrationSummary } from "./types";

interface RepositoriesTabProps {
  summary: MigrationSummary;
  startExtraction: (artifactType: string) => Promise<void>;
}

export function RepositoriesTab({ summary, startExtraction }: RepositoriesTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Repositories</CardTitle>
      </CardHeader>
      <CardContent>
        {summary.repositories.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No repositories have been extracted yet.</p>
            {!summary.extractionStatus.repositories && (
              <Button className="mt-4" onClick={() => startExtraction("repositories")}>
                Extract Repositories
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Default Branch</TableHead>
                  <TableHead>Branch Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.repositories.map((repo) => (
                  <TableRow key={repo.id}>
                    <TableCell>{repo.name}</TableCell>
                    <TableCell>{repo.defaultBranch}</TableCell>
                    <TableCell>{repo.branchCount}</TableCell>
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