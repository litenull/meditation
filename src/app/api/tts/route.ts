import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { text, voice = 'alloy' } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    // Call OpenAI's Audio API
    const response = await openai.chat.completions.create({
      model: "gpt-4o-audio-preview",
      modalities: ["text", "audio"],
      audio: { voice, format: "mp3" },
      messages: [
        {
          role: "user",
          content: text
        }
      ],
      store: true,
    });

    // Check if response has the expected data
    if (!response.choices?.[0]?.message?.audio?.data) {
      throw new Error('Invalid response format from OpenAI Audio API');
    }

    // Get the audio data from the response
    const audioData = response.choices[0].message.audio.data;
    
    // Convert base64 to binary
    const audioBuffer = Buffer.from(audioData, 'base64');

    // Return the audio data with the appropriate content type
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('Error calling OpenAI Audio API:', error);
    return NextResponse.json(
      { error: 'Failed to generate speech' },
      { status: 500 }
    );
  }
}
