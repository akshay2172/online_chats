// frontend/components/TypingIndicator.tsx
import React from 'react';
import { useDarkMode } from '../pages/_app';

interface Props {
  users: string[];
}

const TypingIndicator: React.FC<Props> = ({ users }) => {
  const { darkMode } = useDarkMode();

  if (users.length === 0) return null;

  const getText = () => {
    if (users.length === 1) {
      return `${users[0]} is typing...`;
    } else if (users.length === 2) {
      return `${users[0]} and ${users[1]} are typing...`;
    } else if (users.length === 3) {
      return `${users[0]}, ${users[1]} and ${users[2]} are typing...`;
    } else {
      return `${users.length} people are typing...`;
    }
  };

  return (
    <div 
      className="flex items-center space-x-2 px-4 py-2 text-sm"
      style={{ color: 'var(--text-muted)' }}
    >
      <div className="flex space-x-1">
        <span 
          className="w-2 h-2 rounded-full typing-dot"
          style={{ backgroundColor: 'var(--accent-color)' }}
        />
        <span 
          className="w-2 h-2 rounded-full typing-dot"
          style={{ backgroundColor: 'var(--accent-color)' }}
        />
        <span 
          className="w-2 h-2 rounded-full typing-dot"
          style={{ backgroundColor: 'var(--accent-color)' }}
        />
      </div>
      <span>{getText()}</span>
    </div>
  );
};

export default TypingIndicator;