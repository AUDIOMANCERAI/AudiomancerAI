import React, { useState } from 'react';
import Header from './components/Header';
import Tabs from './components/Tabs';
import MidiGenerator from './components/MidiGenerator';
import Chatbot from './components/Chatbot';
import { ActiveTab } from './types';
import PromptGenerator from './components/PromptGenerator';
import FileWizard from './components/FileWizard';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [midiPrompt, setMidiPrompt] = useState('');

  const handlePromptGenerated = (prompt: string) => {
    setMidiPrompt(prompt);
    setActiveTab('midi');
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'midi':
        return <MidiGenerator prompt={midiPrompt} setPrompt={setMidiPrompt} />;
      case 'prompt':
        return <PromptGenerator onPromptGenerated={handlePromptGenerated} />;
      case 'chat':
        return <Chatbot />;
      case 'fileWizard':
        return <FileWizard />;
      default:
        return null;
    }
  }

  return (
    <div className="bg-transparent min-h-screen text-bunker-100 font-sans">
      <Header />
      <main className="container mx-auto p-4 md:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mt-6 bg-bunker-900/30 backdrop-blur-xl rounded-lg shadow-2xl shadow-cyan-900/50 ring-1 ring-cyan-400/20 overflow-hidden">
            <Tabs activeTab={activeTab} setActiveTab={setActiveTab} />
            <div className="animate-fade-in">
              {renderActiveTab()}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
