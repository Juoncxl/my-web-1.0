import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export type AuthFeedbackType = 'error' | 'success';

interface AuthFeedbackProps {
  type: AuthFeedbackType;
  message: string;
}

export const AuthFeedback: React.FC<AuthFeedbackProps> = ({ type, message }) => {
  if (!message) return null;

  const isError = type === 'error';
  return (
    <div
      className={isError
        ? 'mb-4 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs text-rose-600 dark:text-rose-300 flex items-start gap-2 animate-in fade-in'
        : 'mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs text-emerald-600 dark:text-emerald-300 flex items-start gap-2 animate-in fade-in'}
    >
      {isError
        ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        : <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
      <span>{message}</span>
    </div>
  );
};
