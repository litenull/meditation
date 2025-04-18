import { NextRequest, NextResponse } from 'next/server';
import openai from '@/lib/openai';

export async function POST(request: NextRequest) {
  try {
    const { segments, voice = 'alloy' } = await request.json();

    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json(
        { error: 'Valid segments array is required' },
        { status: 400 }
      );
    }

    // Generate audio for each segment in parallel
    const results = await Promise.all(
      segments.map(async (segment) => {
        try {
          const newText = `
            Please follow these instructions carefully!
            When reading the following, speak in a calm, mindful, and empathetic tone. If any part of the text is wrapped in double asterisks (e.g. [sound of ocean waves]), please pause and vividly create that sound with your voice or a vocal approximation, as if you are sound-designing a moment in a meditation session.
            Do not add your own words or any other text. Please follow the entire text, make sure you dont miss anything.
            Now, please begin:
            ${segment.text}`;
          
          // Call OpenAI's Audio API
          const response = await openai.chat.completions.create({
            model: "gpt-4o-audio-preview",
            modalities: ["text", "audio"],
            audio: { voice, format: "mp3" },
            messages: [
              {
                role: "user",
                content: newText
              }
            ],
            store: true,
          });

          // Check if response has the expected data
          if (!response.choices?.[0]?.message?.audio?.data) {
            throw new Error('Invalid response format from OpenAI Audio API');
          }

          // Get the audio data from the response - already in base64 format 
          // which is ready for client-side processing
          const audioData = response.choices[0].message.audio.data;
          
          return {
            timestamp: segment.timestamp,
            audioData,
            success: true
          };
        } catch (error) {
          console.error(`Error generating audio for segment at ${segment.timestamp}:`, error);
          return {
            timestamp: segment.timestamp,
            error: 'Failed to generate audio',
            success: false
          };
        }
      })
    );

    // Return all results
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error in batch TTS processing:', error);
    return NextResponse.json(
      { error: 'Failed to process batch TTS request' },
      { status: 500 }
    );
  }
} 