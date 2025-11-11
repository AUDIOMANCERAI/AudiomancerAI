import React, { useState, useEffect } from 'react';

const FileWizard: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);

    // Revoke the object URL when the component unmounts or the file changes
    useEffect(() => {
        return () => {
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }
        };
    }, [audioUrl]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Revoke previous URL if it exists
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
            setAudioUrl(null);
        }

        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setAudioUrl(URL.createObjectURL(selectedFile));
        } else {
            setFile(null);
        }
    };

    return (
        <div className="p-6 md:p-8 space-y-6">
            <div>
                <h2 className="text-xl font-bold text-white">Audio File Player</h2>
                <p className="text-fuchsia-400 mt-1">
                    Upload an audio file to play it back in the browser.
                </p>
            </div>
            
            <div className="p-4 bg-bunker-950/50 rounded-lg border border-bunker-800 space-y-4">
                 <label htmlFor="audio-upload" className="block text-base font-semibold text-white">Upload Audio File</label>
                 <div className="flex items-center justify-center w-full">
                    <label htmlFor="audio-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-bunker-700 border-dashed rounded-lg cursor-pointer bg-bunker-900/50 hover:bg-bunker-800/50">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <svg className="w-8 h-8 mb-4 text-fuchsia-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/></svg>
                            <p className="mb-2 text-sm text-fuchsia-300"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                            <p className="text-xs text-bunker-400">WAV, MP3, FLAC, etc.</p>
                        </div>
                        <input id="audio-upload" type="file" className="hidden" accept="audio/*" onChange={handleFileChange} />
                    </label>
                </div> 
                {file && <p className="text-center text-cyan-300">Selected: {file.name}</p>}
            </div>

            {audioUrl && (
                <div className="pt-4">
                    <h3 className="text-lg font-semibold text-white mb-4">Playback</h3>
                    <audio controls src={audioUrl} className="w-full">
                        Your browser does not support the audio element.
                    </audio>
                </div>
            )}
        </div>
    );
};

export default FileWizard;