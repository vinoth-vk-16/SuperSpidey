import { useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { ChevronDown, Send, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import AIOverlay from '@/components/ai-overlay';
import EditingPanel from '@/components/editing-panel';
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

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
    setPreviousBody(emailData.body); // Store current body before replacing
    setPreviousSubject(emailData.subject); // Store current subject before replacing
    setEmailData(prev => ({ 
      ...prev, 
      body: draft,
      subject: subject || prev.subject // Only update subject if provided
    }));
  };

  const handleDiscardGenerated = () => {
    setEmailData(prev => ({ 
      ...prev, 
      body: previousBody, // Restore previous body
      subject: previousSubject // Restore previous subject
    }));
    setShowAI(false);
  };

  const aiOverlayRef = useRef<any>(null);

  return (
    <div className="h-full flex bg-white">
      {/* Left Panel - Compose */}
      <div className="w-2/3 flex flex-col border-r border-gray-200">
        {/* Top Navigation */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-white">
          <div className="flex items-center space-x-1">
            <Button variant="ghost" size="icon" className="h-6 w-6 p-0" onClick={() => setLocation('/')}>
              <ArrowLeft className="h-3 w-3" />
            </Button>
            <span className="text-xs font-medium text-gray-900">New Message</span>
          </div>
          <div className="flex items-center space-x-1">
            <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
              <Send className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Compose Form */}
        <div className="flex-1 p-3">
          <div className="space-y-2">
            {/* To Field */}
            <div className="flex items-center space-x-2">
              <span className="text-xs font-medium text-gray-600 w-8">To</span>
              <Input
                type="email"
                value={emailData.to}
                onChange={(e) => setEmailData(prev => ({ ...prev, to: e.target.value }))}
                className="flex-1 text-xs px-2 py-1 border-0 bg-transparent focus:outline-none focus:ring-0"
                placeholder="Recipients"
                data-testid="input-to"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowCcBcc(!showCcBcc)}
                className="h-5 w-5 p-0"
                data-testid="button-cc-bcc-toggle"
              >
                <ChevronDown className="w-3 h-3" />
              </Button>
            </div>

            {/* CC/BCC Fields */}
            {showCcBcc && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-medium text-gray-600 w-8">Cc</span>
                  <Input
                    type="email"
                    value={emailData.cc}
                    onChange={(e) => setEmailData(prev => ({ ...prev, cc: e.target.value }))}
                    className="flex-1 text-xs px-2 py-1 border-0 bg-transparent focus:outline-none focus:ring-0"
                    placeholder="Cc"
                    data-testid="input-cc"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-medium text-gray-600 w-8">Bcc</span>
                  <Input
                    type="email"
                    value={emailData.bcc}
                    onChange={(e) => setEmailData(prev => ({ ...prev, bcc: e.target.value }))}
                    className="flex-1 text-xs px-2 py-1 border-0 bg-transparent focus:outline-none focus:ring-0"
                    placeholder="Bcc"
                    data-testid="input-bcc"
                  />
                </div>
              </div>
            )}

            {/* Subject Field */}
            <div className="flex items-center space-x-2 border-t border-gray-200 pt-2">
              <span className="text-xs font-medium text-gray-600 w-8">Subject</span>
              <Input
                type="text"
                value={emailData.subject}
                onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
                className="flex-1 text-xs px-2 py-1 border-0 bg-transparent focus:outline-none focus:ring-0"
                placeholder="Subject"
                data-testid="input-subject"
              />
            </div>

            {/* Email Body */}
            <div className="border-t border-gray-200 pt-2">
              <Textarea
                placeholder="Tip: Hit cmd/ctrl + U for AI"
                value={emailData.body}
                onChange={(e) => setEmailData(prev => ({ ...prev, body: e.target.value }))}
                className="w-full h-64 text-xs px-2 py-2 border-0 resize-none focus:outline-none focus:ring-0 bg-transparent"
                data-testid="textarea-body"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between border-t border-gray-200 pt-2">
              <div className="flex items-center space-x-2">
                <Button
                  onClick={handleSend}
                  disabled={sendEmailMutation.isPending}
                  className="px-3 py-1 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  data-testid="button-send"
                  size="sm"
                >
                  {sendEmailMutation.isPending ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-3 h-3 mr-1" />
                      Send
                    </>
                  )}
                </Button>
                <span className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 cursor-pointer">
                  Send later
                </span>
                <span className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 cursor-pointer">
                  Remind me
                </span>
                <span className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 cursor-pointer">
                  Share draft
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - AI Assistant */}
      <div className="w-1/3 flex flex-col bg-gray-50">
        <div className="p-3 border-b border-gray-200 bg-white">
          <h3 className="text-xs font-medium text-gray-900">AI Assistant</h3>
        </div>
        <div className="flex-1 p-3">
          <div className="text-xs text-gray-500 mb-3">
            Use AI to generate, improve, or enhance your email content.
          </div>
          <Button
            onClick={() => setShowAI(true)}
            className="w-full text-xs py-2 bg-blue-600 text-white hover:bg-blue-700"
            size="sm"
          >
            Open AI Assistant
          </Button>
        </div>
      </div>

      {showEditing && (
        <EditingPanel
          emailText={emailData.body}
          onTextUpdate={(newText) => setEmailData(prev => ({ ...prev, body: newText }))}
          onClose={() => setShowEditing(false)}
        />
      )}

      {/* AI Overlay - Floating above compose card */}
      {showAI && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            // Only handle clicks on the backdrop, not on the overlay content
            if (e.target === e.currentTarget) {
              // Call the AIOverlay's handleOutsideClick method directly
              aiOverlayRef.current?.handleOutsideClick?.();
            }
          }}
        >
          <div className="w-full max-w-2xl">
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
