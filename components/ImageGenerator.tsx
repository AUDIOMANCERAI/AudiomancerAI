import React, { useState } from 'react';
import { generateImage } from '../services/geminiService';

const LoadingSpinner: React.FC = () => (
  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
    <div className="w-16 h-16 border-4 border-bunker-500 border-t-cyan-400 rounded-full animate-spin"></div>
  </div>
);

const ImageGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt for the image.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setImageUrl(null);

    try {
      const url = await generateImage(prompt);
      setImageUrl(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Create Album Art</h2>
        <p className="text-fuchsia-400 mt-1">
          Generate a unique cover art for your track.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., A robot DJing in a neon-lit city"
          className="flex-grow p-3 bg-bunker-950 border border-bunker-700 rounded-md focus:ring-2 focus:ring-cyan-400 focus:outline-none transition text-fuchsia-300"
          disabled={isLoading}
        />
        <button
          onClick={handleGenerate}
          disabled={isLoading}
          className="px-6 py-3 bg-cyan-500 text-bunker-950 font-bold rounded-md hover:bg-cyan-400 disabled:bg-bunker-600 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Generating...' : 'Generate'}
        </button>
      </div>

      {error && <div className="text-red-400 bg-red-900/30 p-3 rounded-md">{error}</div>}

      <div className="aspect-square w-full max-w-lg mx-auto bg-bunker-950 rounded-lg overflow-hidden relative ring-1 ring-bunker-700">
        {isLoading && <LoadingSpinner />}
        {imageUrl ? (
          <img src={imageUrl} alt={prompt} className="w-full h-full object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full text-fuchsia-500">
            Your generated art will appear here
          </div>
        )}
      </div>

      {imageUrl && (
        <div className="text-center">
            <a 
                href={imageUrl} 
                download={`audiomancer-art-${Date.now()}.jpg`}
                className="inline-block px-6 py-2 bg-bunker-700 text-fuchsia-300 rounded-md hover:bg-bunker-600 transition-colors"
            >
                Download Image
            </a>
        </div>
      )}
    </div>
  );
};

export default ImageGenerator;