import React, { useState, useRef, useEffect } from 'react';
// REMOVED: import { GoogleGenAI } from '@google/genai'; 
// The client is now handled securely on the Python backend.

// Assuming a new type for messages is available from types.ts
interface ChatMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}

// ... other components and constants (LoadingSpinner, SendIcon, etc.) ...

const Chatbot: React.FC = () => {
    // REMOVED: const [chat, setChat] = useState<any>(null); // No longer needed
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [userInput, setUserInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null); // Added error state

    // useEffect for chat initialization is REMOVED, as the chat session is now ephemeral 
    // or managed by the backend on a per-request basis.

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const messageText = userInput.trim();
        if (!messageText || isStreaming) return;

        setError(null);
        setIsStreaming(true);
        setUserInput('');

        // 1. Add user message to history
        const newUserMessage: ChatMessage = { role: 'user', parts: [{ text: messageText }] };
        setMessages(prev => [...prev, newUserMessage]);

        // 2. Add a placeholder for the model's response
        const newModelMessage: ChatMessage = { role: 'model', parts: [{ text: '' }] };
        setMessages(prev => [...prev, newModelMessage]);

        try {
            // =========================================================
            // SECURE REFIT: Call the Python API Gateway endpoint
            // The backend is responsible for calling Google AI API and streaming the response.
            // =========================================================
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Send the new user message and the full history for context
                body: JSON.stringify({
                    message: messageText,
                    history: messages.slice(-10), // Send last 10 messages for context
                }),
            });

            if (!response.ok || !response.body) {
                // Handle HTTP errors
                const errorBody = await response.text();
                throw new Error(`Backend Error: ${response.status} - ${errorBody || 'Failed to get a response.'}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let receivedText = '';

            // Stream the response chunks
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                receivedText += chunk;

                // Update the last message in state with the new chunk
                setMessages(prevMessages => {
                    const lastIndex = prevMessages.length - 1;
                    const updatedMessages = [...prevMessages];
                    updatedMessages[lastIndex] = {
                        ...updatedMessages[lastIndex],
                        parts: [{ text: receivedText }],
                    };
                    return updatedMessages;
                });
            }

        } catch (e: unknown) {
            console.error('API Gateway Error:', e);
            // Show a user-friendly error
            setError(e instanceof Error ? e.message : 'An unknown chat error occurred.');

            // Remove the empty model message placeholder on failure
            setMessages(prev => prev.slice(0, -1));
        } finally {
            setIsStreaming(false);
        }
    };

    // ... render logic remains largely the same, but now includes error display ...

    return (
        <div className="flex flex-col h-full">
            {/* ... Messages display ... */}

            {error && (
                <div className="p-3 bg-red-900/30 text-red-400 rounded-md mb-4">
                    <p className="font-bold">Error:</p>
                    <p>{error}</p>
                </div>
            )}

            <form onSubmit={handleSendMessage} className="p-4 border-t border-bunker-700">
                {/* ... input and button elements ... */}
            </form>
        </div>
    );
};