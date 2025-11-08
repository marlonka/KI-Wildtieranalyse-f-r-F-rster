export enum AppState {
    UPLOAD = 'UPLOAD',
    PROCESSING = 'PROCESSING',
    ANALYSIS = 'ANALYSIS',
}

export interface UploadedImage {
    id: number;
    file: File;
    previewUrl: string;
    fileNameApi?: string; // e.g. 'files/abcdef123'
    fileUri?: string;     // e.g. 'https://generativelanguage.googleapis.com/...'
}

export interface AnalysisReport {
    markdownContent: string;
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    modelUsed?: 'gemini-2.5-flash' | 'gemini-2.5-pro';
}

export enum MessageRole {
    USER = 'user',
    ASSISTANT = 'assistant'
}

export interface ChatMessage {
    id: string;
    role: MessageRole;
    text: string;
    sources?: {
        uri: string;
        title: string;
    }[];
}
