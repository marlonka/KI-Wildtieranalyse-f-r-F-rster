import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AppState, UploadedImage, AnalysisReport } from './types';
import { analyzeImages } from './services/geminiService';
import { createGeminiClient } from './config/api';
import { Icons } from './components/Icons';
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
    const progressIntervalRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        }
    }, []);

    const handleFilesSelected = useCallback(async (selectedFiles: FileList) => {
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
        let aiClient: any;
    
        try {
            aiClient = createGeminiClient();

            setProgressText("Lade Bilder hoch...");
            
            let completedUploads = 0;
            const uploadPromises = initialImages.map(async (img) => {
                const uploadedFile = await aiClient.files.upload({
                    file: img.file,
                    config: { mimeType: img.file.type, displayName: img.file.name },
                });
                
                let file = uploadedFile;
                while (file.state === 'PROCESSING') {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    file = await aiClient.files.get({ name: file.name });
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
    
            const report = await analyzeImages(aiClient, uploadedImagesWithUris, true);
            
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            setProgress(1);
            setAnalysisReport(report);
            setAppState(AppState.ANALYSIS);
    
        } catch (e) {
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            const message = e instanceof Error ? e.message : "Unbekannter Fehler";
            setError(`Vorgang fehlgeschlagen: ${message}`);
            setAppState(AppState.UPLOAD);
            setProgress(0);
        } finally {
            if (aiClient && uploadedImagesWithUris.length > 0) {
                console.log("Cleaning up uploaded files in background...");
                Promise.all(uploadedImagesWithUris.map(img => {
                    if (img.fileNameApi) {
                        return aiClient.files.delete({ name: img.fileNameApi });
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
                    <button onClick={() => setError(null)} className="absolute top-1 right-2 text-white font-bold">&times;</button>
                    {error}
                </div>
            )}
            {renderContent()}
        </div>
    );
};

export default App;
