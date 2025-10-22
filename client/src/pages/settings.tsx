import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Key, ExternalLink, Save, Check, User, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import Sidebar from '@/components/sidebar';

type SettingsTab = 'api' | 'user-info';

interface UserInfo {
  user_email: string;
  user_name: string;
  user_info: string;
  style: string;
  found: boolean;
}

const WRITING_STYLES = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'formal', label: 'Formal' },
  { value: 'concise', label: 'Concise' },
  { value: 'detailed', label: 'Detailed' },
  { value: 'technical', label: 'Technical' },
  { value: 'conversational', label: 'Conversational' },
];

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<SettingsTab>('user-info');
  const [apiKey, setApiKey] = useState('');
  const [isApiLoading, setIsApiLoading] = useState(false);
  const [isApiSaved, setIsApiSaved] = useState(false);
  
  // User Info states
  const [userName, setUserName] = useState('');
  const [userContext, setUserContext] = useState('');
  const [writingStyle, setWritingStyle] = useState('');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch user info on mount
  const { data: userInfoData, isLoading: isUserInfoLoading } = useQuery<UserInfo>({
    queryKey: ['userInfo', user?.email],
    queryFn: async () => {
      if (!user?.email) {
        throw new Error('User not authenticated');
      }
      
      const response = await fetch(`https://superspidey-email-management.onrender.com/fetch-user-info/${user.email}`);
      if (!response.ok) {
        throw new Error('Failed to fetch user info');
      }
      return response.json();
    },
  });

  // Populate form when data is loaded
  useEffect(() => {
    if (userInfoData && userInfoData.found) {
      setUserName(userInfoData.user_name || '');
      setUserContext(userInfoData.user_info || '');
      setWritingStyle(userInfoData.style || '');
    }
  }, [userInfoData]);

  // Load API key from localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem('gemini-api-key');
    if (savedKey) {
      setApiKey(savedKey);
      setIsApiSaved(true);
    }
  }, []);

  // Save/Update user info mutation
  const saveUserInfoMutation = useMutation({
    mutationFn: async (data: { user_name: string; user_info: string; style: string }) => {
      if (!user?.email) {
        throw new Error('User not authenticated');
      }
      
      const endpoint = userInfoData?.found 
        ? 'https://superspidey-email-management.onrender.com/update-user-info'
        : 'https://superspidey-email-management.onrender.com/save-user-info';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_email: user.email,
          ...data,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save user info');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userInfo', user?.email] });
      toast({
        title: "Success",
        description: userInfoData?.found ? "User information updated successfully" : "User information saved successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save user information",
        variant: "destructive",
      });
    },
  });

  const handleApiSave = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid API key",
        variant: "destructive"
      });
      return;
    }

    setIsApiLoading(true);
    try {
      localStorage.setItem('gemini-api-key', apiKey.trim());
      setIsApiSaved(true);
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
      setIsApiLoading(false);
    }
  };

  const handleUserInfoSave = () => {
    if (!userName.trim()) {
      toast({
        title: "Error",
        description: "Please enter your name",
        variant: "destructive"
      });
      return;
    }

    if (!writingStyle) {
      toast({
        title: "Error",
        description: "Please select a writing style",
        variant: "destructive"
      });
      return;
    }

    saveUserInfoMutation.mutate({
      user_name: userName.trim(),
      user_info: userContext.trim(),
      style: writingStyle,
    });
  };

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <Sidebar />
      
      {/* Navigation Section */}
      <div className="w-64 bg-background flex-shrink-0 pt-8 px-4">
        <div className="space-y-3">
          <button
            onClick={() => setActiveTab('user-info')}
            className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'user-info'
                ? 'border border-border text-foreground bg-background'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center space-x-3">
              <User className="w-4 h-4" />
              <span>User Info</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'api'
                ? 'border border-border text-foreground bg-background'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Key className="w-4 h-4" />
              <span>API Key</span>
            </div>
          </button>
        </div>
      </div>

      {/* Main Content Box with 8px margin */}
      <div className="flex-1 p-2">
        <div className="h-full bg-card rounded-tl-3xl rounded-tr-3xl overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto custom-scrollbar">
            <div className="max-w-3xl mx-auto py-8 px-6">
              {/* User Info Section */}
              {activeTab === 'user-info' && (
                <>
                  {isUserInfoLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Name Field */}
                      <div>
                        <Label htmlFor="userName" className="text-sm font-medium text-foreground mb-2 block">
                          Name
                        </Label>
                        <Input
                          id="userName"
                          type="text"
                          placeholder="Enter your full name"
                          value={userName}
                          onChange={(e) => setUserName(e.target.value)}
                          className="w-full rounded-xl"
                        />
                      </div>

                      {/* Context Field */}
                      <div>
                        <Label htmlFor="userContext" className="text-sm font-medium text-foreground mb-2 block">
                          Context
                        </Label>
                        <Textarea
                          id="userContext"
                          placeholder="Provide context about yourself (e.g., your role, company, interests, common email scenarios). This helps the AI generate more relevant and personalized emails."
                          value={userContext}
                          onChange={(e) => setUserContext(e.target.value)}
                          className="w-full min-h-[120px] resize-none rounded-xl"
                        />
                        
                      </div>

                      {/* Writing Style Dropdown */}
                      <div>
                        <Label htmlFor="writingStyle" className="text-sm font-medium text-foreground mb-2 block">
                          Writing Style
                        </Label>
                        <Select value={writingStyle} onValueChange={setWritingStyle}>
                          <SelectTrigger className="w-full rounded-xl">
                            <SelectValue placeholder="Select your preferred writing style" />
                          </SelectTrigger>
                          <SelectContent>
                            {WRITING_STYLES.map((style) => (
                              <SelectItem key={style.value} value={style.value}>
                                {style.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Save Button - Aligned Right */}
                      <div className="flex justify-end pt-2">
                        <Button
                          onClick={handleUserInfoSave}
                          disabled={saveUserInfoMutation.isPending}
                          className="btn-superhuman bg-primary hover:brightness-110 text-primary-foreground px-8"
                        >
                          {saveUserInfoMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4 mr-2" />
                              Save
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Info Card */}
                  <div className="mt-8 bg-muted/30 border border-border rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-2">
                      Why provide this information?
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Your personal information helps the AI generate more contextually relevant and 
                      personalized emails. The AI will use your context and preferred writing style to 
                      craft emails that sound natural and align with your communication patterns.
                    </p>
                  </div>
                </>
              )}

              {/* API Configuration Section */}
              {activeTab === 'api' && (
                <>
                  <div className="space-y-6">
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
                            setIsApiSaved(false);
                          }}
                          className="w-full pr-10 rounded-xl"
                data-testid="input-api-key"
              />
                        {isApiSaved && !isApiLoading && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Check className="w-4 h-4 text-green-600" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Your API key is stored locally and never sent to our servers
                      </p>
            </div>
            
                    {/* Save Button - Aligned Right */}
                    <div className="flex justify-end pt-2">
            <Button
                        onClick={handleApiSave}
                        disabled={isApiLoading || (isApiSaved && apiKey === localStorage.getItem('gemini-api-key'))}
                        className="btn-superhuman bg-primary hover:brightness-110 text-primary-foreground px-8"
              data-testid="button-save-api-key"
            >
                        {isApiLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : isApiSaved && apiKey === localStorage.getItem('gemini-api-key') ? (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Saved
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Save
                          </>
                        )}
            </Button>
                    </div>
                  </div>

                  {/* Instructions Card */}
                  <div className="mt-8 bg-muted/30 border border-border rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-3">
                      How to get your Gemini API key
              </h3>
                    <ol className="space-y-3 text-xs text-muted-foreground">
                      <li className="flex items-start space-x-3">
                        <span className="flex-shrink-0 w-5 h-5 bg-primary/10 text-primary rounded-full flex items-center justify-center text-[10px] font-semibold">
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
                        <span className="flex-shrink-0 w-5 h-5 bg-primary/10 text-primary rounded-full flex items-center justify-center text-[10px] font-semibold">
                          2
                        </span>
                        <span>Sign in with your Google account</span>
                      </li>
                      <li className="flex items-start space-x-3">
                        <span className="flex-shrink-0 w-5 h-5 bg-primary/10 text-primary rounded-full flex items-center justify-center text-[10px] font-semibold">
                          3
                        </span>
                        <span>Click "Create API Key" button</span>
                      </li>
                      <li className="flex items-start space-x-3">
                        <span className="flex-shrink-0 w-5 h-5 bg-primary/10 text-primary rounded-full flex items-center justify-center text-[10px] font-semibold">
                          4
                        </span>
                        <span>Copy the generated key and paste it in the field above</span>
                </li>
              </ol>
                  </div>

                  {/* Info Card */}
                  <div className="mt-6 bg-muted/30 border border-border rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-2">
                      Why do I need an API key?
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      The Gemini API key enables AI-powered features like email composition assistance, 
                      smart replies, and content improvement. Your key is stored securely in your browser 
                      and is only used to communicate directly with Google's AI services.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
