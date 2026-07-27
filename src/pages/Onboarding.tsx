import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Check, ChevronDown, ChevronRight, Loader2, Mic, MicOff,
  Pause, Play, RotateCcw, Send, ShieldCheck, Sparkles, Volume2, VolumeX,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

type AnswerMap = Record<string, string>;
type AssistantState = "idle" | "listening" | "thinking" | "speaking" | "muted";
type BrandScan = {
  companyName: string;
  website: string;
  primaryColor: string;
  secondaryColor: string;
  logo: { data: string; contentType: string; sourceUrl: string } | null;
};
type Question = {
  id: string;
  prompt: (answers: AnswerMap) => string;
  placeholder?: string;
  optional?: boolean;
  choices?: string[];
  sensitiveNote?: string;
};

const QUESTIONS: Question[] = [
  { id: "businessName", prompt: () => "What is your business name?", placeholder: "Your company name" },
  { id: "industry", prompt: ({ businessName }) => `What industry is ${businessName || "your business"} in?`, placeholder: "For example, roofing, landscaping, or accounting" },
  { id: "phone", prompt: () => "What is the best business phone number?", placeholder: "(555) 555-0123" },
  { id: "website", prompt: () => "What is your website address?", placeholder: "yourcompany.com", optional: true },
  { id: "userName", prompt: () => "Last question—what should I call you?", placeholder: "Your preferred name" },
];

const INTRO = "Hi, I’m Ava, your FastTract AI assistant. I only need five quick answers to create your business workspace and finish setting up your login. If you share a website, I’ll also pull in your brand and prepare ideas for improving it. Ready?";

const emptyBrand: BrandScan = {
  companyName: "", website: "", primaryColor: "#ff5a2a", secondaryColor: "#241812", logo: null,
};

function base64ToBlob(data: string, contentType: string) {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}

function Onboarding() {
  const navigate = useNavigate();
  const { user, memberships, loading, refresh, setActiveOrgId, signOut, isPlatformAdmin, isAgent } = useAuth();
  const isPreview = import.meta.env.DEV && window.location.pathname === "/onboarding-preview";
  const draftKey = `fasttract-ava-onboarding-${user?.id || "preview"}`;
  const [started, setStarted] = useState(false);
  const [consentMic, setConsentMic] = useState(false);
  const [consentMemory, setConsentMemory] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [input, setInput] = useState("");
  const [assistantState, setAssistantState] = useState<AssistantState>("idle");
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [brand, setBrand] = useState<BrandScan>(emptyBrand);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const recognitionRef = useRef<any>(null);
  const speechFallbackRef = useRef<number | null>(null);
  const speechRunRef = useRef(0);
  const speechAudioRef = useRef<HTMLAudioElement | null>(null);

  const current = QUESTIONS[step];
  const prompt = reviewing
    ? `Thanks, ${answers.userName || "there"}. I have everything I need to create the FastTract login and workspace for ${answers.businessName || "your business"}. Does this look right?`
    : current?.prompt(answers) || "";
  const progress = Math.round(((reviewing ? QUESTIONS.length : step + 1) / QUESTIONS.length) * 100);

  useEffect(() => {
    if (isPreview) return;
    if (loading) return;
    if (!user) return void navigate("/login", { replace: true });
    if (memberships.length > 0) return void navigate("/app", { replace: true });
    if (isPlatformAdmin) navigate("/admin", { replace: true });
    else if (isAgent) navigate("/agent", { replace: true });
  }, [user, loading, memberships, isPlatformAdmin, isAgent, navigate, isPreview]);

  useEffect(() => {
    const saved = localStorage.getItem(draftKey);
    if (!saved) return;
    try {
      const draft = JSON.parse(saved);
      if (draft.version !== 3) {
        localStorage.removeItem(draftKey);
        return;
      }
      setAnswers(draft.answers || {});
      setStep(Math.min(draft.step || 0, QUESTIONS.length - 1));
      setStarted(Boolean(draft.started));
      setConsentMemory(Boolean(draft.consentMemory));
      setBrand(draft.brand || emptyBrand);
    } catch { localStorage.removeItem(draftKey); }
  }, [draftKey]);

  useEffect(() => {
    if (!started || !consentMemory) return;
    localStorage.setItem(draftKey, JSON.stringify({ version: 3, answers, step, started, consentMemory, brand }));
  }, [answers, step, started, consentMemory, brand, draftKey]);

  useEffect(() => {
    if (started) window.scrollTo({ top: 0, behavior: "auto" });
  }, [started]);

  const stopSpeaking = () => {
    speechRunRef.current += 1;
    speechAudioRef.current?.pause();
    speechAudioRef.current = null;
    if (speechFallbackRef.current) window.clearTimeout(speechFallbackRef.current);
    speechFallbackRef.current = null;
    window.speechSynthesis?.cancel();
  };

  const speak = async (text: string) => {
    if (muted) return setAssistantState("idle");
    stopSpeaking();
    const run = ++speechRunRef.current;
    setAssistantState("speaking");
    const finishSpeaking = () => {
      if (speechRunRef.current !== run) return;
      if (speechFallbackRef.current) window.clearTimeout(speechFallbackRef.current);
      speechFallbackRef.current = null;
      setAssistantState("idle");
    };
    speechFallbackRef.current = window.setTimeout(finishSpeaking, Math.min(16000, Math.max(3500, text.length * 68)));

    const speakWithComputerVoice = async () => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.92;
      utterance.pitch = 1.04;
      utterance.volume = 0.92;
      if (speechRunRef.current !== run) return;
      utterance.onend = finishSpeaking;
      utterance.onerror = finishSpeaking;
      window.speechSynthesis.speak(utterance);
    };

    try {
      const { data, error } = await supabase.functions.invoke("voice-speak", { body: { text } });
      if (error || !data?.audio) throw error || new Error(data?.error || "No audio returned");
      if (speechRunRef.current !== run) return;
      const audio = new Audio(`data:${data.mime || "audio/mpeg"};base64,${data.audio}`);
      speechAudioRef.current = audio;
      audio.onended = finishSpeaking;
      audio.onerror = () => void speakWithComputerVoice();
      await audio.play();
    } catch {
      if (speechRunRef.current === run) void speakWithComputerVoice();
    }
  };

  useEffect(() => () => {
    stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!started || paused) return;
    const timer = window.setTimeout(() => void speak(prompt), 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, reviewing, started, paused]);

  const scanBrand = async (website: string) => {
    const normalized = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    const { data, error } = await supabase.functions.invoke<BrandScan>("crawl-brand", { body: { website: normalized } });
    if (!error && data) {
      setBrand(data);
      if (!answers.businessName && data.companyName) setAnswers((old) => ({ ...old, businessName: data.companyName }));
      toast({ title: "I found your brand", description: "I’ll use the approved logo and colors in your workspace." });
    }
  };

  const submitAnswer = async (value = input) => {
    const clean = value.trim();
    if (!clean && !current?.optional) return;
    setAssistantState("thinking");
    const nextAnswers = { ...answers, [current.id]: clean || "Skipped" };
    setAnswers(nextAnswers);
    setInput("");
    if (current.id === "website" && clean) void scanBrand(clean);
    window.setTimeout(() => {
      setAssistantState("idle");
      if (step === QUESTIONS.length - 1) setReviewing(true);
      else setStep((value) => value + 1);
    }, 420);
  };

  const startListening = () => {
    if (!consentMic) return;
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) {
      toast({ title: "Voice input is not supported here", description: "You can continue by typing." });
      return;
    }
    stopSpeaking();
    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onstart = () => setAssistantState("listening");
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results).map((result: any) => result[0].transcript).join("");
      setInput(transcript);
    };
    recognition.onend = () => setAssistantState("idle");
    recognition.onerror = () => setAssistantState("idle");
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => recognitionRef.current?.stop();

  const createWorkspace = async () => {
    if (isPreview) {
      toast({ title: "Preview complete", description: "Your personalized four-part workspace is ready." });
      return navigate("/app");
    }
    if (!user) return;
    setSaving(true);
    const businessProfile = {
      onboarding_version: 3,
      assistant: { name: "Ava", labeled_as_ai: true, memory_consent: consentMemory },
      business: { industry: answers.industry },
      website_review: {
        source_website: answers.website === "Skipped" ? null : (brand.website || answers.website),
        brand_crawled: Boolean(brand.website),
        refresh_recommendation_requested: answers.website !== "Skipped",
        status: answers.website === "Skipped" ? "waiting_for_website" : "ready_to_review",
      },
      setup: { intro_complete: true, login_ready: true, question_count: 5 },
      workspace: ["Home", "Work", "Money", "Business"],
    };
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email,
      full_name: answers.userName,
      phone: answers.phone,
      updated_at: new Date().toISOString(),
    });
    if (profileError) {
      setSaving(false);
      return toast({ title: "I couldn’t finish your login profile", description: profileError.message, variant: "destructive" });
    }
    const { data: org, error } = await supabase.from("organizations").insert({
      name: answers.businessName,
      owner_id: user.id,
      website: answers.website === "Skipped" ? null : (brand.website || answers.website),
      phone: answers.phone,
      brand_color: brand.primaryColor,
      brand_color_secondary: brand.secondaryColor,
      business_profile: businessProfile,
    }).select().single();
    if (error || !org) {
      setSaving(false);
      return toast({ title: "I couldn’t create the workspace", description: error?.message, variant: "destructive" });
    }
    const { error: memberError } = await supabase.from("organization_members").insert({
      organization_id: org.id, user_id: user.id, role: "owner",
    });
    if (memberError) {
      setSaving(false);
      return toast({ title: "I couldn’t finish owner access", description: memberError.message, variant: "destructive" });
    }
    if (consentMemory) {
      const website = answers.website === "Skipped" ? "No website provided" : (brand.website || answers.website);
      const knowledgeEntries = [
        { knowledge_key: "business.name", content: answers.businessName },
        { knowledge_key: "business.industry", content: answers.industry },
        { knowledge_key: "business.phone", content: answers.phone },
        { knowledge_key: "business.website", content: website },
        { knowledge_key: "owner.preferred_name", content: answers.userName },
      ].map((entry) => ({
        ...entry,
        organization_id: org.id,
        user_id: user.id,
        source: "onboarding_v3",
        approved: true,
        metadata: {
          captured_at: new Date().toISOString(),
          consent: "conversational_memory",
          onboarding_version: 3,
        },
      }));
      const { error: knowledgeError } = await supabase
        .from("ai_knowledge_entries")
        .upsert(knowledgeEntries, { onConflict: "organization_id,source,knowledge_key" });
      if (knowledgeError) {
        setSaving(false);
        return toast({
          title: "Your workspace was created, but Ava’s memory needs attention",
          description: knowledgeError.message,
          variant: "destructive",
        });
      }
    }
    if (brand.logo) {
      const extension = brand.logo.contentType.includes("svg") ? "svg" : brand.logo.contentType.includes("webp") ? "webp" : brand.logo.contentType.includes("jpeg") ? "jpg" : "png";
      const path = `${org.id}/logo-onboarding.${extension}`;
      const { error: uploadError } = await supabase.storage.from("branding").upload(
        path, base64ToBlob(brand.logo.data, brand.logo.contentType),
        { contentType: brand.logo.contentType, upsert: true },
      );
      if (!uploadError) await supabase.from("organizations").update({ logo_url: path }).eq("id", org.id);
    }
    localStorage.removeItem(draftKey);
    setActiveOrgId(org.id);
    await refresh();
    setSaving(false);
    toast({
      title: `Welcome, ${answers.userName}`,
      description: answers.website === "Skipped"
        ? `${org.name} is ready. Add a website anytime for a free brand review.`
        : `${org.name} is ready. Ava is preparing website improvement ideas.`,
    });
    navigate("/app?welcome=ava&websiteReview=ready", { replace: true });
  };

  const statusLabel = useMemo(() => ({
    idle: "Ready", listening: "Listening", thinking: "Thinking", speaking: "Speaking", muted: "Muted",
  }[assistantState]), [assistantState]);

  if (!started) {
    return (
      <main className="relative min-h-[100dvh] overflow-hidden bg-[radial-gradient(circle_at_50%_15%,rgba(249,115,22,.16),transparent_36%),#100b08] text-white">
        <div className="relative mx-auto flex min-h-[100dvh] max-w-2xl items-center px-4 py-12">
          <section className="w-full rounded-[28px] border border-white/15 bg-[#17100c]/90 p-6 text-center shadow-2xl backdrop-blur-xl md:p-10">
            <div className="mx-auto mb-6 grid h-24 w-24 place-items-center rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-400 shadow-[0_0_70px_rgba(249,115,22,.18)]">
              <div className="flex h-10 items-center gap-1">
                {[12, 22, 32, 18, 28, 14].map((height, index) => (
                  <span key={index} className="ava-wave w-1 rounded-full bg-orange-500" style={{ height, animationDelay: `${index * 90}ms` }} />
                ))}
              </div>
            </div>
            <div className="mb-3 flex items-center justify-between md:mb-5">
              <span className="inline-flex items-center gap-2 rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-1.5 text-xs font-semibold text-orange-100">
                <Sparkles className="h-3.5 w-3.5" /> AVA · FASTTRACT AI
              </span>
              {!isPreview && <button className="text-xs text-white/65 hover:text-white" onClick={signOut}>Sign out</button>}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-5xl">Let’s set up your business through a conversation.</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/75 md:mt-4 md:text-base">Hi, I’m Ava. Five quick questions and your FastTract workspace is ready. If you have a website, I’ll use it to match your brand and suggest improvements.</p>
            <div className="mt-4 space-y-3 rounded-2xl bg-white/[0.06] p-3.5 md:mt-6 md:p-4">
              <label className="flex cursor-pointer items-start gap-3 text-sm text-white/85">
                <input type="checkbox" checked={consentMic} onChange={(e) => setConsentMic(e.target.checked)} className="mt-0.5 h-5 w-5 accent-orange-500" />
                <span><strong className="block text-white">Allow microphone when I tap it</strong>It never turns on by itself. Camera is not required.</span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 text-sm text-white/85">
                <input type="checkbox" checked={consentMemory} onChange={(e) => setConsentMemory(e.target.checked)} className="mt-0.5 h-5 w-5 accent-orange-500" />
                <span><strong className="block text-white">Remember my approved answers</strong>Securely save them to your company’s private AI memory so Ava can personalize future help. You can clear them later.</span>
              </label>
            </div>
            <Button size="lg" className="mt-4 h-13 w-full rounded-2xl bg-orange-500 text-base font-semibold text-[#100b08] hover:bg-orange-400 md:mt-5 md:h-14" onClick={() => { setStarted(true); void speak(INTRO); }}>
              Yes, let’s begin <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
            <button className="mt-4 w-full text-center text-sm text-white/60 hover:text-white" onClick={() => { setStarted(true); setMuted(true); }}>Continue with text only</button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#100b08] text-white">
      <div className="absolute inset-x-0 top-0 z-30 h-1 bg-white/10"><div className="h-full bg-orange-500 transition-all duration-500" style={{ width: `${progress}%` }} /></div>
      <header className="absolute inset-x-0 top-1 z-30 flex items-center justify-between px-4 py-4 md:px-8">
        <div>
          <p className="text-sm font-semibold">FastTract</p>
          <p className="text-[11px] text-white/55">{progress}% personalized</p>
        </div>
        <div className="flex items-center gap-1">
          <button aria-label={paused ? "Resume" : "Pause and finish later"} className="grid h-11 w-11 place-items-center rounded-full bg-black/30 hover:bg-black/50" onClick={() => setPaused(!paused)}>
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <button aria-label={muted ? "Unmute Ava" : "Mute Ava"} className="grid h-11 w-11 place-items-center rounded-full bg-black/30 hover:bg-black/50" onClick={() => { setMuted(!muted); stopSpeaking(); }}>
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button aria-label="Minimize Ava" className="grid h-11 w-11 place-items-center rounded-full bg-black/30 hover:bg-black/50" onClick={() => setMinimized(!minimized)}>
            <ChevronDown className={`h-4 w-4 transition-transform ${minimized ? "rotate-180" : ""}`} />
          </button>
        </div>
      </header>

      <div className="relative mx-auto flex min-h-[100dvh] max-w-3xl">
        <section className="relative z-10 flex min-h-[100dvh] w-full flex-col justify-center px-5 pb-6 pt-24 md:px-12 md:py-24">
          {!minimized && (
            <div className="mx-auto mb-8 w-full max-w-xl text-center">
              <div className={`mx-auto grid h-24 w-24 place-items-center rounded-full border transition-all ${
                assistantState === "listening"
                  ? "border-emerald-400/50 bg-emerald-400/10 shadow-[0_0_70px_rgba(52,211,153,.18)]"
                  : "border-orange-500/40 bg-orange-500/10 shadow-[0_0_70px_rgba(249,115,22,.18)]"
              }`}>
                {assistantState === "listening" ? (
                  <Mic className="h-8 w-8 text-emerald-300" />
                ) : (
                  <div className="flex h-10 items-center gap-1">
                    {[12, 22, 32, 18, 28, 14].map((height, index) => (
                      <span
                        key={index}
                        className={`w-1 rounded-full bg-orange-500 ${assistantState === "speaking" ? "ava-wave" : ""}`}
                        style={{ height, animationDelay: `${index * 90}ms` }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
                <span className={`h-2.5 w-2.5 rounded-full ${assistantState === "listening" ? "animate-pulse bg-emerald-400" : assistantState === "speaking" ? "animate-pulse bg-orange-500" : "bg-white/50"}`} />
                <span className="text-sm font-semibold">Ava <span className="font-normal text-white/45">· FastTract AI</span></span>
                <span className="text-xs uppercase tracking-[.16em] text-white/45">{statusLabel}</span>
              </div>
            </div>
          )}
          {paused ? (
            <div className="mx-auto w-full max-w-xl rounded-3xl border border-white/10 bg-white/[0.05] p-7 text-center">
              <Pause className="mx-auto h-9 w-9 text-orange-500" />
              <h2 className="mt-4 text-2xl font-semibold">We’ll pick up right here.</h2>
              <p className="mt-2 text-white/65">{consentMemory ? "Your approved answers are saved on this device." : "Turn on memory if you want your progress saved after you leave."}</p>
              <Button className="mt-6 h-12 rounded-xl bg-orange-500 text-[#100b08] hover:bg-orange-400" onClick={() => setPaused(false)}><Play className="mr-2 h-4 w-4" />Resume conversation</Button>
            </div>
          ) : reviewing ? (
            <div className="mx-auto w-full max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[.2em] text-orange-500">Five answers · your approval</p>
              <h2 className="mt-3 text-2xl font-semibold leading-tight md:text-4xl">{prompt}</h2>
              <div className="mt-6 grid gap-2 rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-sm">
                {[["Business", answers.businessName], ["Industry", answers.industry], ["Phone", answers.phone], ["Website", answers.website], ["Your name", answers.userName]].map(([label, value]) => (
                  <div key={label} className="flex gap-4 border-b border-white/[0.07] py-2 last:border-0"><span className="w-20 shrink-0 text-white/45">{label}</span><span>{value || "Not provided"}</span></div>
                ))}
              </div>
              <div className="mt-3 rounded-2xl border border-orange-500/20 bg-orange-500/[0.07] p-4 text-sm text-orange-50/80">
                <strong className="block text-orange-200">{brand.website ? "Website brand found" : answers.website === "Skipped" ? "Website can wait" : "Website review queued"}</strong>
                {answers.website === "Skipped"
                  ? "Your SaaS login and workspace will be ready now. Add a website later and Ava can review it."
                  : "I’ll use the site’s logo and colors, then suggest a cleaner, higher-converting version after you enter the workspace."}
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/65">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-orange-300" />
                <span>
                  {consentMemory
                    ? "After you approve, these five answers will be saved to this company’s private AI memory so Ava can use them in future conversations."
                    : "AI memory is off. Your workspace will still be created, but Ava will not save these answers as conversational memory."}
                </span>
              </div>
              <div className="mt-5 flex gap-3">
                <Button
                  variant="outline"
                  className="h-13 flex-1 border-white/15 bg-transparent text-white hover:bg-white/10"
                  onClick={() => {
                    setReviewing(false);
                    setStep(0);
                    setInput(answers.businessName || "");
                  }}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />Correct an answer
                </Button>
                <Button className="h-13 flex-[1.35] bg-orange-500 font-semibold text-[#100b08] hover:bg-orange-400" onClick={createWorkspace} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}{saving ? "Creating your login…" : "Create my workspace"}
                </Button>
              </div>
              <p className="mt-4 flex items-center justify-center gap-2 text-xs text-white/45"><ShieldCheck className="h-3.5 w-3.5" />Nothing important is sent, filed, paid, or changed without your approval.</p>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-xl">
              {current.sensitiveNote && <div className="mb-4 flex gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-4 text-sm text-amber-50/80"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />{current.sensitiveNote}</div>}
              <p className="text-xs font-semibold uppercase tracking-[.2em] text-orange-500">Ava is asking</p>
              <h1 className="mt-3 text-2xl font-semibold leading-tight md:text-4xl">{prompt}</h1>
              <p aria-live="polite" className="mt-3 min-h-5 text-sm text-white/55">{assistantState === "listening" ? `“${input || "I’m listening…"}”` : assistantState === "thinking" ? "Got it — I’m organizing that now." : "Answer naturally. You can change anything before it’s saved."}</p>

              {current.choices ? (
                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  {current.choices.map((choice) => <button key={choice} onClick={() => submitAnswer(choice)} className="min-h-12 rounded-xl border border-white/12 bg-white/[0.05] px-4 py-3 text-left text-sm font-medium transition hover:border-orange-500/60 hover:bg-orange-500/10 focus:outline-none focus:ring-2 focus:ring-orange-500">{choice}</button>)}
                </div>
              ) : (
                <form className="mt-6 flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] p-2 focus-within:border-orange-500/60" onSubmit={(e) => { e.preventDefault(); submitAnswer(); }}>
                  <Input
                    autoFocus
                    type={current.id === "phone" ? "tel" : "text"}
                    inputMode={current.id === "website" ? "url" : undefined}
                    autoComplete={current.id === "phone" ? "tel" : current.id === "website" ? "url" : current.id === "userName" ? "name" : "organization"}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={current.placeholder}
                    className="h-12 flex-1 border-0 bg-transparent text-base text-white placeholder:text-white/35 focus-visible:ring-0"
                  />
                  <Button type="submit" aria-label="Send answer" size="icon" className="h-12 w-12 rounded-xl bg-orange-500 text-[#100b08] hover:bg-orange-400" disabled={!input.trim() && !current.optional}><Send className="h-5 w-5" /></Button>
                </form>
              )}

              <div className="mt-5 flex items-center justify-center gap-4">
                <button disabled={!consentMic} onClick={assistantState === "listening" ? stopListening : startListening} className={`grid h-16 w-16 place-items-center rounded-full shadow-xl transition disabled:cursor-not-allowed disabled:opacity-35 ${assistantState === "listening" ? "bg-red-400 text-white ring-8 ring-red-400/15" : "bg-orange-500 text-[#100b08] hover:scale-105"}`} aria-label={assistantState === "listening" ? "Stop listening" : "Answer by voice"}>
                  {assistantState === "listening" ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </button>
                <p className="max-w-32 text-xs text-white/45">{consentMic ? "Tap to answer by voice" : "Microphone is off. Type to continue."}</p>
              </div>

              <footer className="mt-5 flex items-center justify-between border-t border-white/[0.07] pt-4 text-sm">
                <button disabled={step === 0} onClick={() => { setStep((value) => Math.max(0, value - 1)); setInput(answers[QUESTIONS[Math.max(0, step - 1)].id] || ""); }} className="flex min-h-11 items-center gap-2 text-white/55 hover:text-white disabled:opacity-25"><ArrowLeft className="h-4 w-4" />Back</button>
                {current.optional && <button onClick={() => submitAnswer("")} className="min-h-11 px-3 text-white/55 hover:text-white">Skip for now</button>}
              </footer>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default Onboarding;
