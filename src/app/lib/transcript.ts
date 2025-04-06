export interface TranscriptSegment {
  timestamp: number; // timestamp in seconds
  text: string;
}

/**
 * Parse a transcript from text format
 * Example format:
 * 
 * 00:30 Take a deep breath in
 * 01:15 Now exhale slowly 
 * 02:00 Feel your body relaxing
 * 
 * @param text The transcript text
 * @returns Array of transcript segments
 */
export function parseTranscript(text: string): TranscriptSegment[] {
  const lines = text.split('\n').filter(line => line.trim() !== '');
  
  return lines.map(line => {
    // Match time format like "00:30" or "1:45" at the beginning of the line
    const match = line.match(/^(\d+):(\d+)\s+(.+)$/);
    
    if (!match) {
      throw new Error(`Invalid transcript line format: ${line}`);
    }
    
    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    const text = match[3].trim();
    
    // Convert to total seconds
    const timestamp = minutes * 60 + seconds;
    
    return { timestamp, text };
  });
}

/**
 * Get the transcript segment that should be played at a specific time
 * @param segments The transcript segments
 * @param currentTime The current time in seconds
 * @returns The segment to play, or undefined if none
 */
export function getSegmentForTime(
  segments: TranscriptSegment[],
  currentTime: number
): TranscriptSegment | undefined {
  // Get segments that align with the current time
  // We're checking if any segment's timestamp matches the exact second
  // This provides tight synchronization between timer and audio cues
  const flooredTime = Math.floor(currentTime);
  
  // Find segments that should be played exactly at this time
  return segments.find(segment => segment.timestamp === flooredTime);
}

/**
 * Get all segments that should be played up to a specific time
 * Used for preloading and checking which segments to queue
 * @param segments The transcript segments
 * @param maxTime Maximum time to include segments for (in seconds)
 * @returns Array of segments
 */
export function getSegmentsUpToTime(
  segments: TranscriptSegment[],
  maxTime: number
): TranscriptSegment[] {
  return segments.filter(segment => segment.timestamp <= maxTime);
}