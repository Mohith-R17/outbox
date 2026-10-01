import { useAuth } from '../hooks/useAuth';
import { useSlackStatus, useDisconnectSlack } from '../hooks/useSlack';
import { Button } from './Button';
import { LogOut, Link2, Unlink } from 'lucide-react';
import { slackService } from '../services/slackService';

export const Header = () => {
  const { user, logout, isLoggingOut } = useAuth();
  const { data: slackStatus } = useSlackStatus();
  const { mutate: disconnectSlack, isPending: isDisconnecting } = useDisconnectSlack();

  const handleSlackConnect = () => {
    window.location.href = slackService.getConnectUrl();
  };

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-900">ReachInbox</h1>
            <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
              Scheduler
            </span>
          </div>

          <div className="flex items-center gap-6">
            {/* Slack Connection */}
            <div className="flex items-center gap-2">
              {slackStatus?.connected ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-green-600 font-medium flex items-center">
                    <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                    Slack Connected {slackStatus.workspaceName ? `(${slackStatus.workspaceName})` : ''}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="h-8 text-xs px-2"
                    onClick={() => disconnectSlack()}
                    isLoading={isDisconnecting}
                  >
                    <Unlink className="w-3 h-3 mr-1" /> Disconnect
                  </Button>
                </div>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleSlackConnect}
                >
                  <Link2 className="w-3 h-3 mr-1" /> Connect Slack
                </Button>
              )}
            </div>

            {/* User Profile */}
            {user && (
              <div className="flex items-center gap-4 border-l pl-6">
                <div className="flex items-center gap-3">
                  <img 
                    src={user.avatar || `https://ui-avatars.com/api/?name=${user.name}`} 
                    alt={user.name}
                    className="w-8 h-8 rounded-full bg-gray-200"
                  />
                  <div className="hidden md:block">
                    <p className="text-sm font-medium text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  className="h-8 w-8 p-0"
                  onClick={() => logout()}
                  isLoading={isLoggingOut}
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
