import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is not set.');
}

/**
 * Singleton instance of the OpenAI client used across the application.
 * Centralising the initialisation avoids re‑creating clients for every request
 * and keeps the code DRY.
 */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default openai; 