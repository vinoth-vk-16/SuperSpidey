import { useState, useRef, useEffect } from 'react';
import { Mail, Lightbulb } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface SpideyChatProps {
  className?: string;
}

interface UserInfo {
  name: string;
  info: string;
  style: string;
}

// Custom Send Icon Component
const SendIcon = ({ className }: { className?: string }) => (
  <img src="/send.svg" alt="Send" className={className} />
);

export default function SpideyChat({ className = '' }: SpideyChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch user info for context
  const { data: userInfoData } = useQuery({
    queryKey: ['userInfo', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      
      const response = await fetch('https://superspidey-email-management.onrender.com/fetch-user-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_email: user.email,
        }),
      });
      
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!user?.email,
  });

  // Build context string from user info
  const buildContext = (): string => {
    if (!userInfoData || !userInfoData.found) return '';
    
    const { name, info, style } = userInfoData;
    const parts = [];
    
    if (name) parts.push(`Name: ${name}`);
    if (info) parts.push(`Context: ${info}`);
    if (style) parts.push(`Writing Style: ${style}`);
    
    return parts.join('. ');
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;
    if (!user?.email) {
      toast({
        title: "Authentication required",
        description: "Please log in to use Spidey",
        variant: "destructive",
      });
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Get selected AI model type from localStorage (user settings)
      const selectedModel = localStorage.getItem('ai-model-type') || 'gemini_api_key';
      const apiKey = localStorage.getItem(`api-key-${selectedModel}`);
      
      if (!apiKey) {
        const modelName = selectedModel === 'gemini_api_key' ? 'Gemini' : 'DeepSeek V3';
        toast({
          title: "API Key Required",
          description: `Please set your ${modelName} API key in Settings before using Spidey`,
          variant: "destructive",
        });
        setIsLoading(false);
        setMessages(prev => prev.filter(m => m.id !== userMessage.id));
        return;
      }
      
      const response = await fetch('https://superspidey-spideyagent.onrender.com/invoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_email: user.email,
          key_type: selectedModel,
          task: inputValue,
          context: buildContext(),
          previous_convo: conversationHistory,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from Spidey');
      }

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message || 'I processed your request successfully.',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Update conversation history
      const newHistory = `${conversationHistory}\nUser: ${inputValue}\nAssistant: ${assistantMessage.content}`;
      setConversationHistory(newHistory);

      // Show success toast if drafts were created
      if (data.drafts_created && data.drafts_created > 0) {
        toast({
          title: "Drafts created!",
          description: `${data.drafts_created} email draft${data.drafts_created > 1 ? 's' : ''} created successfully`,
        });
      }
    } catch (error) {
      console.error('Spidey API error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to get response from Spidey",
        variant: "destructive",
      });
      
      // Remove user message on error
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const showInitialState = messages.length === 0;

  return (
    <div className={`flex flex-col h-full bg-background ${className}`}>
      {showInitialState ? (
        // Initial state with logo and suggestions
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
          {/* Logo - increased size */}
          <div className="mb-8">
            <img 
              src="/logo.png" 
              alt="Spidey Logo" 
              className="w-28 h-28 object-contain"
            />
          </div>

          {/* Greeting */}
          <div className="flex flex-col space-y-1 text-center mb-6">
            <h2 className="text-lg font-medium text-foreground">
              Hi I'm Spidey
            </h2>
            <p className="text-base font-medium text-foreground">
              How can I help you today?
            </p>
          </div>

          {/* Suggestion Badges - transparent with grey border */}
          <div className="w-full flex flex-wrap items-center justify-center gap-2 mb-8">
            <button
              onClick={() => handleSuggestionClick('Write an email for draft to referral at google')}
              className="h-8 px-3 cursor-pointer gap-1.5 text-xs rounded-md border border-border bg-transparent hover:bg-muted/30 transition-colors flex items-center"
            >
              <Mail aria-hidden="true" className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-foreground">Write an email for draft to referral at google</span>
            </button>
            <button
              onClick={() => handleSuggestionClick('How to write a professional email')}
              className="h-8 px-3 cursor-pointer gap-1.5 text-xs rounded-md border border-border bg-transparent hover:bg-muted/30 transition-colors flex items-center"
            >
              <Lightbulb aria-hidden="true" className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-foreground">How to write a professional email</span>
            </button>
          </div>
        </div>
      ) : (
        // Chat messages
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4">
          <div className="space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                {/* Profile Image */}
                <div className="mb-2">
                  {message.role === 'user' ? (
                    user?.picture ? (
                      <img
                        src={user.picture}
                        alt="User"
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                        {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                      </div>
                    )
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center">
                      <img src="/logo.png" alt="Spidey" className="w-6 h-6 object-contain" />
                    </div>
                  )}
                </div>
                {/* Message Content */}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-[#2a2a2a] text-foreground'
                      : 'bg-[#1a1a1a] text-foreground'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex flex-col items-start">
                <div className="mb-2">
                  <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center">
                    <img src="/logo.png" alt="Spidey" className="w-6 h-6 object-contain" />
                  </div>
                </div>
                <div className="bg-[#1a1a1a] rounded-2xl px-4 py-3">
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Input Area - with grey box and send icon inside */}
      <div className="p-4 flex-shrink-0">
        <div className="relative rounded-xl ring-1 ring-border bg-muted">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything..."
            className="min-h-[100px] resize-none border-none shadow-none focus-visible:ring-0 pr-14 rounded-xl bg-transparent"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="absolute top-1/2 -translate-y-1/2 right-3 h-9 w-9 rounded-full border-2 border-primary bg-transparent hover:bg-primary/10 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center space-x-0.5">
                <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            ) : (
              <SendIcon className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
