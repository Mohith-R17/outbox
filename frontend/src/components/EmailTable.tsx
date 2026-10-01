import type { Email } from '../types';
import { format } from 'date-fns';
import { Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { cn } from './Button';

interface EmailTableProps {
  emails: Email[];
  isLoading: boolean;
  type: 'scheduled' | 'sent';
}

export const EmailTable = ({ emails, isLoading, type }: EmailTableProps) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
        <p className="text-sm text-gray-500">No emails found.</p>
      </div>
    );
  }

  const getStatusIcon = (status: Email['status']) => {
    switch (status) {
      case 'SCHEDULED': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'PROCESSING': return <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />;
      case 'SENT': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'FAILED': return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusBadgeClass = (status: Email['status']) => {
    switch (status) {
      case 'SCHEDULED': return 'bg-blue-50 text-blue-700 ring-blue-600/20';
      case 'PROCESSING': return 'bg-yellow-50 text-yellow-800 ring-yellow-600/20';
      case 'SENT': return 'bg-green-50 text-green-700 ring-green-600/20';
      case 'FAILED': return 'bg-red-50 text-red-700 ring-red-600/10';
    }
  };

  return (
    <div className="overflow-hidden bg-white shadow-sm ring-1 ring-gray-200 sm:rounded-lg">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Recipient</th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Subject</th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
              {type === 'scheduled' ? 'Scheduled For' : 'Date'}
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {emails.map((email) => (
            <tr key={email.id}>
              <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                {email.recipient}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 max-w-[200px] truncate">
                {email.subject}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                {format(new Date(type === 'scheduled' ? email.scheduledAt : (email.sentAt || email.failedAt || email.updatedAt)), 'MMM d, yyyy HH:mm')}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm">
                <span className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
                  getStatusBadgeClass(email.status)
                )}>
                  {getStatusIcon(email.status)}
                  {email.status}
                </span>
                {email.status === 'FAILED' && email.failureReason && (
                  <p className="mt-1 text-xs text-red-500 max-w-[150px] truncate" title={email.failureReason}>
                    {email.failureReason}
                  </p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
