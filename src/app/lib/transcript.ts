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
  // Find the segment that matches the current time
  return segments.find(segment => segment.timestamp === Math.floor(currentTime));
} 