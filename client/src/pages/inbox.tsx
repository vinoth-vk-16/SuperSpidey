import { useLocation } from 'wouter';
import { Search, Archive, Trash2, Clock, Check, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import Sidebar from '@/components/sidebar';

interface Message {
  messageId: string;
  threadId: string;
  from_: string;
  to: string[];
  subject: string;
  snippet: string;
  body: string;
  timestamp: string;
  isRead: boolean;
  isSent: boolean;
}

interface EmailThread {
  threadId: string;
  subject: string;
  from_: string;
  timestamp: string;
  messageCount: number;
  isRead: boolean;
  messages: Message[];
}

export default function InboxPage() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(new Set());
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  const { data: emailData, isLoading, error, refetch } = useQuery({
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
    refetchInterval: 30000,
  });

  const threads: EmailThread[] = emailData?.threads || [];
  const totalCount = emailData?.total_count || 0;
  const hasMore = emailData?.has_more || false;

  const filteredThreads = threads.filter((thread) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      thread.subject.toLowerCase().includes(query) ||
      thread.from_.toLowerCase().includes(query) ||
      thread.messages.some(msg => 
        msg.snippet.toLowerCase().includes(query) ||
        msg.body.toLowerCase().includes(query)
      )
    );
  });

  const toggleThreadSelection = (threadId: string) => {
    const newSelection = new Set(selectedThreadIds);
    if (newSelection.has(threadId)) {
      newSelection.delete(threadId);
    } else {
      newSelection.add(threadId);
    }
    setSelectedThreadIds(newSelection);
  };

  const toggleThreadExpansion = (threadId: string) => {
    const newExpanded = new Set(expandedThreads);
    if (newExpanded.has(threadId)) {
      newExpanded.delete(threadId);
    } else {
      newExpanded.add(threadId);
    }
    setExpandedThreads(newExpanded);
  };

  if (isLoading) {
    return (
      <div className="h-screen flex bg-background">
        <Sidebar />
        {/* Empty Section */}
        <div className="w-64 bg-background"></div>
        {/* Main Content Box */}
        <div className="flex-1 p-2">
          <div className="h-full bg-card rounded-tl-3xl rounded-tr-3xl overflow-hidden flex items-center justify-center">
            <div className="text-center">
              <div className="w-10 h-10 border-3 border-muted border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
              <div className="text-muted-foreground font-medium">Loading your inbox...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex bg-background">
        <Sidebar />
        {/* Empty Section */}
        <div className="w-64 bg-background"></div>
        {/* Main Content Box */}
        <div className="flex-1 p-2">
          <div className="h-full bg-card rounded-tl-3xl rounded-tr-3xl overflow-hidden flex items-center justify-center">
          <div className="text-center">
              <div className="text-destructive font-semibold mb-4">Failed to load emails</div>
              <Button onClick={() => refetch()} variant="outline" className="btn-superhuman">
              <RotateCcw className="w-4 h-4 mr-2" />
              Retry
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
      
      {/* Empty Section Navigation (like in the reference image) */}
      <div className="w-64 bg-background flex-shrink-0">
        {/* This section is intentionally left empty for future navigation */}
                  </div>

      {/* Main Content Box with 8px margin */}
      <div className="flex-1 p-2">
        <div className="h-full bg-card rounded-tl-3xl rounded-tr-3xl overflow-hidden flex flex-col">
          {/* Header with Title and Search */}
          <div className="px-6 py-3 border-b border-border">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold text-foreground">Inbox</h1>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8 pl-8 pr-16 bg-muted border-0 rounded-lg text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-0.5">
                  <kbd className="px-1.5 py-0.5 bg-background/50 rounded text-[10px] text-muted-foreground font-mono">⌘</kbd>
                  <kbd className="px-1.5 py-0.5 bg-background/50 rounded text-[10px] text-muted-foreground font-mono">K</kbd>
                </div>
              </div>
            </div>
          </div>

          {/* Content Area */}
          {filteredThreads.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-muted-foreground" />
                </div>
                <div className="text-foreground text-lg font-semibold mb-2">
                  {searchQuery ? 'No emails found' : 'Inbox Zero!'}
                </div>
                <div className="text-muted-foreground">
                  {searchQuery
                    ? 'Try a different search term'
                    : 'You\'re all caught up. Great work!'}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto custom-scrollbar">
              <div className="max-w-5xl mx-auto">
                {filteredThreads.map((thread) => (
                  <EmailThreadItem
                    key={thread.threadId}
                    thread={thread}
                    isSelected={selectedThreadIds.has(thread.threadId)}
                    isExpanded={expandedThreads.has(thread.threadId)}
                    onToggleSelect={toggleThreadSelection}
                    onToggleExpand={toggleThreadExpansion}
                    onClick={() => setLocation(`/email/${thread.messages[0].messageId}`)}
                  />
                ))}
                
                {/* Pagination */}
                {(hasMore || currentPage > 1) && (
                  <div className="flex items-center justify-center py-6 space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => prev - 1)}
                      className="btn-superhuman"
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground px-4">
                      Page {currentPage} • {totalCount} threads
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!hasMore}
                      onClick={() => setCurrentPage(prev => prev + 1)}
                      className="btn-superhuman"
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
              </div>
            )}
          </div>
        </div>
                  </div>
  );
}

interface EmailThreadItemProps {
  thread: EmailThread;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onClick: () => void;
}

function EmailThreadItem({ thread, isSelected, isExpanded, onToggleSelect, onToggleExpand, onClick }: EmailThreadItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [, setLocation] = useLocation();

  const getSenderName = (from: string) => {
    if (from.includes('<')) {
      return from.split('<')[0].trim();
    }
    return from.split('@')[0];
  };

  const latestMessage = thread.messages[0];

  return (
    <div className="border-b border-border">
      {/* Main Thread Row */}
      <div
        className={`email-item group px-6 py-4 cursor-pointer ${
          isSelected ? 'bg-primary/10' : ''
        } ${!thread.isRead ? 'bg-muted/20' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={onClick}
      >
        <div className="flex items-start space-x-4">
          {/* Expand/Collapse Button for threads with multiple messages */}
          {thread.messageCount > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(thread.threadId);
              }}
              className="flex-shrink-0 pt-0.5 text-muted-foreground hover:text-foreground transition-smooth"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          )}

          {/* Checkbox - visible on hover */}
          <div className={`flex-shrink-0 pt-0.5 ${isHovered || isSelected ? 'opacity-100' : 'opacity-0'}`}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect(thread.threadId);
              }}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-smooth ${
                isSelected
                  ? 'bg-primary border-primary'
                  : 'border-border hover:border-primary'
              }`}
            >
              {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
            </button>
          </div>

          {/* Thread Content */}
              <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between mb-1">
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                <span className={`text-sm truncate ${!thread.isRead ? 'font-bold text-foreground' : 'font-semibold text-foreground'}`}>
                  {getSenderName(thread.from_)}
                </span>
                <span className={`text-sm truncate flex-1 ${!thread.isRead ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>
                  {thread.subject || '(No subject)'}
                </span>
                {thread.messageCount > 1 && (
                  <span className="flex-shrink-0 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {thread.messageCount}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0 ml-4">
                {formatDistanceToNow(new Date(thread.timestamp), { addSuffix: true }).replace('about ', '')}
              </span>
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {latestMessage.snippet.replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')}
            </p>
          </div>

          {/* Quick Actions - visible on hover */}
          <div className={`email-actions flex items-center space-x-1 flex-shrink-0 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                // Archive action
              }}
              className="h-8 w-8 rounded-lg hover:bg-muted"
              title="Archive"
            >
              <Archive className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                // Delete action
              }}
              className="h-8 w-8 rounded-lg hover:bg-destructive/20 hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                // Snooze action
              }}
              className="h-8 w-8 rounded-lg hover:bg-muted"
              title="Snooze"
            >
              <Clock className="w-4 h-4" />
            </Button>
                </div>
              </div>
            </div>

      {/* Expanded Messages */}
      {isExpanded && thread.messageCount > 1 && (
        <div className="bg-muted/30 border-t border-border">
          {thread.messages.slice(1).map((message, index) => (
            <div
              key={message.messageId}
              className="px-6 py-3 pl-20 border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-smooth"
              onClick={() => setLocation(`/email/${message.messageId}`)}
            >
              <div className="flex items-baseline justify-between mb-1">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <span className="text-xs text-muted-foreground truncate">
                    {getSenderName(message.from_)}
                  </span>
                  <span className="text-xs text-muted-foreground truncate flex-1">
                    {message.snippet.substring(0, 80).replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')}...
                  </span>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0 ml-4">
                  {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true }).replace('about ', '')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
