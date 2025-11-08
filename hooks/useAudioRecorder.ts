import { useState, useRef, useCallback, useEffect } from 'react';

const VAD_SILENCE_TIMEOUT_MS = 2200;
const AMPLITUDE_UPDATE_INTERVAL_MS = 50;

export const useAudioRecorder = (onRecordingFinished: (blob: Blob, duration: number) => void) => {
    const [isRecording, setIsRecording] = useState(false);
    const [amplitude, setAmplitude] = useState(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const silenceTimerRef = useRef<number | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const amplitudeIntervalRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const recordingStartTimeRef = useRef<number>(0);

    const onRecordingFinishedRef = useRef(onRecordingFinished);
    useEffect(() => {
        onRecordingFinishedRef.current = onRecordingFinished;
    }, [onRecordingFinished]);

    const stopRecording = useCallback(() => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;
        
        mediaRecorderRef.current.stop();
        if (amplitudeIntervalRef.current) clearInterval(amplitudeIntervalRef.current);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        
        amplitudeIntervalRef.current = null;
        silenceTimerRef.current = null;
        setAmplitude(0);
    }, []);

    const updateAmplitude = useCallback(() => {
        if (analyserRef.current) {
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteTimeDomainData(dataArray);
            let sumSquares = 0.0;
            for (const amp of dataArray) {
                const normalized = (amp / 128.0) - 1.0;
                sumSquares += normalized * normalized;
            }
            const rms = Math.sqrt(sumSquares / dataArray.length);
            setAmplitude(rms);

            if (rms < 0.01) { 
                if (!silenceTimerRef.current) {
                    silenceTimerRef.current = window.setTimeout(() => {
                        stopRecording();
                    }, VAD_SILENCE_TIMEOUT_MS);
                }
            } else {
                if (silenceTimerRef.current) {
                    clearTimeout(silenceTimerRef.current);
                    silenceTimerRef.current = null;
                }
            }
        }
    }, [stopRecording]);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;
            source.connect(analyserRef.current);

            const options = { mimeType: 'audio/webm;codecs=opus' };
            mediaRecorderRef.current = new MediaRecorder(stream, options);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const duration = Date.now() - recordingStartTimeRef.current;
                const audioBlob = new Blob(audioChunksRef.current, { type: options.mimeType });
                
                onRecordingFinishedRef.current(audioBlob, duration);
                setIsRecording(false);
                stream.getTracks().forEach(track => track.stop());
                audioContextRef.current?.close();
            };
            
            mediaRecorderRef.current.start();
            recordingStartTimeRef.current = Date.now();
            setIsRecording(true);

            if (amplitudeIntervalRef.current) clearInterval(amplitudeIntervalRef.current);
            amplitudeIntervalRef.current = window.setInterval(updateAmplitude, AMPLITUDE_UPDATE_INTERVAL_MS);

        } catch (err) {
            console.error("Error accessing microphone:", err);
            setIsRecording(false);
        }
    }, [updateAmplitude]);


    return { isRecording, amplitude, startRecording, stopRecording };
};
