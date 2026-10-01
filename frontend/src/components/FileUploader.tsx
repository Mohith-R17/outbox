import { useState } from 'react';
import Papa from 'papaparse';
import { Upload, X, FileText } from 'lucide-react';

interface FileUploaderProps {
  onEmailsExtracted: (emails: string[]) => void;
  error?: string;
}

export const FileUploader = ({ onEmailsExtracted, error }: FileUploaderProps) => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [emailCount, setEmailCount] = useState<number>(0);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setLocalError(null);

    Papa.parse(file, {
      complete: (results) => {
        const emails = new Set<string>();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        // Flatten all rows and columns to find emails
        results.data.forEach((row: any) => {
          if (Array.isArray(row)) {
            row.forEach((cell: string) => {
              if (typeof cell === 'string' && emailRegex.test(cell.trim())) {
                emails.add(cell.trim());
              }
            });
          } else if (typeof row === 'object' && row !== null) {
            Object.values(row).forEach((val: any) => {
              if (typeof val === 'string' && emailRegex.test(val.trim())) {
                emails.add(val.trim());
              }
            });
          }
        });

        const extracted = Array.from(emails);
        if (extracted.length === 0) {
          setLocalError('No valid email addresses found in the file.');
          setEmailCount(0);
          onEmailsExtracted([]);
        } else {
          setEmailCount(extracted.length);
          onEmailsExtracted(extracted);
        }
      },
      error: (error) => {
        setLocalError(`Error parsing CSV: ${error.message}`);
      },
    });
  };

  const clearFile = () => {
    setFileName(null);
    setEmailCount(0);
    setLocalError(null);
    onEmailsExtracted([]);
  };

  return (
    <div className="w-full">
      {!fileName ? (
        <div className="mt-2 flex justify-center rounded-lg border border-dashed border-gray-900/25 px-6 py-6 hover:bg-gray-50 transition-colors">
          <div className="text-center">
            <Upload className="mx-auto h-8 w-8 text-gray-300" aria-hidden="true" />
            <div className="mt-4 flex text-sm leading-6 text-gray-600 justify-center">
              <label
                htmlFor="file-upload"
                className="relative cursor-pointer rounded-md bg-white font-semibold text-blue-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-2 hover:text-blue-500"
              >
                <span>Upload a CSV or TXT file</span>
                <input id="file-upload" name="file-upload" type="file" accept=".csv,.txt" className="sr-only" onChange={handleFileUpload} />
              </label>
            </div>
            <p className="text-xs leading-5 text-gray-600">Emails will be automatically extracted</p>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex items-center justify-between p-3 border rounded-md bg-gray-50">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-2 rounded text-blue-600">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{fileName}</p>
              <p className="text-xs text-gray-500">
                {emailCount} email address{emailCount !== 1 && 'es'} detected
              </p>
            </div>
          </div>
          <button type="button" onClick={clearFile} className="p-1 text-gray-400 hover:text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
      {(error || localError) && (
        <p className="mt-2 text-sm text-red-600">{error || localError}</p>
      )}
    </div>
  );
};
