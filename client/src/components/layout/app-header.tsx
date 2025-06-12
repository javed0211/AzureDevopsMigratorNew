import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Settings } from "lucide-react";
import { Cloud } from "lucide-react";
import { Link } from "wouter"; // 👈 Make sure this is imported

interface AppHeaderProps {
  onRefresh: () => void;
  connectionStatus: boolean;
}

export function AppHeader({ onRefresh, connectionStatus }: AppHeaderProps) {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Cloud className="text-azure-blue text-2xl" />
              <h1 className="text-xl font-semibold text-gray-900">Azure DevOps Migration Tool</h1>
            </div>
            <Badge variant={connectionStatus ? "default" : "secondary"} className={connectionStatus ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}>
              <div className={`w-2 h-2 rounded-full mr-1 ${connectionStatus ? "bg-green-400" : "bg-gray-400"}`} />
              {connectionStatus ? "Connected" : "Disconnected"}
            </Badge>
          </div>

          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              className="text-gray-400 hover:text-gray-600"
            >
              <RefreshCw className="h-4 w-4" /> Refresh Data
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
