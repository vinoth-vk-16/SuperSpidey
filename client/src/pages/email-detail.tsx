import { useLocation } from 'wouter';
import { Reply, Forward, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { useState, useRef } from 'react';
import { format } from 'date-fns';
import Sidebar from '@/components/sidebar';
import { Textarea } from '@/components/ui/textarea';
import AIOverlay from '@/components/ai-overlay';
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut';

interface Message {
  messageId: string;
  from_?: string;
  from?: string;
  to_?: string[];
  to?: string[];
  subject: string;
  body: string;
  snippet: string;
  timestamp: string;
  isRead: boolean;
}

interface EmailThread {
  threadId: string;
  subject: string;
  from_?: string;
  from?: string;
  timestamp: string;
  messageCount: number;
  isRead: boolean;
  messages: Message[];
}

export default function EmailDetailPage() {
  const [, setLocation] = useLocation();
  const [messageId] = useState(() => {
    const path = window.location.pathname;
    return path.split('/email/')[1];
  });
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showAI, setShowAI] = useState(false);
  const aiOverlayRef = useRef<any>(null);

  // AI keyboard shortcut - only when replying
  useKeyboardShortcut(['ctrl', 'u'], () => {
    if (isReplying) setShowAI(true);
  }, [isReplying]);
  useKeyboardShortcut(['meta', 'u'], () => {
    if (isReplying) setShowAI(true);
  }, [isReplying]);

  const { data: emailData, isLoading, error } = useQuery({
    queryKey: ['emails', currentPage],
    queryFn: async () => {
      const response = await fetch('https://superspidey-email-management.onrender.com/fetch-emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_email: 'imvinothvk521@gmail.com',
          page: currentPage,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to fetch emails');
      }
      return response.json();
    },
  });

  const threads: EmailThread[] = emailData?.threads || [];
  
  // Find the message across all threads
  let currentMessage: Message | undefined;
  let currentThread: EmailThread | undefined;
  
  for (const thread of threads) {
    const message = thread.messages.find(m => m.messageId === messageId);
    if (message) {
      currentMessage = message;
      currentThread = thread;
      break;
    }
  }

  const getSenderName = (from: string | undefined, isCurrentUser: boolean = false) => {
    if (isCurrentUser) {
      return 'Me';
    }
    if (!from) return 'Unknown';
    
    // Remove surrounding quotes first (e.g., "\"58 , Vinoth Kumar\" <email>" -> "58 , Vinoth Kumar <email>")
    let cleanFrom = from.replace(/^"(.*)"(\s*<.+>)$/, '$1$2').trim();
    
    // Handle format: "Name <email@domain.com>" or just "email@domain.com"
    if (cleanFrom.includes('<')) {
      const name = cleanFrom.split('<')[0].trim();
      // Remove any leading numbers and commas (e.g., "58 , Vinoth Kumar" -> "Vinoth Kumar")
      const cleanName = name.replace(/^\d+\s*,?\s*/, '').trim();
      return cleanName || cleanFrom.split('@')[0];
    }
    return cleanFrom.split('@')[0];
  };

  const getSenderEmail = (from: string | undefined) => {
    if (!from) return '';
    if (from.includes('<')) {
      return from.split('<')[1].replace('>', '').trim();
    }
    return from;
  };

  const extractEmailOnly = (emailString: string | undefined) => {
    if (!emailString) return '';
    // Extract just the email from formats like: "Name <email@domain.com>" or "58 , Name <email@domain.com>"
    if (emailString.includes('<')) {
      const match = emailString.match(/<(.+?)>/);
      return match ? match[1] : emailString;
    }
    return emailString;
  };

  const isCurrentUserEmail = (email: string | undefined) => {
    if (!email) return false;
    const userEmail = 'imvinothvk521@gmail.com'; // You can get this from auth context
    return email.toLowerCase().includes(userEmail.toLowerCase());
  };

  const getRecipientName = (recipients: string[] | string | undefined) => {
    if (!recipients) return 'Unknown';
    
    // Handle both array and string
    let recipientList: string[] = [];
    if (Array.isArray(recipients)) {
      recipientList = recipients;
    } else if (typeof recipients === 'string') {
      recipientList = [recipients];
    } else {
      return 'Unknown';
    }
    
    const names = recipientList
      .filter(recipient => recipient && typeof recipient === 'string' && recipient.trim())
      .map(recipient => {
        recipient = recipient.trim();
        
        // Remove surrounding quotes first (e.g., "\"58 , Vinoth Kumar\" <email>" -> "58 , Vinoth Kumar <email>")
        recipient = recipient.replace(/^"(.*)"(\s*<.+>)$/, '$1$2').trim();
        
        // Check if it's the current user
        if (isCurrentUserEmail(recipient)) {
          return 'Me';
        }
        
        // Extract name or first part of email
        if (recipient.includes('<')) {
          // Format: "Name <email@domain.com>" or "58 , Name <email>"
          const parts = recipient.split('<');
          if (parts.length >= 2) {
            const namePart = parts[0].trim();
            
            // Remove any leading numbers and commas (e.g., "58 , Vinoth Kumar" -> "Vinoth Kumar")
            const cleanName = namePart.replace(/^\d+\s*,?\s*/, '').trim();
            
            if (cleanName) {
              // Get first name only
              const firstName = cleanName.split(/\s+/)[0];
              return firstName;
            }
            
            // Fallback to email username if no name found
            const emailPart = parts[1].replace('>', '').trim();
            return emailPart ? emailPart.split('@')[0] : null;
          }
        }
        
        // Just email address - use part before @
        if (recipient.includes('@')) {
          return recipient.split('@')[0];
        }
        
        return null;
      })
      .filter(name => name !== null && name !== 'Unknown');
    
    return names.length > 0 ? names.join(', ') : 'Unknown';
  };

  if (isLoading) {
    return (
      <div className="h-screen flex bg-background overflow-hidden">
        <Sidebar />
        {/* Empty Section */}
        <div className="w-64 bg-background flex-shrink-0"></div>
        {/* Main Content Box with 8px margin */}
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

  if (error || !currentMessage) {
    return (
      <div className="h-screen flex bg-background overflow-hidden">
        <Sidebar />
        {/* Empty Section */}
        <div className="w-64 bg-background flex-shrink-0"></div>
        {/* Main Content Box with 8px margin */}
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
    <div className="h-screen flex bg-background overflow-hidden">
      <Sidebar />
      
      {/* Empty Section */}
      <div className="w-64 bg-background flex-shrink-0"></div>

      {/* Main Content Box with 8px margin (same as inbox) */}
      <div className="flex-1 p-2">
        <div className="h-full bg-card rounded-tl-3xl rounded-tr-3xl overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto custom-scrollbar">
          <div className="max-w-5xl mx-auto py-6 px-6">
            {/* Subject */}
            <h1 className="text-xl font-semibold text-foreground mb-6">
              {(currentThread?.subject || currentMessage.subject || '(No subject)').replace(/^Re:\s*/i, '')}
            </h1>

            {/* Display all messages in chronological order (oldest first) */}
            <div className="space-y-0">
              {currentThread && currentThread.messages
                .slice()
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                .map((msg, index) => {
                  const isLastMessage = index === currentThread.messages.length - 1;
                  const cleanBody = msg.body
                    .replace(/&#39;/g, "'")
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&amp;/g, '&')
                    .replace(/\r\n/g, '\n') // Normalize line endings
                    .replace(/\r/g, '\n');
                  
                  // Parse body to extract only the current message content
                  // Gmail format: actual content, then "On ... wrote:" marker, then quoted text with ">"
                  let displayBody = cleanBody;
                  
                  // Method 1: Split by Gmail's "On ... wrote:" pattern (handles both single and multi-line)
                  // Pattern 1: "On ... wrote:" on same line (replace . with [\s\S] for multiline support)
                  const gmailQuotePattern1 = /\n\nOn [\s\S]+?wrote:\s*\n/i;
                  // Pattern 2: "On ..." on one line, "wrote:" on next line (your case)
                  const gmailQuotePattern2 = /\n\nOn [^\n]+\nwrote:\s*\n/i;
                  
                  let gmailMatch = cleanBody.match(gmailQuotePattern1) || cleanBody.match(gmailQuotePattern2);
                  
                  if (gmailMatch && gmailMatch.index !== undefined) {
                    // Extract content before the "On ... wrote:" line
                    displayBody = cleanBody.substring(0, gmailMatch.index).trim();
                  } else {
                    // Method 2: Line-by-line parsing to detect "On ..." followed by quoted content
                    const bodyLines = cleanBody.split('\n');
                    const cleanedLines: string[] = [];
                    let foundQuote = false;
                    
                    for (let i = 0; i < bodyLines.length; i++) {
                      const line = bodyLines[i];
                      const trimmedLine = line.trim();
                      
                      // Check if this line starts a quote section
                      // Pattern: "On <date/time> <name> <email>" or just "On <date>"
                      if (trimmedLine.match(/^On .+?<.+?>$/i) || 
                          trimmedLine.match(/^On .+?\d{1,2}:\d{2}/i) ||
                          trimmedLine === 'wrote:') {
                        // Check if next few lines have "wrote:" or quoted text ">"
                        if (i + 1 < bodyLines.length) {
                          const nextLine = bodyLines[i + 1].trim();
                          if (nextLine === 'wrote:' || nextLine.startsWith('>')) {
                            foundQuote = true;
                            break;
                          }
                        }
                      }
                      
                      // Stop when we hit quoted text (lines starting with ">")
                      if (trimmedLine.startsWith('>')) {
                        foundQuote = true;
                        break;
                      }
                      
                      // Stop at common email signature separators
                      if (trimmedLine.match(/^[_-]{2,}$/)) {
                        break;
                      }
                      
                      // Keep the line
                      cleanedLines.push(line);
                    }
                    
                    if (foundQuote || cleanedLines.length > 0) {
                      displayBody = cleanedLines.join('\n').trim();
                    }
                  }
                  
                  // Fallback to snippet if body is empty
                  if (!displayBody || displayBody.length === 0) {
                    displayBody = msg.snippet
                      .replace(/&#39;/g, "'")
                      .replace(/&lt;/g, '<')
                      .replace(/&gt;/g, '>')
                      .replace(/&quot;/g, '"')
                      .replace(/&amp;/g, '&');
                  }
                  const fromField = msg.from_ || msg.from;
                  const toField = msg.to_ || msg.to;
                  const isMe = isCurrentUserEmail(fromField);
                  const recipientDisplay = getRecipientName(toField);

                  return (
                    <div
                      key={msg.messageId}
                      className="border-l-4 border-primary rounded-l-lg bg-muted/40 mb-3 last:mb-0 overflow-hidden"
                    >
                      {/* Message Header */}
                      <div className="p-5 pb-3">
                        <div className="flex items-baseline justify-between mb-3">
                          <div className="flex items-baseline space-x-2">
                            <div className="font-semibold text-foreground text-sm">
                              {getSenderName(fromField, isMe)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              to {recipientDisplay}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground flex-shrink-0">
                            {format(new Date(msg.timestamp), 'h:mm a').toUpperCase()}
                          </div>
                        </div>

                        {/* Message Body */}
                        <div className="text-foreground text-sm leading-relaxed whitespace-pre-wrap mb-3">
                          {displayBody}
                        </div>

                        {/* Reply button inside the last message box */}
                        {isLastMessage && (
                          <div className="pt-3 border-t border-border/50">
                            <Button
                              onClick={() => setIsReplying(true)}
                              variant="outline"
                              size="sm"
                              className="btn-superhuman"
                            >
                              <Reply className="w-4 h-4 mr-2" />
                              Reply
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>


            {/* Reply Compose Box */}
            {isReplying && currentMessage && (
              <div className="mt-6">
                {/* Reply Box with Purple Left Border - Same as Compose */}
                <div className="border-l-4 border-primary rounded-l-lg bg-muted/40 overflow-hidden">
                  <div className="p-5">
                    {/* To Field - Auto-filled with original sender (email only) */}
                    <div className="flex items-center space-x-3 pb-3 border-b border-border/50">
                      <span className="text-sm font-medium text-muted-foreground w-12">To</span>
                      <div className="flex-1 text-sm text-foreground">
                        {extractEmailOnly(currentMessage.from_ || currentMessage.from)}
                      </div>
                    </div>

                    {/* Reply Body */}
                    <div className="pt-4">
                      <Textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type your reply... (Tip: Press Cmd/Ctrl + U for AI assistance)"
                        className="w-full min-h-[200px] text-sm border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 resize-none bg-transparent leading-relaxed"
                        autoFocus
                      />
                    </div>

                    {/* Bottom Actions */}
                    <div className="pt-4 mt-4 border-t border-border/50 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Button
                          onClick={() => {
                            // TODO: Send reply
                            console.log('Sending reply:', replyText);
                            setIsReplying(false);
                            setReplyText('');
                          }}
                          disabled={!replyText.trim()}
                          className="btn-superhuman bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                          Send
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowAI(true)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          AI
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setIsReplying(false);
                            setReplyText('');
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          Discard
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Press <kbd className="px-1.5 py-0.5 bg-background/50 rounded font-mono">⌘</kbd>
                        <kbd className="px-1.5 py-0.5 bg-background/50 rounded font-mono ml-1">U</kbd> for AI
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* AI Overlay for Reply */}
    {showAI && isReplying && (
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
            onDraftGenerated={(draft) => {
              setReplyText(draft);
              setShowAI(false);
            }}
            onDiscardGenerated={() => {
              setShowAI(false);
            }}
            expandable={true}
          />
        </div>
      </div>
    )}
    </div>
  );
}

