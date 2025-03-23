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
  const [preloadAudio, setPreloadAudio] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [isFirefox, setIsFirefox] = useState(false);

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
  const { 
    currentTime, 
    isLoading, 
    error, 
    progress, 
    isPlayingAudio, 
    queueLength,
    preloadingStatus,
    preloadProgress,
    debugInfo
  } = useMeditationTTS({
    segments,
    isPlaying,
    duration,
    voice: selectedVoice,
    preloadAudio,
  });

  // Detect Firefox browser
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userAgent = window.navigator.userAgent.toLowerCase();
      setIsFirefox(userAgent.indexOf('firefox') > -1);
    }
  }, []);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Track if user has interacted with the page
  useEffect(() => {
    const handleUserInteraction = () => {
      if (!hasUserInteracted) {
        console.log('User has interacted with the page');
        setHasUserInteracted(true);
        // Remove listeners after first interaction
        document.removeEventListener('click', handleUserInteraction);
        document.removeEventListener('keydown', handleUserInteraction);
        document.removeEventListener('touchstart', handleUserInteraction);
      }
    };

    // Add event listeners for user interaction
    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);

    return () => {
      // Clean up event listeners
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, [hasUserInteracted]);

  // Toggle play/pause
  const togglePlay = () => {
    setIsPlaying(!isPlaying);
    
    // This counts as a user interaction
    setHasUserInteracted(true);
    
    // Create and play a silent sound to unlock audio on mobile devices
    if (!isPlaying) {
      try {
        // Create audio context for unlocking audio on iOS/Safari
        // Safe way to access AudioContext across browsers
        if (typeof window !== 'undefined') {
          const ctx = new (window.AudioContext || 
            // @ts-expect-error - Safari webkitAudioContext support
            window.webkitAudioContext)();
          
          // Create a short silent buffer
          const buffer = ctx.createBuffer(1, 1, 22050);
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.start(0);
          console.log("Unlocked audio context");
          
          // Resume audio context if suspended (needed for some browsers)
          if (ctx.state === 'suspended') {
            ctx.resume().then(() => {
              console.log("Audio context resumed");
            });
          }
        }
      } catch (e) {
        console.warn("Error unlocking audio context:", e);
      }
    }
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
          disabled={isCompleted || (preloadAudio && preloadingStatus === 'loading')}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* User Interaction Notice */}
      {!hasUserInteracted && (
        <div className="mt-2 text-sm text-yellow-600 dark:text-yellow-400 text-center">
          Please click or interact with the page to enable audio playback
        </div>
      )}

      {/* Firefox-specific guidance */}
      {isFirefox && !isPlayingAudio && queueLength > 0 && (
        <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900 rounded-lg text-sm">
          <p className="font-medium mb-2">Firefox Autoplay Guide:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Click the shield icon in your address bar</li>
            <li>Check if "Autoplay blocking" is enabled</li>
            <li>Select "Allow Audio and Video" for this site</li>
            <li>Refresh the page and try again</li>
          </ol>
        </div>
      )}

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

      {/* Preload Option */}
      <div className="flex items-center mt-2">
        <input 
          type="checkbox" 
          id="preload-checkbox"
          checked={preloadAudio}
          onChange={(e) => setPreloadAudio(e.target.checked)}
          disabled={isPlaying}
          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
        />
        <label htmlFor="preload-checkbox" className="ml-2 text-sm font-medium">
          Preload all audio segments before starting
        </label>
      </div>
      
      {/* Preload Status */}
      {preloadAudio && preloadingStatus === 'loading' && (
        <div className="mt-2">
          <div className="flex items-center">
            <span className="text-sm text-blue-600 dark:text-blue-400 mr-2">
              Preloading audio segments: {preloadProgress}%
            </span>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
              <div 
                className="bg-blue-600 h-1.5 rounded-full transition-all"
                style={{ width: `${preloadProgress}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}
      {preloadAudio && preloadingStatus === 'complete' && (
        <div className="mt-2 text-sm text-green-600 dark:text-green-400">
          All audio segments preloaded successfully!
        </div>
      )}
      {preloadAudio && preloadingStatus === 'error' && (
        <div className="mt-2 text-sm text-red-600 dark:text-red-400">
          Error preloading audio segments. Try again or disable preloading.
        </div>
      )}

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
      {isPlayingAudio && !isLoading && (
        <div className="mt-2 text-sm text-green-600 dark:text-green-400">
          Playing audio{queueLength > 0 ? ` (${queueLength} segment${queueLength === 1 ? '' : 's'} queued)` : ''}...
        </div>
      )}
      {!isPlayingAudio && queueLength > 0 && (
        <div className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">
          {queueLength} audio segment{queueLength === 1 ? '' : 's'} queued
        </div>
      )}
      {error && (
        <div className="mt-2 text-sm text-red-600 dark:text-red-400">
          Error: {error}
        </div>
      )}
      
      {/* Debug Mode Toggle */}
      <div className="mt-4 flex items-center justify-between">
        <button 
          onClick={() => setShowDebug(!showDebug)}
          className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          {showDebug ? "Hide Debug Info" : "Show Debug Info"}
        </button>
        
        {/* Show Firefox-specific help if needed */}
        {isFirefox && (
          <a 
            href="https://support.mozilla.org/en-US/kb/block-autoplay" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:text-blue-700"
          >
            Firefox Autoplay Settings Help
          </a>
        )}
      </div>
      
      {/* Debug Information */}
      {showDebug && (
        <div className="mt-2 bg-gray-100 dark:bg-gray-900 p-3 rounded-lg overflow-auto max-h-40 text-xs font-mono">
          <pre>{debugInfo || "No debug information available"}</pre>
        </div>
      )}
    </div>
  );
} 