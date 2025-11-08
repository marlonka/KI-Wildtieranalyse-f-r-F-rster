import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, Chat as GenAIChat } from "@google/genai";
import { ChatMessage, MessageRole } from '../types';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { generateSpeech } from '../services/geminiService';
import { playPcmAudio } from '../utils/audioUtils';
import { blobToBase64 } from '../utils/fileUtils';
import { parseChatMarkdown, cleanToolResponse } from '../utils/reportUtils';
import { Icons } from './Icons';

const ChatBubble: React.FC<{
    msg: ChatMessage;
    generatingAudioId: string | null;
    playingAudioId: string | null;
    onPlayAudio: (text: string, messageId: string) => void;
}> = React.memo(({ msg, generatingAudioId, playingAudioId, onPlayAudio }) => {
    const isUser = msg.role === MessageRole.USER;
    const isGenerating = generatingAudioId === msg.id;
    const isPlaying = playingAudioId === msg.id;
    const isAssistant = msg.role === MessageRole.ASSISTANT;
    const shouldAnimate = msg.id.startsWith('msg-');

    return (
        <div id={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} ${shouldAnimate ? 'animate-fade-in-up' : ''}`}>
            <div className={`px-4 py-2 rounded-2xl max-w-sm relative group ${isUser ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
                <div className="prose prose-sm max-w-none text-inherit prose-strong:text-white prose-em:text-white/90 prose-ul:list-disc prose-li:my-0 prose-li:ml-4 prose-p:my-1" dangerouslySetInnerHTML={{ __html: parseChatMarkdown(msg.text) }} />
                {isAssistant && (
                    <button 
                        onClick={() => onPlayAudio(msg.text, msg.id)}
                        className="absolute -bottom-4 -right-2 p-1.5 bg-gray-600 rounded-full shadow-md hover:bg-gray-500 transition-all text-emerald-300 hover:text-emerald-200 disabled:opacity-50"
                        disabled={!!playingAudioId || !!generatingAudioId}
                        aria-label="Antwort vorlesen"
                    >
                        {isGenerating ? <Icons.Loader className="animate-spin-slow" /> : (isPlaying ? <Icons.AudioLines className="animate-pulse" /> : <Icons.Speaker />)}
                    </button>
                )}
            </div>
            {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 max-w-sm w-full">
                    <p className="text-xs text-gray-400 mb-1">Quellen:</p>
                    <div className="flex flex-wrap gap-2">
                        {msg.sources.map((source, index) => (
                            <a
                                key={index}
                                href={source.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 bg-gray-600 text-gray-300 text-xs rounded-md hover:bg-gray-500 transition-colors truncate"
                                title={source.uri}
                            >
                                {source.title || new URL(source.uri).hostname}
                            </a>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
});


const Chat: React.FC<{ reportMarkdown: string }> = ({ reportMarkdown }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([
        { id: 'init-1', role: MessageRole.ASSISTANT, text: "Die Analyse ist abgeschlossen. Stellen Sie mir gerne Folgefragen." }
    ]);
    const [inputText, setInputText] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [generatingAudioId, setGeneratingAudioId] = useState<string | null>(null);
    const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const chatRef = useRef<GenAIChat | null>(null);

    const initializeChat = useCallback(() => {
        if (!process.env.API_KEY) return;
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const initialHistory = [
            { role: "user" as const, parts: [{ text: `Ich habe dir Bilder aus meinem Wald zur Analyse gegeben. Der von dir erstellte Bericht war:\n\n${reportMarkdown}` }] },
            { role: "model" as const, parts: [{ text: "Verstanden. Ich habe den Analysebericht als Kontext. Wie kann ich dir weiterhelfen?" }] }
        ];

        chatRef.current = ai.chats.create({
            model: 'gemini-2.5-flash',
            history: initialHistory,
            config: {
                systemInstruction: `Du bist ein hilfreicher Experte für Forst- und Wildtieranalyse. Deine primäre Wissensbasis ist der detaillierte Bericht, der dir im initialen Kontext zur Verfügung gestellt wird. Ignoriere dein internes Wissen über das aktuelle Datum oder zukünftige Ereignisse vollständig.

**Deine Vorgehensweise:**
1.  **Bericht zuerst:** Beantworte Fragen IMMER zuerst basierend auf dem Inhalt des Analyseberichts. Gehe davon aus, dass sich die Fragen des Nutzers auf diesen Bericht beziehen.
2.  **Websuche als Standard:** Nutze für JEDE Anfrage, die über den reinen Inhalt des Berichts hinausgeht, IMMER und ausnahmslos die Websuche. Dies ist obligatorisch, um aktuelle, zukünftige oder ereignisbezogene Informationen zu liefern. Verlasse dich NICHT auf dein internes Wissen für Fakten, Daten oder Ereignisse.
3.  **Quellen angeben:** Gib IMMER die gefundenen Quellen an.
4.  **Direkt und präzise:** Antworte direkt und prägnant auf Deutsch. Kombiniere clever Informationen aus dem Bericht und der Websuche, um die bestmögliche Antwort zu liefern.`,
                tools: [{googleSearch: {}}],
                thinkingConfig: { thinkingBudget: 24576 }
            }
        });
    }, [reportMarkdown]);

    useEffect(() => { initializeChat(); }, [initializeChat]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [inputText]);

    const handlePlayAudio = useCallback(async (text: string, messageId: string) => {
        if (playingAudioId || generatingAudioId || !process.env.API_KEY) return;
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        setGeneratingAudioId(messageId);
        try {
            const audioData = await generateSpeech(ai, text);
            setPlayingAudioId(messageId);
            await playPcmAudio(audioData);
        } catch (error) {
            console.error("Error playing audio:", error);
        } finally {
            setGeneratingAudioId(null);
            setPlayingAudioId(null);
        }
    }, [playingAudioId, generatingAudioId]);
    
    const submitMessage = useCallback(async (userText: string) => {
        if (!userText.trim() || !chatRef.current) return;
        
        setIsProcessing(true);
        const userMessageId = `msg-${Date.now()}`;
        setMessages(prev => [...prev, { id: userMessageId, role: MessageRole.USER, text: userText }]);
        
        try {
            const response = await chatRef.current.sendMessage({ message: userText });
            const assistantMessageId = `msg-${Date.now() + 1}`;
            
            const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
            const sources = groundingMetadata?.groundingChunks
                ?.map(chunk => chunk.web)
                .filter((web): web is { uri: string; title: string } => 
                    !!web?.uri && !!web.title && !web.uri.includes('vertexaisearch.cloud.google.com')
                );
            
            const cleanedText = cleanToolResponse(response.text);
            const responseText = cleanedText || "Es tut mir leid, ich konnte dazu keine passende Antwort finden. Könnten Sie die Frage umformulieren?";

            setMessages(prev => [...prev, { id: assistantMessageId, role: MessageRole.ASSISTANT, text: responseText, sources: sources || [] }]);
        } catch (error) {
            console.error("Error in chat:", error);
            setMessages(prev => [...prev, { id: `err-${Date.now()}`, role: MessageRole.ASSISTANT, text: "Entschuldigung, es ist ein Fehler aufgetreten." }]);
        } finally {
            setIsProcessing(false);
        }
    }, []);

    const handleFinishedRecording = useCallback(async (audioBlob: Blob) => {
        setIsListening(false);
        if (!process.env.API_KEY) return;
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        setIsProcessing(true);
        try {
            const base64Audio = await blobToBase64(audioBlob);
            const response = await ai.models.generateContent({
              model: "gemini-2.5-flash",
              contents: [{
                parts: [
                  {text: "Transcribe the following audio recording from German into German text."},
                  {inlineData: { mimeType: audioBlob.type, data: base64Audio }}
                ]
              }]
            });
            
            const userText = response.text.trim();
            if (userText) {
                await submitMessage(userText);
            } else {
                setIsProcessing(false);
            }
        } catch (error) {
            console.error("Error transcribing audio:", error);
            setIsProcessing(false);
        }
    }, [submitMessage]);

    const { startRecording, stopRecording } = useAudioRecorder(handleFinishedRecording);
    
    const handleMicToggle = () => {
        if (isListening) stopRecording();
        else {
            startRecording();
            setIsListening(true);
        }
    };

    const handleTextSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await submitMessage(inputText);
        setInputText('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleTextSubmit(e as any);
        }
    };
    
    const handleNewChat = () => {
        setMessages([{ id: 'init-1', role: MessageRole.ASSISTANT, text: "Die Analyse ist abgeschlossen. Stellen Sie mir gerne Folgefragen." }]);
        initializeChat();
    };

    return (
        <div className="bg-gray-900 backdrop-blur-md rounded-2xl shadow-lg flex flex-col h-full border border-gray-700/50">
            <div className="flex justify-between items-center p-4 border-b border-gray-700/80">
                <h3 className="text-lg font-semibold text-gray-300">Dialog</h3>
                <button onClick={handleNewChat} className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-gray-700 transition-colors" title="Neuer Chat">
                    <Icons.RotateCcw className="w-5 h-5" />
                </button>
            </div>
            <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-6 dark-styled-scrollbar">
                {messages.map((msg) => <ChatBubble key={msg.id} msg={msg} generatingAudioId={generatingAudioId} playingAudioId={playingAudioId} onPlayAudio={handlePlayAudio} />)}
                 {isProcessing && !isListening && (
                    <div className="flex justify-start animate-fade-in-up">
                        <div className="px-4 py-2 rounded-2xl max-w-sm bg-gray-700 text-gray-200">
                            <div className="flex items-center gap-2">
                                <Icons.Brain className="animate-spin-slow w-5 h-5"/>
                                <span className="text-sm">Denke nach...</span>
                            </div>
                        </div>
                    </div>
                 )}
            </div>
            <div className="border-t border-gray-700/80 p-2 bg-gray-900/80 rounded-b-2xl">
                 <form onSubmit={handleTextSubmit} className="flex items-end gap-2">
                    <button type="button" onClick={handleMicToggle} disabled={isProcessing} className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-colors duration-200 shrink-0 ${isListening ? 'bg-red-500' : 'bg-emerald-600 hover:bg-emerald-700'} disabled:bg-gray-600`} aria-label={isListening ? 'Aufnahme stoppen' : 'Aufnahme starten'}>
                       {isListening ? <div className="w-3 h-3 bg-white rounded-sm"></div> : <Icons.Mic className="w-5 h-5" />}
                    </button>
                    <textarea ref={textareaRef} value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={handleKeyDown} placeholder="Stellen Sie eine Frage..." rows={1} className="flex-1 bg-gray-800 text-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-200 max-h-32 styled-scrollbar" disabled={isProcessing || isListening}/>
                    <button type="submit" disabled={!inputText.trim() || isProcessing || isListening} className="w-10 h-10 rounded-full flex items-center justify-center text-white bg-emerald-600 hover:bg-emerald-700 transition-colors duration-200 shrink-0 disabled:bg-gray-600 disabled:cursor-not-allowed self-end" aria-label="Nachricht senden">
                        <Icons.Send className="w-5 h-5" />
                    </button>
                 </form>
            </div>
        </div>
    );
};

export default Chat;
