import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { fileToBase64 } from '../utils/fileUtils';

// A selection of reassuring messages for the user during the wait
const loadingMessages = [
    "Warming up the rendering engines...",
    "Storyboarding your vision...",
    "Choreographing the pixels...",
    "Rendering the first few frames...",
    "This is looking great...",
    "Adding cinematic flair...",
    "Polishing the final cut...",
    "Almost there, the masterpiece is nearly ready!"
];

const UploadIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
    </svg>
);

const VideoGenerator: React.FC = () => {
    const [apiKeySelected, setApiKeySelected] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [startImage, setStartImage] = useState<{ file: File; base64: string; mimeType: string; previewUrl: string } | null>(null);
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
    const [resolution, setResolution] = useState<'720p' | '1080p'>('1080p');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    
    const loadingMessageIntervalRef = useRef<number | null>(null);

    // Check for API key on component mount
    useEffect(() => {
        const checkApiKey = async () => {
            if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
                const hasKey = await window.aistudio.hasSelectedApiKey();
                setApiKeySelected(hasKey);
            } else {
                // Fallback for local development or if the script isn't loaded
                console.warn("aistudio context not found. Assuming API key is set in environment.");
                setApiKeySelected(true);
            }
        };
        checkApiKey();
    }, []);

    useEffect(() => {
        if (isLoading) {
            let messageIndex = 0;
            setLoadingMessage(loadingMessages[messageIndex]);
            loadingMessageIntervalRef.current = window.setInterval(() => {
                messageIndex = (messageIndex + 1) % loadingMessages.length;
                setLoadingMessage(loadingMessages[messageIndex]);
            }, 5000); // Change message every 5 seconds
        } else {
            if (loadingMessageIntervalRef.current) {
                clearInterval(loadingMessageIntervalRef.current);
            }
        }
        return () => {
            if (loadingMessageIntervalRef.current) {
                clearInterval(loadingMessageIntervalRef.current);
            }
        };
    }, [isLoading]);

    const handleSelectKey = async () => {
        if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
            await window.aistudio.openSelectKey();
            // Assume key selection is successful and proceed.
            setApiKeySelected(true);
        } else {
            setError("API Key selection is not available in this environment.");
        }
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (startImage?.previewUrl) URL.revokeObjectURL(startImage.previewUrl);
            const { mimeType, data } = await fileToBase64(file);
            setStartImage({ file, mimeType, base64: data, previewUrl: URL.createObjectURL(file) });
        }
    };

    const onDrop = useCallback(async (event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        const file = event.dataTransfer.files?.[0];
        if (file) {
            if (startImage?.previewUrl) URL.revokeObjectURL(startImage.previewUrl);
            const { mimeType, data } = await fileToBase64(file);
            setStartImage({ file, mimeType, base64: data, previewUrl: URL.createObjectURL(file) });
        }
    }, [startImage]);

    const onDragOver = (event: React.DragEvent<HTMLLabelElement>) => event.preventDefault();

    const pollOperation = async (operation: any) => {
        let currentOperation = operation;
        
        while (!currentOperation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            // Create a new instance for polling to ensure the key is fresh
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            try {
                currentOperation = await ai.operations.getVideosOperation({ operation: currentOperation });
            } catch (e: any) {
                 if (e.message?.includes("Requested entity was not found")) {
                    setError("API Key is invalid. Please select a valid key and try again.");
                    setApiKeySelected(false); // Force re-selection
                    setIsLoading(false);
                    return null;
                }
                throw e; // Re-throw other errors
            }
        }
        return currentOperation;
    };
    
    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError('Please enter a prompt for the video.');
            return;
        }

        setIsLoading(true);
        setError(null);
        if (videoUrl) URL.revokeObjectURL(videoUrl);
        setVideoUrl(null);
        
        try {
            // Re-initialize the AI client right before the call to get the latest key
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const requestPayload: any = {
                model: 'veo-3.1-fast-generate-preview',
                prompt: prompt,
                config: {
                    numberOfVideos: 1,
                    resolution: resolution,
                    aspectRatio: aspectRatio
                }
            };
            
            if (startImage) {
                requestPayload.image = {
                    imageBytes: startImage.base64,
                    mimeType: startImage.mimeType,
                };
            }

            let initialOperation = await ai.models.generateVideos(requestPayload);
            
            const finalOperation = await pollOperation(initialOperation);
            if (!finalOperation) return; // Polling failed

            const downloadLink = finalOperation.response?.generatedVideos?.[0]?.video?.uri;

            if (downloadLink) {
                const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
                if (!videoResponse.ok) {
                    throw new Error(`Failed to fetch video: ${videoResponse.statusText}`);
                }
                const videoBlob = await videoResponse.blob();
                const objectUrl = URL.createObjectURL(videoBlob);
                setVideoUrl(objectUrl);
            } else {
                throw new Error("Video generation completed but no video URI was returned.");
            }

        } catch (e: any) {
            console.error(e);
            if (e.message?.includes("Requested entity was not found")) {
                setError("Your API Key is invalid or missing required permissions. Please select a new key via the button above and ensure it is enabled for the Veo API.");
                setApiKeySelected(false); // Force re-selection
            } else {
                setError(e instanceof Error ? e.message : 'An unknown error occurred during video generation.');
            }
        } finally {
            setIsLoading(false);
        }
    };
    
    const renderContent = () => {
        if (!apiKeySelected) {
            return (
                <div className="text-center p-8 bg-bunker-950/50 rounded-lg border border-bunker-700">
                    <h3 className="text-lg font-semibold text-white mb-2">API Key Required</h3>
                    <p className="text-fuchsia-300 mb-4">
                        Video generation with Veo requires a Google AI API key. Please ensure your project has billing enabled.
                        <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline ml-1">Learn more</a>.
                    </p>
                    <button onClick={handleSelectKey} className="px-6 py-2 bg-cyan-500 text-bunker-950 font-bold rounded-md hover:bg-cyan-400 transition-colors">
                        Select API Key
                    </button>
                </div>
            );
        }

        return (
            <div className="space-y-6">
                <div className="space-y-3">
                    <label className="block text-base font-semibold text-white">Describe Your Video</label>
                    <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g., A neon hologram of a cat driving at top speed" className="w-full p-3 bg-bunker-950/50 border border-bunker-700 rounded-md focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 focus:outline-none transition text-fuchsia-300 resize-none h-24" disabled={isLoading}/>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                         <label className="block text-base font-semibold text-white mb-3">Starting Image (Optional)</label>
                         <label onDrop={onDrop} onDragOver={onDragOver} className="flex flex-col items-center justify-center w-full h-32 px-4 transition bg-bunker-800/50 border-2 border-bunker-700 border-dashed rounded-md appearance-none cursor-pointer hover:border-cyan-400 focus:outline-none">
                            {startImage ? (
                                <img src={startImage.previewUrl} alt="Preview" className="max-h-28 object-contain rounded-md" />
                            ) : (
                                <span className="flex items-center space-x-2">
                                    <UploadIcon className="w-8 h-8 text-fuchsia-400"/>
                                    <span className="font-medium text-fuchsia-400">Drop an image, or <span className="text-cyan-400">click to select</span></span>
                                </span>
                            )}
                            <input type="file" name="file_upload" className="hidden" accept="image/*" onChange={handleFileChange} disabled={isLoading}/>
                        </label>
                    </div>
                    <div className="space-y-4">
                        <div>
                           <label className="block text-base font-semibold text-white mb-2">Aspect Ratio</label>
                           <div className="flex gap-2">
                             <button onClick={() => setAspectRatio('16:9')} disabled={isLoading} className={`flex-1 py-2 text-sm rounded-md transition-colors font-medium ${aspectRatio === '16:9' ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400' : 'bg-bunker-800 text-fuchsia-400 hover:bg-bunker-700/60'}`}>Landscape (16:9)</button>
                             <button onClick={() => setAspectRatio('9:16')} disabled={isLoading} className={`flex-1 py-2 text-sm rounded-md transition-colors font-medium ${aspectRatio === '9:16' ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400' : 'bg-bunker-800 text-fuchsia-400 hover:bg-bunker-700/60'}`}>Portrait (9:16)</button>
                           </div>
                        </div>
                         <div>
                           <label className="block text-base font-semibold text-white mb-2">Resolution</label>
                           <div className="flex gap-2">
                             <button onClick={() => setResolution('1080p')} disabled={isLoading} className={`flex-1 py-2 text-sm rounded-md transition-colors font-medium ${resolution === '1080p' ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400' : 'bg-bunker-800 text-fuchsia-400 hover:bg-bunker-700/60'}`}>1080p</button>
                             <button onClick={() => setResolution('720p')} disabled={isLoading} className={`flex-1 py-2 text-sm rounded-md transition-colors font-medium ${resolution === '720p' ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400' : 'bg-bunker-800 text-fuchsia-400 hover:bg-bunker-700/60'}`}>720p</button>
                           </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-center">
                    <button onClick={handleGenerate} disabled={isLoading} className="w-full md:w-auto px-8 py-3 bg-cyan-500 text-bunker-950 font-bold rounded-md hover:bg-cyan-400 disabled:bg-bunker-600 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/30 hover:shadow-cyan-400/40">
                        {isLoading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-bunker-500 border-t-bunker-950 rounded-full animate-spin"></div>
                                <span>Generating...</span>
                            </>
                        ) : 'Generate Video'}
                    </button>
                </div>
            </div>
        )
    };

    return (
        <div className="p-6 md:p-8 space-y-6">
            <div>
                <h2 className="text-xl font-bold text-white">Bring Your Music to Life</h2>
                <p className="text-fuchsia-400 mt-1">
                    Generate a music video from a text prompt and an optional starting image.
                </p>
            </div>
            
            {renderContent()}

            {error && <div className="text-red-400 bg-red-900/30 p-3 rounded-md mt-4">{error}</div>}

            <div className={`w-full max-w-2xl mx-auto bg-bunker-950 rounded-lg overflow-hidden relative ring-1 ring-bunker-700 mt-6 ${aspectRatio === '16:9' ? 'aspect-video' : 'aspect-[9/16]'}`}>
                {isLoading && (
                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-center p-4">
                        <div className="w-16 h-16 border-4 border-bunker-500 border-t-cyan-400 rounded-full animate-spin"></div>
                        <p className="mt-4 text-cyan-300 font-semibold">{loadingMessage}</p>
                        <p className="mt-2 text-fuchsia-400 text-sm">Video generation can take a few minutes. Please be patient.</p>
                    </div>
                )}
                {videoUrl ? (
                    <video src={videoUrl} controls autoPlay loop className="w-full h-full object-contain" />
                ) : (
                    !isLoading && <div className="flex items-center justify-center h-full text-fuchsia-500">Your generated video will appear here</div>
                )}
            </div>

            {videoUrl && !isLoading && (
                <div className="text-center mt-4">
                    <a 
                        href={videoUrl} 
                        download={`audiomancer-video-${Date.now()}.mp4`}
                        className="inline-block px-6 py-2 bg-bunker-700 text-fuchsia-300 rounded-md hover:bg-bunker-600 transition-colors"
                    >
                        Download Video
                    </a>
                </div>
            )}
        </div>
    );
};

export default VideoGenerator;
