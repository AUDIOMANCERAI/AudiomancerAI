export interface MidiNote {
  pitch: number;
  start: number;
  duration: number;
  velocity: number;
}

export type ActiveView = 'midi' | 'prompt';

// Fix: Add ActiveTab type definition.
export type ActiveTab = 'midi' | 'prompt' | 'chat' | 'fileWizard';

export interface GroundingSource {
  uri: string;
  title: string;
}

// Fix: Add ChatMessage interface definition.
export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  parts: { text: string }[];
  sources?: GroundingSource[];
}