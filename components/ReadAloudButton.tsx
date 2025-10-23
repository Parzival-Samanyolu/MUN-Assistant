import React, { useState, useRef, useEffect, useCallback } from 'react';
import { generateSpeechAudio } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audioUtils';

interface ReadAloudButtonProps {
  text: string;
}

type PlaybackState = 'idle' | 'loading' | 'playing';

const ReadAloudButton: React.FC<ReadAloudButtonProps> = ({ text }) => {
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  
  const isPlayingRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    // Cleanup on component unmount
    return () => {
      isPlayingRef.current = false;
      if (currentSourceRef.current) {
        currentSourceRef.current.stop();
        currentSourceRef.current.disconnect();
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);
  
  // When the summary text changes, stop any ongoing playback.
  useEffect(() => {
    if (isPlayingRef.current) {
        isPlayingRef.current = false;
        if (currentSourceRef.current) {
            currentSourceRef.current.stop();
            currentSourceRef.current.disconnect();
            currentSourceRef.current = null;
        }
        setPlaybackState('idle');
    }
  }, [text]);


  const handleTogglePlayback = useCallback(async () => {
    // === STOP PLAYBACK ===
    if (isPlayingRef.current) {
      isPlayingRef.current = false;
      if (currentSourceRef.current) {
        currentSourceRef.current.stop();
      }
      setPlaybackState('idle');
      return;
    }

    // === START PLAYBACK ===
    if (!text.trim()) return;

    setPlaybackState('loading');
    
    // Initialize AudioContext if needed
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    // Resume if suspended (e.g., due to browser policy)
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    
    isPlayingRef.current = true;

    // Process text into clean paragraphs
    const paragraphs = text
      .split('\n')
      .map(p => p.replace(/^(###|#|##)\s+/g, '').trim()) // Remove markdown headers
      .filter(p => p.length > 0 && !p.startsWith('---')); // Filter out empty lines and dividers

    if (paragraphs.length === 0) {
      setPlaybackState('idle');
      isPlayingRef.current = false;
      return;
    }
    
    setPlaybackState('playing');

    for (const paragraph of paragraphs) {
      if (!isPlayingRef.current) break;

      try {
        const base64Audio = await generateSpeechAudio(paragraph);
        if (!isPlayingRef.current) break; // Check again after await

        const audioBuffer = await decodeAudioData(
          decode(base64Audio),
          audioContextRef.current,
          24000,
          1
        );

        // Play the buffer and wait for it to finish
        await new Promise<void>((resolve) => {
          if (!isPlayingRef.current) {
            resolve();
            return;
          }
          const source = audioContextRef.current!.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContextRef.current!.destination);
          
          source.onended = () => {
            currentSourceRef.current = null;
            resolve();
          };

          currentSourceRef.current = source;
          source.start();
        });

      } catch (error) {
        console.error("Error during text-to-speech playback:", error);
        break; // Stop playback on any error
      }
    }

    // If the loop completed naturally (wasn't stopped), reset state.
    if (isPlayingRef.current) {
      setPlaybackState('idle');
    }
    isPlayingRef.current = false;

  }, [text]);

  const renderIcon = () => {
    switch (playbackState) {
      case 'loading':
        return (
            <>
                <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading...
            </>
        );
      case 'playing':
        return (
            <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                </svg>
                Stop
            </>
        );
      case 'idle':
      default:
        return (
            <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
                Read Aloud
            </>
        );
    }
  };

  const getButtonClasses = () => {
    const baseClasses = 'flex items-center text-sm font-medium px-4 py-2 rounded-lg transition-all duration-200';
    if (playbackState === 'playing') {
      return `${baseClasses} bg-red-100 hover:bg-red-200 dark:bg-red-900/50 dark:hover:bg-red-900/80 text-red-700 dark:text-red-300`;
    }
    return `${baseClasses} bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300`;
  }

  return (
    <button
      onClick={handleTogglePlayback}
      disabled={!text.trim() || playbackState === 'loading'}
      className={`${getButtonClasses()} disabled:opacity-50 disabled:cursor-wait`}
      aria-live="polite"
      aria-label={playbackState === 'playing' ? 'Stop reading aloud' : 'Read summary aloud'}
    >
      {renderIcon()}
    </button>
  );
};

export default ReadAloudButton;
