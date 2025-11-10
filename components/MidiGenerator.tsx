import React, { useCallback, useRef, useEffect } from 'react';
import { generateMidiPattern, convertAudioToMidi } from '../services/geminiService';
import { MidiNote } from '../types';
import PianoRoll from './PianoRoll';
import { createMidiFile } from '../utils/midiUtils';
import { fileToBase64 } from '../utils/fileUtils';
import { bufferToWave } from '../utils/audioUtils';

interface MidiGeneratorProps {
    prompt: string;
    setPrompt: (prompt: string) => void;
}

const LoadingSpinner: React.FC = () => (
    <div className="w-5 h-5 border-2 border-bunker-500 border-t-cyan-400 rounded-full animate-spin"></div>
);

const UploadIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
    </svg>
);

const PlayIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M8 5v14l11-7z" />
    </svg>
);

const StopIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M6 6h12v12H6z" />
    </svg>
);


const MidiGenerator: React.FC<MidiGeneratorProps> = ({ prompt, setPrompt }) => {
    const [mode, setMode] = React.useState<'text' | 'audio'>('text');
    
    // Text mode state
    const [patternType, setPatternType] = React.useState('bassline');
    const [duration, setDuration] = React.useState(4);
    const [bpm, setBpm] = React.useState(120);

    // Audio mode state
    const [audioFile, setAudioFile] = React.useState<File | null>(null);
    const [instrumentToExtract, setInstrumentToExtract] = React.useState('bassline');

    // Shared state
    const [notes, setNotes] = React.useState<MidiNote[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [midiUrl, setMidiUrl] = React.useState<string | null>(null);
    const [wavUrl, setWavUrl] = React.useState<string | null>(null);
    const [isRenderingWav, setIsRenderingWav] = React.useState(false);
    const [generatedDuration, setGeneratedDuration] = React.useState(4);
    
    // Playback state
    const [isPlaying, setIsPlaying] = React.useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const scheduledSourcesRef = useRef<AudioNode[]>([]);
    const playbackTimeoutRef = useRef<number | null>(null);

    const textPatternTypes = ['bassline', 'chords', 'drums', 'harmony', 'melody'];
    const audioInstrumentTypes = ['bassline', 'drums', 'harmony', 'melody', 'vocals'];

    const examplePrompts = [
        "A groovy funk bassline in A minor",
        "An emotional piano melody in C major, simple and slow",
        "A fast, syncopated TR-808 hi-hat pattern",
        "Arpeggiated synth chords for a sci-fi soundtrack",
    ];
    
    useEffect(() => {
        return () => { if (midiUrl) URL.revokeObjectURL(midiUrl); };
    }, [midiUrl]);

    useEffect(() => {
        return () => { if (wavUrl) URL.revokeObjectURL(wavUrl); };
    }, [wavUrl]);

    useEffect(() => {
        return () => {
            handleStop();
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
            }
        };
    }, []);

    const handleStop = useCallback(() => {
        if (playbackTimeoutRef.current) {
            clearTimeout(playbackTimeoutRef.current);
            playbackTimeoutRef.current = null;
        }
        scheduledSourcesRef.current.forEach(source => {
            if (source instanceof OscillatorNode) {
                try {
                    source.stop();
                } catch (e) { /* Ignore if already stopped */ }
            }
            source.disconnect();
        });
        scheduledSourcesRef.current = [];
        setIsPlaying(false);
    }, []);

    const handlePlay = () => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const audioContext = audioContextRef.current;
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        if (notes.length === 0) return;

        handleStop();

        const now = audioContext.currentTime;
        const secondsPerBeat = 60.0 / bpm;
        const sources: AudioNode[] = [];
        let maxEndTime = 0;

        notes.forEach(note => {
            const osc = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            const startTime = now + note.start * secondsPerBeat;
            const endTime = startTime + note.duration * secondsPerBeat;
            if (endTime > maxEndTime) maxEndTime = endTime;

            const frequency = 440 * Math.pow(2, (note.pitch - 69) / 12);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(frequency, startTime);

            // Simple ADSR-like envelope
            const attackTime = 0.01;
            const peakGain = (note.velocity / 127) * 0.3; // Lower gain to prevent clipping
            gainNode.connect(audioContext.destination);
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(peakGain, startTime + attackTime);
            gainNode.gain.linearRampToValueAtTime(0, endTime);

            osc.connect(gainNode);
            osc.start(startTime);
            osc.stop(endTime);

            sources.push(osc, gainNode);
        });

        scheduledSourcesRef.current = sources;
        setIsPlaying(true);

        const totalDurationMs = (maxEndTime - now) * 1000;
        playbackTimeoutRef.current = window.setTimeout(() => {
            setIsPlaying(false);
            scheduledSourcesRef.current = [];
        }, totalDurationMs);
    };

    const renderWav = async (notesToRender: MidiNote[], tempo: number): Promise<Blob> => {
        const totalDuration = notesToRender.reduce((max, note) => Math.max(max, note.start + note.duration), 0);
        const secondsPerBeat = 60.0 / tempo;
        const totalDurationInSeconds = totalDuration * secondsPerBeat + 0.5; // Add a small buffer for release tails

        const offlineCtx = new OfflineAudioContext({
            numberOfChannels: 1,
            length: 44100 * totalDurationInSeconds,
            sampleRate: 44100,
        });
        
        notesToRender.forEach(note => {
            const osc = offlineCtx.createOscillator();
            const gainNode = offlineCtx.createGain();

            const startTime = note.start * secondsPerBeat;
            const endTime = startTime + note.duration * secondsPerBeat;
            
            const frequency = 440 * Math.pow(2, (note.pitch - 69) / 12);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(frequency, startTime);

            const attackTime = 0.01;
            const peakGain = (note.velocity / 127) * 0.3;
            gainNode.connect(offlineCtx.destination);
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(peakGain, startTime + attackTime);
            gainNode.gain.linearRampToValueAtTime(0, endTime);

            osc.connect(gainNode);
            osc.start(startTime);
            osc.stop(endTime);
        });

        const renderedBuffer = await offlineCtx.startRendering();
        return bufferToWave(renderedBuffer);
    };

    const handleGenerate = async () => {
        handleStop();
        setIsLoading(true);
        setError(null);
        setNotes([]);
        if (midiUrl) URL.revokeObjectURL(midiUrl);
        setMidiUrl(null);
        if (wavUrl) URL.revokeObjectURL(wavUrl);
        setWavUrl(null);
        setIsRenderingWav(false);

        try {
            let generatedNotes: MidiNote[] = [];
            if (mode === 'text') {
                if (!prompt.trim()) {
                    setError('Please enter a description for the MIDI pattern.');
                    setIsLoading(false);
                    return;
                }
                generatedNotes = await generateMidiPattern(prompt, patternType, duration, bpm);
                setGeneratedDuration(duration);
            } else { // Audio mode
                if (!audioFile) {
                    setError('Please upload an audio file.');
                    setIsLoading(false);
                    return;
                }
                const audioData = await fileToBase64(audioFile);
                generatedNotes = await convertAudioToMidi(audioData, instrumentToExtract);

                if (generatedNotes.length > 0) {
                    const maxBeat = Math.max(...generatedNotes.map(n => n.start + n.duration));
                    const newDurationInBars = Math.ceil(maxBeat / 4);
                    setGeneratedDuration(newDurationInBars > 0 ? newDurationInBars : 4);
                } else {
                    setGeneratedDuration(4);
                }
            }
            
            setNotes(generatedNotes);

            if (generatedNotes.length > 0) {
                const midiBlob = createMidiFile(generatedNotes);
                setMidiUrl(URL.createObjectURL(midiBlob));

                setIsRenderingWav(true);
                renderWav(generatedNotes, bpm)
                    .then(wavBlob => {
                        setWavUrl(URL.createObjectURL(wavBlob));
                    })
                    .catch(err => {
                        console.error("Failed to render WAV file:", err);
                    })
                    .finally(() => {
                        setIsRenderingWav(false);
                    });
            }
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const onDrop = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        if (event.dataTransfer.files && event.dataTransfer.files[0]) {
            setAudioFile(event.dataTransfer.files[0]);
        }
    }, []);

    const onDragOver = (event: React.DragEvent<HTMLLabelElement>) => event.preventDefault();
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            setAudioFile(event.target.files[0]);
        }
    };

    return (
        <div className="p-6 md:p-8 space-y-6">
             <div>
                <h2 className="text-xl font-bold text-white">Compose Your MIDI Pattern</h2>
                <p className="text-fuchsia-400 mt-1">
                    Use a text prompt or upload an audio file to generate music with AI.
                </p>
            </div>

            {/* Mode Switcher */}
            <div className="flex justify-center p-1 bg-bunker-800 rounded-lg">
                <button onClick={() => setMode('text')} disabled={isLoading} className={`w-1/2 px-4 py-2 text-sm font-semibold rounded-md transition ${mode === 'text' ? 'bg-cyan-600 text-white shadow-md shadow-cyan-500/40' : 'text-fuchsia-400 hover:bg-cyan-500/10'}`}>Text Prompt</button>
                <button onClick={() => setMode('audio')} disabled={isLoading} className={`w-1/2 px-4 py-2 text-sm font-semibold rounded-md transition ${mode === 'audio' ? 'bg-cyan-600 text-white shadow-md shadow-cyan-500/40' : 'text-fuchsia-400 hover:bg-cyan-500/10'}`}>Audio File</button>
            </div>

            {/* Text to MIDI UI */}
            {mode === 'text' && (
                <div className="space-y-6 animate-fade-in">
                     <div className="p-4 bg-bunker-950/50 rounded-lg border border-bunker-800 space-y-6">
                        <div>
                            <label className="block text-base font-semibold text-white mb-3">Pattern Type</label>
                            <div className="flex flex-wrap gap-2">
                                {textPatternTypes.map(type => (
                                    <button key={type} onClick={() => setPatternType(type)} disabled={isLoading} className={`px-4 py-2 text-sm rounded-md transition-colors font-medium ${patternType === type ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400' : 'bg-bunker-800 text-fuchsia-400 hover:bg-bunker-700/60 disabled:bg-bunker-800/50'}`}>
                                        {type.charAt(0).toUpperCase() + type.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="duration-select" className="block text-base font-semibold text-white mb-3">Duration</label>
                                <select id="duration-select" value={duration} onChange={e => setDuration(Number(e.target.value))} disabled={isLoading} className="w-full p-2.5 bg-bunker-950/50 border border-bunker-700 rounded-md focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 focus:outline-none transition text-fuchsia-300">
                                    <option value="4">4 Bars</option>
                                    <option value="8">8 Bars</option>
                                    <option value="16">16 Bars</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="bpm-input" className="block text-base font-semibold text-white mb-3">Tempo (BPM)</label>
                                <input id="bpm-input" type="number" value={bpm} onChange={e => setBpm(Math.max(30, Math.min(300, Number(e.target.value))))} disabled={isLoading} className="w-full p-2.5 bg-bunker-950/50 border border-bunker-700 rounded-md focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 focus:outline-none transition text-fuchsia-300"/>
                            </div>
                         </div>
                    </div>
                    <div className="space-y-3">
                        <label className="block text-base font-semibold text-white">Describe Your Idea</label>
                        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g., A funky house bassline in E minor with slides and ghost notes" className="w-full p-3 bg-bunker-950/50 border border-bunker-700 rounded-md focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 focus:outline-none transition text-fuchsia-300 resize-none h-24" disabled={isLoading}/>
                        <div className="flex flex-wrap gap-2">
                            {examplePrompts.map(ex => (<button key={ex} onClick={() => setPrompt(ex)} disabled={isLoading} className="px-2 py-1 text-xs bg-bunker-800/60 text-fuchsia-400 rounded hover:bg-bunker-700/80 hover:text-white transition-colors">{ex}</button>))}
                        </div>
                    </div>
                </div>
            )}

            {/* Audio to MIDI UI */}
            {mode === 'audio' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="p-4 bg-bunker-950/50 rounded-lg border border-bunker-800 space-y-4">
                        <div>
                            <label className="block text-base font-semibold text-white mb-3">Upload Audio</label>
                            <label onDrop={onDrop} onDragOver={onDragOver} className="flex flex-col items-center justify-center w-full h-32 px-4 transition bg-bunker-800/50 border-2 border-bunker-700 border-dashed rounded-md appearance-none cursor-pointer hover:border-cyan-400 focus:outline-none">
                                {audioFile ? (
                                    <span className="font-medium text-fuchsia-300">{audioFile.name}</span>
                                ) : (
                                    <span className="flex items-center space-x-2">
                                        <UploadIcon className="w-8 h-8 text-fuchsia-400"/>
                                        <span className="font-medium text-fuchsia-400">Drop an audio file, or <span className="text-cyan-400">click to select</span></span>
                                    </span>
                                )}
                                <input type="file" name="file_upload" className="hidden" accept="audio/*" onChange={handleFileChange} disabled={isLoading}/>
                            </label>
                        </div>
                         <div>
                            <label className="block text-base font-semibold text-white mb-3">Extract Instrument</label>
                            <div className="flex flex-wrap gap-2">
                                {audioInstrumentTypes.map(type => (
                                    <button key={type} onClick={() => setInstrumentToExtract(type)} disabled={isLoading} className={`px-4 py-2 text-sm rounded-md transition-colors font-medium ${instrumentToExtract === type ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400' : 'bg-bunker-800 text-fuchsia-400 hover:bg-bunker-700/60 disabled:bg-bunker-800/50'}`}>
                                        {type.charAt(0).toUpperCase() + type.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {error && <div className="text-red-400 bg-red-900/30 p-3 rounded-md">{error}</div>}

            <div className="flex justify-center">
                <button onClick={handleGenerate} disabled={isLoading} className="w-full md:w-auto px-8 py-3 bg-cyan-500 text-bunker-950 font-bold rounded-md hover:bg-cyan-400 disabled:bg-bunker-600 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/30 hover:shadow-cyan-400/40">
                    {isLoading ? <LoadingSpinner /> : (mode === 'text' ? 'Generate Pattern' : 'Generate from Audio')}
                </button>
            </div>
            
            <div className="pt-4">
                 <h3 className="text-lg font-semibold text-white mb-4">Generated Piano Roll</h3>
                <PianoRoll notes={notes} durationInBars={generatedDuration} />
                <div className="flex flex-wrap justify-center items-center gap-4 mt-6">
                    {notes.length > 0 && (
                        <button onClick={isPlaying ? handleStop : handlePlay} className="flex items-center gap-2 px-6 py-2 bg-bunker-800/60 text-fuchsia-300 rounded-md hover:bg-bunker-700/80 transition-colors">
                            {isPlaying ? <StopIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
                            <span>{isPlaying ? 'Stop' : 'Play'}</span>
                        </button>
                    )}
                    {midiUrl && (
                        <a href={midiUrl} download={`audiomancer-pattern-${Date.now()}.mid`} className="inline-block px-6 py-2 bg-bunker-800/60 text-fuchsia-300 rounded-md hover:bg-bunker-700/80 transition-colors">
                            Download .mid File
                        </a>
                    )}
                    {isRenderingWav && (
                         <div className="inline-flex items-center px-6 py-2 bg-bunker-700 text-fuchsia-400 rounded-md cursor-wait">
                            <div className="w-5 h-5 border-2 border-bunker-500 border-t-cyan-400 rounded-full animate-spin"></div>
                            <span className="ml-2">Rendering .wav...</span>
                        </div>
                    )}
                    {wavUrl && !isRenderingWav && (
                         <a href={wavUrl} download={`audiomancer-pattern-${Date.now()}.wav`} className="inline-block px-6 py-2 bg-bunker-800/60 text-fuchsia-300 rounded-md hover:bg-bunker-700/80 transition-colors">
                            Download .wav File
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MidiGenerator;