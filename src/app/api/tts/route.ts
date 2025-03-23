import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { text, voice = 'alloy' } = await request.json();

    // Validate request
    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    console.log(`Processing TTS request: "${text.substring(0, 50)}..." with voice: ${voice}`);
    const newText = `Please read the following text in a chill, mindful, empathetic tone: ${text}`;

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
      console.error('Invalid response format from OpenAI Audio API:', JSON.stringify(response));
      throw new Error('Invalid response format from OpenAI Audio API');
    }

    // Get the audio data from the response
    const audioData = response.choices[0].message.audio.data;
    
    // Convert base64 to binary
    const audioBuffer = Buffer.from(audioData, 'base64');
    console.log(`TTS succeeded: Generated ${audioBuffer.byteLength} bytes of audio data`);

    // Return the audio data with the appropriate content type
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
    });
  } catch (error) {
    console.error('Error calling OpenAI Audio API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate speech' },
      { status: 500 }
    );
  }
}
