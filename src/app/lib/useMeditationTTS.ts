'use client';

import { useState, useEffect, useRef } from 'react';
import { TranscriptSegment, getSegmentForTime } from './transcript';

interface UseMeditationTTSProps {
  segments: TranscriptSegment[];
  isPlaying: boolean;
  duration: number;
  voice?: string;
}

export function useMeditationTTS({
  segments,
  isPlaying,
  duration,
  voice = 'alloy',
}: UseMeditationTTSProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastPlayedTimestampRef = useRef<number | null>(null);

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

  // Handle playing audio at specific timestamps
  useEffect(() => {
    const handleTimeUpdate = async () => {
      const segment = getSegmentForTime(segments, currentTime);
      
      // If we have a segment for this time and we haven't played it yet
      if (segment && lastPlayedTimestampRef.current !== segment.timestamp) {
        try {
          setIsLoading(true);
          setError(null);
          
          // Remember this timestamp so we don't play it again
          lastPlayedTimestampRef.current = segment.timestamp;
          
          // Fetch speech audio from our API endpoint
          const response = await fetch('/api/tts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: segment.text,
              voice,
            }),
          });
          
          if (!response.ok) {
            throw new Error('Failed to generate speech');
          }
          
          // Get audio blob and create a URL for it
          const audioBlob = await response.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          
          // Play the audio
          if (audioRef.current) {
            if (!audioRef.current.paused) {
              audioRef.current.pause();
            }
            
            audioRef.current.src = audioUrl;
            await audioRef.current.play();
          } else {
            // Create an audio element if it doesn't exist
            const audio = new Audio(audioUrl);
            audioRef.current = audio;
            await audio.play();
          }
          
          setIsLoading(false);
        } catch (err) {
          console.error('Error playing TTS:', err);
          setError('Failed to play audio');
          setIsLoading(false);
        }
      }
    };
    
    if (isPlaying) {
      handleTimeUpdate();
    }
  }, [currentTime, segments, isPlaying, voice]);

  // Cleanup function
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      lastPlayedTimestampRef.current = null;
    };
  }, []);

  return {
    currentTime,
    isLoading,
    error,
    progress: duration > 0 ? (currentTime / duration) * 100 : 0,
  };
} 