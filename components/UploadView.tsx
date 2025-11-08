import React, { useState, useRef } from 'react';
import { Icons } from './Icons';

interface UploadViewProps {
    onFilesSelected: (files: FileList) => void;
}

const UploadView: React.FC<UploadViewProps> = ({ onFilesSelected }) => {
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") setIsDragging(true);
        else if (e.type === "dragleave") setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files?.length) onFilesSelected(e.dataTransfer.files);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) onFilesSelected(e.target.files);
    };

    return (
        <div className="flex flex-col items-center justify-center h-full p-4 sm:p-8 bg-transparent">
            <div className="bg-white/80 backdrop-blur-sm p-6 sm:p-10 rounded-3xl shadow-lg animate-fade-in-up border border-gray-200">
                <div className="flex items-center justify-center gap-3 sm:gap-4 mb-4">
                  <Icons.Microscope className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-700" />
                  <h1 className="text-3xl sm:text-4xl font-bold text-emerald-800">Tierwildanalyse</h1>
                </div>
                <p className="text-gray-600 mb-8 max-w-md text-center text-sm sm:text-base">Laden Sie Bilder aus Ihrem Wald hoch, um eine KI-gestützte Analyse der Tierpopulation zu erhalten.</p>
                <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrop}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                    className={`border-4 ${isDragging ? 'border-emerald-600 bg-emerald-50' : 'border-dashed border-gray-400 bg-gray-50'} rounded-2xl p-8 sm:p-12 cursor-pointer transition-all duration-300 transform hover:scale-102 hover:shadow-md`}
                >
                    <input ref={inputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleChange} />
                    <div className="flex flex-col items-center justify-center space-y-4 text-gray-500">
                        <Icons.ImageUp className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400" />
                        <p className="font-semibold text-gray-600 text-center">Bilder hierher ziehen & ablegen</p>
                        <p className="text-sm text-center">oder klicken, um den Explorer zu öffnen</p>
                        <p className="text-xs text-gray-400 pt-2">Maximal 3.000 Bilder pro Analyse</p>
                    </div>
                </div>
                <div className="flex flex-col items-center mt-8 space-y-3">
                    <p className="text-xs text-gray-500 max-w-xs text-center">
                        Nutzt standardmäßig Gemini 2.5 Pro für präziseste Analyseergebnisse.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default UploadView;
