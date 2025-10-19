import { useLocation } from 'wouter';
import { ArrowLeft, Check, Clock, Paperclip, Reply, Forward, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

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

  if (isLoading) {
    return (
      <div className="h-full flex bg-white">
        <div className="w-full flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-white">
            <div className="flex items-center space-x-1">
              <Button variant="ghost" size="icon" className="h-6 w-6 p-0" onClick={() => setLocation('/')}>
                <ArrowLeft className="h-3 w-3" />
              </Button>
              <span className="text-xs font-medium text-gray-900">Loading...</span>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-gray-500 text-xs">Loading email...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !email) {
    return (
      <div className="h-full flex bg-white">
        <div className="w-full flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-white">
            <div className="flex items-center space-x-1">
              <Button variant="ghost" size="icon" className="h-6 w-6 p-0" onClick={() => setLocation('/')}>
                <ArrowLeft className="h-3 w-3" />
              </Button>
              <span className="text-xs font-medium text-gray-900">Email not found</span>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-red-500 text-xs mb-2">Email not found</div>
              <Button onClick={() => setLocation('/')} variant="outline" size="sm" className="text-xs">
                Back to Inbox
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-white">
      <div className="w-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-white">
          <div className="flex items-center space-x-1">
            <Button variant="ghost" size="icon" className="h-6 w-6 p-0" onClick={() => setLocation('/')}>
              <ArrowLeft className="h-3 w-3" />
            </Button>
            <span className="text-xs font-medium text-gray-900">Email Detail</span>
          </div>
          <div className="flex items-center space-x-1">
            <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
              <Check className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
              <Clock className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
              <Paperclip className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Email Content */}
        <div className="flex-1 overflow-auto">
          {/* Email Header */}
          <div className="p-3 border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-sm font-medium text-gray-900 truncate">
                {email.subject || '(No subject)'}
              </h1>
              <div className="flex items-center space-x-1">
                <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                  <Reply className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                  <Forward className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              <span className="text-gray-600">
                {email.from.includes('<') ?
                  email.from.split('<')[0].trim() :
                  email.from
                }
              </span>
              <span className="mx-1">to</span>
              <span className="text-gray-600">{email.to}</span>
              <span className="ml-2">{new Date(email.date).toLocaleString()}</span>
            </div>
          </div>

          {/* Email Body */}
          <div className="p-3">
            <div className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap">
              {email.body}
            </div>
          </div>
        </div>

        {/* Reply Section */}
        <div className="p-3 border-t border-gray-200 bg-white">
          <div className="flex items-center space-x-1 mb-2">
            <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
              <Reply className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
              <Forward className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="@mention anyone and share conversation"
              className="flex-1 text-xs px-2 py-1 border border-gray-300 rounded bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
              <Paperclip className="h-3 w-3" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-5 w-5 p-0"
              disabled={!replyText.trim()}
            >
              <Send className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
