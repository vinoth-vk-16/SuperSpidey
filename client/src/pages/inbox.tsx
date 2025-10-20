import { useLocation } from 'wouter';
import { Search, Archive, Trash2, Clock, Check, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import Sidebar from '@/components/sidebar';

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

export default function InboxPage() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set());

  const { data: emailData, isLoading, error, refetch } = useQuery({
    queryKey: ['emails'],
    queryFn: async () => {
      const response = await fetch('/api/gmail/messages');
      if (!response.ok) {
        throw new Error('Failed to fetch emails');
      }
      return response.json();
    },
    refetchInterval: 30000,
  });

  const emails: Email[] = emailData?.messages || [];

  const filteredEmails = emails.filter((email) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      email.subject.toLowerCase().includes(query) ||
      email.from.toLowerCase().includes(query) ||
      email.snippet.toLowerCase().includes(query)
    );
  });

  const toggleEmailSelection = (emailId: string) => {
    const newSelection = new Set(selectedEmailIds);
    if (newSelection.has(emailId)) {
      newSelection.delete(emailId);
    } else {
      newSelection.add(emailId);
    }
    setSelectedEmailIds(newSelection);
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
          {filteredEmails.length === 0 ? (
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
                {filteredEmails.map((email) => (
                  <EmailItem
                    key={email.id}
                    email={email}
                    isSelected={selectedEmailIds.has(email.id)}
                    onToggleSelect={toggleEmailSelection}
                    onClick={() => setLocation(`/email/${email.id}`)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface EmailItemProps {
  email: Email;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onClick: () => void;
}

function EmailItem({ email, isSelected, onToggleSelect, onClick }: EmailItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  const getSenderName = (from: string) => {
    if (from.includes('<')) {
      return from.split('<')[0].trim();
    }
    return from.split('@')[0];
  };

  return (
    <div
      className={`email-item group border-b border-border px-6 py-4 cursor-pointer ${
        isSelected ? 'bg-primary/10' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <div className="flex items-start space-x-4">
        {/* Checkbox - visible on hover */}
        <div className={`flex-shrink-0 pt-0.5 ${isHovered || isSelected ? 'opacity-100' : 'opacity-0'}`}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(email.id);
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

        {/* Email Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between mb-1">
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              <span className="font-semibold text-foreground text-sm truncate">
                {getSenderName(email.from)}
              </span>
              <span className="text-foreground font-medium text-sm truncate flex-1">
                {email.subject || '(No subject)'}
              </span>
            </div>
            <span className="text-xs text-muted-foreground flex-shrink-0 ml-4">
              {formatDistanceToNow(new Date(email.date), { addSuffix: true }).replace('about ', '')}
            </span>
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {email.snippet || email.body.replace(/\n/g, ' ').substring(0, 120)}
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
  );
}
