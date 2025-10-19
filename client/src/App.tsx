import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/sidebar";
import InboxPage from "@/pages/inbox";
import ComposePage from "@/pages/compose";
import SettingsPage from "@/pages/settings";
import LoginPage from "@/pages/login";
import EmailDetailPage from "@/pages/email-detail";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 dark:border-slate-100"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="h-screen">
      <Component />
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 dark:border-slate-100"></div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
             {isAuthenticated ? (
               <>
                 <Route path="/" component={() => <ProtectedRoute component={InboxPage} />} />
                 <Route path="/compose" component={() => <ProtectedRoute component={ComposePage} />} />
                 <Route path="/settings" component={() => <ProtectedRoute component={SettingsPage} />} />
                 <Route path="/email/:id" component={() => <ProtectedRoute component={EmailDetailPage} />} />
               </>
             ) : (
               <Route path="/" component={LoginPage} />
             )}
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <ThemeProvider>
            <Toaster />
            <Router />
          </ThemeProvider>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
