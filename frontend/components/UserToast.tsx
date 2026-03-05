// frontend/components/UserToast.tsx - ENHANCED WITH THEME & STABLE TIMER
import React, { useEffect, useRef } from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useDarkMode } from '../pages/_app';

interface Props {
  text: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  onClose: () => void;
  duration?: number;
}

const getIcon = (type?: string) => {
  switch (type) {
    case 'success':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'warning':
      return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    case 'error':
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    default:
      return <Info className="w-5 h-5 text-blue-500" />;
  }
};

const getBackgroundColor = (type?: string, darkMode?: boolean) => {
  if (darkMode) {
    switch (type) {
      case 'success':
        return 'bg-green-900/90';
      case 'warning':
        return 'bg-yellow-900/90';
      case 'error':
        return 'bg-red-900/90';
      default:
        return 'bg-gray-800/90';
    }
  }
  switch (type) {
    case 'success':
      return 'bg-green-50';
    case 'warning':
      return 'bg-yellow-50';
    case 'error':
      return 'bg-red-50';
    default:
      return 'bg-white';
  }
};

const getBorderColor = (type?: string) => {
  switch (type) {
    case 'success':
      return 'border-green-200';
    case 'warning':
      return 'border-yellow-200';
    case 'error':
      return 'border-red-200';
    default:
      return 'border-gray-200';
  }
};

export default function UserToast({ text, type = 'info', onClose, duration = 5000 }: Props) {
  const { darkMode } = useDarkMode();

  // Store onClose in a ref so the timer stays stable across re-renders
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Stable timer that only restarts if duration changes
  useEffect(() => {
    const timer = setTimeout(() => {
      onCloseRef.current();
    }, duration);

    return () => clearTimeout(timer); // Cleanup if component unmounts
  }, [duration]); // Only restart if duration changes, not when room re-renders

  return (
    <div
      className={`px-4 py-3 rounded-lg shadow-lg animate-slide-in-right flex items-center gap-3 max-w-sm border backdrop-blur-sm ${getBackgroundColor(type, darkMode)
        } ${getBorderColor(type)}`}
    >
      {getIcon(type)}
      <span
        className="flex-1 text-sm"
        style={{ color: darkMode ? 'var(--text-primary)' : 'inherit' }}
      >
        {text}
      </span>
      <button
        onClick={onClose}
        className="p-1 rounded transition-colors hover:bg-black/10 dark:hover:bg-white/10"
        style={{ color: darkMode ? 'var(--text-muted)' : 'var(--text-muted)' }}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}