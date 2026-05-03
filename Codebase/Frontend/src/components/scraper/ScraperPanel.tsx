import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface ScraperEvent {
  ts: string;
  event: string;
  [k: string]: unknown;
}

interface ScraperState {
  runId: string;
  url: string;
  startedAt: string;
  ready: boolean;
  finishedAt: string | null;
  outputDir: string | null;
  events: ScraperEvent[];
  pid: number | null;
  exitCode: number | null;
}

interface StatusResponse {
  enabled: boolean;
  running: boolean;
  state: ScraperState | null;
}

const TOKEN_KEY = 'nt_token';

function readToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = readToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    const msg = (body && typeof body === 'object' && 'error' in body) ? String((body as { error: unknown }).error) : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export default function ScraperPanel() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [url, setUrl] = useState<string>('');
  const [maxScrolls, setMaxScrolls] = useState<number>(5);
  const [hostKey, setHostKey] = useState<string>('');
  const pollRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await api<StatusResponse>('/api/admin/scraper/status');
      setStatus(s);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'status failed');
    }
  }, []);

  useEffect(() => {
    void refresh();
    pollRef.current = window.setInterval(refresh, 2000);
    return () => {
      if (pollRef.current !== null) window.clearInterval(pollRef.current);
    };
  }, [refresh]);

  const onStart = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      await api('/api/admin/scraper/start', {
        method: 'POST',
        body: JSON.stringify({
          url: url.trim(),
          maxScrolls,
          hostKey: hostKey.trim() || undefined,
        }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'start failed');
    } finally {
      setBusy(false);
    }
  }, [url, maxScrolls, hostKey, refresh]);

  const onStop = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      await api('/api/admin/scraper/stop', { method: 'POST' });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'stop failed');
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const recentEvents = useMemo(() => {
    if (!status?.state) return [] as ScraperEvent[];
    return status.state.events.slice(-12).reverse();
  }, [status]);

  const enabled = status?.enabled ?? false;
  const running = status?.running ?? false;

  return (
    <main className="nt-scraper">
      <header className="nt-scraper__head">
        <p className="nt-section-eyebrow">Admin · scraper</p>
        <h1>Manual-login web scraper</h1>
        <p className="nt-scraper__lede">
          Spawns a headed Chromium window with the picker overlay. You sign in by hand, hover-pick
          posts, choose image scope per post, then press <strong>Start scraping</strong> in the
          overlay. Output is grouped by post under
          <code> playwright-scratch/scraper-output/&lt;run_id&gt;/</code>.
        </p>
      </header>

      <section className="nt-scraper__warn" data-tone={enabled ? 'on' : 'off'}>
        <strong>{enabled ? 'Enabled' : 'Disabled'}</strong>
        {!enabled && (
          <p>
            Set <code>NEOTERRITORY_ENABLE_SCRAPER=1</code> in <code>Codebase/Backend/.env</code>
            and restart the backend to enable. Off by default in production.
          </p>
        )}
        {enabled && (
          <p>
            Reminder: Facebook and LinkedIn ToS prohibit automated scraping. Account checkpointing
            is a real risk. Use only for accounts whose owners have agreed.
          </p>
        )}
      </section>

      <section className="nt-scraper__form">
        <h2>1 · Configure run</h2>
        <label>
          Target URL
          <input
            type="url"
            placeholder="https://example.com/profile"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={running || !enabled}
          />
        </label>
        <div className="nt-scraper__row">
          <label>
            Max scrolls before extract
            <input
              type="number"
              min={0}
              max={50}
              value={maxScrolls}
              onChange={(e) => setMaxScrolls(Number(e.target.value))}
              disabled={running || !enabled}
            />
          </label>
          <label>
            Host key (storage state folder)
            <input
              type="text"
              placeholder="auto from URL host"
              value={hostKey}
              onChange={(e) => setHostKey(e.target.value)}
              disabled={running || !enabled}
            />
          </label>
        </div>
        <div className="nt-scraper__btnrow">
          <button
            type="button"
            className="nt-magnetic nt-magnetic--primary"
            onClick={onStart}
            disabled={busy || running || !enabled || !url.trim()}
          >
            <span className="nt-magnetic__inner">Open browser & inject overlay</span>
          </button>
          <button
            type="button"
            className="nt-magnetic nt-magnetic--ghost"
            onClick={onStop}
            disabled={busy || !running}
          >
            <span className="nt-magnetic__inner">Stop session</span>
          </button>
        </div>
        {error && <p className="nt-scraper__error">{error}</p>}
      </section>

      <section className="nt-scraper__live">
        <h2>2 · Live session</h2>
        {!status?.state && <p className="nt-scraper__hint">No session yet. Start one above.</p>}
        {status?.state && (
          <dl className="nt-scraper__meta">
            <div>
              <dt>Run ID</dt>
              <dd>
                <code>{status.state.runId}</code>
              </dd>
            </div>
            <div>
              <dt>State</dt>
              <dd data-tone={running ? 'on' : 'off'}>
                {running ? (status.state.ready ? 'ready · picker injected' : 'booting…') : 'finished'}
                {status.state.exitCode !== null && ` (exit ${status.state.exitCode})`}
              </dd>
            </div>
            <div>
              <dt>URL</dt>
              <dd>
                <code>{status.state.url}</code>
              </dd>
            </div>
            <div>
              <dt>Output</dt>
              <dd>
                <code>{status.state.outputDir ?? '—'}</code>
              </dd>
            </div>
          </dl>
        )}
      </section>

      <section className="nt-scraper__events">
        <h2>3 · Recent events</h2>
        {recentEvents.length === 0 && <p className="nt-scraper__hint">No events yet.</p>}
        <ol>
          {recentEvents.map((ev, i) => (
            <li key={`${ev.ts}-${i}`}>
              <span className="nt-scraper__evt-time">{ev.ts.slice(11, 19)}</span>
              <span className="nt-scraper__evt-name">{ev.event}</span>
              <span className="nt-scraper__evt-rest">
                {Object.entries(ev)
                  .filter(([k]) => k !== 'ts' && k !== 'event')
                  .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
                  .join('  ')}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="nt-scraper__how">
        <h2>4 · How to use the overlay (in the spawned window)</h2>
        <ol className="nt-scraper__how-list">
          <li>The overlay sits in the top-right of the target page.</li>
          <li>Click <strong>Start picking</strong> — hover the page; the nearest post-like block highlights.</li>
          <li>Click a highlighted block to add it. Each pick becomes one post (text + chosen images).</li>
          <li>Per pick: choose image scope (<code>none</code> default, <code>profile</code> = first image only, <code>all</code> = every image inside).</li>
          <li>Set max-scrolls to load more feed before extraction.</li>
          <li>Click <strong>Save session</strong> to persist storageState — your sign-in is reused next run for the same host key.</li>
          <li>Click <strong>Start scraping</strong>. Output folder fills with one numbered post folder per pick.</li>
        </ol>
      </section>
    </main>
  );
}
