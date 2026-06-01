import type { Page } from 'playwright';
import { withPage, jitter, runConcurrent, detectBlock } from './browser';
import { getCachedListing, upsertListing } from '../db';
import type { BodyType, Fuel, Gearbox, NormalizedListing, SearchFilters } from './types';

const BASE = 'https://www.kleinanzeigen.de';

// Kleinanzeigen erwartet Filter als PFAD-Segmente, nicht als Query-Parameter.
// Nur der Preis ist als Pfad-Segment zuverlässig: /s-autos/preis:MIN:MAX/<keyword>/k0c216
// Baujahr/km/Kraftstoff werden NICHT in die URL gepackt (die +autos.*-Segmente sind
// unzuverlässig und können die Suche auf 0 Treffer brechen) — das erledigt der
// Code-Filter matchesFilters() nach dem Scrapen.
function buildSearchUrl(f: SearchFilters, page: number): string {
  const slug = [f.make, f.model]
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const priceSeg = f.priceMin || f.priceMax ? `/preis:${f.priceMin ?? ''}:${f.priceMax ?? ''}` : '';
  const pageSeg = page > 1 ? `/seite:${page}` : '';

  // Location-Code (l<zip>r<radius>) — Platzierung hängt davon ab, ob ein Keyword existiert.
  let loc = '';
  if (f.zip) {
    loc = `l${f.zip}`;
    if (f.radiusKm) loc += `r${f.radiusKm}`;
  }

  if (slug) {
    // MIT Keyword: Location als eigenes Segment VOR dem Keyword, Kategorie als /k0c216.
    // /s-autos/preis:.../l10115r100/vw-golf/k0c216
    const locSeg = loc ? `/${loc}` : '';
    return `${BASE}/s-autos${priceSeg}${locSeg}/${slug}${pageSeg}/k0c216`;
  }

  // OHNE Keyword: Location wird DIREKT an den Kategorie-Code c216 angehängt (ohne k0).
  // /s-autos/preis:.../c216l10115r50   bzw.   /s-autos/preis:.../c216
  return `${BASE}/s-autos${priceSeg}${pageSeg}/c216${loc}`;
}

// "Reserviert • Gelöscht • …" sind Boilerplate-Badges im Detail-Titel. Entfernen.
function cleanTitle(t: string): string {
  return t
    .replace(/\s+/g, ' ')
    .replace(/^(\s*(reserviert|gelöscht|gesucht|zu verschenken|verkauft)\s*[•·|]\s*)+/gi, '')
    .trim();
}

// Mapping vom Kleinanzeigen-"Fahrzeugtyp" auf unsere BodyType-Werte.
function mapBodyType(raw: string | null): BodyType | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes('kombi')) return 'estate';
  if (s.includes('cabrio') || s.includes('roadster')) return 'convertible';
  if (s.includes('suv') || s.includes('geländewagen') || s.includes('gelaendewagen') || s.includes('pickup')) return 'suv';
  if (s.includes('limousine') || s.includes('limo')) return 'sedan';
  if (s.includes('sportwagen') || s.includes('coupé') || s.includes('coupe')) return 'coupe';
  if (s.includes('van') || s.includes('bus') || s.includes('kleinwagen')) {
    return s.includes('kleinwagen') ? 'small' : 'van';
  }
  return 'other';
}

// Sicherheitsnetz: nur Anzeigen behalten, die wirklich zu den Filtern passen.
function matchesFilters(l: NormalizedListing, f: SearchFilters): boolean {
  if (f.priceMin != null && l.price != null && l.price < f.priceMin) return false;
  if (f.priceMax != null && l.price != null && l.price > f.priceMax) return false;
  if (f.yearMin != null && l.year != null && l.year < f.yearMin) return false;
  if (f.yearMax != null && l.year != null && l.year > f.yearMax) return false;
  if (f.kmMax != null && l.km != null && l.km > f.kmMax) return false;
  if (f.fuels && f.fuels.length && l.fuel && !f.fuels.includes(l.fuel)) return false;
  // Karosserieform: nur filtern, wenn das Inserat einen Typ angibt (sonst durchlassen).
  if (f.bodyType && f.bodyType !== 'any' && l.bodyType && l.bodyType !== f.bodyType) return false;
  return true;
}

interface ListCard {
  platformId: string;
  url: string;
  title: string;
  price: number | null;
  thumbnail: string | null;
}

async function gotoSafe(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const content = await page.content();
  const block = detectBlock(content);
  if (block) throw new Error(`kleinanzeigen blocked: ${block}`);
}

async function scrapeListPage(url: string): Promise<ListCard[]> {
  return withPage(async (page) => {
    await gotoSafe(page, url);
    await jitter(800, 1800);
    const cards = await page.evaluate(() => {
      const out: any[] = [];
      const items = document.querySelectorAll('article.aditem');
      items.forEach((art) => {
        const id = art.getAttribute('data-adid') || '';
        const linkEl = art.querySelector('a.ellipsis');
        const href = (linkEl as HTMLAnchorElement)?.href || '';
        const title = (linkEl?.textContent || '').trim().replace(/\s+/g, ' ');
        const priceTxt = (art.querySelector('.aditem-main--middle--price-shipping--price')?.textContent || '').trim();
        const priceMatch = priceTxt.replace(/\./g, '').match(/(\d+)\s*€/);
        const img = art.querySelector('img');
        const src = img?.getAttribute('src') || img?.getAttribute('data-src') || null;
        if (id && href) {
          out.push({
            platformId: id,
            url: href,
            title,
            price: priceMatch ? Number(priceMatch[1]) : null,
            thumbnail: src,
          });
        }
      });
      return out;
    });
    return cards as ListCard[];
  });
}

const FUEL_MAP_DE: Record<string, Fuel> = {
  benzin: 'petrol',
  diesel: 'diesel',
  hybrid: 'hybrid',
  elektro: 'electric',
  elektrisch: 'electric',
};

function parseGerNumber(s: string): number | null {
  const m = s.replace(/\s/g, '').replace(/\./g, '').match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

async function scrapeDetail(card: ListCard): Promise<NormalizedListing | null> {
  return withPage(async (page) => {
    try {
      await gotoSafe(page, card.url);
      await jitter(700, 1600);
      const data = await page.evaluate(() => {
        const getDetail = (label: string): string | null => {
          const items = document.querySelectorAll('#viewad-details .addetailslist--detail');
          for (const it of Array.from(items)) {
            const lbl = (it as HTMLElement).innerText || '';
            if (lbl.toLowerCase().includes(label.toLowerCase())) {
              const v = it.querySelector('.addetailslist--detail--value');
              return (v?.textContent || '').trim();
            }
          }
          return null;
        };
        const title = (document.querySelector('#viewad-title')?.textContent || '').trim();
        const priceText = (document.querySelector('#viewad-price')?.textContent || '').trim();
        const priceMatch = priceText.replace(/\./g, '').match(/(\d+)/);
        const description = (document.querySelector('#viewad-description-text')?.textContent || '').trim();
        const location = (document.querySelector('#viewad-locality')?.textContent || '').trim();
        return {
          title,
          price: priceMatch ? Number(priceMatch[1]) : null,
          description,
          location,
          km: getDetail('Kilometerstand'),
          year: getDetail('Erstzulassung'),
          fuel: getDetail('Kraftstoffart'),
          gearbox: getDetail('Getriebe'),
          bodyType: getDetail('Fahrzeugtyp'),
          power: getDetail('Leistung'),
        };
      });

      // cleanTitle auf beide Quellen anwenden: entfernt "Reserviert/Gelöscht"-Badges
      // und kollabiert Whitespace — egal ob Karten- oder Detail-Titel.
      const title = cleanTitle((card.title && card.title.trim()) || data.title);
      if (!title) return null;

      const fuelLower = (data.fuel || '').toLowerCase();
      let fuel: Fuel | null = null;
      for (const [k, v] of Object.entries(FUEL_MAP_DE)) if (fuelLower.includes(k)) fuel = v;
      const gearbox: Gearbox | null = data.gearbox
        ? data.gearbox.toLowerCase().includes('auto')
          ? 'automatic'
          : 'manual'
        : null;
      const yearMatch = (data.year || '').match(/(\d{4})/);
      const year = yearMatch ? Number(yearMatch[1]) : null;
      const km = data.km ? parseGerNumber(data.km) : null;
      const power_kw = data.power
        ? (() => {
            const m = data.power.match(/(\d+)\s*kW/);
            return m ? Number(m[1]) : null;
          })()
        : null;

      return {
        id: `kleinanzeigen:${card.platformId}`,
        source: 'kleinanzeigen',
        platformId: card.platformId,
        url: card.url,
        title,
        price: data.price ?? card.price,
        km,
        year,
        fuel,
        gearbox,
        bodyType: mapBodyType(data.bodyType),
        power_kw,
        location: data.location || null,
        description: data.description || '',
        thumbnail: card.thumbnail,
        fetchedAt: Date.now(),
      };
    } catch (e) {
      return null;
    }
  });
}

export async function scrapeKleinanzeigen(
  filters: SearchFilters,
  opts: { maxPages?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<NormalizedListing[]> {
  const maxPages = opts.maxPages ?? 2;
  const allCards: ListCard[] = [];
  for (let p = 1; p <= maxPages; p++) {
    const url = buildSearchUrl(filters, p);
    const cards = await scrapeListPage(url);
    if (cards.length === 0) break;
    allCards.push(...cards);
    await jitter(1500, 3000);
  }

  const seen = new Set<string>();
  let unique = allCards.filter((c) => (seen.has(c.platformId) ? false : (seen.add(c.platformId), true)));

  // Vorfilter auf Kartenebene (Preis steht schon in der Trefferliste) -> spart Detailaufrufe.
  unique = unique.filter((c) => {
    if (filters.priceMin != null && c.price != null && c.price < filters.priceMin) return false;
    if (filters.priceMax != null && c.price != null && c.price > filters.priceMax) return false;
    return true;
  });

  const results = await runConcurrent(unique, 2, async (card) => {
    const cached = getCachedListing('kleinanzeigen', card.platformId);
    if (cached) return cached;
    const detail = await scrapeDetail(card);
    if (detail) upsertListing(detail);
    await jitter(900, 2200);
    return detail;
  }, (done) => opts.onProgress?.(done, unique.length));

  // Endgültiges Sicherheitsnetz: Baujahr/km/Kraftstoff/Preis gegen die Filter prüfen.
  return results.filter((r): r is NormalizedListing => r != null && matchesFilters(r, filters));
}
