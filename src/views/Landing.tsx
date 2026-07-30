/**
 * The dark surface.
 *
 * One idea: the letter is the light source. The page is nearly black and the
 * only warmth in it leaks out from behind a document. As the model downloads,
 * that light grows, so the page literally brightens as the thing becomes real.
 *
 * The download is the hero rather than a wait. Every other product hides a 2 GB
 * transfer behind a spinner and apologises for it. Here it is the argument: this
 * is the size of a language model moving onto your machine, and when the number
 * reaches 100 you can turn your wifi off.
 *
 * No WebGL and no scroll library. A render loop and a 2 GB model both want this
 * GPU, and on 8 GB of unified memory that contention is how a tab dies mid
 * demo. Reveals are IntersectionObserver plus CSS, and all of it is inert under
 * prefers-reduced-motion.
 */
import { useEffect, useRef } from 'react';

interface Props {
  /** 0 to 1. Drives the light. */
  progress: number;
  downloading: boolean;
  cached: boolean;
  webGpu: boolean;
  /**
   * The adapter can hold the 2 GB model. False on iPhones, which report
   * WebGPU and then jetsam the tab; they must never be offered the download.
   */
  modelFits: boolean;
  onStart: () => void;
  onPickFile: () => void;
  onSkip: () => void;
}

export function Landing({
  progress,
  downloading,
  cached,
  webGpu,
  modelFits,
  onStart,
  onPickFile,
  onSkip,
}: Props) {
  const revealRoot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nodes = revealRoot.current?.querySelectorAll('.reveal');
    if (!nodes?.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.shown = 'true';
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.25 },
    );

    for (const node of nodes) io.observe(node);
    return () => io.disconnect();
  }, []);

  // The light tracks the download, then settles once the model is on the device.
  // The ceiling is low on purpose: this is atmosphere, and atmosphere is never
  // allowed to cost text contrast on a tool built for low-vision readers.
  const lit = cached ? 1 : progress;
  const glowScale = 0.75 + lit * 0.35;
  const glowOpacity = 0.35 + lit * 0.5;

  return (
    <div
      ref={revealRoot}
      className="on-ink grain relative min-h-dvh bg-ink text-white"
    >
      <div
        aria-hidden
        className="glow pointer-events-none fixed inset-0 transition-[opacity,transform] duration-1000 ease-out"
        style={{ opacity: glowOpacity, transform: `scale(${glowScale})` }}
      />
      {/* Sits above the glow, below the text. */}
      <div aria-hidden className="scrim pointer-events-none fixed inset-0" />

      {/* Pill chrome, floating in the corners, nothing docked. */}
      <header className="fixed inset-x-0 top-0 z-40 flex items-start justify-between p-4 sm:p-6">
        <span className="rounded-full border border-white/20 bg-black/30 px-4 py-2 text-[0.9375rem] font-semibold tracking-tight backdrop-blur">
          Renova
        </span>
        <span className="rounded-full border border-white/20 bg-black/30 px-4 py-2 text-[0.875rem] backdrop-blur">
          {cached ? 'On this device' : webGpu && modelFits ? 'Runs in this browser' : 'Reader mode'}
        </span>
      </header>

      <main className="relative z-10">
        {/* One */}
        {/* Top padding clears the fixed pill chrome. */}
        <section className="flex min-h-dvh flex-col justify-center px-5 pt-28 pb-16 sm:px-10">
          <p className="rise text-[1rem] uppercase tracking-[0.22em] text-white/55">
            Medicaid renewal, read on your device
          </p>
          <h1 className="display rise mt-5 max-w-[16ch]" style={{ animationDelay: '80ms' }}>
            Seven in ten kept their eligibility.
            <span className="text-glow"> They lost the envelope.</span>
          </h1>
          <p
            className="rise mt-7 max-w-[52ch] text-[1.25rem] text-white/70"
            style={{ animationDelay: '160ms' }}
          >
            Photograph your renewal packet. Get the deadline, the case number, and exactly what to
            send, in plain English and Spanish. Nothing you photograph leaves this device.
          </p>

          <div className="rise mt-10" style={{ animationDelay: '240ms' }}>
            <ModelGate
              progress={progress}
              downloading={downloading}
              cached={cached}
              webGpu={webGpu}
              modelFits={modelFits}
              onStart={onStart}
              onPickFile={onPickFile}
              onSkip={onSkip}
            />
          </div>
        </section>

        {/* Two */}
        <Panel
          kicker="The problem"
          title="The deadline is not where you think."
          body="California prints it on the form. New York, Georgia, and Texas put it on a separate notice. Pennsylvania puts it on the envelope. Photograph only the form in New York and you are holding paperwork with no visible date at all."
        />

        {/* Three */}
        <Panel
          kicker="The design"
          title="A wrong date is worse than no date."
          body="The deadline, the case number, and the document list are read by a rules engine, never generated. Gemma 4 writes the explanation and the Spanish, and is not allowed to overwrite them. When the two disagree you see both. When the date cannot be read, we say so and give you your state's number instead of guessing."
        />

        {/* Four */}
        <Panel
          kicker="Most people are never told"
          title="Miss it, and you still have 90 days."
          body="Federal rule 42 CFR 435.916 gives you 90 days to send the form and get coverage back without reapplying. In most states it is backdated to the day it stopped. Every answer this tool gives ends with that sentence."
          accent
        />

        <footer className="px-5 pb-24 pt-16 text-[0.9375rem] text-white/45 sm:px-10">
          <p className="max-w-[62ch]">
            Decision support only. Not legal advice and not an eligibility determination. All demo
            documents are synthetic. Open source under Apache-2.0.
          </p>
        </footer>
      </main>
    </div>
  );
}

/**
 * The download, presented as the point rather than as an obstacle.
 */
function ModelGate({
  progress,
  downloading,
  cached,
  webGpu,
  modelFits,
  onStart,
  onPickFile,
  onSkip,
}: Omit<Props, never>) {
  if (!webGpu) {
    return (
      <div className="max-w-[54ch]">
        <p className="text-[1.0625rem] text-white/70">
          This browser cannot run the model, so the written explanation is unavailable. The deadline,
          the case number, and the checklist still work, because those are never generated.
        </p>
        <button
          onClick={onSkip}
          className="mt-5 min-h-14 rounded-full bg-white px-8 text-[1.0625rem] font-semibold text-ink"
        >
          Read my packet anyway
        </button>
      </div>
    );
  }

  /* WebGPU is present but the adapter cannot hold 2 GB in one piece, which is
     every iPhone. Offering the download here ends with a dead tab after a long
     wait, so the honest move is to say so before a byte moves. */
  if (!modelFits) {
    return (
      <div className="max-w-[54ch]">
        <p className="text-[1.0625rem] text-white/70">
          This device caps browser GPU memory below what the 2 GB model needs, so the written
          explanation cannot run here. The deadline, the case number, and the checklist are read
          from your document and work on this device. The sample packets inside show the full
          experience, including the explanation from a saved run of the same model.
        </p>
        <button
          onClick={onSkip}
          className="mt-5 min-h-14 rounded-full bg-white px-8 text-[1.0625rem] font-semibold text-ink"
        >
          Read my packet anyway
        </button>
      </div>
    );
  }

  if (cached) {
    return (
      <div>
        <p className="text-[1.0625rem] text-glow">
          Gemma 4 is on this device. You can turn off your wifi.
        </p>
        <button
          onClick={onSkip}
          className="mt-5 min-h-14 rounded-full bg-white px-8 text-[1.0625rem] font-semibold text-ink"
        >
          Read my packet
        </button>
      </div>
    );
  }

  if (downloading) {
    return (
      <div className="max-w-xl">
        <p className="counter text-[clamp(5rem,20vw,13rem)] leading-[0.8]">
          {Math.floor(progress * 100)}
          <span className="text-[0.3em] align-super text-white/40">%</span>
        </p>
        <div className="mt-5 h-[3px] w-full overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full bg-glow transition-[width] duration-300"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <p className="mt-4 text-[1rem] text-white/60">
          Gemma 4 E2B is copying onto your device. This happens once. After it finishes, nothing
          you photograph is ever transmitted anywhere.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[54ch]">
      <div className="flex flex-wrap gap-3">
        <button
          onClick={onStart}
          className="min-h-14 rounded-full bg-glow px-8 text-[1.0625rem] font-bold text-ink"
        >
          Put Gemma 4 on this device
        </button>
        <button
          onClick={onPickFile}
          className="min-h-14 rounded-full border border-white/25 px-7 text-[1.0625rem] text-white/85"
        >
          I have the file
        </button>
      </div>
      <p className="mt-4 text-[0.9375rem] text-white/50">
        1.87 GB, once. Or skip it and use the reader without the written explanation.
      </p>
      <button onClick={onSkip} className="mt-2 text-[0.9375rem] text-white/60 underline">
        Skip and read my packet
      </button>
    </div>
  );
}

function Panel({
  kicker,
  title,
  body,
  accent,
}: {
  kicker: string;
  title: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <section className="reveal flex min-h-[86vh] flex-col justify-center px-5 sm:px-10">
      <p className="text-[0.9375rem] uppercase tracking-[0.22em] text-white/45">{kicker}</p>
      <h2 className={`display-sm mt-4 max-w-[20ch] ${accent ? 'text-glow' : ''}`}>
        {title}
      </h2>
      <p className="mt-6 max-w-[58ch] text-[1.25rem] leading-relaxed text-white/70">{body}</p>
    </section>
  );
}
