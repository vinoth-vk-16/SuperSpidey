import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Sparkles } from 'lucide-react';
import { useEffect } from 'react';
import { useLocation } from 'wouter';

export default function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation('/');
    }
  }, [isAuthenticated, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 dark:border-slate-100 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <Mail className="h-8 w-8 text-slate-900 dark:text-slate-100" />
          </div>
          <CardTitle className="text-2xl font-bold">Welcome to ContactRemedy</CardTitle>
          <CardDescription className="text-lg">
            Your AI-powered email assistant
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
              <Sparkles className="h-4 w-4" />
              <span>Generate professional emails with AI</span>
            </div>
            <div className="flex items-center justify-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
              <Sparkles className="h-4 w-4" />
              <span>Send and receive emails through Gmail</span>
            </div>
            <div className="flex items-center justify-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
              <Sparkles className="h-4 w-4" />
              <span>Improve and refine your writing</span>
            </div>
            <div className="flex items-center justify-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
              <Sparkles className="h-4 w-4" />
              <span>Compose with confidence</span>
            </div>
          </div>

          <div className="pt-4">
            <Button
              onClick={login}
              className="w-full h-12 text-base font-medium"
              size="lg"
            >
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>
          </div>

          <div className="text-center text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <p>Sign in to start creating amazing emails</p>
            <p>You'll be asked to grant Gmail access for sending and receiving emails</p>
            <p>Real-time email notifications will be automatically enabled</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
