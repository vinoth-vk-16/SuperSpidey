import { useLocation } from 'wouter';
import { Search, Trash2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import Sidebar from '@/components/sidebar';
import SpideyChat from '@/components/spidey-chat';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

interface Draft {
  draft_id: string;
  to_email?: string;
  subject?: string;
  body?: string;
  created_at: string;
  updated_at: string;
}

export default function DraftsPage() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: draftsData, isLoading, error, refetch } = useQuery({
    queryKey: ['drafts', currentPage],
    queryFn: async () => {
      if (!user?.email) {
        throw new Error('User not authenticated');
      }
      
      const response = await fetch('https://superspidey-email-management.onrender.com/fetch-drafts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_email: user.email,
          page: currentPage,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to fetch drafts');
      }
      return response.json();
    },
    enabled: !!user?.email,
    refetchInterval: 3000, // Refetch every 3 seconds in background
    refetchIntervalInBackground: true, // Continue refetching even when tab is not focused
  });

  const deleteDraftMutation = useMutation({
    mutationFn: async (draftId: string) => {
      if (!user?.email) {
        throw new Error('User not authenticated');
      }
      
      const response = await fetch('https://superspidey-email-management.onrender.com/delete-draft', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_email: user.email,
          draft_id: draftId,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete draft');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Draft deleted",
        description: "The draft has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const drafts: Draft[] = draftsData?.drafts || [];
  const totalCount = draftsData?.total_count || 0;
  const hasMore = draftsData?.has_more || false;

  const filteredDrafts = drafts.filter((draft) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      draft.subject?.toLowerCase().includes(query) ||
      draft.to_email?.toLowerCase().includes(query) ||
      draft.body?.toLowerCase().includes(query)
    );
  });

  const handleEditDraft = (draft: Draft) => {
    // Navigate to compose page with draft data
    setLocation(`/compose?draftId=${draft.draft_id}`);
  };

  if (isLoading) {
    return (
      <div className="h-screen flex bg-background">
        <Sidebar />
        <div className="w-96 bg-background flex-shrink-0">
          <SpideyChat className="h-full" />
        </div>
        <div className="flex-1 p-2 pr-2">
          <div className="h-full bg-card rounded-tl-3xl rounded-tr-3xl overflow-hidden flex flex-col">
            <div className="px-6 py-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="h-6 w-24 bg-muted rounded animate-pulse"></div>
                <div className="h-8 w-64 bg-muted rounded-lg animate-pulse"></div>
              </div>
            </div>
            <div className="flex-1 overflow-auto custom-scrollbar">
              <div className="max-w-5xl mx-auto">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="border-b border-border px-6 py-4">
                    <div className="flex items-start space-x-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="h-4 w-48 bg-muted rounded animate-pulse"></div>
                          <div className="h-3 w-16 bg-muted rounded animate-pulse"></div>
                        </div>
                        <div className="h-3 w-full bg-muted rounded animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
        <div className="w-96 bg-background flex-shrink-0">
          <SpideyChat className="h-full" />
        </div>
        <div className="flex-1 p-2 pr-2">
          <div className="h-full bg-card rounded-tl-3xl rounded-tr-3xl overflow-hidden flex items-center justify-center">
            <div className="text-center">
              <div className="text-destructive font-semibold mb-4">Failed to load drafts</div>
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
      
      <div className="w-96 bg-background flex-shrink-0">
        <SpideyChat className="h-full" />
      </div>

      <div className="flex-1 p-2 pr-2">
        <div className="h-full bg-card rounded-tl-3xl rounded-tr-3xl overflow-hidden flex flex-col">
          <div className="px-6 py-3 border-b border-border">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold text-foreground">Drafts</h1>
              <div className="flex items-center space-x-3">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search drafts"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-8 pl-8 pr-4 bg-muted border-0 rounded-lg text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
              </div>
            </div>
          </div>

          {filteredDrafts.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-muted-foreground" />
                </div>
                <div className="text-foreground text-lg font-semibold mb-2">
                  {searchQuery ? 'No drafts found' : 'No drafts yet'}
                </div>
                <div className="text-muted-foreground">
                  {searchQuery
                    ? 'Try a different search term'
                    : 'Your saved drafts will appear here'}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto custom-scrollbar">
              <div className="max-w-5xl mx-auto">
                {filteredDrafts.map((draft) => (
                  <div key={draft.draft_id}>
                    <div 
                      className="email-item px-6 py-2.5 cursor-pointer group"
                      onClick={() => handleEditDraft(draft)}
                    >
                      <div className="flex items-center gap-2 w-full">
                        {/* Recipient - compact width */}
                        <div className="flex-shrink-0 w-36">
                          <span className="text-xs text-muted-foreground truncate block">
                            To: {draft.to_email || '(No recipient)'}
                          </span>
                        </div>

                        {/* Subject - compact width */}
                        <div className="flex-shrink-0 w-48">
                          <span className="text-xs font-medium text-foreground truncate block">
                            {draft.subject || '(No subject)'}
                          </span>
                        </div>

                        {/* Separator */}
                        <span className="text-xs text-muted-foreground flex-shrink-0 px-1">—</span>

                        {/* Body snippet - takes remaining space */}
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <p className="text-xs text-muted-foreground truncate">
                            {draft.body || '(No content)'}
                          </p>
                        </div>

                        {/* Timestamp - compact, more space from right */}
                        <div className="flex-shrink-0 w-20 text-right ml-4">
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(draft.updated_at), { addSuffix: true }).replace('about ', '').replace(' ago', '')}
                          </span>
                        </div>

                        {/* Delete button - visible on hover */}
                        <div className={`flex items-center flex-shrink-0 ml-3 ${
                          deleteDraftMutation.isPending ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        } transition-opacity`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteDraftMutation.mutate(draft.draft_id);
                            }}
                            disabled={deleteDraftMutation.isPending}
                            className="h-7 w-7 rounded hover:bg-destructive/20 hover:text-destructive"
                            title="Delete draft"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="border-b border-border"></div>
                  </div>
                ))}
                
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
                      Page {currentPage} • {totalCount} drafts
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

