/**
 * GATE W spike.
 *
 * This screen exists to answer four questions with numbers before any product
 * code is written, and it is throwaway:
 *
 *   1. Does the model download and commit to OPFS at this exact origin?
 *   2. Does it load again after a reload with the network off?
 *   3. What is time-to-first-token, and what is the sustained decode rate?
 *   4. Does the whole thing fit on an 8 GB machine with headroom?
 *
 * Numbers printed here go into the writeup's architecture section, so they are
 * measured rather than estimated.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MODEL_BYTES,
  clearCachedModel,
  downloadModel,
  getCachedModel,
  isOpfsSupported,
  requestPersistence,
  validateModelFile,
  type DownloadProgress,
} from './model/cache';
import { checkWebGpu, disposeEngine, generate, warmEngine, type WebGpuStatus } from './model/engine';

const GB = (n: number) => `${(n / 1024 ** 3).toFixed(2)} GB`;
const MBs = (n: number) => `${(n / 1024 ** 2).toFixed(1)} MB/s`;

const PROBE_PROMPT =
  'Explain in three short sentences, at a sixth grade reading level, what a Medicaid renewal packet is and why the deadline on it matters.';

type Phase = 'idle' | 'downloading' | 'warming' | 'ready' | 'generating' | 'error';

export default function App() {
  const [gpu, setGpu] = useState<WebGpuStatus | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [cached, setCached] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState('');
  const [metrics, setMetrics] = useState<Record<string, string>>({});
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void checkWebGpu().then(setGpu);
    void getCachedModel().then(setCached);
    navigator.storage?.persisted?.().then(setPersisted).catch(() => {});
  }, []);

  const note = useCallback((k: string, v: string) => {
    setMetrics((m) => ({ ...m, [k]: v }));
  }, []);

  const onDownload = useCallback(async () => {
    setError(null);
    setPhase('downloading');
    try {
      const granted = await requestPersistence();
      setPersisted(granted);
      note('storage.persist()', granted ? 'granted' : 'REFUSED (cache may be evicted)');

      const t0 = performance.now();
      const file = await downloadModel(setProgress);
      note('download', `${((performance.now() - t0) / 1000).toFixed(1)}s`);
      setCached(file);
      setPhase('idle');
    } catch (err) {
      setError(String(err));
      setPhase('error');
    }
  }, [note]);

  const onPickFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setError(null);
      try {
        setCached(validateModelFile(file));
        note('model source', `local file (${file.name})`);
      } catch (err) {
        setError(String(err));
      }
    },
    [note],
  );

  const onRun = useCallback(async () => {
    if (!cached) return;
    setError(null);
    setOutput('');
    setPhase('warming');
    try {
      const tWarm = performance.now();
      const engine = await warmEngine(cached);
      note('engine warm', `${((performance.now() - tWarm) / 1000).toFixed(1)}s`);

      setPhase('generating');
      const tGen = performance.now();
      let first = 0;
      let chunks = 0;

      const text = await generate(engine, PROBE_PROMPT, {
        onToken: (t) => {
          if (!first) {
            first = performance.now();
            note('time to first token', `${((first - tGen) / 1000).toFixed(2)}s`);
          }
          chunks += 1;
          setOutput((o) => o + t);
        },
      });

      const seconds = (performance.now() - (first || tGen)) / 1000;
      // Chunk count is a lower bound on token count. Labelled as chunks so it
      // can never be quoted as a tokens/second figure by accident.
      note('decode rate', `${(chunks / seconds).toFixed(1)} chunks/s over ${seconds.toFixed(1)}s`);
      note('output chars', String(text.length));
      setPhase('ready');
    } catch (err) {
      setError(String(err));
      setPhase('error');
    }
  }, [cached, note]);

  const onClear = useCallback(async () => {
    await disposeEngine();
    await clearCachedModel();
    setCached(null);
    setOutput('');
    setMetrics({});
    setPhase('idle');
  }, []);

  const busy = phase === 'downloading' || phase === 'warming' || phase === 'generating';

  return (
    <main className="mx-auto max-w-3xl p-8 text-slate-900">
      <h1 className="text-2xl font-bold">Renova spike: GATE W</h1>
      <p className="mt-1 text-sm text-slate-600">
        Gemma 4 E2B on WebGPU, cached in OPFS, at origin <code>{location.origin}</code>
      </p>

      <section className="mt-6 space-y-1 rounded border border-slate-300 p-4 text-sm">
        <Row label="WebGPU">
          {gpu === null
            ? 'checking...'
            : gpu.supported
              ? `yes${gpu.adapterInfo ? ` (${gpu.adapterInfo})` : ''}`
              : `NO — ${gpu.reason}`}
        </Row>
        <Row label="OPFS">{isOpfsSupported() ? 'yes' : 'NO'}</Row>
        <Row label="Storage persisted">
          {persisted === null ? 'unknown' : persisted ? 'yes' : 'no'}
        </Row>
        <Row label="Model cached">
          {cached ? `yes, ${GB(cached.size)} (byte-exact)` : `no, needs ${GB(MODEL_BYTES)}`}
        </Row>
      </section>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          onClick={onDownload}
          disabled={busy || !!cached}
          className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-40"
        >
          Download model
        </button>
        <button
          onClick={() => fileInput.current?.click()}
          disabled={busy}
          className="rounded border border-slate-400 px-4 py-2 disabled:opacity-40"
        >
          Load from disk
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".litertlm"
          onChange={onPickFile}
          className="hidden"
        />
        <button
          onClick={onRun}
          disabled={busy || !cached}
          className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-40"
        >
          Warm and generate
        </button>
        <button
          onClick={onClear}
          disabled={busy}
          className="rounded border border-red-400 px-4 py-2 text-red-700 disabled:opacity-40"
        >
          Clear cache
        </button>
      </div>

      {progress && phase === 'downloading' && (
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded bg-slate-200">
            <div
              className="h-full bg-slate-900 transition-[width]"
              style={{ width: `${progress.fraction * 100}%` }}
            />
          </div>
          <p className="mt-1 text-sm tabular-nums text-slate-600">
            {GB(progress.receivedBytes)} / {GB(progress.totalBytes)},{' '}
            {(progress.fraction * 100).toFixed(1)}%, {MBs(progress.bytesPerSecond)}
          </p>
        </div>
      )}

      {phase === 'warming' && <p className="mt-4 text-sm">Loading weights onto the GPU...</p>}

      {error && (
        <pre className="mt-4 overflow-x-auto rounded bg-red-50 p-3 text-sm text-red-800">
          {error}
        </pre>
      )}

      {output && (
        <pre className="mt-4 whitespace-pre-wrap rounded bg-slate-50 p-3 text-sm">{output}</pre>
      )}

      {Object.keys(metrics).length > 0 && (
        <section className="mt-6">
          <h2 className="font-semibold">Measurements</h2>
          <table className="mt-2 text-sm">
            <tbody>
              {Object.entries(metrics).map(([k, v]) => (
                <tr key={k}>
                  <td className="pr-6 text-slate-600">{k}</td>
                  <td className="tabular-nums">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-600">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}
