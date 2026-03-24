import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUser } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { WorkspaceSetupDialog } from "@/components/WorkspaceSetupDialog";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Departments from "@/pages/Departments";
import Classrooms from "@/pages/Classrooms";
import Faculty from "@/pages/Faculty";
import Timetable from "@/pages/Timetable";
import Subjects from "@/pages/Subjects";
import Sections from "@/pages/Sections";
import TimeSlots from "@/pages/TimeSlots";
import ReferralPage from "@/pages/ReferralPage";
import RequestsPage from "@/pages/RequestsPage";

function ProtectedRoute({ component: Component }) {
  const { user, isLoading } = useUser();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return <div className="h-screen w-full flex items-center justify-center"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
  }

  if (!user) {
    setLocation("/login");
    return null;
  }

  // Show workspace setup if user has no workspace
  if (!user.workspace) {
    return <WorkspaceSetupDialog />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      <Route path="/">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/departments">
        <ProtectedRoute component={Departments} />
      </Route>
      <Route path="/classrooms">
        <ProtectedRoute component={Classrooms} />
      </Route>
      <Route path="/faculty">
        <ProtectedRoute component={Faculty} />
      </Route>
      <Route path="/timetable">
        <ProtectedRoute component={Timetable} />
      </Route>
      <Route path="/subjects">
        <ProtectedRoute component={Subjects} />
      </Route>
      <Route path="/sections">
        <ProtectedRoute component={Sections} />
      </Route>
      <Route path="/timeslots">
        <ProtectedRoute component={TimeSlots} />
      </Route>
      <Route path="/referral">
        <ProtectedRoute component={ReferralPage} />
      </Route>
      <Route path="/requests">
        <ProtectedRoute component={RequestsPage} />
      </Route>

      <Route>404 Not Found</Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
