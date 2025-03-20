'use client';

import { useState, useEffect } from 'react';
import { useMeditationTTS } from '../lib/useMeditationTTS';
import { parseTranscript, TranscriptSegment } from '../lib/transcript';

interface MeditationTimerProps {
  initialDuration?: number; // in seconds
  initialTranscript?: string;
  voiceOptions?: string[];
}

export default function MeditationTimer({
  initialDuration = 300, // 5 minutes default
  initialTranscript = '',
  voiceOptions = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
}: MeditationTimerProps) {
  const [duration, setDuration] = useState(initialDuration);
  const [transcript, setTranscript] = useState(initialTranscript);
  const [isPlaying, setIsPlaying] = useState(false);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [selectedVoice, setSelectedVoice] = useState(voiceOptions[0]);

  // Parse transcript when it changes
  useEffect(() => {
    try {
      if (transcript.trim()) {
        const parsedSegments = parseTranscript(transcript);
        setSegments(parsedSegments);
      } else {
        setSegments([]);
      }
    } catch (err) {
      console.error('Error parsing transcript:', err);
    }
  }, [transcript]);

  // Use our custom hook
  const { currentTime, isLoading, error, progress } = useMeditationTTS({
    segments,
    isPlaying,
    duration,
    voice: selectedVoice,
  });

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Toggle play/pause
  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  // Reset timer
  const resetTimer = () => {
    setIsPlaying(false);
  };

  // Check if meditation is completed
  const isCompleted = currentTime >= duration;

  // Stop if completed
  useEffect(() => {
    if (isCompleted) {
      setIsPlaying(false);
    }
  }, [isCompleted]);

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto p-6 rounded-lg bg-gray-50 dark:bg-gray-800 shadow-md">
      {/* Timer Display */}
      <div className="text-center">
        <h2 className="text-4xl font-bold font-mono">
          {formatTime(currentTime)} / {formatTime(duration)}
        </h2>
        
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-4">
          <div 
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-4">
        <button
          onClick={togglePlay}
          disabled={isCompleted}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
        >
          {isPlaying ? 'Pause' : 'Start'}
        </button>
        <button
          onClick={resetTimer}
          className="px-5 py-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600 font-medium rounded-lg"
        >
          Reset
        </button>
      </div>

      {/* Settings */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block mb-2 text-sm font-medium">
            Duration (minutes)
          </label>
          <input
            type="number"
            min="1"
            max="120"
            value={Math.floor(duration / 60)}
            onChange={(e) => setDuration(parseInt(e.target.value, 10) * 60)}
            disabled={isPlaying}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block mb-2 text-sm font-medium">
            Voice
          </label>
          <select
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
            disabled={isPlaying}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {voiceOptions.map((voice) => (
              <option key={voice} value={voice}>
                {voice.charAt(0).toUpperCase() + voice.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Transcript Input */}
      <div className="mt-4">
        <label className="block mb-2 text-sm font-medium">
          Meditation Transcript (format: MM:SS Text)
        </label>
        <textarea
          rows={8}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          disabled={isPlaying}
          placeholder="00:30 Take a deep breath in&#10;01:15 Now exhale slowly&#10;02:00 Feel your body relaxing"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Status and Errors */}
      {isLoading && (
        <div className="mt-2 text-sm text-blue-600 dark:text-blue-400">
          Loading audio...
        </div>
      )}
      {error && (
        <div className="mt-2 text-sm text-red-600 dark:text-red-400">
          Error: {error}
        </div>
      )}
    </div>
  );
} 