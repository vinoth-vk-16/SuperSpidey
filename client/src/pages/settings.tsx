import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Key, ExternalLink, Save, Check } from 'lucide-react';
import Sidebar from '@/components/sidebar';

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const savedKey = localStorage.getItem('gemini-api-key');
    if (savedKey) {
      setApiKey(savedKey);
      setIsSaved(true);
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
      setIsSaved(true);
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
    <div className="h-screen flex bg-background overflow-hidden">
      <Sidebar />
      
      {/* Empty Section */}
      <div className="w-64 bg-background flex-shrink-0"></div>

      {/* Main Content Box with 8px margin */}
      <div className="flex-1 p-2">
        <div className="h-full bg-card rounded-tl-3xl rounded-tr-3xl overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto custom-scrollbar">
          <div className="max-w-3xl mx-auto py-8 px-6">
            {/* API Configuration Card */}
            <div className="bg-card border border-border rounded-xl p-6 card-superhuman">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
                  <Key className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Gemini API Configuration
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Configure your AI assistant settings
                  </p>
                </div>
              </div>
              
              <div className="space-y-5">
                <div>
                  <Label htmlFor="apiKey" className="text-sm font-medium text-foreground mb-2 block">
                    API Key
                  </Label>
                  <div className="relative">
                    <Input
                      id="apiKey"
                      type="password"
                      placeholder="Enter your Gemini API key"
                      value={apiKey}
                      onChange={(e) => {
                        setApiKey(e.target.value);
                        setIsSaved(false);
                      }}
                      className="w-full pr-10 focus-ring"
                      data-testid="input-api-key"
                    />
                    {isSaved && !isLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Check className="w-4 h-4 text-green-600" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Your API key is stored locally and never sent to our servers
                  </p>
                </div>
                
                <Button
                  onClick={handleSave}
                  disabled={isLoading || (isSaved && apiKey === localStorage.getItem('gemini-api-key'))}
                  className="btn-superhuman bg-primary hover:brightness-110 text-primary-foreground"
                  data-testid="button-save-api-key"
                >
                  {isLoading ? (
                    'Saving...'
                  ) : isSaved && apiKey === localStorage.getItem('gemini-api-key') ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save API Key
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Instructions Card */}
            <div className="mt-6 bg-muted/50 border border-border rounded-xl p-6">
              <h3 className="text-base font-semibold text-foreground mb-3">
                How to get your Gemini API key
              </h3>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-semibold">
                    1
                  </span>
                  <span>
                    Visit{' '}
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center"
                    >
                      Google AI Studio
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-semibold">
                    2
                  </span>
                  <span>Sign in with your Google account</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-semibold">
                    3
                  </span>
                  <span>Click "Create API Key" button</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-semibold">
                    4
                  </span>
                  <span>Copy the generated key and paste it in the field above</span>
                </li>
              </ol>
            </div>

            {/* Info Card */}
            <div className="mt-6 bg-card border border-primary/30 rounded-xl p-6">
              <h3 className="text-base font-semibold text-foreground mb-2">
                Why do I need an API key?
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The Gemini API key enables AI-powered features like email composition assistance, 
                smart replies, and content improvement. Your key is stored securely in your browser 
                and is only used to communicate directly with Google's AI services.
              </p>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
