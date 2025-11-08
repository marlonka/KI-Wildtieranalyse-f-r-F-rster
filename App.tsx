import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { AppState, UploadedImage, AnalysisReport } from './types';
import { analyzeImages } from './services/geminiService';
import ApiKeySelector from './components/ApiKeySelector';
import UploadView from './components/UploadView';
import ProcessingView from './components/ProcessingView';
import AnalysisView from './components/AnalysisView';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

const App: React.FC = () => {
    const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
    const [images, setImages] = useState<UploadedImage[]>([]);
    const [analysisReport, setAnalysisReport] = useState<AnalysisReport | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('Analysiere Bilder...');
    const [hasApiKey, setHasApiKey] = useState(false);
    const progressIntervalRef = useRef<number | null>(null);

    useEffect(() => {
        const checkApiKey = async () => {
            if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
                try {
                    const keySelected = await window.aistudio.hasSelectedApiKey();
                    setHasApiKey(keySelected);
                } catch (e) {
                    console.error("Error checking API key status:", e);
                    setHasApiKey(!!process.env.API_KEY);
                }
            } else {
                setHasApiKey(!!process.env.API_KEY);
            }
        };
        checkApiKey();
        
        return () => {
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        }
    }, []);

    const handleKeySelected = () => {
        setHasApiKey(true);
    };

    const handleFilesSelected = useCallback(async (selectedFiles: FileList) => {
        if (!process.env.API_KEY) {
            setError("API-Schlüssel nicht konfiguriert. Bitte wählen Sie einen Schlüssel aus.");
            setHasApiKey(false);
            return;
        }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        setError(null);
        setProgress(0);
        setAppState(AppState.PROCESSING);
    
        const files = Array.from(selectedFiles).slice(0, 3000);
    
        const initialImages: UploadedImage[] = files
            .filter(file => file.type.startsWith('image/'))
            .map((file, index) => ({
                id: Date.now() + index,
                file,
                previewUrl: URL.createObjectURL(file),
            }));
        setImages(initialImages);
    
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    
        let uploadedImagesWithUris: UploadedImage[] = [];
    
        try {
            setProgressText("Lade Bilder hoch...");
            
            let completedUploads = 0;
            const uploadPromises = initialImages.map(async (img) => {
                const uploadedFile = await ai.files.upload({
                    file: img.file,
                    config: { mimeType: img.file.type, displayName: img.file.name },
                });
                
                let file = uploadedFile;
                while (file.state === 'PROCESSING') {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    file = await ai.files.get({ name: file.name });
                }
    
                if (file.state !== 'ACTIVE') {
                    throw new Error(`Datei ${img.file.name} konnte nicht verarbeitet werden. Status: ${file.state}`);
                }
    
                completedUploads++;
                setProgress((completedUploads / initialImages.length) * 0.5);
    
                return { ...img, fileNameApi: file.name, fileUri: file.uri };
            });
    
            uploadedImagesWithUris = await Promise.all(uploadPromises);
            setImages(uploadedImagesWithUris);
            
            setProgressText("Analysiere Bilder...");
            
            const duration = 60000;
            const tickRate = 100;
            const increment = (0.5 / (duration / tickRate));
            
            progressIntervalRef.current = window.setInterval(() => {
                setProgress(prev => {
                    const newProgress = prev + increment;
                    if (newProgress >= 0.99) {
                        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
                        return 0.99;
                    }
                    return newProgress;
                });
            }, tickRate);
    
            const report = await analyzeImages(ai, uploadedImagesWithUris, true);
            
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            setProgress(1);
            setAnalysisReport(report);
            setAppState(AppState.ANALYSIS);
    
        } catch (e) {
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            const message = e instanceof Error ? e.message : "Unbekannter Fehler";

            if (message.includes('API key not valid') || message.includes('not found') || message.includes('Failed to get upload url') || message.includes('API key expired') || message.includes('Requested entity was not found')) {
                setError(`API-Schlüsselproblem: Der bereitgestellte Schlüssel ist möglicherweise abgelaufen oder ungültig. Bitte wählen Sie einen anderen Schlüssel aus.`);
                setHasApiKey(false); 
                setAppState(AppState.UPLOAD);
                setProgress(0);
                return;
            }

            setError(`Vorgang fehlgeschlagen: ${message}`);
            setAppState(AppState.UPLOAD);
            setProgress(0);
        } finally {
            if (uploadedImagesWithUris.length > 0) {
                console.log("Cleaning up uploaded files in background...");
                Promise.all(uploadedImagesWithUris.map(img => {
                    if (img.fileNameApi) {
                        return ai.files.delete({ name: img.fileNameApi });
                    }
                    return Promise.resolve();
                })).then(() => {
                    console.log("File cleanup complete.");
                }).catch(err => {
                    console.error("File cleanup failed:", err);
                });
            }
        }
    }, []);
    
    const handleReset = () => {
        images.forEach(img => URL.revokeObjectURL(img.previewUrl));
        setImages([]);
        setAnalysisReport(null);
        setError(null);
        setProgress(0);
        setAppState(AppState.UPLOAD);
    };
    
    if (!hasApiKey) {
        return <ApiKeySelector onKeySelected={handleKeySelected} />;
    }

    const renderContent = () => {
        switch (appState) {
            case AppState.PROCESSING:
                return <ProcessingView images={images} progress={progress} progressText={progressText} />;
            case AppState.ANALYSIS:
                return analysisReport ? <AnalysisView report={analysisReport} images={images} onReset={handleReset} /> : <UploadView onFilesSelected={handleFilesSelected} />;
            case AppState.UPLOAD:
            default:
                return <UploadView onFilesSelected={handleFilesSelected} />;
        }
    };

    return (
        <div className="h-full font-sans">
            {error && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in-up" role="alert">
                    <button onClick={() => setError(null)} className="absolute top-1 right-2 text-white">&times;</button>
                    {error}
                </div>
            )}
            {renderContent()}
        </div>
    );
};

export default App;
