import React from 'react';
import { MidiNote } from '../types';

interface PianoRollProps {
  notes: MidiNote[];
  durationInBars: number;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const PianoRoll: React.FC<PianoRollProps> = ({ notes, durationInBars }) => {
  const defaultMinPitch = 48; // C3
  const defaultMaxPitch = 72; // C5

  const notePitches = notes.map(n => n.pitch);
  const minPitch = notes.length > 0 ? Math.min(...notePitches) : defaultMinPitch;
  const maxPitch = notes.length > 0 ? Math.max(...notePitches) : defaultMaxPitch;

  // Ensure a minimum vertical size for the piano roll for better viewing
  const displayMinPitch = Math.min(minPitch, defaultMinPitch);
  const displayMaxPitch = Math.max(maxPitch, defaultMaxPitch);

  const totalBeats = durationInBars * 4; // 4 beats/bar
  const pitchRange = displayMaxPitch - displayMinPitch + 1;

  const KEYBOARD_WIDTH = 60;
  const BEAT_WIDTH = 50;
  const NOTE_HEIGHT = 12;

  const viewboxWidth = KEYBOARD_WIDTH + totalBeats * BEAT_WIDTH;
  const viewboxHeight = pitchRange * NOTE_HEIGHT;
  
  const isBlackKey = (pitch: number) => {
    const keyInOctave = pitch % 12;
    return [1, 3, 6, 8, 10].includes(keyInOctave);
  };

  return (
    <div className="w-full overflow-x-auto bg-bunker-950 p-2 rounded-md ring-1 ring-bunker-700">
      <svg
        width="100%"
        height={viewboxHeight}
        viewBox={`0 0 ${viewboxWidth} ${viewboxHeight}`}
        preserveAspectRatio="none"
      >
        {/* Grid and Keyboard */}
        {Array.from({ length: pitchRange }, (_, i) => {
          const pitch = displayMaxPitch - i;
          const y = i * NOTE_HEIGHT;
          const isBlack = isBlackKey(pitch);

          // Background rows
          return (
            <g key={`row-${pitch}`}>
              <rect
                x={KEYBOARD_WIDTH}
                y={y}
                width={totalBeats * BEAT_WIDTH}
                height={NOTE_HEIGHT}
                fill={isBlack ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.02)'}
              />
            </g>
          );
        })}
        
        {/* Beat lines */}
        {Array.from({ length: totalBeats + 1 }, (_, i) => (
          <line
            key={`beat-line-${i}`}
            x1={KEYBOARD_WIDTH + i * BEAT_WIDTH}
            y1={0}
            x2={KEYBOARD_WIDTH + i * BEAT_WIDTH}
            y2={viewboxHeight}
            stroke={i % 4 === 0 ? 'rgba(34, 211, 238, 0.2)' : 'rgba(34, 211, 238, 0.1)'}
            strokeWidth={i % 4 === 0 ? 1 : 0.5}
          />
        ))}

        {/* Piano Keys */}
        {Array.from({ length: pitchRange }, (_, i) => {
          const pitch = displayMaxPitch - i;
          const y = i * NOTE_HEIGHT;
          const isBlack = isBlackKey(pitch);
          const octave = Math.floor(pitch / 12) - 1;
          const noteName = NOTE_NAMES[pitch % 12];
          return (
             <g key={`key-${pitch}`}>
               <rect 
                 x="0" 
                 y={y}
                 width={KEYBOARD_WIDTH}
                 height={NOTE_HEIGHT}
                 fill={isBlack ? '#2f3241' : '#cdd0dd'}
                 stroke="#0f1015"
                 strokeWidth="0.5"
                />
               <text
                 x="10"
                 y={y + NOTE_HEIGHT / 2}
                 dy=".3em"
                 fontSize="8"
                 fill={isBlack ? '#cdd0dd' : '#0f1015'}
                 className="font-mono select-none"
               >
                 {noteName}{octave}
               </text>
             </g>
           );
        })}

        {/* Placeholder text when no notes are present */}
        {notes.length === 0 && (
            <text
                x={KEYBOARD_WIDTH + (totalBeats * BEAT_WIDTH) / 2}
                y={viewboxHeight / 2}
                textAnchor="middle"
                fill="rgba(217, 70, 239, 0.4)"
                className="font-sans text-lg"
                dy=".3em"
            >
                Your generated MIDI pattern will appear here.
            </text>
        )}

        {/* Notes */}
        {notes.map((note, index) => {
          const y = (displayMaxPitch - note.pitch) * NOTE_HEIGHT;
          const x = KEYBOARD_WIDTH + note.start * BEAT_WIDTH;
          const width = note.duration * BEAT_WIDTH;
          const opacity = (note.velocity / 127) * 0.7 + 0.3; // Velocity affects opacity

          return (
            <rect
              key={index}
              x={x}
              y={y}
              width={width}
              height={NOTE_HEIGHT}
              fill="currentColor"
              className="text-cyan-400 drop-shadow-[0_0_3px_#22d3ee]"
              fillOpacity={opacity}
              rx="2"
              ry="2"
              stroke="#0f1015"
              strokeWidth="1"
            />
          );
        })}
      </svg>
    </div>
  );
};

export default PianoRoll;