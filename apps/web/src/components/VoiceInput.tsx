"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, X, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface VoiceInputProps {
    onTranscript: (text: string) => void;
    onLiveTranscript?: (text: string) => void;
    isAuthenticated: boolean;
    isPaidUser: boolean;
    onUpgradeClick: () => void;
    onAuthRequired?: () => void;
    disabled?: boolean;
    className?: string;
    onRecordingStateChange?: (isRecording: boolean, isProcessing: boolean, audioLevel: number, frequencyData?: number[]) => void;
}

export function VoiceInput({
    onTranscript,
    onLiveTranscript,
    isAuthenticated,
    isPaidUser,
    onUpgradeClick,
    onAuthRequired,
    disabled,
    className,
    onRecordingStateChange,
}: VoiceInputProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0);
    const [frequencyData, setFrequencyData] = useState<number[]>(new Array(40).fill(0));

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const shouldTranscribeRef = useRef<boolean>(true);

    // Notify parent of state changes
    useEffect(() => {
        onRecordingStateChange?.(isRecording, isProcessing, audioLevel, frequencyData);
    }, [isRecording, isProcessing, audioLevel, frequencyData, onRecordingStateChange]);

    const startRecording = async () => {
        // Check authentication first
        if (!isAuthenticated) {
            if (onAuthRequired) {
                onAuthRequired();
            } else {
                toast.error('Sign in to use voice input');
            }
            return;
        }

        // Then check if user is paid
        if (!isPaidUser) {
            toast.error('Voice input is only available for paid users');
            onUpgradeClick();
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            audioChunksRef.current = [];
            shouldTranscribeRef.current = true; // Reset flag when starting new recording

            // Setup Audio Context for visualization
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
            analyser.fftSize = 256;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            audioContextRef.current = audioContext;
            analyserRef.current = analyser;
            sourceRef.current = source;

            // Animation loop for audio level (waveform visualization)
            const updateAudioLevel = () => {
                if (!analyser) return;
                analyser.getByteFrequencyData(dataArray);
                
                // Calculate average for overall level
                const average = dataArray.reduce((a, b) => a + b) / bufferLength;
                setAudioLevel(Math.min(100, Math.max(0, (average / 128) * 100)));
                
                // Sample frequency data for waveform bars (40 bars)
                const barCount = 40;
                const sampledData: number[] = [];
                const step = Math.floor(bufferLength / barCount);
                
                for (let i = 0; i < barCount; i++) {
                    const index = i * step;
                    // Normalize to 0-100 range
                    sampledData.push((dataArray[index] / 255) * 100);
                }
                
                setFrequencyData(sampledData);
                animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
            };
            updateAudioLevel();

            // Setup MediaRecorder for audio capture
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm',
            });

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                // Only transcribe if we have audio chunks AND the flag is set (not cancelled)
                if (shouldTranscribeRef.current && audioChunksRef.current.length > 0) {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    await transcribeAudio(audioBlob);
                }
            };

            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.start();
            setIsRecording(true);

        } catch (error) {
            console.error("Error accessing microphone:", error);
            toast.error("Could not access microphone. Please check permissions.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        setIsProcessing(true);
        cleanup();
    };

    const cancelRecording = () => {
        // Set flag to prevent transcription
        shouldTranscribeRef.current = false;
        
        // Clear audio chunks
        audioChunksRef.current = [];
        
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        cleanup();
    };

    const transcribeAudio = async (audioBlob: Blob) => {
        try {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');

            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (response.status === 401) {
                // User is not authenticated - show auth modal
                if (onAuthRequired) {
                    onAuthRequired();
                } else {
                    toast.error('Please sign in to use voice input');
                }
                return;
            }

            if (response.status === 402) {
                // User is not a paid user - show upgrade modal
                toast.error('Voice input is only available for paid users');
                onUpgradeClick();
                return;
            }

            if (data.success && data.text) {
                onTranscript(data.text);
            } else {
                toast.error(data.error || 'Transcription failed');
            }
        } catch (error) {
            console.error('Transcription error:', error);
            toast.error('Failed to transcribe audio');
        } finally {
            setIsProcessing(false);
        }
    };

    const cleanup = () => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        setAudioLevel(0);
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanup();
        };
    }, []);

    // Processing state - Show loader
    if (isProcessing) {
        return (
            <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled
                className={cn(
                    "rounded-full hover:bg-muted text-muted-foreground relative transition-colors",
                    className
                )}
                title="Transcribing..."
            >
                <Loader2 className="w-5 h-5 animate-spin" />
            </Button>
        );
    }

    // Recording state - Show cancel and accept buttons
    if (isRecording) {
        return (
            <div className="flex items-center gap-2">
                {/* Cancel button */}
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={cancelRecording}
                    className={cn(
                        "rounded-full hover:bg-muted text-foreground transition-colors",
                        className
                    )}
                    title="Cancel recording"
                >
                    <X className="w-5 h-5" />
                </Button>

                {/* Accept button */}
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={stopRecording}
                    className={cn(
                        "rounded-full hover:bg-muted text-foreground transition-colors",
                        className
                    )}
                    title="Accept recording"
                >
                    <Check className="w-5 h-5" />
                </Button>
            </div>
        );
    }

    // Idle state - ChatGPT style microphone button
    const getTitle = () => {
        if (!isAuthenticated) {
            return "Sign in to use voice input";
        }
        if (!isPaidUser) {
            return "Voice input is a premium feature. Click to upgrade.";
        }
        return "Click to start voice recording";
    };

    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={startRecording}
            disabled={disabled}
            className={cn(
                "rounded-full hover:bg-muted text-muted-foreground hover:text-foreground relative transition-colors",
                className
            )}
            title={getTitle()}
        >
            <Mic className="w-5 h-5" />
        </Button>
    );
}
