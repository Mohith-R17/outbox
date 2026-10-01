import { useState } from 'react';
import { Modal } from './Modal';
import { Input } from './Input';
import { Button } from './Button';
import { FileUploader } from './FileUploader';
import { useScheduleEmail } from '../hooks/useEmails';
import toast from 'react-hot-toast';

interface ComposeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ComposeEmailModal = ({ isOpen, onClose }: ComposeEmailModalProps) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const { mutateAsync: scheduleEmail, isPending } = useScheduleEmail();

  const handleClose = () => {
    if (!isPending) {
      setSubject('');
      setBody('');
      setScheduledAt('');
      setRecipients([]);
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (recipients.length === 0) {
      toast.error('Please provide at least one recipient email address.');
      return;
    }

    if (!scheduledAt) {
      toast.error('Please select a schedule time.');
      return;
    }

    const scheduledDate = new Date(scheduledAt);
    if (scheduledDate < new Date()) {
      toast.error('Schedule time must be in the future.');
      return;
    }

    try {
      // Schedule each email individually
      // The backend handles rate limiting and concurrency gracefully
      for (const recipient of recipients) {
        await scheduleEmail({
          recipient,
          subject,
          body,
          scheduledAt: scheduledDate.toISOString(),
          // Generate a unique idempotency key for this batch item
          idempotencyKey: `compose-${Date.now()}-${recipient}`
        });
      }
      
      toast.success(`Successfully queued ${recipients.length} emails!`);
      handleClose();
    } catch (error) {
      // Errors handled by mutation
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Compose Scheduled Email">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Recipients (Upload CSV)</label>
          <FileUploader onEmailsExtracted={setRecipients} />
        </div>

        <Input
          label="Subject"
          placeholder="Email subject line"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email Body</label>
          <textarea
            className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
            placeholder="Write your message here..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />
        </div>

        <Input
          label="Schedule Time"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          required
        />

        <div className="flex justify-end gap-3 pt-4 border-t mt-6">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isPending}>
            Schedule {recipients.length > 0 ? `${recipients.length} Emails` : 'Emails'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
