import type { ScoredListing } from '@/lib/scrapers/types';
import ScoreBadge from './ScoreBadge';

interface Props {
  listing: ScoredListing;
}

function fmtEUR(n: number | null): string {
  if (n == null) return '—';
  return `${n.toLocaleString('de-DE')} €`;
}

function fmtKm(n: number | null): string {
  if (n == null) return '—';
  return `${n.toLocaleString('de-DE')} km`;
}

export default function ResultCard({ listing: l }: Props) {
  return (
    <a href={l.url} target="_blank" rel="noopener noreferrer" className="card" style={{ color: 'inherit' }}>
      <div
        className="thumb"
        style={l.thumbnail ? { backgroundImage: `url(${l.thumbnail})` } : {}}
      />
      <div className="body">
        <div className="title">{l.title}</div>
        <div className="meta">
          <span><strong>{fmtEUR(l.price)}</strong></span>
          <span>{fmtKm(l.km)}</span>
          {l.year && <span>{l.year}</span>}
          {l.fuel && <span>{l.fuel}</span>}
          {l.gearbox && <span>{l.gearbox === 'automatic' ? 'Automatik' : 'Schalter'}</span>}
        </div>
        {l.location && <div className="meta">{l.location}</div>}
        {l.score && (
          <>
            <div className="summary">{l.score.summary}</div>
            {(l.score.pros.length > 0 || l.score.redFlags.length > 0) && (
              <div className="tags">
                {l.score.pros.slice(0, 3).map((p, i) => (
                  <span key={`p${i}`} className="tag pro">+ {p}</span>
                ))}
                {l.score.redFlags.slice(0, 3).map((f, i) => (
                  <span key={`f${i}`} className="tag flag">⚠ {f}</span>
                ))}
              </div>
            )}
          </>
        )}
        <div className="footer">
          <span className="source">{l.source === 'mobile' ? 'mobile.de' : 'Kleinanzeigen'}</span>
          {l.score ? <ScoreBadge score={l.score.score} /> : <span className="source">…wird bewertet</span>}
        </div>
      </div>
    </a>
  );
}
