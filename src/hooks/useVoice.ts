import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Mic recording → STT via voice-transcribe edge function. */
export function useVoiceRecorder(onTranscript: (text: string) => void) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      // Pick a supported mime; fall back to default.
      const mime =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : MediaRecorder.isTypeSupported("audio/mp4")
              ? "audio/mp4"
              : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setRecording(false);
        const type = rec.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        if (blob.size < 1500) {
          toast.error("Recording too short");
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
          if (!text) toast.error("Couldn't hear anything");
          else onTranscript(text);
        } catch (e: any) {
          toast.error(e?.message ?? "Transcription failed");
        } finally {
          setTranscribing(false);
        }
      };
      rec.start();
      setRecording(true);
    } catch (e: any) {
      toast.error(e?.name === "NotAllowedError" ? "Microphone access denied" : "Could not access microphone");
    }
  }, [onTranscript]);

  return { recording, transcribing, start, stop };
}

/** Text → speech via voice-speak edge function, played in an Audio element. */
export function useVoiceSpeaker() {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeakingId(null);
  }, []);

  const speak = useCallback(async (id: string, text: string) => {
    stop();
    setLoadingId(id);
    try {
      const { data, error } = await supabase.functions.invoke("voice-speak", { body: { text } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const audio = new Audio(`data:${data.mime || "audio/mpeg"};base64,${data.audio}`);
      audioRef.current = audio;
      audio.onended = () => setSpeakingId((cur) => (cur === id ? null : cur));
      audio.onerror = () => setSpeakingId((cur) => (cur === id ? null : cur));
      setSpeakingId(id);
      await audio.play();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not play voice");
    } finally {
      setLoadingId((cur) => (cur === id ? null : cur));
    }
  }, [stop]);

  return { speak, stop, speakingId, loadingId };
}
