import React from 'react';
import { Icons } from './Icons';

const ApiKeySelector: React.FC<{ onKeySelected: () => void }> = ({ onKeySelected }) => {
    const handleSelectKey = async () => {
        if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
            try {
                await window.aistudio.openSelectKey();
                onKeySelected();
            } catch (e) {
                console.error("Error opening key selector:", e);
            }
        } else {
            alert("API key selection is not available in this environment.");
        }
    };

    return (
        <div className="h-full w-full flex items-center justify-center bg-gray-100 p-4">
            <div className="bg-white/80 backdrop-blur-sm p-8 sm:p-10 rounded-3xl shadow-lg animate-fade-in-up border border-gray-200 text-center max-w-lg">
                <Icons.GlobeLock className="w-14 h-14 text-emerald-700 mx-auto" />
                <h2 className="text-2xl sm:text-3xl font-bold text-emerald-800 mt-4">API-Schlüssel erforderlich</h2>
                <p className="text-gray-600 mt-4 text-sm sm:text-base">
                    Für den Datei-Upload und die Analyse ist ein API-Schlüssel mit aktivierter Abrechnung erforderlich. Bitte wählen Sie einen Schlüssel aus, um fortzufahren. Die Nutzung der Files API kann Kosten verursachen.
                </p>
                <button
                    onClick={handleSelectKey}
                    className="mt-8 w-full bg-emerald-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-emerald-700 transition-all duration-300 transform hover:scale-102 active:scale-98"
                >
                    API-Schlüssel auswählen
                </button>
                <p className="text-xs text-gray-500 mt-4">
                    Weitere Informationen zur Abrechnung finden Sie in der <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline hover:text-emerald-800">offiziellen Dokumentation</a>.
                </p>
            </div>
        </div>
    );
};

export default ApiKeySelector;
