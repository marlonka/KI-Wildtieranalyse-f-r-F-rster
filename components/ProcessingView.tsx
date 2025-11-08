import React from 'react';
import { Icons } from './Icons';
import { UploadedImage } from '../types';

interface ProcessingViewProps {
    images: UploadedImage[];
    progress: number;
    progressText: string;
}

const ProcessingView: React.FC<ProcessingViewProps> = ({ images, progress, progressText }) => {
    return (
        <div className="flex flex-col items-center justify-center h-full p-4 sm:p-8 bg-transparent">
            <div className="animate-fade-in-up text-center">
                <Icons.Brain className="w-14 h-14 sm:w-16 sm:h-16 text-emerald-600 mx-auto animate-pulse" />
                <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mt-6 shimmer-text">{progressText}</h2>
                <p className="text-gray-500 mt-2 text-sm sm:text-base">Gemini zählt, identifiziert und beobachtet die Tiere. Dies kann einen Moment dauern.</p>
                
                <div className="w-full max-w-md mx-auto bg-gray-200 rounded-full h-2.5 mt-8 overflow-hidden">
                    <div className="bg-emerald-600 h-2.5 rounded-full" style={{ width: `${progress * 100}%`, transition: 'width 0.5s ease-out' }}></div>
                </div>
                <p className="text-sm text-gray-500 mt-2">{Math.round(progress * 100)}% abgeschlossen</p>

                <div className="mt-8 grid grid-cols-8 gap-2 max-w-2xl mx-auto opacity-30 blur-sm max-h-36 overflow-hidden">
                    {images.map(img => (
                        <div key={img.id} className="relative aspect-square">
                            <img src={img.previewUrl} alt="Vorschau" className="w-full h-full object-cover rounded-lg" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ProcessingView;
