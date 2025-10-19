import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const savedKey = localStorage.getItem('gemini-api-key');
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid API key",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      localStorage.setItem('gemini-api-key', apiKey.trim());
      toast({
        title: "Success",
        description: "API key saved successfully",
      });
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to save API key",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-lg font-medium mb-6 text-foreground" data-testid="text-page-title">
          Settings
        </h1>
        
        {/* Settings Card */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-base font-medium text-foreground mb-4">
            Gemini API Configuration
          </h2>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="apiKey" className="block text-sm font-medium text-foreground mb-2">
                API Key
              </Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Enter your Gemini API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="input-api-key"
              />
            </div>
            
            <Button
              onClick={handleSave}
              disabled={isLoading}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
              data-testid="button-save-api-key"
            >
              {isLoading ? 'Saving...' : 'Save'}
            </Button>
            
            <div className="mt-6 p-4 bg-muted rounded-md">
              <h3 className="text-sm font-medium text-foreground mb-2">
                How to get your Gemini API key:
              </h3>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>
                  Visit{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Google AI Studio
                  </a>
                </li>
                <li>Sign in with your Google account</li>
                <li>Click "Create API Key"</li>
                <li>Copy the generated key and paste it above</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
