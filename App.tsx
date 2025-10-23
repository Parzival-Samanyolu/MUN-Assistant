import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { generateMUNSummary } from './services/geminiService';
import Header from './components/Header';
import Footer from './components/Footer';
import Spinner from './components/Spinner';
import PronunciationButton from './components/PronunciationButton';
import HistorySidebar from './components/HistorySidebar';
import ReadAloudButton from './components/ReadAloudButton';
import { useLocalStorage } from './hooks/useLocalStorage';
import { HistoryItem, DetailLevel, Source } from './types';


const loadingMessages = [
  'Consulting diplomatic archives...',
  'Analyzing geopolitical data...',
  'Searching the web for latest updates...',
  'Formulating policy recommendations...',
  'Cross-referencing UN resolutions...',
  "Drafting country's official stance...",
  'Identifying key allies and blocs...',
  'Finalizing briefing document...',
];

export const App: React.FC = () => {
  const [country, setCountry] = useState<string>('');
  const [topic, setTopic] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [sources, setSources] = useState<Source[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>(loadingMessages[0]);
  const [detailLevel, setDetailLevel] = useState<DetailLevel>('standard');
  const [includeHistory, setIncludeHistory] = useState<boolean>(false);
  const [flagUrl, setFlagUrl] = useState<string | null>(null);
  const [isFlagLoading, setIsFlagLoading] = useState<boolean>(false);
  const [isFlagVisible, setIsFlagVisible] = useState<boolean>(false);
  
  // State for autocomplete
  const [allCountries, setAllCountries] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSuggestionsVisible, setIsSuggestionsVisible] = useState<boolean>(false);
  
  const intervalRef = useRef<number | null>(null);
  const countryInputContainerRef = useRef<HTMLDivElement>(null);

  // History State
  const [history, setHistory] = useLocalStorage<HistoryItem[]>('mun-briefing-history', []);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);


  // Fetch all countries on initial load for autocomplete
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const response = await fetch('https://restcountries.com/v3.1/all?fields=name');
        if (!response.ok) throw new Error('Failed to fetch countries');
        const data = await response.json();
        // Sort alphabetically
        const countryNames = data.map((c: any) => c.name.common).sort();
        setAllCountries(countryNames);
      } catch (e) {
        console.error("Failed to fetch country list:", e);
      }
    };
    fetchCountries();
  }, []);

  // Effect to handle clicks outside the suggestions dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (countryInputContainerRef.current && !countryInputContainerRef.current.contains(event.target as Node)) {
        setIsSuggestionsVisible(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);


  useEffect(() => {
    // Debounce fetching the flag
    const handler = setTimeout(async () => {
      if (country.trim().length > 2) {
        setIsFlagLoading(true);
        setFlagUrl(null);
        try {
          const response = await fetch(`https://restcountries.com/v3.1/name/${country.trim()}?fields=flags`);
          if (!response.ok) {
            throw new Error('Country not found');
          }
          const data = await response.json();
          if (data && data.length > 0 && data[0].flags?.svg) {
            setFlagUrl(data[0].flags.svg);
          } else {
            setFlagUrl(null);
          }
        } catch (error) {
          console.warn('Could not fetch country flag:', error);
          setFlagUrl(null);
        } finally {
          setIsFlagLoading(false);
        }
      } else {
        setFlagUrl(null);
      }
    }, 500); // 500ms debounce

    return () => {
      clearTimeout(handler);
    };
  }, [country]);

  useEffect(() => {
    // Handle the fade-in animation for the flag
    if (flagUrl) {
      // Use a small timeout to ensure the element is in the DOM with opacity-0 before transitioning to opacity-100
      const timer = setTimeout(() => {
        setIsFlagVisible(true);
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setIsFlagVisible(false);
    }
  }, [flagUrl]);

  useEffect(() => {
    if (isLoading) {
      let messageIndex = 0;
      intervalRef.current = window.setInterval(() => {
        messageIndex = (messageIndex + 1) % loadingMessages.length;
        setLoadingMessage(loadingMessages[messageIndex]);
      }, 2000); // Change message every 2 seconds
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isLoading]);

  const handleCountryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCountry(value);

    if (value.trim().length > 0) {
      const filteredSuggestions = allCountries.filter(c =>
        c.toLowerCase().startsWith(value.toLowerCase())
      );
      setSuggestions(filteredSuggestions);
      setIsSuggestionsVisible(true);
    } else {
      setSuggestions([]);
      setIsSuggestionsVisible(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setCountry(suggestion);
    setSuggestions([]);
    setIsSuggestionsVisible(false);
  };


  const handleGenerateSummary = useCallback(async () => {
    if (!country.trim() || !topic.trim()) {
      setError('Please enter both a country and a topic.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setSummary('');
    setSources([]);
    setIsCopied(false); // Reset copy status on new generation

    try {
      const { summary: result, sources: newSources } = await generateMUNSummary(country, topic, detailLevel, includeHistory);
      setSummary(result);
      setSources(newSources);

      // Add to history
      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        country,
        topic,
        detailLevel,
        includeHistory,
        summary: result,
        timestamp: new Date().toISOString(),
        sources: newSources,
      };
      setHistory(prevHistory => [newHistoryItem, ...prevHistory]);

    } catch (err) {
      // The error from geminiService is already user-friendly
      setError(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [country, topic, detailLevel, includeHistory, setHistory]);

  const handleCopy = useCallback(() => {
    if (!summary) return;
    const textToCopy = sources.length > 0
      ? `${summary}\n\nSources:\n${sources.map(s => `- ${s.title}: ${s.uri}`).join('\n')}`
      : summary;

    navigator.clipboard.writeText(textToCopy).then(
      () => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2500); // Reset after 2.5 seconds
      },
      (err) => {
        console.error('Failed to copy summary: ', err);
        setError('Could not copy summary to clipboard.');
      }
    );
  }, [summary, sources]);

  const handleSelectHistoryItem = (item: HistoryItem) => {
    setCountry(item.country);
    setTopic(item.topic);
    setDetailLevel(item.detailLevel);
    setIncludeHistory(item.includeHistory ?? false); // Default to false for old items
    setSummary(item.summary);
    setSources(item.sources ?? []); // Load sources, default to empty array
    setIsHistoryOpen(false); // Close sidebar after selection
    setError(null);
    setIsCopied(false);
  };

  const handleClearHistory = () => {
    setHistory([]);
  };


  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-200">
      <HistorySidebar
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelect={handleSelectHistoryItem}
        onClear={handleClearHistory}
      />
      <Header onToggleHistory={() => setIsHistoryOpen(prev => !prev)} />
      <main className="flex-grow container mx-auto px-4 py-8 flex flex-col items-center">
        <div className="w-full max-w-4xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="relative" ref={countryInputContainerRef}>
                <label htmlFor="country" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Country
                </label>
                 <div className="absolute inset-y-0 left-0 top-6 flex items-center pl-3 pointer-events-none">
                  {isFlagLoading ? (
                    <div className="w-6 h-4 bg-gray-200 dark:bg-gray-700 rounded-sm animate-pulse"></div>
                  ) : flagUrl ? (
                    <img 
                      src={flagUrl} 
                      alt={`${country} flag`} 
                      className={`w-6 h-auto rounded-sm shadow transition-opacity duration-300 ease-in-out ${isFlagVisible ? 'opacity-100' : 'opacity-0'}`} />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2h1a2 2 0 002-2v-1a2 2 0 012-2h1.945M7.757 15.757a3 3 0 014.486 0M12 18.75a3 3 0 01-4.486 0" />
                    </svg>
                  )}
                </div>
                <input
                  type="text"
                  id="country"
                  value={country}
                  onChange={handleCountryChange}
                  onFocus={() => {
                    if (country.trim().length > 0 && suggestions.length > 0) {
                        setIsSuggestionsVisible(true);
                    }
                  }}
                  placeholder="e.g., Brazil"
                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg pl-12 pr-10 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  disabled={isLoading}
                  autoComplete="off"
                />
                 {isSuggestionsVisible && suggestions.length > 0 && (
                  <ul className="absolute z-10 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg mt-1 max-h-60 overflow-y-auto shadow-lg">
                    {suggestions.slice(0, 100).map((suggestion, index) => ( // Limit to 100 suggestions for performance
                      <li
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="px-4 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="absolute inset-y-0 right-0 top-6 flex items-center pr-3">
                    <PronunciationButton country={country} />
                </div>
              </div>
              <div>
                <label htmlFor="topic" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  MUN Topic
                </label>
                <input
                  type="text"
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Cybersecurity and International Law"
                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  disabled={isLoading}
                />
              </div>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center pt-2">
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Level of Detail
                  </label>
                  <div className="flex w-full bg-gray-100 dark:bg-gray-900/50 p-1 rounded-xl border border-gray-300 dark:border-gray-600">
                  {(['concise', 'standard', 'detailed'] as DetailLevel[]).map((level) => (
                      <button
                      key={level}
                      onClick={() => setDetailLevel(level)}
                      disabled={isLoading}
                      className={`w-1/3 py-2 text-sm font-semibold rounded-lg transition-all duration-200 capitalize focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-800 focus:ring-blue-500 ${
                          detailLevel === level
                          ? 'bg-blue-600 text-white shadow'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700/50'
                      }`}
                      >
                      {level}
                      </button>
                  ))}
                  </div>
                </div>
                <div className="flex items-center justify-start md:justify-center md:pt-6">
                    <label htmlFor="includeHistory" className="flex items-center space-x-3 cursor-pointer p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
                        <input
                        type="checkbox"
                        id="includeHistory"
                        checked={includeHistory}
                        onChange={(e) => setIncludeHistory(e.target.checked)}
                        disabled={isLoading}
                        className="h-5 w-5 rounded border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 transition"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 select-none">
                            Include Country's History
                        </span>
                    </label>
                </div>
            </div>
            <button
              onClick={handleGenerateSummary}
              disabled={isLoading || !country || !topic}
              className="w-full flex justify-center items-center bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:scale-100"
            >
              {isLoading ? (
                <>
                  <Spinner />
                  Generating Briefing...
                </>
              ) : (
                'Generate Briefing'
              )}
            </button>
          </div>

          <div className="mt-8">
            {error && <div className="bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-center">{error}</div>}
            
            {isLoading && !summary && (
              <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                <p className="transition-opacity duration-500">{loadingMessage}</p>
              </div>
            )}

            {summary && (
              <div className="bg-gray-50/70 dark:bg-gray-900/70 p-6 rounded-lg border border-gray-200 dark:border-gray-700 mt-6">
                <div className="flex flex-wrap gap-2 justify-between items-center mb-4 border-b border-gray-300 dark:border-gray-600 pb-2">
                  <h2 className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    Briefing for {country}
                  </h2>
                  <div className="flex items-center gap-2">
                    <ReadAloudButton text={summary} />
                    <button
                      onClick={handleCopy}
                      className={`flex items-center text-sm font-medium px-4 py-2 rounded-lg transition-all duration-200 ${
                        isCopied
                          ? 'bg-green-500 dark:bg-green-600/80 text-white'
                          : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {isCopied ? (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Copied!
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy Summary
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
                </div>

                {sources && sources.length > 0 && (
                  <div className="mt-6 border-t border-gray-300 dark:border-gray-600 pt-4">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9V3m0 18a9 9 0 00-9-9" />
                      </svg>
                      Sources
                    </h3>
                    <ul className="space-y-2">
                      {sources.map((source, index) => (
                        <li key={index} className="text-sm">
                          <a
                            href={source.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center"
                            title={source.uri}
                          >
                            <span className="truncate" style={{maxWidth: '32rem'}}>{source.title}</span>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 opacity-70 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};