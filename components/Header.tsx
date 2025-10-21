import React from 'react';
import ThemeSwitcher from './ThemeSwitcher';

interface HeaderProps {
    onToggleHistory: () => void;
}

const Header: React.FC<HeaderProps> = ({ onToggleHistory }) => {
  return (
    <header className="relative py-6 text-center border-b border-gray-200 dark:border-gray-800">
      <div className="absolute top-1/2 left-4 -translate-y-1/2">
        <button
          onClick={onToggleHistory}
          className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          aria-label="Toggle history"
          title="View History"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
          MUN Assistant
        </h1>
        <p className="mt-2 text-lg text-gray-500 dark:text-gray-400">
          Your AI-powered co-delegate for MUN success
        </p>
      </div>
      <div className="absolute top-1/2 right-4 -translate-y-1/2">
        <ThemeSwitcher />
      </div>
    </header>
  );
};

export default Header;
