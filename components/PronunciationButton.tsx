import React, { useState } from 'react';
import { generateSpeechAudio } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audioUtils';

interface PronunciationButtonProps {
  country: string;
}

const PronunciationButton: React.FC<PronunciationButtonProps> = ({ country }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handlePlayPronunciation = async () => {
    if (!country.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const base64Audio = await generateSpeechAudio(country);
      
      // The Gemini TTS API returns audio with a 24000 sample rate
      // FIX: Cast window to `any` to support vendor-prefixed `webkitAudioContext`.
      const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const audioBuffer = await decodeAudioData(
        decode(base64Audio),
        outputAudioContext,
        24000, // sampleRate
        1,     // numberOfChannels
      );
      
      const source = outputAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(outputAudioContext.destination);
      source.start();

    } catch (error) {
      console.error('Failed to play pronunciation:', error);
      // Optionally, set an error state to show feedback to the user
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handlePlayPronunciation}
      disabled={!country.trim() || isLoading}
      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
      aria-label="Play country name pronunciation"
      title="Play pronunciation"
    >
      {isLoading ? (
        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        </svg>
      )}
    </button>
  );
};

export default PronunciationButton;
