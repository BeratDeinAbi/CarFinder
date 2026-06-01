import crypto from 'crypto';
import {
  appendJobError,
  createJob,
  getJob,
  getJobListings,
  getScore,
  linkJobListing,
  updateJob,
} from './db';
import { scrapeMobileDe } from './scrapers/mobile';
import { scrapeKleinanzeigen } from './scrapers/kleinanzeigen';
import { closeBrowser, runConcurrent } from './scrapers/browser';
import { getWishHash, rankListing } from './ranker';
import type { JobInfo, NormalizedListing, ScoredListing, SearchFilters } from './scrapers/types';

export function startJob(filters: SearchFilters): string {
  const id = crypto.randomBytes(6).toString('hex');
  createJob(id, filters);
  // Fire-and-forget — runs in the background of the Node process
  void runJob(id, filters).catch((e) => {
    appendJobError(id, String(e?.message || e));
    updateJob(id, { status: 'error' });
  });
  return id;
}

async function runJob(jobId: string, filters: SearchFilters): Promise<void> {
  updateJob(jobId, { status: 'scraping' });

  const all: NormalizedListing[] = [];

  // mobile.de ist standardmäßig AUS: Cloudflare blockt headless-Browser zuverlässig,
  // das kostet nur Zeit und erzeugt Fehlermeldungen. Mit ENABLE_MOBILE_DE=1 in
  // .env.local wieder aktivierbar (dann ggf. mit Proxy nötig).
  if (process.env.ENABLE_MOBILE_DE === '1') {
    try {
      const mobile = await scrapeMobileDe(filters, {
        maxPages: 2,
        onProgress: (done, total) => {
          updateJob(jobId, { totalFound: all.length + done });
          void total; // total used in UI via state
        },
      });
      all.push(...mobile);
    } catch (e: any) {
      appendJobError(jobId, `mobile.de: ${e?.message || e}`);
    }
    updateJob(jobId, { totalFound: all.length });
  }

  try {
    const ka = await scrapeKleinanzeigen(filters, {
      maxPages: 2,
      onProgress: (done) => {
        updateJob(jobId, { totalFound: all.length + done });
      },
    });
    all.push(...ka);
  } catch (e: any) {
    appendJobError(jobId, `kleinanzeigen: ${e?.message || e}`);
  }

  for (const l of all) linkJobListing(jobId, l.id);

  // Nicht alle Treffer von Gemini bewerten lassen: Bei breiten Suchen (z.B. nur
  // Preis, ohne Marke) kommen leicht 50+ Anzeigen, was das kostenlose Gemini-
  // Tageslimit sprengt und ewig dauert. Wir ranken die günstigsten RANK_LIMIT
  // Anzeigen (bestes Preis-Leistungs-Potenzial). Der Rest bleibt sichtbar (ohne Score).
  const RANK_LIMIT = 25;
  const toRank = [...all]
    .sort((a, b) => (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER))
    .slice(0, RANK_LIMIT);

  updateJob(jobId, { status: 'ranking', totalFound: toRank.length });

  // Rank with Gemini (concurrency 1 — vermeidet Bursts, die das Gratis-Minutenlimit reißen)
  let scored = 0;
  await runConcurrent(
    toRank,
    1,
    async (listing) => {
      try {
        await rankListing(listing, filters.wish);
      } catch (e: any) {
        appendJobError(jobId, `rank ${listing.id}: ${e?.message || e}`);
      }
      scored++;
      updateJob(jobId, { totalScored: scored });
    },
  );

  updateJob(jobId, { status: 'done', totalScored: scored, totalFound: all.length });
  // Best-effort: free the browser when we're idle
  setTimeout(() => closeBrowser().catch(() => {}), 10_000);
}

export function getJobResult(jobId: string): { job: JobInfo; listings: ScoredListing[] } | null {
  const job = getJob(jobId);
  if (!job) return null;
  const listings = getJobListings(jobId);
  const wishHash = getWishHash(job.filters.wish);
  const enriched: ScoredListing[] = listings.map((l) => {
    const score = getScore(l.id, wishHash);
    return score ? { ...l, score } : l;
  });
  enriched.sort((a, b) => (b.score?.score ?? -1) - (a.score?.score ?? -1));
  return { job, listings: enriched };
}
