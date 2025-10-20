import { useLocation } from 'wouter';
import { Reply, Forward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { format } from 'date-fns';
import Sidebar from '@/components/sidebar';
import { Textarea } from '@/components/ui/textarea';

interface Email {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  body: string;
  snippet: string;
}

export default function EmailDetailPage() {
  const [, setLocation] = useLocation();
  const [emailId] = useState(() => {
    const path = window.location.pathname;
    return path.split('/email/')[1];
  });
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');

  const { data: emailData, isLoading, error } = useQuery({
    queryKey: ['emails'],
    queryFn: async () => {
      const response = await fetch('/api/gmail/messages');
      if (!response.ok) {
        throw new Error('Failed to fetch emails');
      }
      return response.json();
    },
  });

  const emails: Email[] = emailData?.messages || [];
  const email = emails.find(e => e.id === emailId);

  const getSenderName = (from: string) => {
    if (from.includes('<')) {
      return from.split('<')[0].trim();
    }
    return from.split('@')[0];
  };

  const getSenderEmail = (from: string) => {
    if (from.includes('<')) {
      return from.split('<')[1].replace('>', '').trim();
    }
    return from;
  };

  if (isLoading) {
    return (
      <div className="h-screen flex bg-background">
        <Sidebar />
        {/* Empty Section */}
        <div className="w-64 bg-background flex-shrink-0"></div>
        {/* Main Content Box */}
        <div className="flex-1 p-2">
          <div className="h-full bg-card rounded-tl-3xl rounded-tr-3xl overflow-hidden flex items-center justify-center">
            <div className="text-center">
              <div className="w-10 h-10 border-3 border-muted border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
              <div className="text-muted-foreground font-medium">Loading email...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !email) {
    return (
      <div className="h-screen flex bg-background">
        <Sidebar />
        {/* Empty Section */}
        <div className="w-64 bg-background flex-shrink-0"></div>
        {/* Main Content Box */}
        <div className="flex-1 p-2">
          <div className="h-full bg-card rounded-tl-3xl rounded-tr-3xl overflow-hidden flex items-center justify-center">
            <div className="text-center">
              <div className="text-destructive font-semibold mb-4">Email not found</div>
              <Button onClick={() => setLocation('/')} variant="outline" className="btn-superhuman">
                Back to Inbox
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-background">
      <Sidebar />
      
      {/* Empty Section */}
      <div className="w-64 bg-background border-r border-border flex-shrink-0"></div>

      {/* Main Content Box with 5px margin */}
      <div className="flex-1 p-[5px]">
        <div className="h-full bg-card rounded-tl-3xl rounded-tr-3xl overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto custom-scrollbar">
          <div className="max-w-3xl mx-auto py-8 px-6">
            {/* Subject */}
            <h1 className="text-2xl font-semibold text-foreground mb-6">
              {email.subject || '(No subject)'}
            </h1>

            {/* Sender Info */}
            <div className="flex items-start justify-between mb-8 pb-6 border-b border-border">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground font-semibold text-sm flex-shrink-0">
                  {getSenderName(email.from).charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-foreground">
                    {getSenderName(email.from)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {getSenderEmail(email.from)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    to {email.to}
                  </div>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                {format(new Date(email.date), 'MMM d, yyyy • h:mm a')}
              </div>
            </div>

            {/* Email Body */}
            <div className="prose prose-sm max-w-none">
              <div className="text-foreground leading-relaxed whitespace-pre-wrap">
                {email.body}
              </div>
            </div>

            {/* Reply Section */}
            <div className="mt-12 pt-8 border-t border-border">
              {!isReplying ? (
                <div className="flex items-center space-x-3">
                  <Button
                    onClick={() => setIsReplying(true)}
                    className="btn-superhuman bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <Reply className="w-4 h-4 mr-2" />
                    Reply
                  </Button>
                  <Button
                    variant="outline"
                    className="btn-superhuman"
                  >
                    <Forward className="w-4 h-4 mr-2" />
                    Forward
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-foreground">
                      Reply to {getSenderName(email.from)}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsReplying(false);
                        setReplyText('');
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </Button>
                  </div>
                  
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply..."
                    className="min-h-[160px] resize-none focus-ring"
                    autoFocus
                  />
                  
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-foreground font-mono">Cmd+Enter</kbd> to send
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsReplying(false);
                          setReplyText('');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        disabled={!replyText.trim()}
                        className="btn-superhuman bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        Send Reply
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
