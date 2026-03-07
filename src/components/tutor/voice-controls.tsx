"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX, Mic, MicOff, Square, Loader2 } from "lucide-react";

interface VoiceControlsProps {
  messageContent: string;
  onTranscript: (text: string) => void;
  onSendTranscript: (text: string) => void;
  disabled?: boolean;
}

// Extend Window for SpeechRecognition types
interface SpeechRecognitionEvent extends Event {
  results: { [index: number]: { [index: number]: { transcript: string } }; length: number };
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

export function VoiceControls({
  messageContent,
  onTranscript,
  onSendTranscript,
  disabled,
}: VoiceControlsProps) {
  // TTS state
  const [ttsLoading, setTtsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // STT state
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptRef = useRef("");

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, []);

  // --- TTS: Read Aloud ---
  const handleReadAloud = useCallback(async () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
      audioRef.current = null;
      setIsPlaying(false);
      return;
    }

    if (!messageContent.trim()) return;

    setTtsLoading(true);
    try {
      const res = await fetch("/api/tutor/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: messageContent }),
      });

      if (!res.ok) {
        console.error("TTS request failed:", res.status);
        setTtsLoading(false);
        return;
      }

      if (!res.body) {
        console.error("TTS returned no body");
        setTtsLoading(false);
        return;
      }

      // Collect chunks and start playback as soon as we have data
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let firstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        if (value) {
          chunks.push(value);
          // Start playback after first chunk arrives
          if (firstChunk) {
            firstChunk = false;
            setTtsLoading(false);
            setIsPlaying(true);
          }
        }
        if (done) break;
      }

      const blob = new Blob(chunks as BlobPart[], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };

      audio.onerror = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };

      await audio.play();
    } catch (err) {
      console.error("TTS playback error:", err);
      setIsPlaying(false);
      setTtsLoading(false);
    }
  }, [messageContent, isPlaying]);

  // --- STT: Voice Input ---
  const startListening = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in your browser. Try Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    transcriptRef.current = "";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result[0]) {
          // Check if result is final (has isFinal property)
          const isFinal = (result as unknown as { isFinal: boolean }).isFinal;
          if (isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }
      }

      if (finalTranscript) {
        transcriptRef.current += finalTranscript;
      }

      const display = transcriptRef.current + interimTranscript;
      onTranscript(display);

      // Reset silence timer on new speech
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      // Auto-stop after 3s of silence and send
      silenceTimerRef.current = setTimeout(() => {
        if (transcriptRef.current.trim()) {
          recognition.stop();
        }
      }, 3000);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== "aborted") {
        console.error("Speech recognition error:", event.error);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      // Auto-send the transcript
      const final = transcriptRef.current.trim();
      if (final) {
        onSendTranscript(final);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [onTranscript, onSendTranscript]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const hasSpeechRecognition =
    typeof window !== "undefined" &&
    (!!window.SpeechRecognition || !!window.webkitSpeechRecognition);

  return (
    <div className="flex items-center gap-1">
      {/* Read Aloud Button */}
      {messageContent && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleReadAloud}
          disabled={ttsLoading}
          title={isPlaying ? "Stop reading" : "Read aloud"}
        >
          {ttsLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isPlaying ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </Button>
      )}

      {/* Voice Input Button */}
      {hasSpeechRecognition && (
        <Button
          variant={isListening ? "destructive" : "ghost"}
          size="icon"
          className="h-8 w-8"
          onClick={isListening ? stopListening : startListening}
          disabled={disabled}
          title={isListening ? "Stop listening" : "Voice input"}
        >
          {isListening ? (
            <Square className="h-3.5 w-3.5" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  );
}

// Standalone mic button for the input area
export function MicButton({
  onTranscript,
  onSendTranscript,
  disabled,
}: {
  onTranscript: (text: string) => void;
  onSendTranscript: (text: string) => void;
  disabled?: boolean;
}) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptRef = useRef("");

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, []);

  const toggle = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in your browser. Try Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    transcriptRef.current = "";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result[0]) {
          const isFinal = (result as unknown as { isFinal: boolean }).isFinal;
          if (isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }
      }

      if (finalTranscript) {
        transcriptRef.current += finalTranscript;
      }

      onTranscript(transcriptRef.current + interimTranscript);

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        if (transcriptRef.current.trim()) recognition.stop();
      }, 3000);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== "aborted") {
        console.error("Speech recognition error:", event.error);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      const final = transcriptRef.current.trim();
      if (final) onSendTranscript(final);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, onTranscript, onSendTranscript]);

  if (
    typeof window !== "undefined" &&
    !window.SpeechRecognition &&
    !window.webkitSpeechRecognition
  ) {
    return null;
  }

  return (
    <Button
      variant={isListening ? "destructive" : "outline"}
      size="icon"
      className="h-[60px] w-[60px] shrink-0"
      onClick={toggle}
      disabled={disabled && !isListening}
      title={isListening ? "Stop listening (auto-sends)" : "Voice input"}
    >
      {isListening ? (
        <div className="relative">
          <MicOff className="h-4 w-4" />
          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
        </div>
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
}
