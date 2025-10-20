import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Textarea } from '@/components/ui/textarea';
import { ArrowUp, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface AIOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onDraftGenerated: (draft: string, subject?: string) => void;
  onDiscardGenerated?: () => void;
  expandable?: boolean; // Whether the overlay can expand and doesn't auto-shrink
}

interface AIOverlayRef {
  handleOutsideClick: () => void;
}

const AIOverlay = forwardRef<AIOverlayRef, AIOverlayProps>(({ isOpen, onClose, onDraftGenerated, onDiscardGenerated, expandable = false }, ref) => {
  const [prompt, setPrompt] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const [isShrunken, setIsShrunken] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [generatedSubject, setGeneratedSubject] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { toast } = useToast();
  
  const typeIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
    
    setDisplayText('');
    setIsTyping(true);
    setShowResult(true); // Show result immediately so typing is visible
    setGeneratedContent(text); // Set final content upfront
    let index = 0;
    
    if (typeIntervalRef.current) {
      clearInterval(typeIntervalRef.current);
    }
    
    typeIntervalRef.current = setInterval(() => {
      // Additional safety check inside interval
      if (!text || typeof text !== 'string') {
        console.warn('text became invalid during typing:', text);
        if (typeIntervalRef.current) {
          clearInterval(typeIntervalRef.current);
          typeIntervalRef.current = null;
        }
        setIsTyping(false);
        return;
      }
      
      if (index < text.length) {
        setDisplayText(text.substring(0, index + 1));
        index++;
      } else {
        if (typeIntervalRef.current) {
          clearInterval(typeIntervalRef.current);
          typeIntervalRef.current = null;
        }
        setIsTyping(false);
        // Auto-open dropdown after typing finishes
        setTimeout(() => {
          setDropdownOpen(true);
        }, 200); // Small delay to let user see the complete text
      }
    }, 10); // Faster animation - from 30ms to 10ms
  };

  const generateMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const apiKey = localStorage.getItem('gemini-api-key');
      if (!apiKey) {
        throw new Error('No API key found');
      }
      // Call external email management service directly
      const response = await fetch('https://superspidey-email-management.onrender.com/generate-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          api_key: apiKey
        }),
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

  const handleDiscardConfirm = () => {
    setShowDiscardModal(false);
    if (onDiscardGenerated) {
      onDiscardGenerated(); // Restore previous content
    }
    resetOverlay();
    onClose();
  };

  const handleDiscardCancel = () => {
    setShowDiscardModal(false);
  };

  const handleOutsideClick = () => {
    // Check if there's any content worth preserving (with null checks)
    const hasContent = (prompt && prompt.trim()) || 
                       (generatedContent && generatedContent.trim()) || 
                       (generatedSubject && generatedSubject.trim()) || 
                       (editPrompt && editPrompt.trim());
    
    if (hasContent) {
      // Show discard modal if there's content
      setShowDiscardModal(true);
    } else {
      // Close directly if no content
      onClose();
    }
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
      
      // Call external email management service directly
      const response = await fetch('https://superspidey-email-management.onrender.com/improve-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          action: action,
          api_key: apiKey,
          custom_prompt: action === 'custom' ? customPrompt : undefined
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to improve email');
      }
      const data = await response.json();
      return { improvedText: data.improved_text };
    },
    onSuccess: (data) => {
      typeText(data.improvedText); // Use typing animation for regenerated content too
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
        onClick={(e) => e.stopPropagation()} // Prevent clicks from bubbling to backdrop
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
          onClick={(e) => e.stopPropagation()} // Prevent clicks from bubbling to backdrop
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
                      // When user clicks outside dropdown with AI response, show discard modal
                      if (generatedContent.trim()) {
                        setShowDiscardModal(true);
                      }
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
                      onClick={() => improveEmailMutation.mutate({ text: generatedContent, action: 'improve' })}
                      className={`cursor-pointer px-2 py-1.5 text-sm text-foreground hover:text-blue-600 transition-colors ${improveEmailMutation.isPending ? 'opacity-50 pointer-events-none' : ''}`}
                      data-testid="button-improve"
                    >
                      Improve writing
                    </div>
                    <div
                      onClick={() => improveEmailMutation.mutate({ text: generatedContent, action: 'shorten' })}
                      className={`cursor-pointer px-2 py-1.5 text-sm text-foreground hover:text-blue-600 transition-colors ${improveEmailMutation.isPending ? 'opacity-50 pointer-events-none' : ''}`}
                      data-testid="button-shorten"
                    >
                      Shorten
                    </div>
                    <div
                      onClick={() => improveEmailMutation.mutate({ text: generatedContent, action: 'lengthen' })}
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
        
        {/* Discard Modal */}
        <Dialog open={showDiscardModal} onOpenChange={setShowDiscardModal}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Discard AI Response</DialogTitle>
              <DialogDescription>
                Do you want to discard the AI's response? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={handleDiscardCancel} data-testid="button-discard-cancel">
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDiscardConfirm} data-testid="button-discard-confirm">
                Discard
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Initial input state (or expandable loading state)
  return (
    <div 
      className="border-2 border-blue-400 rounded-lg bg-card transition-all duration-200 ease-in-out relative" 
      data-testid="ai-inline-dialog"
      onClick={(e) => e.stopPropagation()} // Prevent clicks from bubbling to backdrop
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
