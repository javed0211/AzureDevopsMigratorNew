import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import NotFound from "@/pages/not-found";
import ProjectSelection from "@/pages/project-selection";
import ExtractionOverview from "@/pages/extraction-overview";
import Migration from "@/pages/migration";
import AuditLogs from "@/pages/audit-logs";
import Settings from "@/pages/settings";

import { AppHeader } from "@/components/layout/app-header";
import { NavigationTabs } from "@/components/layout/navigation-tabs";

function Router() {
  return (
    <Switch>
      <Route path="/" component={ProjectSelection} />
      <Route path="/extraction" component={ExtractionOverview} />
      <Route path="/migration" component={Migration} />
      <Route path="/audit" component={AuditLogs} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const handleRefresh = () => {
    queryClient.invalidateQueries();
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-gray-50">
          <AppHeader 
            onRefresh={handleRefresh}
            connectionStatus={true}
          />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <NavigationTabs />
            <Router />
          </div>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
