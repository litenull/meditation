'use client';

import { useState, useEffect, useRef } from 'react';
import { TranscriptSegment, getSegmentForTime } from './transcript';

interface UseMeditationTTSProps {
  segments: TranscriptSegment[];
  isPlaying: boolean;
  duration: number;
  voice?: string;
  preloadAudio?: boolean;
}

interface QueuedAudio {
  timestamp: number;
  text: string;
}

// Used for typing the results from the batch API
interface BatchResult {
  timestamp: number;
  audioData: string;
  success: boolean;
  error?: string;
}

export function useMeditationTTS({
  segments,
  isPlaying,
  duration,
  voice = 'alloy',
  preloadAudio = false,
}: UseMeditationTTSProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioQueue, setAudioQueue] = useState<QueuedAudio[]>([]);
  const [preloadingStatus, setPreloadingStatus] = useState<'idle' | 'loading' | 'complete' | 'error'>('idle');
  const [preloadProgress, setPreloadProgress] = useState(0);
  const [debugInfo, setDebugInfo] = useState<string>('');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastPlayedTimestampRef = useRef<number | null>(null);
  const preloadedAudioRef = useRef<Map<number, string>>(new Map());

  // Create a timer to track meditation progress
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentTime(prev => {
          const newTime = prev + 1;
          return newTime <= duration ? newTime : prev;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPlaying, duration]);

  // Preload all audio segments when preloadAudio is true and segments change
  useEffect(() => {
    const preloadAllSegments = async () => {
      if (!segments.length || preloadingStatus === 'loading' || preloadingStatus === 'complete') {
        return;
      }

      try {
        setPreloadingStatus('loading');
        setPreloadProgress(0);
        
        // Call the batch API endpoint
        const response = await fetch('/api/tts/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            segments,
            voice,
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to preload audio segments');
        }
        
        const data = await response.json();
        const successfulResults = data.results.filter((result: BatchResult) => result.success);
        
        // Create audio URLs for each segment
        for (const result of successfulResults) {
          // Convert base64 to binary using browser-compatible approach
          const binaryString = atob(result.audioData);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
          const audioUrl = URL.createObjectURL(audioBlob);
          
          // Store in the ref
          preloadedAudioRef.current.set(result.timestamp, audioUrl);
          
          // Update progress
          setPreloadProgress(
            Math.round((preloadedAudioRef.current.size / segments.length) * 100)
          );
        }
        
        setPreloadingStatus('complete');
      } catch (err) {
        console.error('Error preloading audio segments:', err);
        setError('Failed to preload audio segments');
        setPreloadingStatus('error');
      }
    };
    
    if (preloadAudio && segments.length > 0) {
      preloadAllSegments();
    }
  }, [segments, voice, preloadAudio, preloadingStatus]);

  // Play audio from the queue when current audio ends
  const playNextInQueue = async () => {
    console.log(audioQueue)
    if (audioQueue.length === 0 || !isPlaying) {
      setIsPlayingAudio(false);
      addDebugInfo('No audio in queue or meditation paused');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // Get the next item from the queue (but don't remove it yet)
      const nextAudio = audioQueue[0];
      
      addDebugInfo(`Attempting to play segment at ${nextAudio.timestamp}s: ${nextAudio.text.substring(0, 20)}...`);
      
      let audioUrl: string;
      
      // Check if we have this audio preloaded
      if (preloadedAudioRef.current.has(nextAudio.timestamp)) {
        addDebugInfo(`Using preloaded audio for timestamp ${nextAudio.timestamp}s`);
        audioUrl = preloadedAudioRef.current.get(nextAudio.timestamp) as string;
      } else {
        addDebugInfo(`Fetching audio for timestamp ${nextAudio.timestamp}s`);
        // Fetch speech audio from our API endpoint
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: nextAudio.text,
            voice,
          }),
        });
        
        if (!response.ok) {
          addDebugInfo(`API response error ${response.status}: ${response.statusText}`);
          throw new Error(`Failed to generate speech: ${response.statusText}`);
        }
        
        // Get audio blob and create a URL for it
        const audioBlob = await response.blob();
        audioUrl = URL.createObjectURL(audioBlob);
        addDebugInfo(`Created audio URL`);
      }
      
      // Create a fresh audio element each time (more reliable than reusing)
      const audio = new Audio();
      audio.preload = 'auto'; // Ensure audio is preloaded
      
      // Set up event handlers before setting the source
      const handleCanPlayThrough = () => {
        addDebugInfo('Audio ready to play through');
        // Remove this handler after it fires once
        audio.removeEventListener('canplaythrough', handleCanPlayThrough);
      };
      
      const handlePlay = () => {
        addDebugInfo('Audio playback started');
        setIsPlayingAudio(true);
        setIsLoading(false);
      };
      
      const handleEnded = () => {
        addDebugInfo('Audio playback completed');
        // Remove all event listeners
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('error', handleError);
        audio.removeEventListener('canplaythrough', handleCanPlayThrough);
        
        // Free up resources
        URL.revokeObjectURL(audio.src);
        
        // Now remove from queue after it's done playing
        setAudioQueue(prevQueue => prevQueue.slice(1));
        
        // Update ref for lastPlayedTimestamp
        lastPlayedTimestampRef.current = nextAudio.timestamp;
        
        // Reset states
        setIsPlayingAudio(false);
        
        // Process the next queued audio
        setTimeout(() => playNextInQueue(), 100);
      };
      
      const handleError = (event: Event) => {
        const audioElement = event.target as HTMLAudioElement;
        addDebugInfo(`Audio playback error: ${audioElement.error?.message || 'Unknown error'}`);
        
        // Remove all event listeners
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('error', handleError);
        audio.removeEventListener('canplaythrough', handleCanPlayThrough);
        
        // Remove from queue and try the next item
        setAudioQueue(prevQueue => prevQueue.slice(1));
        setError(`Audio playback error: ${audioElement.error?.message || 'Unknown error'}`);
        setIsLoading(false);
        setIsPlayingAudio(false);
        
        // Try the next audio after a delay
        setTimeout(playNextInQueue, 1000);
      };
      
      // Add event listeners
      audio.addEventListener('canplaythrough', handleCanPlayThrough);
      audio.addEventListener('play', handlePlay);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);
      
      // Set source and load (prepares the audio)
      audio.src = audioUrl;
      audio.load();
      
      // Replace reference
      if (audioRef.current) {
        // Clean up existing audio before replacing
        audioRef.current.pause();
        audioRef.current.src = '';
        try {
          // This might fail but we're already replacing it
          audioRef.current.load();
        } catch {
          // Ignore error, just log it
          addDebugInfo('Minor issue cleaning up previous audio');
        }
      }
      audioRef.current = audio;
      
      // Play audio with user interaction fallback
      addDebugInfo('Attempting to play audio');
      try {
        // Try to play immediately
        const playPromise = audio.play();
        
        // Modern browsers return a promise
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              addDebugInfo('Audio playback started successfully');
              // Note: 'play' event handler will update UI states
            })
            .catch(err => {
              addDebugInfo(`Audio play promise rejected: ${err.message}`);
              
              // Handle autoplay restrictions
              if (err.name === 'NotAllowedError') {
                setError('Audio playback was blocked by the browser. Please interact with the page first.');
              } else {
                setError(`Failed to play audio: ${err.message}`);
              }
              
              // Reset state and try again with next segment
              audio.removeEventListener('ended', handleEnded);
              audio.removeEventListener('play', handlePlay);
              audio.removeEventListener('error', handleError);
              audio.removeEventListener('canplaythrough', handleCanPlayThrough);
              setIsPlayingAudio(false);
              setIsLoading(false);
              
              // Remove this item from queue
              setAudioQueue(prevQueue => prevQueue.slice(1));
              
              // Try next item after a delay
              if (audioQueue.length > 1) {
                setTimeout(playNextInQueue, 1000);
              }
            });
        } else {
          // Older browsers might not return a promise
          addDebugInfo('Browser did not return play promise (older browser)');
        }
      } catch (err) {
        const error = err as Error;
        addDebugInfo(`Error initiating audio playback: ${error.message}`);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('error', handleError);
        audio.removeEventListener('canplaythrough', handleCanPlayThrough);
        throw error;
      }
    } catch (err) {
      const error = err as Error;
      addDebugInfo(`Error in playNextInQueue: ${error.message}`);
      setError(`Failed to play audio: ${error.message}`);
      setIsLoading(false);
      setIsPlayingAudio(false);
      
      // Remove the failed audio from queue
      setAudioQueue(prevQueue => prevQueue.slice(1));
      
      // Try next item after a delay
      if (audioQueue.length > 1) {
        setTimeout(playNextInQueue, 1000);
      }
    }
  };

  // Helper function for debug info
  const addDebugInfo = (message: string) => {
    console.log(`[MeditationTTS] ${message}`);
    setDebugInfo(prev => {
      const newInfo = `${new Date().toISOString().substr(11, 8)} - ${message}\n${prev}`;
      // Keep only last 10 lines
      const lines = newInfo.split('\n');
      return lines.slice(0, 10).join('\n');
    });
  };

  // Handle checking for new segments at timestamps
  useEffect(() => {
    const checkForNewSegment = () => {
      const segment = getSegmentForTime(segments, currentTime);
      
      // If we have a segment for this time and we haven't played it yet
      if (segment && lastPlayedTimestampRef.current !== segment.timestamp) {
        // Check if this segment is already in the queue
        const isInQueue = audioQueue.some(item => item.timestamp === segment.timestamp);
        
        // Also check if we've played this segment already (to prevent reprocessing)
        const hasBeenPlayed = lastPlayedTimestampRef.current !== null && 
                             segment.timestamp <= lastPlayedTimestampRef.current;
        
        if (!isInQueue && !hasBeenPlayed) {
          console.log(`Adding segment at timestamp ${segment.timestamp}s to queue:`, segment.text);
          
          // Add to queue if not already playing or in queue
          setAudioQueue(prevQueue => {
            const newQueue = [...prevQueue, { 
              timestamp: segment.timestamp, 
              text: segment.text 
            }];
            return newQueue;
          });
        }
      }
    };
    
    if (isPlaying) {
      checkForNewSegment();
    }
  }, [currentTime, segments, isPlaying, isPlayingAudio, isLoading, audioQueue]);

  // Add separate effect to monitor queue and start playback
  useEffect(() => {
    // Start playing if we have items in queue and nothing is currently playing
    if (audioQueue.length > 0 && !isPlayingAudio && !isLoading && isPlaying) {
      playNextInQueue();
    }
  }, [audioQueue, isPlayingAudio, isLoading, isPlaying]);

  // Reset queue when meditation is paused
  useEffect(() => {
    if (!isPlaying) {
      setAudioQueue([]);
    }
  }, [isPlaying]);

  // Cleanup function
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        // Ensure audio is stopped and source is cleared
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.load(); // Reset the audio element completely
        audioRef.current = null;
      }
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      // Revoke all object URLs to prevent memory leaks
      preloadedAudioRef.current.forEach(url => {
        URL.revokeObjectURL(url);
      });
      preloadedAudioRef.current.clear();
      
      lastPlayedTimestampRef.current = null;
      setIsPlayingAudio(false);
      setAudioQueue([]);
      setError(null);
    };
  }, []);

  return {
    currentTime,
    isLoading,
    error,
    progress: duration > 0 ? (currentTime / duration) * 100 : 0,
    isPlayingAudio,
    queueLength: audioQueue.length,
    preloadingStatus,
    preloadProgress,
    debugInfo, // Return debug info for UI display
  };
} 