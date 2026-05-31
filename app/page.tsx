'use client';

import { useEffect, useRef, useState } from 'react';
import FilterForm from '@/components/FilterForm';
import ResultCard from '@/components/ResultCard';
import type { JobInfo, ScoredListing, SearchFilters } from '@/lib/scrapers/types';

interface JobResponse {
  job: JobInfo;
  listings: ScoredListing[];
}

const STATUS_LABEL: Record<string, string> = {
  queued: 'In Warteschlange…',
  scraping: 'Anzeigen werden geladen…',
  ranking: 'Gemini liest die Beschreibungen…',
  done: 'Fertig',
  error: 'Fehler',
};

export default function Page() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [data, setData] = useState<JobResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startSearch = async (filters: SearchFilters) => {
    setError(null);
    setData(null);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(filters),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const { jobId } = (await res.json()) as { jobId: string };
      setJobId(jobId);
    } catch (e: any) {
      setError(e?.message || 'Unbekannter Fehler');
    }
  };

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as JobResponse;
        if (cancelled) return;
        setData(json);
        if (json.job.status !== 'done' && json.job.status !== 'error') {
          timerRef.current = setTimeout(poll, 2000);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Polling-Fehler');
      }
    };
    poll();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [jobId]);

  const job = data?.job;
  const listings = data?.listings || [];
  const isRunning = job && job.status !== 'done' && job.status !== 'error';
  const scoreProgress = job && job.totalFound > 0 ? (job.totalScored / job.totalFound) * 100 : 0;

  return (
    <div className="container">
      <div className="header">
        <div className="brand">
          <div className="logo">🚗</div>
          <div>
            <h1>CarFinder</h1>
          </div>
        </div>
      </div>

      <div className="grid">
        <div>
          <FilterForm onSubmit={startSearch} disabled={!!isRunning} />
        </div>

        <div>
          {error && <div className="error-banner">{error}</div>}

          {job && (
            <div className="status">
              <div>
                <strong>{STATUS_LABEL[job.status] || job.status}</strong>
                {' · '}
                {job.totalFound} Anzeigen gefunden
                {job.status === 'ranking' && ` · ${job.totalScored} von ${job.totalFound} bewertet`}
              </div>
              {job.errors.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 12 }}>
                  {job.errors.slice(-3).map((e, i) => (
                    <div key={i}>⚠ {e}</div>
                  ))}
                </div>
              )}
              {job.status === 'ranking' && (
                <div className="progress-bar">
                  <div style={{ width: `${scoreProgress}%` }} />
                </div>
              )}
            </div>
          )}

          {!job && !error && (
            <div className="empty">
              Filter links ausfüllen und „Autos finden" klicken. Die Suche dauert je nach Trefferzahl 1-3 Minuten.
            </div>
          )}

          {listings.length > 0 && (
            <div className="results">
              {listings.map((l) => (
                <ResultCard key={l.id} listing={l} />
              ))}
            </div>
          )}

          {job?.status === 'done' && listings.length === 0 && (
            <div className="empty">Keine Treffer für deine Filter — versuche eine breitere Suche.</div>
          )}
        </div>
      </div>
    </div>
  );
}
