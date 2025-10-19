import { useLocation } from 'wouter';
import { PenSquare, RotateCcw, Inbox, ArrowLeft, Search, Settings, User, Send, MessageCircle, Menu, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';

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
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
  const { user, logout } = useAuth();

  const { data: emailData, isLoading, error, refetch } = useQuery({
    queryKey: ['emails'],
    queryFn: async () => {
      const response = await fetch('/api/gmail/messages');
      if (!response.ok) {
        throw new Error('Failed to fetch emails');
      }
      return response.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const emails: Email[] = emailData?.messages || [];
  
  // Get unique contacts from emails
  const contacts = Array.from(new Set(emails.map(email => 
    email.from.includes('<') ? email.from.split('<')[0].trim() : email.from
  )));

  if (isLoading) {
    return (
      <div className="h-full flex flex-col bg-gray-50 relative overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 p-0 text-gray-600">
              <Menu className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-semibold text-gray-900">Inbox</h1>
          </div>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
              <Input placeholder="Search..." className="pl-7 text-xs h-8 w-48" />
            </div>
            <Button variant="ghost" size="sm">
              <RotateCcw className="h-4 w-4 animate-spin" />
            </Button>
            <Button size="sm" onClick={() => setLocation('/compose')} className="bg-blue-600 hover:bg-blue-700">
              <PenSquare className="h-4 w-4 mr-2" />
              Compose
            </Button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <RotateCcw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <div className="text-gray-600 text-sm font-medium">Loading your inbox...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col bg-gray-50 relative overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 p-0 text-gray-600">
              <Menu className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-semibold text-gray-900">Inbox</h1>
          </div>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
              <Input placeholder="Search..." className="pl-7 text-xs h-8 w-48" />
            </div>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => setLocation('/compose')} className="bg-blue-600 hover:bg-blue-700">
              <PenSquare className="h-4 w-4 mr-2" />
              Compose
            </Button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-600 text-sm font-medium mb-4">Failed to load emails</div>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RotateCcw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 relative overflow-hidden">
      {/* Single Header Throughout the Page */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center space-x-3">
          {/* Hamburger Menu */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onMouseEnter={() => setShowSidebar(true)}
              className="h-8 w-8 p-0 text-gray-600 hover:bg-gray-100"
            >
              <Menu className="h-4 w-4" />
            </Button>
            
            {/* Sidebar - Only visible on hamburger hover */}
            {showSidebar && (
              <div 
                className="fixed left-0 top-0 h-full w-16 bg-white border-r border-gray-200 shadow-lg z-50 flex flex-col py-4"
                onMouseLeave={() => setShowSidebar(false)}
              >
                {/* Top Section - Navigation */}
                <div className="flex flex-col items-center space-y-4">
                  {/* Logo/Brand */}
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                    <Inbox className="w-4 h-4 text-white" />
                  </div>

                  {/* Email Icon */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setLocation('/')}
                    className="h-10 w-10 p-0 rounded-xl bg-blue-100 text-blue-600 shadow-sm"
                    data-testid="button-email"
                  >
                    <Inbox className="w-5 h-5" />
                  </Button>

                  {/* Compose Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setLocation('/compose')}
                    className="h-10 w-10 p-0 rounded-xl text-gray-600 hover:bg-gray-100 transition-all"
                  >
                    <PenSquare className="w-5 h-5" />
                  </Button>
                </div>

                {/* Middle Section - Settings */}
                <div className="flex flex-col items-center mt-8">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setLocation('/settings')}
                    className="h-10 w-10 p-0 rounded-xl text-gray-600 hover:bg-gray-100 transition-all"
                    data-testid="button-settings"
                  >
                    <Settings className="w-5 h-5" />
                  </Button>
                </div>

                {/* Bottom Section - Profile Picture & Logout */}
                {user && (
                  <div className="mt-auto pt-4 border-t border-gray-200 w-full flex flex-col items-center space-y-2">
                    <button className="relative group focus:outline-none">
                      {user.picture ? (
                        <img
                          src={user.picture}
                          alt="Profile"
                          className="w-10 h-10 rounded-xl border-2 border-gray-200 hover:border-blue-500 transition-colors cursor-pointer shadow-sm"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold border-2 border-gray-200 hover:border-blue-500 transition-colors cursor-pointer shadow-sm">
                          {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={logout}
                      className="h-8 w-8 p-0 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      <LogOut className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <h1 className="text-lg font-semibold text-gray-900">Inbox</h1>
          <Badge variant="secondary" className="text-xs">
            {emails.length}
          </Badge>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Search Bar in Header */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
            <Input
              placeholder="Search..."
              className="pl-7 text-xs h-8 w-48"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => setLocation('/compose')} className="bg-blue-600 hover:bg-blue-700">
            <PenSquare className="h-4 w-4 mr-2" />
            Compose
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Contacts Panel */}
        <div className="w-48 flex flex-col bg-white border-r border-gray-200 flex-shrink-0">
          <div className="flex-1 overflow-auto">
            {contacts.length === 0 ? (
              <div className="p-3 text-center">
                <div className="text-gray-500 text-xs">No contacts</div>
              </div>
            ) : (
              <div className="space-y-0">
                {contacts.map((contact, index) => (
                  <div
                    key={index}
                    onClick={() => setSelectedContact(contact)}
                    className={`px-3 py-3 cursor-pointer transition-colors border-b border-gray-100 ${
                      selectedContact === contact 
                        ? 'bg-blue-50 border-l-4 border-l-blue-500' 
                        : 'hover:bg-gray-50'
                    }`}
                    style={{ minHeight: '48px' }}
                  >
                    <div className="text-xs font-medium text-gray-900 truncate flex items-center h-full">
                      {contact}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Middle Panel - Email List */}
        <div className="flex-1 flex flex-col bg-white border-r border-gray-200 min-w-0">
          {/* Email List */}
          <div className="flex-1 overflow-auto">
            {emails.length === 0 ? (
              <div className="flex-1 flex items-center justify-center h-full">
                <div className="text-center">
                  <Inbox className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <div className="text-gray-600 text-lg font-medium mb-2">No emails found</div>
                  <div className="text-gray-500 text-sm">
                    Emails sent through ContactRemedy will appear here.
                  </div>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {emails.map((email) => (
                  <div
                    key={email.id}
                    onClick={() => setLocation(`/email/${email.id}`)}
                    className="group py-2 hover:bg-gray-50 cursor-pointer transition-colors flex items-center"
                    style={{ minHeight: '36px' }}
                  >
                    <div className="flex items-center w-full px-4">
                      {/* Sender Name - aligned with contacts */}
                      <div className="w-48 flex-shrink-0 pr-3">
                        <span className="text-xs font-medium text-gray-900 truncate">
                          {email.from.includes('<') ?
                            email.from.split('<')[0].trim() :
                            email.from
                          }
                        </span>
                      </div>
                      
                      {/* Subject - Bold */}
                      <div className="w-48 flex-shrink-0 pr-3">
                        <h3 className="text-xs font-bold text-gray-900 truncate group-hover:text-blue-600">
                          {email.subject || '(No subject)'}
                        </h3>
                      </div>
                      
                      {/* Content - Normal, Single Line */}
                      <div className="flex-1 min-w-0 pr-3">
                        <p className="text-xs text-gray-600 truncate">
                          {email.snippet || email.body.replace(/\n/g, ' ').substring(0, 80)}
                        </p>
                      </div>
                      
                      {/* Time */}
                      <div className="flex-shrink-0">
                        <span className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(email.date), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - User Info & Chat */}
        <div className="w-80 flex flex-col bg-white flex-shrink-0">
          {/* User Info */}
          <div className="p-3">
            <div className="flex items-center space-x-2">
              {user?.picture ? (
                <img
                  src={user.picture}
                  alt="Profile"
                  className="w-8 h-8 rounded-full border border-gray-200"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
                  {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-semibold text-gray-900 truncate">
                  {user?.name || 'User'}
                </h3>
                <p className="text-xs text-gray-500 truncate">
                  {user?.email}
                </p>
              </div>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setLocation('/settings')}>
                <Settings className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Chat Interface */}
          <div className="flex-1 flex flex-col border-t border-gray-200">
            <div className="p-2">
              <div className="flex items-center space-x-2">
                <MessageCircle className="h-3 w-3 text-gray-600" />
                <h3 className="text-xs font-semibold text-gray-900">Quick Chat</h3>
              </div>
            </div>
            
            {/* Chat Messages */}
            <div className="flex-1 p-2 overflow-auto">
              <div className="space-y-2">
                <div className="text-center">
                  <div className="text-xs text-gray-500">Start a conversation</div>
                </div>
              </div>
            </div>

            {/* Chat Input */}
            <div className="p-2 border-t border-gray-200">
              <div className="flex items-center space-x-1">
                <Input
                  placeholder="Type a message..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  className="flex-1 text-xs h-7"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && chatMessage.trim()) {
                      // Handle send message
                      setChatMessage('');
                    }
                  }}
                />
                <Button 
                  size="sm" 
                  disabled={!chatMessage.trim()}
                  className="bg-blue-600 hover:bg-blue-700 h-7 w-7 p-0"
                >
                  <Send className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
