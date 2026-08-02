import { useEffect, useRef, useState } from "react";
import { Bot, HardHat, ShieldCheck } from "lucide-react";

const HERO_VIDEO_SRC =
  "https://d8j0ntlcm91z4.cloudfront.net/user_3H7X2kAni8FzyATc3QST6eU05zb/hf_20260802_084203_23e911ae-8f08-4406-b7f8-a9908497e308.mp4";

function Waveform({ active }: { active: boolean }) {
  const bars = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  return (
    <div className="flex h-4 items-center gap-[3px]" aria-hidden="true">
      {bars.map((b) => (
        <span
          key={b}
          className={`w-[3px] rounded-full bg-primary ${active ? "ft-wave-bar" : ""}`}
          style={{ height: "100%", animationDelay: `${b * 90}ms`, opacity: active ? 1 : 0.35 }}
        />
      ))}
    </div>
  );
}

/**
 * Premium 16:9 hero frame with the FastTract demo video and crisp HTML overlay UI.
 * The overlay is a visual demonstration of an assisted workflow — the contractor
 * always reviews and approves before anything is sent.
 */
export function HeroVideo() {
  const [step, setStep] = useState(0); // 0 idle, 1 contractor, 2 listening, 3 ava, 4 review
  const [videoOk, setVideoOk] = useState(true);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setStep(4);
      return;
    }
    const run = () => {
      const seq = [
        [400, 1],
        [1500, 2],
        [3000, 3],
        [4200, 4],
        [9000, 0],
      ] as const;
      seq.forEach(([ms, s]) => {
        timers.current.push(window.setTimeout(() => setStep(s), ms));
      });
    };
    run();
    const loop = window.setInterval(run, 10000);
    timers.current.push(loop);
    return () => {
      timers.current.forEach((t) => {
        window.clearTimeout(t);
        window.clearInterval(t);
      });
      timers.current = [];
    };
  }, []);

  return (
    <figure className="relative m-0">
      <div className="relative aspect-video overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-secondary via-card to-background shadow-2xl">
        {videoOk && (
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src={HERO_VIDEO_SRC}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
            tabIndex={-1}
            onError={() => setVideoOk(false)}
          />
        )}
        {/* Legibility + brand gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/45 to-background/20" />

        {/* Overlay UI (HTML, not baked into the video) */}
        <div className="absolute inset-0 flex flex-col justify-between p-3 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-2.5 py-1 text-[10px] font-medium text-muted-foreground backdrop-blur sm:text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              FastTract live workflow
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-2.5 py-1 text-[10px] text-muted-foreground backdrop-blur sm:text-xs">
              <Waveform active={step === 1 || step === 2} />
              <span>{step === 1 || step === 2 ? "Ava listening" : "Ava ready"}</span>
            </div>
          </div>

          <div className="space-y-2 sm:space-y-3">
            <div
              className={`max-w-[85%] rounded-2xl rounded-bl-sm border border-border/70 bg-card/85 px-3 py-2 text-xs backdrop-blur transition-all duration-500 sm:text-sm ${
                step >= 1 ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
              }`}
            >
              <div className="mb-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                <HardHat className="h-3 w-3" /> Contractor
              </div>
              <span className="font-medium text-foreground">“Price a 20 × 40 driveway.”</span>
            </div>

            <div
              className={`ml-auto max-w-[85%] rounded-2xl rounded-br-sm border border-primary/40 bg-primary/15 px-3 py-2 text-xs backdrop-blur transition-all duration-500 sm:text-sm ${
                step >= 3 ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
              }`}
            >
              <div className="mb-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-primary">
                <Bot className="h-3 w-3" /> Ava
              </div>
              <span className="font-medium text-foreground">
                “Draft estimate ready — $10,432.”
              </span>
            </div>

            <div
              className={`flex items-center gap-2 rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-[11px] backdrop-blur transition-all duration-500 sm:text-xs ${
                step >= 4 ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
              }`}
            >
              <ShieldCheck className="h-4 w-4 flex-shrink-0 text-success" />
              <span className="text-foreground">
                Waiting on your review — you approve before anything is sent.
              </span>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="sr-only">
        Demonstration of FastTract: a contractor asks the AI assistant to price a 20 by 40 foot
        driveway, and a draft estimate of $10,432 is prepared for the contractor to review and
        approve. Nothing is sent to a customer without contractor approval.
      </figcaption>
    </figure>
  );
}
