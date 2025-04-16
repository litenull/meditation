'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  
  // Create refs for maintaining state across renders
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastPlayedTimestampRef = useRef<number | null>(null);
  const preloadedAudioRef = useRef<Map<number, string>>(new Map());
  const playedSegmentsRef = useRef<Set<number>>(new Set());
  // Add a processing ref to track which segments are currently being processed
  const processingSegmentsRef = useRef<Set<number>>(new Set());

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

  // Helper function for debug info
  const addDebugInfo = useCallback((message: string) => {
    console.log(`[MeditationTTS] ${message}`);
    setDebugInfo(prev => {
      const newInfo = `${new Date().toISOString().substr(11, 8)} - ${message}\\n${prev}`;
      // Keep only last 10 lines
      const lines = newInfo.split('\\n');
      return lines.slice(0, 10).join('\\n');
    });
  }, []); // Empty dependency array means this function reference is stable

  // Play audio from the queue when current audio ends
  const playNextInQueue = useCallback(async (audioToPlay: QueuedAudio) => {
    // No need to check queue length here, assuming it's called correctly
    if (!isPlaying) {
      setIsPlayingAudio(false);
      addDebugInfo('Meditation paused during playback attempt');
      // Clean up processing state if paused during attempt
      processingSegmentsRef.current.delete(audioToPlay.timestamp);
      return;
    }

    try {
      setIsLoading(true); // Set loading now that we are processing this specific segment
      setError(null);
      
      // Get the next item from the queue (but don't remove it yet)
      // const nextAudio = audioQueue[0]; // Use argument audioToPlay instead
      
      addDebugInfo(`Attempting to play segment at ${audioToPlay.timestamp}s: ${audioToPlay.text.substring(0, 20)}...`);
      
      // Immediately remove from queue and mark as being played to prevent duplicates
      // setAudioQueue(prevQueue => prevQueue.slice(1)); // Moved to the triggering effect
      // playedSegmentsRef.current.add(nextAudio.timestamp); // Moved to handleEnded
      
      let audioUrl: string;
      
      // Check if we have this audio preloaded
      if (preloadedAudioRef.current.has(audioToPlay.timestamp)) {
        addDebugInfo(`Using preloaded audio for timestamp ${audioToPlay.timestamp}s`);
        audioUrl = preloadedAudioRef.current.get(audioToPlay.timestamp) as string;
      } else {
        addDebugInfo(`Fetching audio for timestamp ${audioToPlay.timestamp}s`);
        // Fetch speech audio from our API endpoint
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: audioToPlay.text, // Use argument
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
        
        // Update ref for lastPlayedTimestamp and make sure it's removed from processing
        lastPlayedTimestampRef.current = audioToPlay.timestamp;
        // Mark as played only when successfully completed
        playedSegmentsRef.current.add(audioToPlay.timestamp);
        // Remove from processing segments to ensure full cleanup
        processingSegmentsRef.current.delete(audioToPlay.timestamp);
        
        // Reset states
        setIsPlayingAudio(false);
        
        // Process the next queued audio - REMOVED, handled by effect
        // setTimeout(() => playNextInQueue(), 100); 
      };
      
      const handleError = (event: Event) => {
        const audioElement = event.target as HTMLAudioElement;
        addDebugInfo(`Audio playback error: ${audioElement.error?.message || 'Unknown error'}`);
        
        // Remove all event listeners
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('error', handleError);
        audio.removeEventListener('canplaythrough', handleCanPlayThrough);
        
        // Remove from processing segments if error occurs
        processingSegmentsRef.current.delete(audioToPlay.timestamp);

        // Remove from queue and try the next item
        setError(`Audio playback error: ${audioElement.error?.message || 'Unknown error'}`);
        setIsLoading(false);
        setIsPlayingAudio(false);
        
        // Try the next audio after a delay - REMOVED, handled by effect
        // setTimeout(playNextInQueue, 1000);
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
              
              // Try next item after a delay - REMOVED, handled by effect
              // setTimeout(playNextInQueue, 1000);
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
      // Ensure processing state is cleaned up on caught errors
      processingSegmentsRef.current.delete(audioToPlay.timestamp);
      setError(`Failed to play audio: ${error.message}`);
      setIsLoading(false);
      setIsPlayingAudio(false);
      
      // Remove the failed audio from queue - REMOVED, handled by effect
      // setAudioQueue(prevQueue => prevQueue.slice(1));
      
      // Try next item after a delay - REMOVED, handled by effect
      // if (audioQueue.length > 1) {
      //   setTimeout(playNextInQueue, 1000);
      // }
    }
  }, [isPlaying, voice, addDebugInfo]); // Dependencies for playNextInQueue

  // Handle checking for new segments at timestamps
  useEffect(() => {
    const checkForNewSegment = () => {
      const segment = getSegmentForTime(segments, currentTime);
      
      if (segment && isPlaying) {
        const hasBeenPlayed = playedSegmentsRef.current.has(segment.timestamp);
        // const isInQueue = audioQueue.some(item => item.timestamp === segment.timestamp);
        // const isProcessing = processingSegmentsRef.current.has(segment.timestamp);
        
        // Combine the check and marking for processing atomically
        if (!hasBeenPlayed) {
            // Attempt to mark as processing. If successful (returns true), queue it.
            if (processingSegmentsRef.current.add(segment.timestamp)) {
                addDebugInfo(`Adding segment at timestamp ${segment.timestamp}s to queue: ${segment.text.substring(0, 20)}...`);
                setAudioQueue(prevQueue => [...prevQueue, { 
                  timestamp: segment.timestamp, 
                  text: segment.text 
                }]);
            }
        }
      }
    };
    
    if (isPlaying) {
      checkForNewSegment();
    }
    // Only trigger when time, segments, or play state change. NOT when queue changes.
  }, [currentTime, segments, isPlaying, addDebugInfo]); 

  // Add separate effect to monitor queue and start playback
  useEffect(() => {
    const startPlayback = async () => {
      // Check conditions: queue has items, not currently playing, not currently loading, meditation is active
      if (audioQueue.length > 0 && !isPlayingAudio && !isLoading && isPlaying) {
        // Get the segment to play
        const segmentToPlay = audioQueue[0];

        // Double-check if already processing (safety check)
        if (!processingSegmentsRef.current.has(segmentToPlay.timestamp)) {
            addDebugInfo(`Segment ${segmentToPlay.timestamp} is in queue but NOT marked processing! Skipping play trigger.`);
            // This indicates a potential state inconsistency. For now, just return.
            return;
        }

        addDebugInfo(`Triggering playNextInQueue for segment ${segmentToPlay.timestamp}`);
        // Remove from queue *before* calling playNextInQueue to prevent re-triggering
        setAudioQueue(prevQueue => prevQueue.slice(1));
        // Call playNextInQueue with the specific segment
        await playNextInQueue(segmentToPlay); 
      }
    };
    startPlayback();
    // Dependencies: monitor the queue, playing state, loading state, meditation state, and the playback function itself
  }, [audioQueue, isPlayingAudio, isLoading, isPlaying, playNextInQueue, addDebugInfo]);

  // Effect to handle pausing and resuming the currently playing audio element
  useEffect(() => {
    // If the meditation is playing again, attempt to resume any paused audio
    if (isPlaying) {
      if (audioRef.current && audioRef.current.paused && audioRef.current.src) {
        audioRef.current
          .play()
          .catch((err) => {
            // If the browser blocks autoplay after resume, surface a helpful error
            addDebugInfo(`Failed to resume audio: ${err.message}`);
            if (err.name === 'NotAllowedError') {
              setError('Audio playback was blocked by the browser. Please interact with the page first.');
            }
          });
      }
    } else {
      // Meditation is paused – pause the current audio but keep the source so we can resume later
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, addDebugInfo]);

  // Reset state when meditation is reset (currentTime === 0 and not playing)
  useEffect(() => {
    if (!isPlaying && currentTime === 0) {
      // Stop and fully release any audio resources
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.load();
      }
      // Clear queues and tracking sets – we are starting fresh
      setAudioQueue([]);
      processingSegmentsRef.current.clear();
      playedSegmentsRef.current.clear();
      lastPlayedTimestampRef.current = null;
    }
  }, [isPlaying, currentTime]);

  // Cleanup function
  useEffect(() => {
    return () => {
      // Copy all refs to local variables for cleanup
      const audioElement = audioRef.current;
      const preloadedUrls = Array.from(preloadedAudioRef.current.values());
      const preloadedAudioMap = preloadedAudioRef.current;
      const playedSegments = playedSegmentsRef.current;
      const processingSegments = processingSegmentsRef.current;
      const timer = timerRef.current;
      
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
        audioElement.load();
      }
      
      if (timer) {
        clearInterval(timer);
      }
      
      // Clean up preloaded audio URLs
      preloadedUrls.forEach(url => {
        URL.revokeObjectURL(url);
      });
      
      // Reset all state using local variables
      audioRef.current = null;
      timerRef.current = null;
      preloadedAudioMap.clear();
      playedSegments.clear();
      processingSegments.clear();
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