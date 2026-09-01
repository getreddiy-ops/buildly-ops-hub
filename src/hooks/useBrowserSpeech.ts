import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type SpeechRecognitionEventLike = Event & {
  results: ArrayLike<{
    0: { transcript: string };
    isFinal: boolean;
  }>;
};

type SpeechRecognitionErrorEventLike = Event & {
  error?: string;
  message?: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

export function useBrowserSpeech(onTranscript: (transcript: string) => void) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [listening, setListening] = useState(false);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  useEffect(() => () => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
  }, []);

  const start = useCallback(() => {
    if (typeof window === "undefined") return;

    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      toast.info("Voice input is not available in this browser", {
        description: "Type the request instead, or open FastTract in Chrome or Safari with microphone permission enabled.",
      });
      return;
    }

    recognitionRef.current?.abort();
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = navigator.language || "en-US";

    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index]?.[0]?.transcript ?? "";
      }
      if (transcript.trim()) onTranscript(transcript.trim());
    };

    recognition.onerror = (event) => {
      setListening(false);
      const denied = event.error === "not-allowed" || event.error === "service-not-allowed";
      toast.error(denied ? "Microphone permission is required" : "Voice input stopped", {
        description: denied
          ? "Allow microphone access for the FastTract Custom Page, then try again."
          : event.message || "Type the request and continue.",
      });
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };

    recognitionRef.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch (error) {
      recognitionRef.current = null;
      setListening(false);
      toast.error(error instanceof Error ? error.message : "Voice input could not start");
    }
  }, [onTranscript]);

  return { listening, start, stop };
}
