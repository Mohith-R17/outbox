import { useState } from 'react';
import { Header } from '../components/Header';
import { EmailTable } from '../components/EmailTable';
import { ComposeEmailModal } from '../components/ComposeEmailModal';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useScheduledEmails, useSentEmails, useSearchEmails } from '../hooks/useEmails';
import { Plus, Search, Calendar, CheckCircle } from 'lucide-react';

export const Dashboard = () => {
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: scheduledEmails = [], isLoading: isScheduledLoading } = useScheduledEmails();
  const { data: sentEmails = [], isLoading: isSentLoading } = useSentEmails();
  
  // Custom debounced search hook would be better in prod, but keeping simple here
  const { data: searchResults = [], isLoading: isSearchLoading } = useSearchEmails(searchQuery);

  const displayedEmails = searchQuery.length > 0 
    ? searchResults.filter(e => activeTab === 'scheduled' ? e.status === 'SCHEDULED' || e.status === 'PROCESSING' : e.status === 'SENT' || e.status === 'FAILED')
    : activeTab === 'scheduled' ? scheduledEmails : sentEmails;

  const isLoading = searchQuery.length > 0 ? isSearchLoading : (activeTab === 'scheduled' ? isScheduledLoading : isSentLoading);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Email Campaigns</h2>
            <p className="text-sm text-gray-500 mt-1">Manage your scheduled and sent emails.</p>
          </div>
          <Button onClick={() => setIsComposeOpen(true)} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            Compose Email
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
              <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('scheduled')}
                  className={`${
                    activeTab === 'scheduled'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium flex items-center gap-2`}
                >
                  <Calendar className="w-4 h-4" />
                  Scheduled
                  <span className="bg-gray-100 text-gray-900 rounded-full py-0.5 px-2.5 text-xs font-medium">
                    {scheduledEmails.length}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('sent')}
                  className={`${
                    activeTab === 'sent'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium flex items-center gap-2`}
                >
                  <CheckCircle className="w-4 h-4" />
                  Sent
                  <span className="bg-gray-100 text-gray-900 rounded-full py-0.5 px-2.5 text-xs font-medium">
                    {sentEmails.length}
                  </span>
                </button>
              </nav>

              <div className="relative w-full sm:w-64">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
                </div>
                <Input
                  type="search"
                  placeholder="Search emails..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <EmailTable 
              emails={displayedEmails} 
              isLoading={isLoading} 
              type={activeTab} 
            />
          </div>
        </div>
      </main>

      <ComposeEmailModal 
        isOpen={isComposeOpen} 
        onClose={() => setIsComposeOpen(false)} 
      />
    </div>
  );
};
