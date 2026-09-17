import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Mic recording → ElevenLabs STT through the voice-transcribe edge function. */
export function useVoiceRecorder(onTranscript: (text: string) => void) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  const start = useCallback(async () => {
    if (recording || transcribing) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Voice recording is not available on this device. You can keep typing.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      toast.error("This iOS/browser version does not support voice recording. You can keep typing.");
      return;
    }

    try {
      cleanupStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      chunksRef.current = [];

      const supported = (type: string) => {
        try { return MediaRecorder.isTypeSupported(type); } catch { return false; }
      };
      const mime = supported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : supported("audio/mp4")
          ? "audio/mp4"
          : supported("audio/webm")
            ? "audio/webm"
            : "";

      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorderRef.current = rec;

      rec.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      rec.onerror = () => {
        cleanupStream();
        recorderRef.current = null;
        setRecording(false);
        toast.error("Voice recording stopped unexpectedly. Your typed answer is still safe.");
      };

      rec.onstop = async () => {
        cleanupStream();
        recorderRef.current = null;
        setRecording(false);

        const type = rec.mimeType || mime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        if (blob.size < 1500) {
          toast.error("Recording was too short. Hold the mic a little longer or type your answer.");
          return;
        }

        const ext = type.includes("mp4") ? "mp4" : type.includes("webm") ? "webm" : "wav";
        const form = new FormData();
        form.append("file", blob, `recording.${ext}`);
        setTranscribing(true);

        try {
          const { data, error } = await supabase.functions.invoke("voice-transcribe", { body: form });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          const text = (data?.text ?? "").trim();
          if (!text) toast.error("I couldn't hear that clearly. Try again or type your answer.");
          else onTranscript(text);
        } catch (error: any) {
          toast.error(error?.message ?? "Voice transcription failed. You can keep typing.");
        } finally {
          setTranscribing(false);
        }
      };

      // Timeslices make Safari/WKWebView return chunks more reliably for short recordings.
      rec.start(250);
      setRecording(true);
    } catch (error: any) {
      cleanupStream();
      recorderRef.current = null;
      setRecording(false);
      toast.error(
        error?.name === "NotAllowedError"
          ? "Microphone access is off. Enable it in iPhone Settings or keep typing."
          : "Could not start the microphone. You can keep typing.",
      );
    }
  }, [cleanupStream, onTranscript, recording, transcribing]);

  return { recording, transcribing, start, stop };
}

/** Text → ElevenLabs speech through the voice-speak edge function. */
export function useVoiceSpeaker() {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeakingId(null);
    setLoadingId(null);
  }, []);

  const speak = useCallback(async (id: string, text: string) => {
    stop();
    if (!text.trim()) return;
    setLoadingId(id);
    try {
      const { data, error } = await supabase.functions.invoke("voice-speak", { body: { text } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.audio) throw new Error("No voice audio returned");

      const audio = new Audio(`data:${data.mime || "audio/mpeg"};base64,${data.audio}`);
      audioRef.current = audio;
      audio.onended = () => {
        if (audioRef.current === audio) audioRef.current = null;
        setSpeakingId((cur) => (cur === id ? null : cur));
      };
      audio.onerror = () => {
        if (audioRef.current === audio) audioRef.current = null;
        setSpeakingId((cur) => (cur === id ? null : cur));
      };
      setSpeakingId(id);
      await audio.play();
    } catch (error: any) {
      // Voice should never block the workflow. The text is always visible.
      toast.error(error?.message ?? "Ava's voice is unavailable right now. Continue with text.");
    } finally {
      setLoadingId((cur) => (cur === id ? null : cur));
    }
  }, [stop]);

  return { speak, stop, speakingId, loadingId };
}
