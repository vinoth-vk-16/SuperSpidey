import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Mail, Settings, LogOut, Inbox, SquarePen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface NavLink {
  label: string;
  path: string;
  icon: React.ElementType;
  count?: number | null;
}

export default function Sidebar() {
  const [location, setLocation] = useLocation();
  const { logout, user } = useAuth();
  const [showLogout, setShowLogout] = useState(false);

  const isActive = (path: string) => {
    if (path === '/' && (location === '/' || location.startsWith('/email/'))) {
      return true;
    }
    return location === path;
  };

  const navItems: NavLink[] = [
    { icon: Mail, label: 'Inbox', path: '/', count: null },
    { icon: SquarePen, label: 'Compose', path: '/compose', count: null },
  ];

  const bottomNavItems: NavLink[] = [
    { icon: Settings, label: 'Settings', path: '/settings', count: null },
  ];

  return (
    <aside className="w-16 bg-sidebar border-r border-sidebar-border flex flex-col h-screen">
      {/* Navigation Items */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => (
          <SidebarLink
            key={item.path}
            link={item}
            isActive={isActive(item.path)}
            onClick={() => setLocation(item.path)}
          />
        ))}

        <div className="py-2">
          <div className="h-px bg-sidebar-border mx-1" />
        </div>

        {bottomNavItems.map((item) => (
          <SidebarLink
            key={item.path}
            link={item}
            isActive={isActive(item.path)}
            onClick={() => setLocation(item.path)}
          />
        ))}
      </nav>

      {/* Profile Section */}
      {user && (
        <div className="mt-auto border-t border-sidebar-border p-2 flex-shrink-0">
          <div className="space-y-2">
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShowLogout(!showLogout)}
                  className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-sidebar-accent transition-smooth group relative"
                >
                  {user.picture ? (
                    <img
                      src={user.picture}
                      alt="Profile"
                      className="w-10 h-10 rounded-lg border-2 border-sidebar-border group-hover:border-primary transition-smooth shadow-sm"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          const fallback = document.createElement('div');
                          fallback.className = 'w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground text-sm font-semibold border-2 border-sidebar-border group-hover:border-primary transition-smooth shadow-sm';
                          fallback.textContent = (user.name || user.email || 'U').charAt(0).toUpperCase();
                          parent.appendChild(fallback);
                        }
                      }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground text-sm font-semibold border-2 border-sidebar-border group-hover:border-primary transition-smooth shadow-sm">
                      {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                <div className="font-semibold">{user.name || 'User'}</div>
                <div className="text-muted-foreground">{user.email}</div>
              </TooltipContent>
            </Tooltip>

            {showLogout && (
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      logout();
                      setShowLogout(false);
                    }}
                    className="w-full h-9 text-destructive hover:text-destructive hover:bg-destructive/20 transition-smooth animate-in slide-in-from-top-2"
                  >
                    <LogOut className="w-4 h-4" strokeWidth={2} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  Logout
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

interface SidebarLinkProps {
  link: NavLink;
  isActive: boolean;
  onClick: () => void;
}

function SidebarLink({ link, isActive, onClick }: SidebarLinkProps) {
  const Icon = link.icon;
  
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "w-full flex items-center justify-center p-2.5 rounded-lg transition-smooth group relative",
            isActive
              ? 'bg-primary text-primary-foreground shadow-sm hover:brightness-110'
              : 'text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent'
          )}
        >
          <Icon className="w-4 h-4" strokeWidth={2} />
          {link.count !== null && link.count !== undefined && link.count > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-semibold rounded-full flex items-center justify-center shadow-sm">
              {link.count > 99 ? '99+' : link.count}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        {link.label}
      </TooltipContent>
    </Tooltip>
  );
}
