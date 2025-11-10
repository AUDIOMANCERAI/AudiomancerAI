import React from 'react';
import { ActiveTab } from '../types';

interface TabsProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

const Tabs: React.FC<TabsProps> = ({ activeTab, setActiveTab }) => {
  const tabs: { id: ActiveTab; label: string }[] = [
    { id: 'chat', label: 'Wizard' },
    { id: 'prompt', label: 'Prompt Generator' },
    { id: 'midi', label: 'MIDI Generator' },
    { id: 'fileWizard', label: 'File Wizard' },
  ];

  return (
    <div className="flex justify-center border-b border-bunker-700">
      <div className="flex space-x-2 md:space-x-4" role="tablist" aria-orientation="horizontal">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm md:text-base font-medium rounded-t-md transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bunker-950 focus-visible:ring-cyan-400 ${
              activeTab === tab.id
                ? 'bg-bunker-900 text-cyan-400 border-b-2 border-cyan-400'
                : 'text-bunker-400 hover:text-white hover:bg-bunker-800/50'
            }`}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Tabs;