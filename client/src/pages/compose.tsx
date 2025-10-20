import { useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { Sparkles, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import AIOverlay from '@/components/ai-overlay';
import EditingPanel from '@/components/editing-panel';
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import Sidebar from '@/components/sidebar';

export default function ComposePage() {
  const [, setLocation] = useLocation();
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showEditing, setShowEditing] = useState(false);
  const [emailData, setEmailData] = useState({
    to: '',
    cc: '',
    bcc: '',
    subject: '',
    body: ''
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sendEmailMutation = useMutation({
    mutationFn: async (emailData: { to: string; subject: string; body: string }) => {
      const response = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send email');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Email sent successfully!",
        description: "Your email has been sent and will appear in your inbox.",
      });

      // Reset form
      setEmailData({
        to: '',
        cc: '',
        bcc: '',
        subject: '',
        body: ''
      });

      // Refetch emails to show the sent email
      queryClient.invalidateQueries({ queryKey: ['emails'] });

      // Go back to inbox
      setLocation('/');
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send email",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useKeyboardShortcut(['ctrl', 'u'], () => setShowAI(true), []);
  useKeyboardShortcut(['meta', 'u'], () => setShowAI(true), []);

  const handleSend = () => {
    if (!emailData.to.trim()) {
      toast({
        title: "Recipient required",
        description: "Please enter at least one recipient.",
        variant: "destructive",
      });
      return;
    }

    if (!emailData.subject.trim() && !emailData.body.trim()) {
      toast({
        title: "Content required",
        description: "Please enter a subject or message.",
        variant: "destructive",
      });
      return;
    }

    sendEmailMutation.mutate({
      to: emailData.to,
      subject: emailData.subject,
      body: emailData.body,
    });
  };

  const [previousBody, setPreviousBody] = useState('');
  const [previousSubject, setPreviousSubject] = useState('');

  const handleDraftGenerated = (draft: string, subject?: string) => {
    setPreviousBody(emailData.body);
    setPreviousSubject(emailData.subject);
    setEmailData(prev => ({ 
      ...prev, 
      body: draft,
      subject: subject || prev.subject
    }));
  };

  const handleDiscardGenerated = () => {
    setEmailData(prev => ({ 
      ...prev, 
      body: previousBody,
      subject: previousSubject
    }));
    setShowAI(false);
  };

  const aiOverlayRef = useRef<any>(null);

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <Sidebar />
      
      {/* Empty Section */}
      <div className="w-64 bg-background flex-shrink-0"></div>

      {/* Main Content Box with 8px margin */}
      <div className="flex-1 p-2">
        <div className="h-full bg-card rounded-tl-3xl rounded-tr-3xl overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto custom-scrollbar">
          <div className="max-w-4xl mx-auto py-6 px-6">
            <div className="space-y-4">
              {/* To Field */}
              <div className="flex items-center space-x-4 pb-3 border-b border-border">
                <span className="text-sm font-medium text-muted-foreground w-12">To</span>
                <Input
                  type="email"
                  value={emailData.to}
                  onChange={(e) => setEmailData(prev => ({ ...prev, to: e.target.value }))}
                  className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-auto text-foreground bg-transparent"
                  placeholder="recipient@example.com"
                  data-testid="input-to"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCcBcc(!showCcBcc)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cc/Bcc
                </Button>
              </div>

              {/* CC/BCC Fields */}
              {showCcBcc && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-4 pb-3 border-b border-border">
                    <span className="text-sm font-medium text-muted-foreground w-12">Cc</span>
                    <Input
                      type="email"
                      value={emailData.cc}
                      onChange={(e) => setEmailData(prev => ({ ...prev, cc: e.target.value }))}
                      className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-auto text-foreground bg-transparent"
                      placeholder="cc@example.com"
                      data-testid="input-cc"
                    />
                  </div>
                  <div className="flex items-center space-x-4 pb-3 border-b border-border">
                    <span className="text-sm font-medium text-muted-foreground w-12">Bcc</span>
                    <Input
                      type="email"
                      value={emailData.bcc}
                      onChange={(e) => setEmailData(prev => ({ ...prev, bcc: e.target.value }))}
                      className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-auto text-foreground bg-transparent"
                      placeholder="bcc@example.com"
                      data-testid="input-bcc"
                    />
                  </div>
                </div>
              )}

              {/* Subject Field */}
              <div className="flex items-center space-x-4 pb-3 border-b border-border">
                <span className="text-sm font-medium text-muted-foreground w-12">Subject</span>
                <Input
                  type="text"
                  value={emailData.subject}
                  onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
                  className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-auto text-foreground font-semibold bg-transparent"
                  placeholder="What's this about?"
                  data-testid="input-subject"
                />
              </div>

              {/* Email Body */}
              <div className="pt-4">
                <Textarea
                  placeholder="Write your message here... (Tip: Press Cmd/Ctrl + U for AI assistance)"
                  value={emailData.body}
                  onChange={(e) => setEmailData(prev => ({ ...prev, body: e.target.value }))}
                  className="w-full min-h-[400px] text-base border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 resize-none bg-transparent leading-relaxed"
                  data-testid="textarea-body"
                />
              </div>

              {/* Keyboard Shortcuts Hint */}
              <div className="pt-4 border-t border-border">
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex items-center space-x-2">
                    <kbd className="px-2 py-1 bg-muted rounded text-foreground font-mono text-xs">
                      Cmd/Ctrl + Enter
                    </kbd>
                    <span>to send</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <kbd className="px-2 py-1 bg-muted rounded text-foreground font-mono text-xs">
                      Cmd/Ctrl + U
                    </kbd>
                    <span>for AI assistance</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>

      {showEditing && (
        <EditingPanel
          emailText={emailData.body}
          onTextUpdate={(newText) => setEmailData(prev => ({ ...prev, body: newText }))}
          onClose={() => setShowEditing(false)}
        />
      )}

      {/* AI Overlay */}
      {showAI && (
        <div
          className="fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              aiOverlayRef.current?.handleOutsideClick?.();
            }
          }}
        >
          <div className="w-full max-w-2xl animate-in fade-in zoom-in-95 duration-200">
            <AIOverlay
              ref={aiOverlayRef}
              isOpen={showAI}
              onClose={() => setShowAI(false)}
              onDraftGenerated={handleDraftGenerated}
              onDiscardGenerated={handleDiscardGenerated}
              expandable={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}
