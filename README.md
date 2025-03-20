# Meditation App

A guided meditation app with a timer and text-to-speech capabilities, powered by Next.js and OpenAI's TTS API.

## Features

- Meditation timer with customizable duration
- Text-to-speech guided meditation using OpenAI's TTS API
- Support for timestamped transcripts (guided meditations at specific times)
- Multiple voice options

## Getting Started

### Prerequisites

- Node.js (latest LTS version recommended)
- OpenAI API key

### Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

3. Create a `.env.local` file in the root directory and add your OpenAI API key:

```
OPENAI_API_KEY=your_openai_api_key_here
```

4. Start the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Using the App

1. Set the desired meditation duration
2. Enter your meditation transcript with timestamps in the format:
   ```
   00:30 Take a deep breath in
   01:15 Now exhale slowly
   02:00 Feel your body relaxing
   ```
3. Select your preferred voice
4. Click "Start" to begin your meditation

The app will play audio instructions at the specified times during your meditation.

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key, required for text-to-speech functionality

## License

MIT
# meditation
