import React, { useState, useMemo } from 'react';
import { AnalysisReport, UploadedImage } from '../types';
import { calculateCost, parseReportToSections } from '../utils/reportUtils';
import Chat from './Chat';
import { Icons } from './Icons';

const ImageCarousel: React.FC<{ images: UploadedImage[], onImageClick: (image: UploadedImage) => void }> = ({ images, onImageClick }) => {
    if (images.length === 0) return null;
    return (
        <div className="flex gap-3 overflow-x-auto py-3 styled-scrollbar my-2 -mx-1 px-1">
            {images.map(img => (
                <div 
                    key={img.id}
                    onClick={() => onImageClick(img)}
                    className="relative w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 shrink-0 rounded-lg overflow-hidden cursor-pointer group border-2 border-transparent hover:border-emerald-600 transition-all duration-300 shadow-sm"
                >
                    <img 
                        src={img.previewUrl} 
                        alt="Analysiertes Bild"
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <Icons.ZoomIn className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                    </div>
                </div>
            ))}
        </div>
    );
};

const Lightbox: React.FC<{ image: UploadedImage, onClose: () => void }> = ({ image, onClose }) => {
    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = image.previewUrl;
        link.download = image.file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-lightbox-backdrop" onClick={onClose}>
            <div className="relative animate-lightbox-content w-full h-full max-w-screen-lg max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <img src={image.previewUrl} alt="Vollbild" className="w-full h-full object-contain" />
                <div className="absolute top-4 right-4 flex gap-4">
                    <button onClick={handleDownload} className="p-3 bg-gray-800/70 text-white rounded-full hover:bg-gray-700 transition-colors" aria-label="Download image">
                        <Icons.Download className="w-6 h-6" />
                    </button>
                    <button onClick={onClose} className="p-3 bg-gray-800/70 text-white rounded-full hover:bg-gray-700 transition-colors" aria-label="Close lightbox">
                        <Icons.CircleX className="w-6 h-6" />
                    </button>
                </div>
            </div>
        </div>
    );
};


const AnalysisView: React.FC<{ report: AnalysisReport, images: UploadedImage[], onReset: () => void }> = ({ report, images, onReset }) => {
    const [selectedImage, setSelectedImage] = useState<UploadedImage | null>(null);
    const [showCost, setShowCost] = useState<boolean>(false);
    const parsedReportSections = useMemo(() => parseReportToSections(report.markdownContent, images), [report.markdownContent, images]);

    const estimatedCost = useMemo(() => {
        if (!report.modelUsed || report.promptTokenCount === undefined || report.candidatesTokenCount === undefined) return null;
        return calculateCost(report.modelUsed, report.promptTokenCount, report.candidatesTokenCount);
    }, [report]);

    const totalTokens = (report.promptTokenCount || 0) + (report.candidatesTokenCount || 0);

    const handleDownloadReport = () => {
        const blob = new Blob([report.markdownContent], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'wildtieranalyse-bericht.md');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="h-screen flex flex-col bg-transparent">
             <header className="bg-white/90 backdrop-blur-sm sticky top-0 z-10 border-b border-gray-200 shadow-sm">
                <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <Icons.Microscope className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-700" />
                        <h1 className="text-xl sm:text-2xl font-bold text-emerald-800">Analysebericht</h1>
                        
                        <div className='hidden sm:flex items-center gap-2'>
                            {totalTokens > 0 && (
                                <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full border border-gray-200">
                                    <Icons.Hash className="w-3 h-3" />
                                    <span>{totalTokens.toLocaleString('de-DE')} Tokens</span>
                                </div>
                            )}
                             {estimatedCost !== null && (
                                <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full border border-gray-200" title={`Input: ${report.promptTokenCount?.toLocaleString('de-DE')} / Output: ${report.candidatesTokenCount?.toLocaleString('de-DE')}`}>
                                    <Icons.Wallet className="w-3 h-3" />
                                    <span>~ {estimatedCost.toFixed(4).replace('.', ',')} €</span>
                                </div>
                            )}
                        </div>
                        
                        {(totalTokens > 0 || estimatedCost !== null) && (
                            <div className='flex sm:hidden items-center'>
                                <button 
                                    onClick={() => setShowCost(!showCost)}
                                    className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full border border-gray-200 transition-all active:scale-95"
                                    title={showCost ? 'Kosten (Klicken für Tokens)' : 'Tokens (Klicken für Kosten)'}
                                >
                                    {showCost && estimatedCost !== null ? (
                                        <><Icons.Wallet className="w-3 h-3" /><span>~ {estimatedCost.toFixed(4).replace('.', ',')} €</span></>
                                    ) : (
                                        <><Icons.Hash className="w-3 h-3" /><span>{totalTokens.toLocaleString('de-DE')} Tokens</span></>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleDownloadReport} className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-200 transition-colors border border-gray-300 shadow-sm">
                            <Icons.Download className="w-5 h-5" />
                            <span className="hidden sm:inline">Bericht Herunterladen</span>
                        </button>
                        <button onClick={onReset} className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-200 transition-colors border border-gray-300 shadow-sm">
                            <Icons.Reset className="w-5 h-5" />
                            <span className="hidden sm:inline">Neue Analyse</span>
                        </button>
                    </div>
                </div>
            </header>
            <main className="container mx-auto p-4 sm:p-6 flex-1 grid grid-cols-1 lg:grid-cols-5 gap-8 overflow-y-auto styled-scrollbar">
                <div className="lg:col-span-3 bg-white p-4 sm:p-6 md:p-8 rounded-2xl shadow-lg border border-gray-200 overflow-y-auto styled-scrollbar">
                    {parsedReportSections.map(section => (
                        <section key={section.id} className="mb-2">
                            <div dangerouslySetInnerHTML={{ __html: section.htmlContent }} className="prose max-w-none"/>
                            <ImageCarousel images={section.images} onImageClick={setSelectedImage} />
                        </section>
                    ))}
                </div>
                <aside className="lg:col-span-2">
                    <div className="h-[75vh] lg:sticky lg:top-6 lg:h-[calc(100vh-120px)]">
                       <Chat reportMarkdown={report.markdownContent} />
                    </div>
                </aside>
            </main>
            {selectedImage && <Lightbox image={selectedImage} onClose={() => setSelectedImage(null)} />}
        </div>
    );
};

export default AnalysisView;
