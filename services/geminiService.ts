import { GoogleGenAI, Modality } from "@google/genai";
import { UploadedImage, AnalysisReport } from '../types';

export async function analyzeImages(ai: GoogleGenAI, images: UploadedImage[], isProMode: boolean): Promise<AnalysisReport> {
    const systemInstruction = `Du bist ein erfahrener Wildbiologe und Datenanalyst für deutsche Wälder. Deine Aufgabe ist es, eine Reihe von Bildern zu analysieren, die von einem Förster zur Verfügung gestellt wurden, und einen detaillierten, strukturierten Bericht auf Deutsch im Markdown-Format zu erstellen.

Basierend auf den bereitgestellten Bildern, führe folgende Aktionen durch:
1.  **Identifiziere alle Tierarten.**
2.  **Zähle die Anzahl der Individuen für jede Art.**
3.  **Gruppiere deine Ergebnisse nach Arten.**
4.  **Gib für jede Art spezifische Beobachtungen an:** Notiere Gruppengrößen, das Vorhandensein von Jungtieren, den körperlichen Zustand und alle bemerkenswerten Verhaltensweisen.
5.  **Erstelle einen Abschnitt "Besondere Beobachtungen":** Hebe alles Ungewöhnliche hervor, wie seltene Arten, Anzeichen von Krankheit oder Verletzung oder Interaktionen zwischen verschiedenen Arten.
6.  **Erstelle einen Abschnitt "Sonstiges":** Fasse hier alle Bilder zusammen, die keine Wildtiere zeigen (z.B. Menschen, Fahrzeuge, leere Landschaften) und beschreibe, was zu sehen ist.
7.  **Erstelle einen abschließenden Abschnitt "Gesamtzusammenfassung":** Gib die Gesamtzahl der identifizierten Tiere (exklusive Menschen) und Arten (exklusive Menschen) an und füge eine kurze Zusammenfassung hinzu.
8.  **WICHTIG:** Referenziere die Bilder, die deine Beobachtungen stützen, indem du ihre Nummer in Klammern angibst, z.B. (Bild 1), (Bild 5). Die Bilder sind 1-basiert nummeriert in der Reihenfolge, in der sie bereitgestellt wurden. Füge die Referenzen direkt in den Text der Beobachtungen ein.

**Ausgabeformat (Striktes Markdown):**

# Wildtieranalyse-Bericht

## Gesamtzusammenfassung
- **Gesamtzahl der Tiere (exklusive Mensch):** [Gesamtzahl]
- **Anzahl der Arten (exklusive Mensch):** [Anzahl der Arten]
- **Wichtigste Erkenntnisse:**
  - [Fasse die wichtigsten Erkenntnisse für einen Förster zusammen. Konzentriere dich auf Populationsdynamiken (z.B. hohe Anzahl an Jungtieren bei einer Art), Verhaltensmuster (z.B. Interaktionen zwischen Arten), und unerwartete Sichtungen (z.B. exotische oder seltene Tiere). Vermeide generische Aussagen über die Bildersammlung selbst.]

## Analyse nach Arten

### [Art 1, z.B. Rothirsch]
- **Anzahl:** [Anzahl für Art 1]
- **Beobachtungen:**
  * [Detaillierte Beobachtung 1 (Bild X)].
  * [Detaillierte Beobachtung 2 (Bild Y, Bild Z)].

### [Art 2, z.B. Wildschwein]
- **Anzahl:** [Anzahl für Art 2]
- **Beobachtungen:**
  * [Detaillierte Beobachtung 1 (Bild A)].

... weitere Arten ...

## Besondere Beobachtungen
- [Liste hier alle besonderen oder ungewöhnlichen Feststellungen mit Bildreferenzen (Bild B) auf.]

## Sonstiges
- [Liste hier Beobachtungen zu Nicht-Wildtieren mit Bildreferenzen (Bild C) auf.]`;

    const imageParts = images.map(image => ({
        fileData: {
            mimeType: image.file.type,
            fileUri: image.fileUri!
        }
    }));

    const promptParts = [
        { text: "Analysiere die folgenden Bilder von Wildtieren und erstelle einen Bericht gemäß den Anweisungen. Die Bilder sind nummeriert von 1 bis " + images.length + "." },
        ...imageParts
    ];

    const modelName = isProMode ? "gemini-2.5-pro" : "gemini-2.5-flash";
    const thinkingBudget = isProMode ? 32768 : 24576;

    try {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ parts: promptParts }],
            config: {
                systemInstruction: systemInstruction,
                thinkingConfig: { thinkingBudget: thinkingBudget }
            }
        });
        
        const rawMarkdown = response.text;
        if (!rawMarkdown) {
            throw new Error("API returned an empty response.");
        }
        
        let markdownContent = rawMarkdown.replace(/\s*\*\((Ende des Berichts)\)\*/g, '').trim();

        const reportStartIndex = markdownContent.indexOf('# Wildtieranalyse-Bericht');
        if (reportStartIndex > 0) {
            markdownContent = markdownContent.substring(reportStartIndex);
        }
        
        const { promptTokenCount, candidatesTokenCount } = response.usageMetadata || {};
        
        return { 
            markdownContent, 
            promptTokenCount,
            candidatesTokenCount,
            modelUsed: modelName,
        };

    } catch (error) {
        console.error("Error during image analysis:", error);
        throw error;
    }
}


export async function generateSpeech(ai: GoogleGenAI, text: string): Promise<string> {
    const voiceName = 'Charon'; // German voice

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{
                parts: [{ text: `Say in a clear, friendly, and conversational tone: ${text}` }]
            }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceName },
                    },
                },
            },
        });

        const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!data) {
            throw new Error("TTS API did not return audio data.");
        }
        return data;
    } catch(error) {
        console.error("Error during TTS generation:", error);
        throw error;
    }
}
