import { UploadedImage } from "../types";

const USD_TO_EUR_RATE = 0.86; // 1 USD = 0.86 EUR

const PRICING_DATA = {
    'gemini-2.5-flash': {
        input: 0.30, // per 1M tokens
        output: 2.50, // per 1M tokens
    },
    'gemini-2.5-pro': {
        lowTier: { // <= 200k prompt tokens
            input: 1.25,
            output: 10.00,
        },
        highTier: { // > 200k prompt tokens
            input: 2.50,
            output: 15.00,
        }
    }
};

export const calculateCost = (model: 'gemini-2.5-flash' | 'gemini-2.5-pro', promptTokens: number, candidatesTokens: number): number | null => {
    if (!model || promptTokens === undefined || candidatesTokens === undefined) return null;

    const M = 1_000_000;
    let costInUsd: number | null = null;
    
    if (model === 'gemini-2.5-flash') {
        const price = PRICING_DATA[model];
        costInUsd = (promptTokens / M) * price.input + (candidatesTokens / M) * price.output;
    } else if (model === 'gemini-2.5-pro') {
        const tier = promptTokens <= 200_000 ? 'lowTier' : 'highTier';
        const price = PRICING_DATA[model][tier];
        costInUsd = (promptTokens / M) * price.input + (candidatesTokens / M) * price.output;
    }
    
    if (costInUsd === null) return null;
    
    return costInUsd * USD_TO_EUR_RATE;
};

export const parseMarkdownForDisplay = (markdown: string): string => {
    const calculatorIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-emerald-700 shrink-0"><rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/></svg>`;
    const scanEyeIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-emerald-700 shrink-0 mt-1"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="1"/><path d="M18.944 12.33a1 1 0 0 0 0-.66 7.5 7.5 0 0 0-13.888 0 1 1 0 0 0 0 .66 7.5 7.5 0 0 0 13.888 0"/></svg>`;
    
    return markdown
        .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold mb-3 text-emerald-800">$1</h1>')
        .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-semibold mt-4 mb-2 text-emerald-700 border-b-2 border-emerald-200 pb-2">$1</h2>')
        .replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold mt-3 mb-2 text-emerald-800">$1</h3>')
        .replace(/^\s*(?:-)?\s*\**((?:Gesamtzahl der Tiere|Anzahl der Arten).*?)\**:\s*\**\s*(.*?)\s*\**$/gim, `<div class="flex items-center gap-3 text-base mt-4">${calculatorIconSVG}<div><strong class="font-semibold text-gray-700">$1:</strong> <span class="text-gray-600">$2</span></div></div>`)
        .replace(/^\s*-\s*\*\*(Anzahl):\*\*\s*\**\s*(.*?)\s*\**$/gim, `<div class="flex items-center gap-3 text-base mt-2">${calculatorIconSVG}<div><strong class="font-semibold text-gray-700">$1:</strong> <span class="text-gray-600">$2</span></div></div>`)
        .replace(/^\s*-\s*\*\*(Beobachtungen|Wichtigste Erkenntnisse):\*\*/gim, `<div class="flex items-start gap-3 text-base mt-4">${scanEyeIconSVG}<div><strong class="font-semibold text-gray-700">$1:</strong></div></div>`)
        .replace(/^\s*\*\s+(.*$)/gim, '<li class="list-disc ml-12 text-gray-600">$1</li>')
        .replace(/^\s*-\s+(?!.*\*\*Anzahl|.*\*\*Beobachtungen|.*\*\*Wichtigste)(.*$)/gim, '<p class="text-gray-600 mt-1 ml-9">$1</p>')
        .replace(/^\s*-\s+(?!.*\*\*Anzahl|.*\*\*Beobachtungen)(.*$)/gim, '<li class="list-disc ml-6 text-gray-600">$1</li>')
        .replace(/\(\*(.*?)\*\)/g, '(<em>$1</em>)')
        .replace(/\*\*\s*(.*?)\s*\*\*/g, '<strong class="font-semibold text-gray-700">$1</strong>')
        .replace(/\n/g, '<br />')
        .replace(/<br \/>(\s*<li|<div|<p)/g, '$1')
        .replace(/(<\/li>|<\/div>|<\/p>)<br \/>/g, '$1');
};

interface ParsedSection {
    id: string;
    htmlContent: string;
    images: UploadedImage[];
}

export const parseReportToSections = (markdown: string, allImages: UploadedImage[]): ParsedSection[] => {
    if (!markdown) return [];
    
    const sectionsRaw = markdown.split(/^(?=# |## |### )/m).filter(s => s.trim() !== '' && s.trim() !== '---');

    if (sectionsRaw.length > 0 && sectionsRaw[0].trim().startsWith('# Wildtieranalyse-Bericht')) {
        sectionsRaw.shift();
    }
    
    return sectionsRaw.map((sectionMd, index) => {
        const imageNumbers = new Set<number>();
        const matches = sectionMd.matchAll(/\(Bild\s*([\d,\s]+)\)/g);
        for (const match of matches) {
            const numbersStr = match[1];
            numbersStr.split(',').forEach(numStr => {
                const num = parseInt(numStr.trim(), 10);
                if (!isNaN(num)) imageNumbers.add(num);
            });
        }
        
        const sectionImages = Array.from(imageNumbers)
          .map(num => allImages[num - 1])
          .filter((img): img is UploadedImage => !!img);
        
        const cleanSectionMd = sectionMd.replace(/\s*\n?\(Bild\s*[\d,\s]+\)/g, '');
        const htmlContent = parseMarkdownForDisplay(cleanSectionMd);
        
        return { id: `section-${index}`, htmlContent, images: sectionImages };
    });
};

export const parseChatMarkdown = (text: string): string => {
    if (!text) return '';
    let html = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^\s*[\-\*]\s+(.*)$/gm, '<li>$1</li>');
    
    html = html.replace(/(<li>(?:.|\n)*?<\/li>)/g, (match) => {
        if (match.includes('<ul>')) return match;
        return `<ul>${match.replace(/<\/li>\n<li>/g, '</li><li>')}</ul>`;
    });
    html = html.replace(/<\/ul>\n<ul>/g, '');
    
    html = html.replace(/\n/g, '<br />');
    
    html = html.replace(/<br \/>\s*<ul>/g, '<ul>')
               .replace(/<\/ul>\s*<br \/>/g, '</ul>')
               .replace(/<\/li><br \/>/g, '</li>');

    return html;
};

export const cleanToolResponse = (text: string | undefined): string => {
    if (!text) return "";

    const answerStarters = [
        "Das ist eine wichtige Präzisierung.", "Exotische Arten", "Heimische Arten:",
        "Für die heimischen Arten gibt es", "Zusammenfassend lässt sich sagen",
    ];

    let bestStartIndex = -1;

    for (const starter of answerStarters) {
        const index = text.indexOf(starter);
        if (index !== -1 && (bestStartIndex === -1 || index < bestStartIndex)) {
            bestStartIndex = index;
        }
    }

    if (bestStartIndex !== -1) {
        return text.substring(bestStartIndex);
    }
    
    if (text.includes('tool_code') || text.includes('thought')) {
        return "Ich habe eine Websuche durchgeführt, konnte die Antwort aber nicht richtig formatieren. Bitte versuchen Sie, die Frage anders zu formulieren.";
    }

    return text;
};
