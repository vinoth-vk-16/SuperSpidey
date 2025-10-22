import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Textarea } from '@/components/ui/textarea';
import { ArrowUp, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface UserInfo {
  user_email: string;
  user_name: string;
  user_info: string;
  style: string;
  found: boolean;
}

interface AIOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onDraftGenerated: (draft: string, subject?: string) => void;
  onDiscardGenerated?: () => void;
  expandable?: boolean; // Whether the overlay can expand and doesn't auto-shrink
  previousEmailContext?: string; // Previous conversation for reply emails
}

interface AIOverlayRef {
  handleOutsideClick: () => void;
}

const AIOverlay = forwardRef<AIOverlayRef, AIOverlayProps>(({ isOpen, onClose, onDraftGenerated, onDiscardGenerated, expandable = false, previousEmailContext }, ref) => {
  const [prompt, setPrompt] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const [isShrunken, setIsShrunken] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [generatedSubject, setGeneratedSubject] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { toast } = useToast();
  
  const typeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const userEmail = 'imvinothvk521@gmail.com'; // TODO: Get from auth context

  // Fetch user info for context
  const { data: userInfoData } = useQuery<UserInfo>({
    queryKey: ['userInfo', userEmail],
    queryFn: async () => {
      const response = await fetch(`https://superspidey-email-management.onrender.com/fetch-user-info/${userEmail}`);
      if (!response.ok) {
        return { user_email: userEmail, user_name: '', user_info: '', style: '', found: false };
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Build user context string
  const buildUserContext = (): string | undefined => {
    if (!userInfoData || !userInfoData.found) {
      return undefined;
    }
    
    const parts = [];
    if (userInfoData.user_name) {
      parts.push(`Name: ${userInfoData.user_name}`);
    }
    if (userInfoData.user_info) {
      parts.push(`Info: ${userInfoData.user_info}`);
    }
    if (userInfoData.style) {
      parts.push(`Writing style: ${userInfoData.style}`);
    }
    
    return parts.length > 0 ? parts.join(', ') : undefined;
  };

  // Expose handleOutsideClick method through ref
  useImperativeHandle(ref, () => ({
    handleOutsideClick
  }));

  // Cleanup interval on unmount or when overlay closes
  useEffect(() => {
    return () => {
      if (typeIntervalRef.current) {
        clearInterval(typeIntervalRef.current);
        typeIntervalRef.current = null;
      }
    };
  }, []);

  const typeText = (text: string) => {
    // Safety check for undefined text
    if (!text || typeof text !== 'string') {
      console.warn('typeText called with invalid text:', text);
      setIsTyping(false);
      return;
    }
    
    // Clear any ongoing typing animation
    if (typeIntervalRef.current) {
      clearInterval(typeIntervalRef.current);
      typeIntervalRef.current = null;
    }
    
    // Instantly display the text without animation
    setGeneratedContent(text);
    setDisplayText(text);
    setShowResult(true);
    setIsTyping(false);
    
    // Auto-open dropdown immediately
    setDropdownOpen(true);
  };

  const generateMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const apiKey = localStorage.getItem('gemini-api-key');
      if (!apiKey) {
        throw new Error('No API key found');
      }
      
      const userContext = buildUserContext();
      
      // Build request body
      const requestBody: any = {
        prompt,
        api_key: apiKey
      };
      
      // Add user context if available
      if (userContext) {
        requestBody.context = userContext;
      }
      
      // Add previous email context if this is a reply
      if (previousEmailContext) {
        requestBody.previous_email_context = previousEmailContext;
      }
      
      // Call external email management service directly
      const response = await fetch('https://superspidey-email-management.onrender.com/generate-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) {
        throw new Error('Failed to generate email draft');
      }
      return response.json();
    },
    onSuccess: (data) => {
      console.log('API Response:', data);
      // Handle both old and new response structures
      if (data.subject && data.body) {
        // New structure: { subject, body }
        setGeneratedSubject(data.subject || '');
        typeText(data.body);
      } else if (data.draft) {
        // Old structure: { draft: { subject, body } }
        if (typeof data.draft === 'object' && data.draft.subject && data.draft.body) {
          setGeneratedSubject(data.draft.subject || '');
          typeText(data.draft.body);
        } else {
          // Fallback: draft is a string (old old structure)
          setGeneratedSubject('');
          typeText(data.draft);
        }
      } else {
        console.error('Unexpected response structure:', data);
        typeText('Failed to generate content');
      }
    },
    onError: async (error: any) => {
      let errorMessage = "Failed to generate email draft. Please check your API key in settings.";
      
      // Try to extract error message from server response
      if (error?.response?.status === 400) {
        try {
          const errorData = await error.response.json();
          if (errorData?.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // Fallback to generic API key error
          errorMessage = "Invalid API key. Please go to Settings and enter a valid Gemini API key.";
        }
      } else if (error?.message?.includes("API key") || error?.message?.includes("not valid")) {
        errorMessage = "Invalid API key. Please go to Settings and enter a valid Gemini API key.";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
      setIsShrunken(false);
      resetOverlay();
    }
  });

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast({
        title: "Error",
        description: "Please describe the email you want to draft",
        variant: "destructive"
      });
      return;
    }
    // Only shrink if not expandable
    if (!expandable) {
      setIsShrunken(true);
    }
    generateMutation.mutate(prompt.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };


  const handleReject = () => {
    // Retry should regenerate with the last prompt instead of closing
    if (prompt.trim()) {
      generateMutation.mutate(prompt.trim());
    } else {
      resetOverlay();
      onClose();
    }
  };

  const handleOutsideClick = () => {
    // Close directly without showing discard modal
    onClose();
  };


  const resetOverlay = () => {
    // Clear any ongoing typing animation
    if (typeIntervalRef.current) {
      clearInterval(typeIntervalRef.current);
      typeIntervalRef.current = null;
    }
    
    setPrompt('');
    setDisplayText('');
    setIsShrunken(false);
    setShowResult(false);
    setGeneratedContent('');
    setGeneratedSubject('');
    setEditPrompt('');
    setIsTyping(false);
    setDropdownOpen(false);
  };

  const handleEditRequest = () => {
    if (!editPrompt.trim()) return;
    
    // Close dropdown while processing
    setDropdownOpen(false);
    
    // Call mutation to improve the content
    improveEmailMutation.mutate({
      text: generatedContent,
      action: 'custom',
      customPrompt: editPrompt
    });
  };

  const improveEmailMutation = useMutation({
    mutationFn: async ({ text, action, customPrompt }: { text: string; action: string; customPrompt?: string }) => {
      const apiKey = localStorage.getItem('gemini-api-key');
      if (!apiKey) {
        throw new Error('No API key found');
      }
      
      let prompt = '';
      if (action === 'custom' && customPrompt) {
        prompt = `${customPrompt}:\n\n${text}`;
      } else {
        // For predefined actions
        const actionMap = {
          'shorten': 'Make this email more concise while preserving all important information:',
          'lengthen': 'Expand this email with more detail and context while maintaining professionalism:',
          'fix-grammar': 'Fix any spelling, grammar, and punctuation errors in this email:',
          'improve': 'Improve the writing style, clarity, and professionalism of this email:'
        };
        prompt = `${actionMap[action as keyof typeof actionMap]}\n\n${text}`;
      }
      
      const userContext = buildUserContext();
      
      // Build request body
      const requestBody: any = {
        text: text,
        action: action,
        api_key: apiKey,
        custom_prompt: action === 'custom' ? customPrompt : undefined
      };
      
      // Add user context if available
      if (userContext) {
        requestBody.context = userContext;
      }
      
      // Add previous email context if this is a reply
      if (previousEmailContext) {
        requestBody.previous_email_context = previousEmailContext;
      }
      
      // Call external email management service directly
      const response = await fetch('https://superspidey-email-management.onrender.com/improve-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) {
        throw new Error('Failed to improve email');
      }
      const data = await response.json();
      
      // Parse the response - API returns {subject: "", body: "..."}
      let improvedText = '';
      if (data.body) {
        // If there's a body field, use it
        improvedText = data.body;
      } else if (data.improved_text) {
        // Fallback to improved_text if that's what's returned
        improvedText = data.improved_text;
      } else if (typeof data === 'string') {
        // If the response is just a string
        improvedText = data;
      } else {
        console.error('Unexpected improve-email response:', data);
        throw new Error('Invalid response format');
      }
      
      return { 
        improvedText,
        subject: data.subject || '' // Update subject if provided
      };
    },
    onSuccess: (data) => {
      // Update both content and subject if provided
      if (data.subject) {
        setGeneratedSubject(data.subject);
      }
      typeText(data.improvedText); // Use typing animation for regenerated content too (dropdown will auto-open after typing)
      setEditPrompt('');
    },
    onError: async (error: any) => {
      let errorMessage = "Failed to update email";
      
      // Try to extract error message from server response
      if (error?.response?.status === 400) {
        try {
          const errorData = await error.response.json();
          if (errorData?.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // Fallback to generic API key error
          errorMessage = "Invalid API key. Please go to Settings and enter a valid Gemini API key.";
        }
      } else if (error?.message?.includes("API key") || error?.message?.includes("not valid")) {
        errorMessage = "Invalid API key. Please go to Settings and enter a valid Gemini API key.";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  });

  if (!isOpen) return null;

  // Show compact "Writing..." state immediately when request starts OR during typing
  if (generateMutation.isPending || (showResult && generatedContent && isTyping)) {
    return (
      <div 
        className="border-2 border-blue-400 rounded-lg bg-card transition-all duration-200 ease-in-out relative" 
        data-testid="ai-inline-dialog"
      >
        <div className="p-2">
          <div className="text-sm text-muted-foreground flex items-center">
            <span>Writing</span>
            <span className="ml-1 animate-pulse">...</span>
          </div>
        </div>
      </div>
    );
  }

  // Show result state with generated content and options
  if (showResult && generatedContent && !isTyping) {
    return (
      <>
        <div 
          className="border-2 border-blue-400 rounded-lg bg-card transition-all duration-200 ease-in-out relative" 
          data-testid="ai-inline-dialog"
        >
          <div className="p-3 space-y-3">
          {/* Generated content display */}
          <div className="bg-muted rounded-lg p-3">
            <div className="text-sm text-foreground whitespace-pre-wrap">
              {generatedContent}
            </div>
          </div>
          
          {!isTyping && (
            <>
              {/* Manual edit input */}
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Describe how to edit the text"
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleEditRequest();
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                    data-testid="input-edit-prompt"
                    disabled={improveEmailMutation.isPending}
                  />
                  {editPrompt.trim() && (
                    <button
                      onClick={handleEditRequest}
                      disabled={improveEmailMutation.isPending}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-blue-500 hover:text-blue-600 transition-colors disabled:opacity-50"
                      data-testid="button-edit-request"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {improveEmailMutation.isPending && (
                  <div className="text-xs text-muted-foreground flex items-center">
                    <span>Updating</span>
                    <span className="ml-1 animate-pulse">...</span>
                  </div>
                )}
              </div>

              {/* Action dropdown - auto opens, no visible trigger button */}
              <div className="space-y-2">
                <DropdownMenu open={dropdownOpen} onOpenChange={() => {}}>
                  <DropdownMenuTrigger asChild>
                    <div className="w-full opacity-0 h-0 pointer-events-none" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    className="w-[200px]" 
                    align="start"
                    onInteractOutside={(e) => {
                      e.preventDefault();
                      // Close the dropdown when clicking outside
                      setDropdownOpen(false);
                    }}
                  >
                    <div
                      onClick={() => {
                        onDraftGenerated(generatedContent, generatedSubject);
                        setDropdownOpen(false);
                        onClose();
                      }}
                      className="cursor-pointer px-2 py-1.5 text-sm text-foreground hover:text-blue-600 transition-colors"
                      data-testid="button-accept"
                    >
                      Accept
                    </div>
                    <div
                      onClick={() => {
                        handleReject();
                        setDropdownOpen(false);
                      }}
                      className="cursor-pointer px-2 py-1.5 text-sm text-foreground hover:text-blue-600 transition-colors"
                      data-testid="button-reject"
                    >
                      Retry
                    </div>
                    <div
                      onClick={() => {
                        setDropdownOpen(false);
                        improveEmailMutation.mutate({ text: generatedContent, action: 'improve' });
                      }}
                      className={`cursor-pointer px-2 py-1.5 text-sm text-foreground hover:text-blue-600 transition-colors ${improveEmailMutation.isPending ? 'opacity-50 pointer-events-none' : ''}`}
                      data-testid="button-improve"
                    >
                      Improve writing
                    </div>
                    <div
                      onClick={() => {
                        setDropdownOpen(false);
                        improveEmailMutation.mutate({ text: generatedContent, action: 'shorten' });
                      }}
                      className={`cursor-pointer px-2 py-1.5 text-sm text-foreground hover:text-blue-600 transition-colors ${improveEmailMutation.isPending ? 'opacity-50 pointer-events-none' : ''}`}
                      data-testid="button-shorten"
                    >
                      Shorten
                    </div>
                    <div
                      onClick={() => {
                        setDropdownOpen(false);
                        improveEmailMutation.mutate({ text: generatedContent, action: 'lengthen' });
                      }}
                      className={`cursor-pointer px-2 py-1.5 text-sm text-foreground hover:text-blue-600 transition-colors ${improveEmailMutation.isPending ? 'opacity-50 pointer-events-none' : ''}`}
                      data-testid="button-lengthen"
                    >
                      Lengthen
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          )}
        </div>
        </div>
      </>
    );
  }

  // Initial input state (or expandable loading state)
  return (
    <div 
      className="border-2 border-blue-400 rounded-lg bg-card transition-all duration-200 ease-in-out relative" 
      data-testid="ai-inline-dialog"
    >
      <div className="p-3">
        <div className="text-sm font-medium text-foreground mb-2">
          Write a draft
        </div>
        
        
        <div className="relative">
          <Textarea
            placeholder="Outline your email in brief notes"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyPress}
            className="w-full min-h-[60px] px-2 py-2 text-sm border-0 bg-transparent resize-none focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:outline-none text-foreground placeholder-muted-foreground pr-8"
            style={{ boxShadow: 'none', outline: 'none' }}
            data-testid="textarea-ai-prompt"
            autoFocus
            disabled={generateMutation.isPending}
          />
          
          {prompt.trim() && !generateMutation.isPending && (
            <button
              onClick={handleGenerate}
              className="absolute bottom-2 right-2 p-1.5 text-blue-500 hover:text-blue-600 transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded"
              data-testid="button-send-ai"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export default AIOverlay;
