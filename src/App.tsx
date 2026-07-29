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
  downloadModel,
  getCachedModel,
  requestPersistence,
  validateModelFile,
} from './model/cache';
import { checkWebGpu, warmEngine } from './model/engine';
import { warmOcr } from './ocr/paddle';
import { analyse, type Analysis, type Progress } from './pipeline';
import { Landing } from './views/Landing';
import { Result } from './views/Result';

type Screen = 'landing' | 'capture' | 'working' | 'result';

export default function App() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [webGpu, setWebGpu] = useState(true);
  const [cached, setCached] = useState<File | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [busy, setBusy] = useState<Progress>({ stage: 'idle', message: '' });
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const [error, setError] = useState<string | null>(null);

  const modelInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void checkWebGpu().then((s) => setWebGpu(s.supported));
    void getCachedModel().then(setCached);
    // OCR is small and is needed on every path, including the one where the
    // reader never downloads the model at all.
    void warmOcr().catch(() => {});
  }, []);

  /** Warm the engine, and prime it once so the first real answer is not the slow one. */
  const warm = useCallback(async (model: File) => {
    const e = await warmEngine(model);
    setEngine(e);
    return e;
  }, []);

  useEffect(() => {
    if (cached && !engine) void warm(cached).catch(() => {});
  }, [cached, engine, warm]);

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
      setCached(validateModelFile(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const onPhotos = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = [...(e.target.files ?? [])];
      if (!files.length) return;
      setError(null);
      setScreen('working');
      try {
        const result = await analyse(files, { engine, onProgress: setBusy });
        setAnalysis(result);
        setScreen('result');
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setScreen('capture');
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
          webGpu={webGpu}
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

      {screen === 'capture' && (
        <section className="mx-auto max-w-2xl px-5 py-14">
          <h1 className="display-sm">Photograph your packet</h1>
          <p className="mt-4 max-w-[52ch] text-[1.125rem] text-slate-text">
            Take a picture of every page you have, including the cover notice that came with it.
            The deadline is often on the notice rather than on the form.
          </p>

          <button
            onClick={() => photoInput.current?.click()}
            className="mt-8 min-h-16 w-full rounded bg-gov px-8 text-[1.25rem] font-bold text-white"
          >
            Choose photos
          </button>
          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            multiple
            onChange={onPhotos}
            className="hidden"
          />

          <p className="mt-6 text-[1rem] text-slate-text">
            {engine
              ? 'Gemma 4 is loaded on this device. You can turn off your wifi now.'
              : 'Running without the written explanation. Your deadline and checklist still work.'}
          </p>

          {error && (
            <p role="alert" className="mt-6 rounded border-l-4 border-alert bg-red-50 p-4">
              {error}
            </p>
          )}
        </section>
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
          <Result analysis={analysis} language={language} onLanguageChange={setLanguage} />
          <div className="mx-auto max-w-2xl px-5 pb-16 no-print">
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
                  setScreen('capture');
                }}
                className="min-h-14 rounded-full px-7 text-[1.0625rem] text-slate-text underline"
              >
                {language === 'es' ? 'Leer otro paquete' : 'Read another packet'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
