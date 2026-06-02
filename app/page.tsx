'use client';

import { useEffect, useRef, useState } from 'react';
import FilterForm from '@/components/FilterForm';
import ResultCard from '@/components/ResultCard';
import ThemeToggle from '@/components/ThemeToggle';
import type { JobInfo, ScoredListing, SearchDomain, SearchFilters } from '@/lib/scrapers/types';

const NAV_ITEMS: { value: SearchDomain; label: string; icon: string }[] = [
  { value: 'cars', label: 'Autos', icon: '🚗' },
  { value: 'electronics', label: 'Elektrogeräte', icon: '📱' },
];

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
  const [domain, setDomain] = useState<SearchDomain>('cars');
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [filterOpen, setFilterOpen] = useState(true);
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
  const activeDomain = job?.filters.domain ?? 'cars';
  const resultTypeLabel = activeDomain === 'electronics' ? 'Elektrogeräte' : 'Autos';

  const activeNav = NAV_ITEMS.find((n) => n.value === domain)!;

  // Klick auf eine Kategorie: Bereich setzen und Filter-Panel aufklappen.
  // Erneuter Klick auf die bereits aktive Kategorie klappt das Panel zu/auf.
  const handleNavClick = (value: SearchDomain) => {
    if (value === domain) {
      setFilterOpen((open) => !open);
    } else {
      setDomain(value);
      setFilterOpen(true);
    }
  };

  return (
    <div className={`app-shell ${railCollapsed ? 'rail-is-collapsed' : ''} ${filterOpen ? 'filter-is-open' : ''}`}>
      {/* Schmale Navigationsleiste mit den Kategorien */}
      <nav className="rail">
        <div className="rail-top">
          <div className="rail-brand">
            <div className="logo">AF</div>
            <span className="rail-label">AnzeigenFinder</span>
          </div>
          <button
            type="button"
            className="rail-toggle"
            onClick={() => setRailCollapsed((c) => !c)}
            aria-label={railCollapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
            title={railCollapsed ? 'Ausklappen' : 'Einklappen'}
          >
            {railCollapsed ? '»' : '«'}
          </button>
        </div>

        <div className="rail-section-label"><span className="rail-label">Suchbereich</span></div>
        <div className="rail-nav">
          {NAV_ITEMS.map((item) => {
            const active = domain === item.value;
            return (
              <button
                key={item.value}
                type="button"
                className={`rail-item ${active ? 'active' : ''}`}
                onClick={() => handleNavClick(item.value)}
                disabled={!!isRunning}
                title={item.label}
              >
                <span className="rail-icon" aria-hidden>{item.icon}</span>
                <span className="rail-label">{item.label}</span>
                <span className="rail-caret" aria-hidden>{active && filterOpen ? '−' : '+'}</span>
              </button>
            );
          })}
        </div>

        <div className="rail-footer">
          <ThemeToggle />
        </div>
      </nav>

      {/* Zweites Panel: Filter für den gewählten Bereich (aufklappbar) */}
      <aside className="filter-panel">
        <div className="filter-panel-head">
          <span className="filter-panel-icon" aria-hidden>{activeNav.icon}</span>
          <div>
            <h2>{activeNav.label}</h2>
            <p>Filter einstellen</p>
          </div>
        </div>
        <FilterForm onSubmit={startSearch} disabled={!!isRunning} domain={domain} />
      </aside>

      {/* Hauptbereich: Ergebnisse über die volle Breite */}
      <main className="content">
        <div className="content-head">
          <h1>{activeNav.label} finden</h1>
          {job && (
            <span className="content-count">
              {STATUS_LABEL[job.status] || job.status}
              {' · '}
              {job.totalFound} gefunden
              {job.status === 'ranking' && ` · ${job.totalScored}/${job.totalFound} bewertet`}
            </span>
          )}
        </div>

        {error && <div className="error-banner">{error}</div>}

        {job?.status === 'ranking' && (
          <div className="progress-bar">
            <div style={{ width: `${scoreProgress}%` }} />
          </div>
        )}

        {job && job.errors.length > 0 && (
          <div className="job-errors">
            {job.errors.slice(-3).map((e, i) => (
              <div key={i}>⚠ {e}</div>
            ))}
          </div>
        )}

        {!job && !error && (
          <div className="empty">
            Wähle links einen Suchbereich, stelle die Filter ein und starte die Suche.
            Die Bewertung dauert je nach Trefferzahl 1-3 Minuten.
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
          <div className="empty">Keine {resultTypeLabel} für deine Filter gefunden — versuche eine breitere Suche.</div>
        )}
      </main>
    </div>
  );
}
