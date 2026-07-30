/**
 * The whole application.
 *
 * Two surfaces, one URL, one piece of state: whether the reader has a packet in
 * front of them yet. There is no router because there are no routes; adding one
 * would be a second thing to break in a room with bad wifi.
 *
 * The model is warmed as early as it is allowed to be. Loading 2 GB onto the GPU
 * and compiling its shaders takes tens of seconds on first use, and doing that
 * lazily puts the whole cost between a person pressing a button and seeing
 * anything happen.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Engine } from '@litert-lm/core';
import {
  adoptModelFile,
  downloadModel,
  getCachedModel,
  requestPersistence,
  validateModelFile,
} from './model/cache';
import { checkWebGpu, warmEngine } from './model/engine';
import { warmOcr } from './ocr/paddle';
import { DEMO_CACHE } from './demo/cached';
import { DEMO_SCENARIOS, type DemoScenario } from './demo/scenarios';
import { analyse, applyCachedProse, type Analysis, type Progress } from './pipeline';
import { buildScript, isSpeechAvailable, speak, stop, whenVoicesReady } from './tts/speak';
import { Landing } from './views/Landing';
import { AskQuestion } from './views/AskQuestion';
import { NavigatorQueue, type QueueEntry } from './views/Navigator';
import { Result } from './views/Result';
import { Verify } from './views/Verify';

type Screen = 'landing' | 'capture' | 'working' | 'result' | 'navigator' | 'verify';

export default function App() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [gpu, setGpu] = useState<{ supported: boolean; modelFits: boolean }>({
    supported: true,
    modelFits: true,
  });
  const [cached, setCached] = useState<File | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [busy, setBusy] = useState<Progress>({ stage: 'idle', message: '' });
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [engineFailed, setEngineFailed] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);

  /**
   * Navigator queue. Memory only, deliberately.
   *
   * This is a list of other people's case numbers on what is often a shared
   * laptop in a community room. Persisting it would be the single worst thing
   * this product could do, so a refresh erases it and that is stated on screen.
   */
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [returnTo, setReturnTo] = useState<Screen>('capture');
  const startedAt = useRef(0);
  const pendingLabel = useRef('');

  const modelInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void checkWebGpu().then((s) => setGpu({ supported: s.supported, modelFits: s.modelFits }));
    // Dev-only: ?nomodel simulates a visitor who never downloaded the model,
    // which is exactly the audience the demo cache exists for.
    const noModel =
      import.meta.env.DEV && new URLSearchParams(location.search).has('nomodel');
    if (!noModel) void getCachedModel().then(setCached);
    // OCR is small and is needed on every path, including the one where the
    // reader never downloads the model at all.
    void warmOcr().catch(() => {});
    void whenVoicesReady().then(() => setCanSpeak(isSpeechAvailable(language)));
  }, []);

  // A device can have English voices and no Spanish one. Re-check per language
  // rather than offering a button that will read Spanish in an English voice.
  useEffect(() => {
    setCanSpeak(isSpeechAvailable(language));
  }, [language]);

  // Never leave audio running when the screen changes underneath it.
  useEffect(() => {
    if (screen !== 'result') {
      stop();
      setSpeaking(false);
    }
  }, [screen]);

  /** Warm the engine, and prime it once so the first real answer is not the slow one. */
  const warm = useCallback(async (model: File) => {
    const e = await warmEngine(model);
    setEngine(e);
    return e;
  }, []);

  useEffect(() => {
    // Never warm on a device whose adapter cannot hold the model: the attempt
    // does not error, it kills the tab.
    if (cached && !engine && gpu.modelFits) {
      void warm(cached).catch((err) => {
        // Silently swallowing this told a user who waited through a 2 GB
        // download that running without an explanation is how the product works.
        console.error('[renova] engine warm failed', err);
        setEngineFailed(true);
      });
    }
  }, [cached, engine, gpu.modelFits, warm]);

  const onDownload = useCallback(async () => {
    setError(null);
    setDownloading(true);
    try {
      await requestPersistence();
      const file = await downloadModel((p) => setProgress(p.fraction));
      setCached(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDownloading(false);
    }
  }, []);

  const onPickModel = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const validated = validateModelFile(file);
      setCached(validated);
      // Copy it into OPFS so the USB-stick path works more than once per load.
      void adoptModelFile(validated).then(setCached).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const onPhotos = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = [...(e.target.files ?? [])];
      if (!files.length) return;
      setError(null);
      startedAt.current = performance.now();
      setScreen('working');
      try {
        const result = await analyse(files, { engine, onProgress: setBusy });
        const seconds = (performance.now() - startedAt.current) / 1000;
        setAnalysis(result);

        if (returnTo === 'navigator') {
          setQueue((q) => [
            {
              id: `${q.length + 1}-${Math.round(seconds * 1000)}`,
              label: pendingLabel.current || `Packet ${q.length + 1}`,
              analysis: result,
              seconds,
            },
            ...q,
          ]);
        }
        setScreen('result');
      } catch (err) {
        // Raw runtime text ("Aborted(). Build with -sASSERTIONS") is not a
        // sentence to put in front of a frightened reader. Keep it in the log.
        console.error('[renova] analyse failed', err);
        setError(
          'We could not read those photos. Try again with more light, or with one page at a time.',
        );
        setScreen(returnTo);
      } finally {
        // Without this the navigator queue's button stays disabled and reads
        // "Reading..." forever, and the only way out is a reload, which erases
        // every client already processed.
        setBusy({ stage: 'idle', message: '' });
      }
      // Let the same file be chosen twice in a row, which navigators do.
      e.target.value = '';
    },
    [engine, returnTo],
  );

  const onDemo = useCallback(
    async (scenario: DemoScenario) => {
      setError(null);
      startedAt.current = performance.now();
      setScreen('working');
      try {
        const blobs = await Promise.all(
          scenario.images.map(async (url) => {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
            return res.blob();
          }),
        );
        let result = await analyse(blobs, { engine, onProgress: setBusy });
        // No model on this device: show the saved answer this same engine
        // produced for these exact pages, labelled on screen as saved. The
        // fields above the prose were still read live, just now.
        if (!result.modelRan) {
          const cached = DEMO_CACHE.scenarios[scenario.id];
          if (cached) result = applyCachedProse(result, cached);
        }
        setAnalysis(result);
        setScreen('result');
      } catch (err) {
        console.error('[renova] demo failed', err);
        setError(
          'The sample packet could not be loaded. Try again, or photograph your own packet.',
        );
        setScreen('capture');
      } finally {
        setBusy({ stage: 'idle', message: '' });
      }
    },
    [engine],
  );

  if (screen === 'landing') {
    return (
      <>
        <Landing
          progress={progress}
          downloading={downloading}
          cached={!!cached}
          webGpu={gpu.supported}
          modelFits={gpu.modelFits}
          onStart={onDownload}
          onPickFile={() => modelInput.current?.click()}
          onSkip={() => setScreen('capture')}
        />
        <input
          ref={modelInput}
          type="file"
          accept=".litertlm"
          onChange={onPickModel}
          className="hidden"
        />
        {error && (
          <p role="alert" className="fixed inset-x-0 bottom-0 z-50 bg-alert p-4 text-white">
            {error}
          </p>
        )}
      </>
    );
  }

  return (
    <div className="min-h-dvh">
      <div aria-live="polite" className="sr-only">
        {busy.message}
      </div>

      {/* Mounted once, outside the screen switch, because both the reader flow
          and navigator mode open it. */}
      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        multiple
        onChange={onPhotos}
        className="hidden"
      />
      {/* Separate input with capture set. On a phone this opens the camera
          directly; the one above opens the photo library. A person standing at
          a kitchen table with the packet in front of them wants the camera. */}
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={onPhotos}
        className="hidden"
      />

      {screen === 'capture' && (
        <section className="mx-auto max-w-2xl px-5 py-14">
          <h1 className="display-sm">Photograph your packet</h1>
          <p className="mt-4 max-w-[52ch] text-[1.125rem] text-slate-text">
            Take a picture of every page you have, including the cover notice that came with it.
            The deadline is often on the notice rather than on the form.
          </p>

          <button
            onClick={() => cameraInput.current?.click()}
            className="mt-8 min-h-16 w-full rounded bg-gov px-8 text-[1.25rem] font-bold text-white"
          >
            Take a photo
          </button>
          <button
            onClick={() => photoInput.current?.click()}
            className="mt-3 min-h-14 w-full rounded border-2 border-gov px-8 text-[1.0625rem] font-semibold text-gov"
          >
            Choose photos I already took
          </button>
          <p className="mt-6 text-[1rem] text-slate-text">
            {engine
              ? 'Gemma 4 is loaded on this device. You can turn off your wifi now.'
              : engineFailed
                ? 'Gemma 4 could not start on this device, so there will be no written explanation. Your deadline, case number, and checklist are read from your document and still work.'
                : cached
                  ? 'Gemma 4 is still loading. You can start now; the explanation will appear if it is ready.'
                  : 'Running without the written explanation. Your deadline and checklist still work.'}
          </p>

          <div className="mt-10 border-t border-slate-line pt-6">
            <h2 className="text-[0.9375rem] font-bold uppercase tracking-[0.08em] text-slate-text">
              No packet in front of you? Try a sample
            </h2>
            <p className="mt-2 text-[1rem] text-slate-text">
              Synthetic documents in the states' real formats. Invented values, nobody's mail.
            </p>
            <ul className="mt-4 space-y-3">
              {DEMO_SCENARIOS.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => void onDemo(s)}
                    className="min-h-14 w-full rounded border-2 border-slate-line px-5 py-3 text-left hover:border-gov"
                  >
                    <span className="block text-[1.0625rem] font-semibold">{s.label}</span>
                    <span className="mt-1 block text-[0.9375rem] text-slate-text">
                      {s.description}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={() => {
              setReturnTo('navigator');
              setScreen('navigator');
            }}
            className="mt-8 text-[1rem] text-gov underline"
          >
            I am helping someone else with their packet
          </button>

        </section>
      )}

      {error && (
        <p
          role="alert"
          className="mx-auto mt-6 max-w-2xl rounded border-l-4 border-alert bg-red-50 p-4 text-[1.0625rem]"
        >
          {error}
        </p>
      )}

      {screen === 'verify' && <Verify onBack={() => setScreen(returnTo)} />}

      {screen === 'navigator' && (
        <NavigatorQueue
          queue={queue}
          busy={busy.stage !== 'idle' && busy.stage !== 'done'}
          onAdd={() => {
            const input = document.getElementById('client-label') as HTMLInputElement | null;
            pendingLabel.current = input?.value.trim() ?? '';
            if (input) input.value = '';
            photoInput.current?.click();
          }}
          onOpen={(entry) => {
            setAnalysis(entry.analysis);
            setScreen('result');
          }}
          onClear={() => setQueue([])}
        />
      )}

      {screen === 'working' && (
        <section className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-5">
          <p className="display-sm">{busy.message}</p>
          <p className="mt-4 text-[1.125rem] text-slate-text">
            This is happening on your device. Nothing is being uploaded.
          </p>
        </section>
      )}

      {screen === 'result' && analysis && (
        <>
          <Result
            analysis={analysis}
            language={language}
            onLanguageChange={(next) => {
              stop();
              setSpeaking(false);
              setLanguage(next);
            }}
            speaking={speaking}
            onSpeak={
              canSpeak
                ? () => {
                    if (speaking) {
                      stop();
                      setSpeaking(false);
                      return;
                    }
                    setSpeaking(true);
                    speak(buildScript(analysis, language), language, (reason) => {
                      setSpeaking(false);
                      if (reason === 'error') {
                        setError(
                          language === 'es'
                            ? 'No se pudo reproducir el audio en este dispositivo.'
                            : 'Audio could not play on this device.',
                        );
                      }
                    });
                  }
                : undefined
            }
          />
          <div className="mx-auto max-w-2xl px-5">
            <AskQuestion analysis={analysis} engine={engine} language={language} />
          </div>
          <div className="mx-auto max-w-2xl px-5 pb-16 pt-8 no-print">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => window.print()}
                className="min-h-14 rounded-full border-2 border-gov px-7 text-[1.0625rem] font-semibold text-gov"
              >
                {language === 'es' ? 'Imprimir la lista' : 'Print the checklist'}
              </button>
              <button
                onClick={() => {
                  setAnalysis(null);
                  setScreen(returnTo);
                }}
                className="min-h-14 rounded-full px-7 text-[1.0625rem] text-slate-text underline"
              >
                {returnTo === 'navigator'
                  ? 'Back to the list'
                  : language === 'es'
                    ? 'Leer otro paquete'
                    : 'Read another packet'}
              </button>
              <button
                onClick={() => setScreen('verify')}
                className="min-h-14 rounded-full px-7 text-[1.0625rem] text-slate-text underline"
              >
                {language === 'es' ? 'Cómo se mantiene honesto' : 'How this stays honest'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
