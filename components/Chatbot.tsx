import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, GroundingSource } from '../types';
import { sendMessage, startChat, generateSpeech } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audioUtils';
import { GenerateContentResponse } from '@google/genai';

const SpeakerWaveIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
  </svg>
);

const LinkIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
    </svg>
);

const Chatbot: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [useSearch, setUseSearch] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);

  const audioContextRef = useRef<AudioContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    startChat(useSearch); // Re-initialize chat when search mode changes
    setMessages([
        { id: 'initial', role: 'model', parts: [{ text: `Hello! I am the Audiomancer Wizard. ${useSearch ? 'Web search is enabled.' : ''} How can I assist you in your musical quest today?` }] }
    ]);
    if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
    }
  }, [useSearch]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage: ChatMessage = { id: Date.now().toString(), role: 'user', parts: [{ text: input }] };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);
    
    const modelResponseId = (Date.now() + 1).toString();
    const newModelMessage: ChatMessage = { id: modelResponseId, role: 'model', parts: [{ text: '' }] };
    setMessages(prev => [...prev, newModelMessage]);

    try {
      let fullResponseText = '';
      let finalChunk: GenerateContentResponse | null = null;
      const stream = sendMessage(input);

      for await (const chunk of stream) {
        fullResponseText += chunk.text;
        finalChunk = chunk; // Keep overwriting, the last one will have the final data
        setMessages(prev => prev.map(msg => 
          msg.id === modelResponseId ? { ...msg, parts: [{ text: fullResponseText }] } : msg
        ));
      }

      // After stream is complete, check for grounding metadata
      if (finalChunk) {
        const groundingMetadata = finalChunk.candidates?.[0]?.groundingMetadata;
        if (groundingMetadata?.groundingChunks?.length) {
            const sources: GroundingSource[] = groundingMetadata.groundingChunks
                .map(chunk => chunk.web)
                .filter((web): web is { uri: string, title: string } => !!web && !!web.uri && !!web.title)
                .map(({ uri, title }) => ({ uri, title }));

            if (sources.length > 0) {
                 setMessages(prev => prev.map(msg => 
                    msg.id === modelResponseId ? { ...msg, sources } : msg
                ));
            }
        }
      }

      if (autoSpeak && fullResponseText) {
        await handleSpeak({
            id: modelResponseId,
            role: 'model',
            parts: [{ text: fullResponseText }],
        });
      }

    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An unknown error occurred.');
      setMessages(prev => prev.filter(msg => msg.id !== modelResponseId));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpeak = async (message: ChatMessage) => {
    if (!audioContextRef.current || speakingMessageId) return;
    const textToSpeak = message.parts[0].text;
    if (!textToSpeak) return;

    setSpeakingMessageId(message.id);
    try {
        if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }
        const audioData = await generateSpeech(textToSpeak);
        const decodedBytes = decode(audioData);
        const audioBuffer = await decodeAudioData(decodedBytes, audioContextRef.current, 24000, 1);
        
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        source.start();
        source.onended = () => {
            setSpeakingMessageId(null);
        };
    } catch (e) {
        console.error('TTS Error:', e);
        setError("Sorry, I couldn't generate audio for that message.");
        setSpeakingMessageId(null);
    }
  };

  return (
    <div className="p-4 md:p-6 h-[70vh] flex flex-col">
      <div className="flex-1 overflow-y-auto pr-2 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`flex items-end max-w-md ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`p-3 rounded-lg ${msg.role === 'user' ? 'bg-cyan-800/50 text-white ml-2' : 'bg-bunker-800 text-fuchsia-300 mr-2'} whitespace-pre-wrap`}>
                  {msg.parts[0].text}
                </div>
                {msg.role === 'model' && msg.parts[0].text && (
                   <button onClick={() => handleSpeak(msg)} disabled={!!speakingMessageId} className="text-fuchsia-400 hover:text-cyan-400 disabled:text-fuchsia-700 disabled:cursor-wait transition-colors flex-shrink-0">
                       <SpeakerWaveIcon className={`w-4 h-4 ${speakingMessageId === msg.id ? 'animate-pulse text-cyan-400' : ''}`} />
                   </button>
                )}
            </div>
            {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 ml-1 max-w-md">
                    <h4 className="text-xs font-bold text-bunker-400 mb-1">Sources:</h4>
                    <div className="flex flex-wrap gap-2">
                        {msg.sources.map((source, index) => (
                            <a 
                                href={source.uri} 
                                key={index} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs bg-bunker-800 text-cyan-400 hover:bg-bunker-700/80 hover:text-cyan-300 rounded-full px-3 py-1 transition-colors"
                            >
                                <LinkIcon className="w-3 h-3"/>
                                <span>{source.title || new URL(source.uri).hostname}</span>
                            </a>
                        ))}
                    </div>
                </div>
            )}
          </div>
        ))}
        {isLoading && messages[messages.length-1].role === 'model' && (
          <div className="flex justify-start">
            <div className="p-3 rounded-lg bg-bunker-800">
                <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-fuchsia-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-fuchsia-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-fuchsia-400 rounded-full animate-pulse"></div>
                </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && <div className="text-red-400 p-2 text-sm">{error}</div>}

      <div className="mt-4 pt-4 border-t border-bunker-800">
        <div className="flex items-center justify-center gap-6 mb-3">
            <label htmlFor="search-toggle" className="flex items-center cursor-pointer">
                <span className="mr-3 text-sm font-medium text-fuchsia-300">Search the Web</span>
                <div className="relative">
                    <input type="checkbox" id="search-toggle" className="sr-only" checked={useSearch} onChange={() => setUseSearch(!useSearch)} disabled={isLoading} />
                    <div className={`block w-10 h-6 rounded-full transition ${useSearch ? 'bg-cyan-500' : 'bg-bunker-700'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition ${useSearch ? 'transform translate-x-full' : ''}`}></div>
                </div>
            </label>
             <label htmlFor="autospeak-toggle" className="flex items-center cursor-pointer">
                <span className="mr-3 text-sm font-medium text-fuchsia-300">Wizard's Voice</span>
                <div className="relative">
                    <input type="checkbox" id="autospeak-toggle" className="sr-only" checked={autoSpeak} onChange={() => setAutoSpeak(!autoSpeak)} disabled={isLoading || !!speakingMessageId} />
                    <div className={`block w-10 h-6 rounded-full transition ${autoSpeak ? 'bg-cyan-500' : 'bg-bunker-700'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition ${autoSpeak ? 'transform translate-x-full' : ''}`}></div>
                </div>
            </label>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about music theory..."
            className="flex-grow p-3 bg-bunker-950 border border-bunker-700 rounded-md focus:ring-2 focus:ring-cyan-400 focus:outline-none transition text-fuchsia-300"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="px-6 py-3 bg-cyan-500 text-bunker-950 font-bold rounded-md hover:bg-cyan-400 disabled:bg-bunker-600 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;