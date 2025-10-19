import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Mail, Settings, LogOut, Inbox, PenSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export default function Sidebar() {
  const [location, setLocation] = useLocation();
  const { logout, user } = useAuth();
  const [showLogout, setShowLogout] = useState(false);

  const isActive = (path: string) => {
    if (path === '/' && (location === '/' || location === '/compose')) {
      return true;
    }
    return location === path;
  };

  return (
    <aside className="w-16 bg-white border-r border-gray-200 flex flex-col py-4 min-h-screen shadow-sm">
      {/* Top Section - Navigation */}
      <div className="flex flex-col items-center space-y-4">
        {/* Logo/Brand */}
        <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
          <Mail className="w-4 h-4 text-white" />
        </div>

        {/* Email Icon */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation('/')}
          className={`h-10 w-10 p-0 rounded-xl transition-all ${
            isActive('/')
              ? 'bg-blue-100 text-blue-600 shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
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
          className={`h-10 w-10 p-0 rounded-xl transition-all ${
            isActive('/settings')
              ? 'bg-blue-100 text-blue-600 shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          data-testid="button-settings"
        >
          <Settings className="w-5 h-5" />
        </Button>
      </div>

      {/* Bottom Section - Profile Picture */}
      {user && (
        <div className="mt-auto pt-4 border-t border-gray-200 w-full flex flex-col items-center space-y-2">
          <button
            onClick={() => setShowLogout(!showLogout)}
            className="relative group focus:outline-none"
          >
            {user.picture ? (
              <img
                src={user.picture}
                alt="Profile"
                className="w-10 h-10 rounded-xl border-2 border-gray-200 hover:border-blue-500 transition-colors cursor-pointer shadow-sm"
                onError={(e) => {
                  // Fallback to user initial if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    const fallback = document.createElement('div');
                    fallback.className = 'w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold border-2 border-gray-200 hover:border-blue-500 transition-colors cursor-pointer shadow-sm';
                    fallback.textContent = (user.name || user.email || 'U').charAt(0).toUpperCase();
                    parent.appendChild(fallback);
                  }
                }}
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold border-2 border-gray-200 hover:border-blue-500 transition-colors cursor-pointer shadow-sm">
                {(user.name || user.email || 'U').charAt(0).toUpperCase()}
              </div>
            )}
          </button>

          {/* Logout Button - Only show when profile picture is clicked */}
          {showLogout && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                logout();
                setShowLogout(false);
              }}
              className="h-8 w-8 p-0 text-gray-600 hover:bg-gray-100 rounded-lg animate-in slide-in-from-top-2"
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}
    </aside>
  );
}
