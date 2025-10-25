import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

interface EditingPanelProps {
  emailText: string;
  onTextUpdate: (newText: string) => void;
  onClose: () => void;
}

const suggestions = [
  { label: 'Accept', action: 'accept' },
  { label: 'Retry', action: 'retry' },
  { label: 'Improve writing', action: 'improve' },
  { label: 'Shorten', action: 'shorten' },
  { label: 'Lengthen', action: 'lengthen' },
  { label: 'Simplify', action: 'simplify' },
  { label: 'Fix spelling and grammar', action: 'fix-grammar' },
  { label: 'Rewrite in my voice', action: 'rewrite' },
];

export default function EditingPanel({ emailText, onTextUpdate, onClose }: EditingPanelProps) {
  const [customPrompt, setCustomPrompt] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();

  const improveMutation = useMutation({
    mutationFn: async ({ text, action }: { text: string; action: string }) => {
      // Call external email management service directly - API key handled by backend
      const response = await fetch('https://superspidey-email-management.onrender.com/improve-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          action,
          user_email: user?.email
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to improve email');
      }
      const data = await response.json();
      return { improvedText: data.body || data.improved_text };
    },
    onSuccess: (data) => {
      onTextUpdate(data.improvedText);
      toast({
        title: "Success",
        description: "Email improved successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to improve email. Please check your API key in settings.",
        variant: "destructive"
      });
    }
  });

  const handleSuggestionClick = (action: string) => {
    if (action === 'accept') {
      onClose();
      return;
    }
    
    if (action === 'retry') {
      // For retry, we'll use the improve action
      improveMutation.mutate({ text: emailText, action: 'improve' });
      return;
    }

    improveMutation.mutate({ text: emailText, action });
  };

  const handleCustomImprovement = () => {
    if (!customPrompt.trim()) {
      toast({
        title: "Error",
        description: "Please describe how to edit the text",
        variant: "destructive"
      });
      return;
    }
    
    // For custom prompts, we'll use the improve action and include the custom instruction
    improveMutation.mutate({ 
      text: `${customPrompt}\n\n${emailText}`, 
      action: 'improve' 
    });
  };

  return (
    <div className="mt-6 bg-card border border-border rounded-lg p-6" data-testid="panel-editing">
      <div className="mb-4">
        <Input
          type="text"
          placeholder="Describe how to edit the text"
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          data-testid="input-custom-prompt"
        />
      </div>
      
      <div className="space-y-2">
        {suggestions.map((suggestion) => (
          <div
            key={suggestion.action}
            onClick={() => handleSuggestionClick(suggestion.action)}
            className="suggestion-item px-3 py-2 text-sm text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors"
            data-testid={`suggestion-${suggestion.action}`}
          >
            {suggestion.label}
          </div>
        ))}
      </div>
      
      <div className="flex justify-between mt-4">
        <Button
          onClick={handleCustomImprovement}
          disabled={improveMutation.isPending}
          className="px-4 py-2 bg-accent text-accent-foreground text-sm font-medium rounded-md hover:bg-accent/90 transition-colors disabled:opacity-50"
          data-testid="button-regenerate-ai"
        >
          {improveMutation.isPending ? 'Processing...' : 'Regenerate with AI'}
        </Button>
        
        <Button
          variant="ghost"
          onClick={onClose}
          className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-testid="button-close-editing"
        >
          Close
        </Button>
      </div>
    </div>
  );
}
