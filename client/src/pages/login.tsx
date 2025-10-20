import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Mail, Sparkles, Zap, Shield, Clock } from 'lucide-react';
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
              <div className="w-12 h-12 border-3 border-muted border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  const features = [
    {
      icon: Sparkles,
      title: 'AI-Powered Writing',
      description: 'Generate and refine emails with advanced AI assistance'
    },
    {
      icon: Zap,
      title: 'Lightning Fast',
      description: 'Keyboard shortcuts and instant actions for maximum productivity'
    },
    {
      icon: Shield,
      title: 'Secure & Private',
      description: 'Your data is encrypted and never shared with third parties'
    },
    {
      icon: Clock,
      title: 'Real-time Sync',
      description: 'Stay updated with instant email notifications and sync'
    }
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 overflow-hidden relative">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-3xl"></div>
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-secondary/10 to-transparent rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 w-full max-w-5xl">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left Side - Branding */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-primary via-secondary to-accent rounded-xl flex items-center justify-center shadow-lg">
                <Mail className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">ContactRemedy</h1>
                <p className="text-sm text-muted-foreground">Email, reimagined</p>
              </div>
            </div>

            <div className="space-y-3 pt-4">
              <h2 className="text-4xl font-bold text-foreground leading-tight">
                The email experience
                <br />
                <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                  you deserve
                </span>
              </h2>
              <p className="text-lg text-muted-foreground">
                Blazingly fast, beautifully designed, and powered by AI.
                Spend less time on email, and more time on what matters.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-2 gap-4 pt-6">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="p-4 rounded-lg bg-card border border-border hover:border-primary/50 transition-smooth card-superhuman"
                >
                  <feature.icon className="w-5 h-5 text-primary mb-2" />
                  <h3 className="font-semibold text-sm text-foreground mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right Side - Login Card */}
          <div className="flex items-center justify-center">
            <div className="w-full max-w-md">
              <div className="bg-card rounded-2xl border border-border shadow-2xl p-8 space-y-6">
                <div className="text-center space-y-2">
                  <h3 className="text-2xl font-bold text-foreground">Welcome back</h3>
                  <p className="text-muted-foreground">
                    Sign in with your Google account to continue
                  </p>
                </div>

            <Button
              onClick={login}
              className="w-full h-12 text-base font-medium btn-superhuman bg-primary hover:brightness-110 text-primary-foreground shadow-lg"
              size="lg"
            >
                  <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
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

                <div className="pt-4 border-t border-border space-y-2 text-center text-xs text-muted-foreground">
                  <p>By signing in, you agree to grant Gmail access</p>
                  <p>Real-time notifications will be automatically enabled</p>
                </div>
              </div>

              {/* Trust indicators */}
              <div className="mt-6 flex items-center justify-center space-x-6 text-xs text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <Shield className="w-3 h-3" />
                  <span>Secure</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Zap className="w-3 h-3" />
                  <span>Fast</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Sparkles className="w-3 h-3" />
                  <span>AI-Powered</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
