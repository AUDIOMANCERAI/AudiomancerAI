// Fix: Add Chat and Modality to imports for chat and speech generation features.
import { GoogleGenAI, Type, GenerateContentResponse, Chat, Modality, Tool } from "@google/genai";
import { MidiNote } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const midiSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      pitch: {
        type: Type.INTEGER,
        description: 'MIDI pitch number (0-127). Middle C (C4) is 60.',
      },
      start: {
        type: Type.NUMBER,
        description: 'Start time in beats from the beginning of the pattern.',
      },
      duration: {
        type: Type.NUMBER,
        description: 'Duration of the note in beats.',
      },
      velocity: {
        type: Type.INTEGER,
        description: 'Note velocity (0-127), representing loudness.',
      },
    },
    required: ['pitch', 'start', 'duration', 'velocity'],
  },
};

const parseMidiResponse = (response: GenerateContentResponse): MidiNote[] => {
    const jsonString = response.text;
    try {
        const parsedJson = JSON.parse(jsonString);

        if (Array.isArray(parsedJson)) {
            return parsedJson as MidiNote[];
        } else if (parsedJson.notes && Array.isArray(parsedJson.notes)) {
            // Handle cases where the model wraps the array in an object
            return parsedJson.notes as MidiNote[];
        }
        
        console.warn("Parsed JSON is not in the expected array format:", parsedJson);
        return [];
    } catch (error) {
        console.error("Failed to parse JSON response:", jsonString, error);
        // Attempt to find a JSON array within the string if parsing fails
        const jsonMatch = jsonString.match(/\[.*\]/s);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]) as MidiNote[];
            } catch (e) {
                console.error("Failed to parse extracted JSON array:", e);
                return [];
            }
        }
        return [];
    }
}


export const generateMidiPattern = async (prompt: string, patternType: string, duration: number, bpm: number): Promise<MidiNote[]> => {
  const fullPrompt = `You are an expert MIDI music composer. Generate a ${duration}-bar MIDI pattern in 4/4 time at ${bpm} BPM for a ${patternType} part, based on the following description: "${prompt}". Ensure the pattern is creative and musically coherent. Respond ONLY with a JSON object that adheres to the provided schema.`;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: fullPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: midiSchema,
      },
    });
    return parseMidiResponse(response);
  } catch (error) {
    console.error('Error generating MIDI pattern:', error);
    throw new Error('Failed to generate MIDI pattern. Please try again.');
  }
};

export const convertAudioToMidi = async (audio: { mimeType: string, data: string }, instrument: string): Promise<MidiNote[]> => {
    const audioPart = {
        inlineData: {
            mimeType: audio.mimeType,
            data: audio.data,
        },
    };
    const textPart = {
        text: `You are an expert audio-to-MIDI transcriber. From the provided audio file, extract the ${instrument} part and convert it into a detailed MIDI pattern in 4/4 time. Respond ONLY with a JSON object that adheres to the provided schema.`,
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: { parts: [audioPart, textPart] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: midiSchema,
            },
        });
        return parseMidiResponse(response);
    } catch (error) {
        console.error('Error converting audio to MIDI:', error);
        throw new Error('Failed to convert audio to MIDI. Please try again.');
    }
};

export const enhancePrompt = async (simplePrompt: string): Promise<string> => {
    const fullPrompt = `You are an expert creative writer for music generation AI.
Take the following simple musical idea and expand it into a detailed, descriptive, and evocative prompt.
The goal is to give the AI MIDI generator a rich source of inspiration.
Focus on elements like:
- **Atmosphere and Mood:** Describe the overall feeling and setting.
- **Rhythm and Tempo:** Mention specific rhythmic ideas (e.g., syncopated, driving four-on-the-floor, complex polyrhythms) and tempo characteristics.
- **Harmony and Melody:** Suggest melodic contours, chord progressions, or harmonic textures (e.g., dissonant, consonant, melancholic minor key).
- **Instrumentation Details:** Suggest how specific instruments should be played (e.g., 'a funky bassline with slides and ghost notes', 'delicate piano arpeggios').
- **Dynamics:** Describe changes in volume and intensity.

Do NOT respond with JSON or code. Respond ONLY with the text of the enhanced prompt itself.

Simple Idea: "${simplePrompt}"

Enhanced Prompt:`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: fullPrompt,
        });
        return response.text.trim();
    } catch (error) {
        console.error('Error enhancing prompt:', error);
        throw new Error('Failed to enhance prompt. The AI might be busy, please try again.');
    }
};

// Fix: Add chat functionality for Chatbot component.
let chat: Chat;

export const startChat = (useSearch: boolean = false) => {
  const tools: Tool[] = [];
  if (useSearch) {
    tools.push({googleSearch: {}});
  }

  chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: "You are the Audiomancer Wizard, an AI assistant specializing in music theory, composition, and technology. Your persona is that of a wise and slightly mystical guide. Be friendly, helpful, and concise.",
      tools: tools.length > 0 ? tools : undefined,
    },
  });
};

export async function* sendMessage(message: string): AsyncGenerator<GenerateContentResponse> {
    if (!chat) {
        throw new Error("Chat not initialized. Call startChat first.");
    }
    try {
        const response = await chat.sendMessageStream({ message });
        for await (const chunk of response) {
            yield chunk;
        }
    } catch (error) {
        console.error('Error sending message:', error);
        throw new Error('Failed to get response from AI. Please try again.');
    }
}

// Fix: Add generateSpeech function for text-to-speech in Chatbot component.
export const generateSpeech = async (text: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        // 'Charon' has a deep, commanding voice suitable for a wizard persona.
                        prebuiltVoiceConfig: { voiceName: 'Charon' },
                    },
                },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            throw new Error("No audio data received from API.");
        }
        return base64Audio;
    } catch (error) {
        console.error('Error generating speech:', error);
        throw new Error('Failed to generate speech. Please try again.');
    }
};

// Fix: Add generateImage function for ImageGenerator component.
export const generateImage = async (prompt: string): Promise<string> => {
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
              numberOfImages: 1,
              outputMimeType: 'image/jpeg',
              aspectRatio: '1:1',
            },
        });

        if (response.generatedImages && response.generatedImages.length > 0 && response.generatedImages[0].image.imageBytes) {
            return response.generatedImages[0].image.imageBytes;
        } else {
            console.error("Image generation response did not contain image data:", response);
            throw new Error("No image was generated by the API.");
        }
    } catch (error) {
        console.error('Error generating image:', error);
        throw new Error('Failed to generate image. The AI might be busy, please try again.');
    }
};