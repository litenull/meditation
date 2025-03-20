import MeditationTimer from './components/MeditationTimer';

export default function Home() {
  return (
    <div className="min-h-screen p-8 pb-20 gap-16 sm:p-12 font-[family-name:var(--font-geist-sans)]">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold mb-4">Meditation Timer</h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          A guided meditation timer with text-to-speech
        </p>
      </header>
      
      <main>
        <MeditationTimer 
          initialDuration={600} // 10 minutes
          initialTranscript={`00:05 Take a deep breath in, and slowly exhale
01:00 Focus on your breathing, feeling the air flow in and out
02:30 Relax your shoulders and let go of any tension
04:00 Notice the sensations in your body without judgment
06:00 If your mind wanders, gently bring your attention back to your breath
08:00 Begin to deepen your breath, preparing to return
09:30 When you're ready, slowly open your eyes`}
        />
      </main>

      <footer className="mt-16 text-center text-sm text-gray-500">
        <p>Remember to set your OPENAI_API_KEY in .env.local</p>
      </footer>
    </div>
  );
}
