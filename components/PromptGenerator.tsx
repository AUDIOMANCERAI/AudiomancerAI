import React, { useState } from 'react';
import { genres } from '../data/genres';
import { moods } from '../data/moods';
import { instruments } from '../data/instruments';
import { synths } from '../data/synths';
import { enhancePrompt } from '../services/geminiService';

type Step = 'genre' | 'subgenre' | 'mood' | 'instrument' | 'synth' | 'result';

interface PromptGeneratorProps {
  onPromptGenerated: (prompt: string) => void;
}

const LoadingSpinner: React.FC = () => (
    <div className="w-5 h-5 border-2 border-bunker-500 border-t-cyan-400 rounded-full animate-spin"></div>
);

const ChevronRightIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
  </svg>
);


const PromptGenerator: React.FC<PromptGeneratorProps> = ({ onPromptGenerated }) => {
  const [step, setStep] = useState<Step>('genre');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedSubgenre, setSelectedSubgenre] = useState<string | null>(null);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([]);
  const [selectedSynths, setSelectedSynths] = useState<string[]>([]);

  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancedPrompt, setEnhancedPrompt] = useState<string | null>(null);
  const [enhancementError, setEnhancementError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);


  const handleSelectGenre = (genre: string) => {
    setSelectedGenre(genre);
    setStep('subgenre');
  };

  const handleSelectSubgenre = (subgenre: string) => {
    setSelectedSubgenre(subgenre);
    setStep('mood');
  };
  
  const handleSelectMood = (mood: string) => {
    setSelectedMoods(prev => {
      if (prev.includes(mood)) return prev.filter(m => m !== mood);
      if (prev.length < 3) return [...prev, mood];
      return prev;
    });
  };
  
  const handleSelectInstrument = (instrument: string) => {
    setSelectedInstruments(prev => {
        if (prev.includes(instrument)) return prev.filter(i => i !== instrument);
        if (prev.length < 3) return [...prev, instrument];
        return prev;
    });
  };

  const handleSelectSynth = (synth: string) => {
    setSelectedSynths(prev => {
        if (prev.includes(synth)) return prev.filter(s => s !== synth);
        if (prev.length < 2) return [...prev, synth];
        return prev;
    });
  };
  
  const renderFinalPrompt = () => {
    let parts = [];
    if (selectedMoods.length > 0) parts.push(selectedMoods.join(', '));
    if (selectedSubgenre) parts.push(selectedSubgenre);

    let prompt = `A ${parts.join(' ')} track`;
    
    const instrumentsAndSynths = [...selectedInstruments, ...selectedSynths];
    if (instrumentsAndSynths.length > 0) {
      prompt += ` featuring ${instrumentsAndSynths.join(', ')}`;
    }
    prompt += '.';
    return prompt;
  };

  const generateAndEnhancePrompt = async () => {
      setIsEnhancing(true);
      setEnhancementError(null);
      setStep('result'); // Go to result page to show loader
      try {
          const simplePrompt = renderFinalPrompt();
          const result = await enhancePrompt(simplePrompt);
          setEnhancedPrompt(result);
      } catch (e: unknown) {
          setEnhancementError(e instanceof Error ? e.message : 'An unknown error occurred.');
      } finally {
          setIsEnhancing(false);
      }
  };


  const handleNext = () => {
    switch (step) {
      case 'mood':
        if (selectedMoods.length > 0) setStep('instrument');
        break;
      case 'instrument':
        setStep('synth');
        break;
      case 'synth':
        generateAndEnhancePrompt();
        break;
    }
  };

  const handleStartOver = () => {
    setStep('genre');
    setSelectedGenre(null);
    setSelectedSubgenre(null);
    setSelectedMoods([]);
    setSelectedInstruments([]);
    setSelectedSynths([]);
    setEnhancedPrompt(null);
    setEnhancementError(null);
  };
  
  const handleBack = () => {
    if (step === 'result') {
        setEnhancedPrompt(null);
        setEnhancementError(null);
    }
    switch (step) {
      case 'subgenre':
        setStep('genre');
        setSelectedGenre(null);
        break;
      case 'mood':
        setStep('subgenre');
        setSelectedSubgenre(null);
        break;
      case 'instrument':
        setStep('mood');
        break;
      case 'synth':
        setStep('instrument');
        break;
      case 'result':
        setStep('synth');
        break;
    }
  };

  const mainGenres = Object.keys(genres);

  const renderBreadcrumbs = () => {
    const crumbs = [];
    if (selectedGenre) crumbs.push(selectedGenre);
    if (selectedSubgenre) crumbs.push(selectedSubgenre);
    if (selectedMoods.length > 0) crumbs.push(selectedMoods.join(', '));
    if (selectedInstruments.length > 0) crumbs.push(selectedInstruments.join(', '));
    if (selectedSynths.length > 0) crumbs.push(selectedSynths.join(', '));

    return (
        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-fuchsia-400 mb-4">
            <button onClick={handleBack} className="text-sm font-semibold p-1 hover:bg-bunker-700 rounded-md">Back</button>
            {crumbs.map((crumb, index) => (
                <React.Fragment key={index}>
                    <ChevronRightIcon className="w-4 h-4" />
                    <span className={index === crumbs.length -1 ? 'text-cyan-300 font-semibold drop-shadow-[0_0_4px_rgba(34,211,238,0.3)]' : 'font-medium'}>{crumb}</span>
                </React.Fragment>
            ))}
        </div>
    );
  };
  
  const handleUsePrompt = () => {
    if (enhancedPrompt) {
        onPromptGenerated(enhancedPrompt);
    }
  };

  const handleCopy = () => {
    if (enhancedPrompt) {
        navigator.clipboard.writeText(enhancedPrompt).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }).catch(err => {
            console.error('Failed to copy prompt: ', err);
        });
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
       <div>
        <h2 className="text-xl font-bold text-white">Music Prompt Generator</h2>
        <p className="text-fuchsia-400 mt-1">
          Follow the steps to refine your musical ideas into a detailed prompt.
        </p>
      </div>
      
      <div className="bg-bunker-950/50 rounded-lg border border-bunker-800 p-6 min-h-[400px] flex flex-col">
        {step === 'genre' && (
          <div className="animate-fade-in">
            <h3 className="font-semibold text-lg text-white mb-4">Step 1: Choose a Main Genre</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {mainGenres.map(genre => (
                <button key={genre} onClick={() => handleSelectGenre(genre)} className="p-4 bg-bunker-800/60 rounded-md text-fuchsia-300 hover:bg-cyan-500/20 hover:text-cyan-300 transition-colors duration-200 text-center font-medium">
                  {genre}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'subgenre' && selectedGenre && (
          <div className="animate-fade-in">
            {renderBreadcrumbs()}
            <h3 className="font-semibold text-lg text-white mb-4">Step 2: Choose a Subgenre</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {genres[selectedGenre].map(subgenre => (
                <button key={subgenre} onClick={() => handleSelectSubgenre(subgenre)} className="p-3 text-sm bg-bunker-800/60 rounded-md text-fuchsia-400 hover:bg-cyan-500/20 hover:text-cyan-300 transition-colors duration-200 text-center font-medium">
                  {subgenre}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'mood' && selectedSubgenre && (
            <div className="animate-fade-in">
                {renderBreadcrumbs()}
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-lg text-white">Step 3: Choose up to 3 Moods</h3>
                    <span className="text-sm text-fuchsia-400">{selectedMoods.length} / 3 selected</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 text-center text-sm">
                    {moods.map(mood => (
                        <button key={mood} onClick={() => handleSelectMood(mood)} className={`p-2 rounded-md transition-colors duration-200 font-medium ${selectedMoods.includes(mood) ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400' : 'bg-bunker-800 text-fuchsia-400 hover:bg-bunker-700/60'}`}>
                            {mood}
                        </button>
                    ))}
                </div>
                 <div className="mt-6 flex justify-center">
                    <button onClick={handleNext} disabled={selectedMoods.length === 0} className="px-8 py-2 bg-cyan-500 text-bunker-950 font-bold rounded-md hover:bg-cyan-400 disabled:bg-bunker-600 disabled:cursor-not-allowed transition-colors shadow-lg shadow-cyan-500/30 hover:shadow-cyan-400/40">
                        Next
                    </button>
                </div>
            </div>
        )}

        {step === 'instrument' && (
             <div className="animate-fade-in">
                {renderBreadcrumbs()}
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-lg text-white">Step 4: Choose up to 3 Instruments (Optional)</h3>
                    <span className="text-sm text-fuchsia-400">{selectedInstruments.length} / 3 selected</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 text-center text-sm">
                    {instruments.map(instrument => (
                        <button key={instrument} onClick={() => handleSelectInstrument(instrument)} className={`p-2 rounded-md transition-colors duration-200 font-medium ${selectedInstruments.includes(instrument) ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400' : 'bg-bunker-800 text-fuchsia-400 hover:bg-bunker-700/60'}`}>
                            {instrument}
                        </button>
                    ))}
                </div>
                 <div className="mt-6 flex justify-center">
                    <button onClick={handleNext} className="px-8 py-2 bg-cyan-500 text-bunker-950 font-bold rounded-md hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/30 hover:shadow-cyan-400/40">
                        Next
                    </button>
                </div>
            </div>
        )}

        {step === 'synth' && (
             <div className="animate-fade-in">
                {renderBreadcrumbs()}
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-lg text-white">Step 5: Choose up to 2 Synths (Optional)</h3>
                    <span className="text-sm text-fuchsia-400">{selectedSynths.length} / 2 selected</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 text-center text-sm">
                    {synths.map(synth => (
                        <button key={synth} onClick={() => handleSelectSynth(synth)} className={`p-2 rounded-md transition-colors duration-200 font-medium ${selectedSynths.includes(synth) ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400' : 'bg-bunker-800 text-fuchsia-400 hover:bg-bunker-700/60'}`}>
                            {synth}
                        </button>
                    ))}
                </div>
                 <div className="mt-6 flex justify-center">
                    <button onClick={handleNext} className="px-8 py-2 bg-cyan-500 text-bunker-950 font-bold rounded-md hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/30 hover:shadow-cyan-400/40">
                        Next
                    </button>
                </div>
            </div>
        )}

        {step === 'result' && (
           <div className="animate-fade-in flex flex-col flex-grow">
                {renderBreadcrumbs()}
                {isEnhancing ? (
                    <div className="flex-grow flex flex-col justify-center items-center">
                        <div className="w-8 h-8 border-4 border-bunker-500 border-t-cyan-400 rounded-full animate-spin"></div>
                        <p className="mt-4 text-fuchsia-400 text-lg">Generating a creative prompt...</p>
                    </div>
                ) : enhancementError ? (
                    <div className="flex-grow flex flex-col justify-center items-center p-4">
                        <div className="my-2 p-4 bg-red-900/30 text-red-400 rounded-md text-center">
                            <p className="font-bold text-lg mb-2">Oops! Something went wrong.</p>
                            <p>{enhancementError}</p>
                            <button onClick={handleStartOver} className="mt-4 px-6 py-2 bg-bunker-800/60 text-fuchsia-300 rounded-md hover:bg-bunker-700/80 transition-colors">
                                Start Over
                            </button>
                        </div>
                    </div>
                ) : enhancedPrompt && (
                    <>
                        <div className="relative flex-grow p-4 mt-4 rounded-md bg-bunker-950/70 border border-cyan-400/20 shadow-inner shadow-cyan-900/50">
                            <button 
                                onClick={handleCopy}
                                aria-label="Copy prompt"
                                className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 text-xs bg-bunker-800/80 rounded-md text-fuchsia-300 hover:bg-bunker-700/90 transition-colors disabled:opacity-50"
                                disabled={isCopied}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                <span>{isCopied ? 'Copied!' : 'Copy'}</span>
                            </button>
                            <h3 className="font-semibold text-lg text-white mb-2">Your AI-Generated Prompt:</h3>
                            <p className="text-cyan-400 text-lg leading-relaxed whitespace-pre-wrap">
                                {enhancedPrompt}
                            </p>
                        </div>
                        <div className="mt-6 flex justify-center gap-4 flex-wrap">
                            <button onClick={handleStartOver} className="px-6 py-2 bg-bunker-800/60 text-fuchsia-300 rounded-md hover:bg-bunker-700/80 transition-colors">
                                Start Over
                            </button>
                            <button onClick={handleUsePrompt} className="px-8 py-2 bg-cyan-500 text-bunker-950 font-bold rounded-md hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/30 hover:shadow-cyan-400/40">
                                Use this Prompt
                            </button>
                        </div>
                    </>
                )}
          </div>
        )}
      </div>
    </div>
  );
};