import type { Page } from 'playwright';
import { withPage, jitter, runConcurrent, detectBlock } from './browser';
import { getCachedListing, upsertListing } from '../db';
import type { Fuel, Gearbox, NormalizedListing, SearchFilters } from './types';

const BASE = 'https://suchen.mobile.de/fahrzeuge/search.html';

function buildSearchUrl(f: SearchFilters, page: number): string {
  const p = new URLSearchParams();
  p.set('isSearchRequest', 'true');
  p.set('damageUnrepaired', 'NO_DAMAGE_UNREPAIRED');
  p.set('vehicleCategory', 'Car');
  if (f.make) p.set('makeModelVariant1.makeId', f.make);
  if (f.model) p.set('makeModelVariant1.model', f.model);
  if (f.priceMin) p.set('minPrice', String(f.priceMin));
  if (f.priceMax) p.set('maxPrice', String(f.priceMax));
  if (f.yearMin) p.set('minFirstRegistrationDate', String(f.yearMin));
  if (f.yearMax) p.set('maxFirstRegistrationDate', String(f.yearMax));
  if (f.kmMax) p.set('maxMileage', String(f.kmMax));
  if (f.fuels && f.fuels.length) {
    const map: Record<Fuel, string> = {
      petrol: 'PETROL',
      diesel: 'DIESEL',
      hybrid: 'HYBRID',
      electric: 'ELECTRICITY',
      other: 'OTHER',
    };
    for (const fuel of f.fuels) p.append('fuels', map[fuel]);
  }
  if (f.gearbox && f.gearbox !== 'any') {
    p.set('transmission', f.gearbox === 'automatic' ? 'AUTOMATIC_GEAR' : 'MANUAL_GEAR');
  }
  if (f.zip) p.set('zipcode', f.zip);
  if (f.radiusKm) p.set('zipcodeRadius', String(f.radiusKm));
  if (page > 1) p.set('pageNumber', String(page));
  p.set('sortOption.sortBy', 'price');
  p.set('sortOption.sortOrder', 'ASCENDING');
  return `${BASE}?${p.toString()}`;
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
  if (block) throw new Error(`mobile.de blocked: ${block}`);
}

async function scrapeListPage(url: string): Promise<ListCard[]> {
  return withPage(async (page) => {
    await gotoSafe(page, url);
    await jitter(800, 1800);
    const cards = await page.evaluate(() => {
      const out: any[] = [];
      const items = document.querySelectorAll(
        'a[data-testid^="result-listing-"], article a[href*="/fahrzeuge/details.html"]',
      );
      const seen = new Set<string>();
      items.forEach((a) => {
        const href = (a as HTMLAnchorElement).href || '';
        const m = href.match(/details\.html\?id=(\d+)/);
        if (!m || seen.has(m[1])) return;
        seen.add(m[1]);
        const root = (a.closest('article') || a) as HTMLElement;
        const titleEl = root.querySelector('[data-testid="vehicle-title"], h2, h3');
        const priceEl = root.querySelector('[data-testid="price-label"], .price-block, [class*="price"]');
        const imgEl = root.querySelector('img');
        const priceTxt = priceEl?.textContent || '';
        const priceMatch = priceTxt.replace(/\./g, '').match(/(\d+)\s*€/);
        out.push({
          platformId: m[1],
          url: href.split('#')[0],
          title: (titleEl?.textContent || '').trim().replace(/\s+/g, ' '),
          price: priceMatch ? Number(priceMatch[1]) : null,
          thumbnail: imgEl?.getAttribute('src') || null,
        });
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
        const text = (sel: string) => (document.querySelector(sel)?.textContent || '').trim();
        const get = (label: string): string | null => {
          const dts = document.querySelectorAll('dt, [data-testid$="-label"], th');
          for (const dt of Array.from(dts)) {
            if ((dt.textContent || '').trim().toLowerCase().includes(label.toLowerCase())) {
              const next = dt.nextElementSibling;
              if (next) return (next.textContent || '').trim();
            }
          }
          return null;
        };
        const descEl =
          document.querySelector('[data-testid="vehicle-description"]') ||
          document.querySelector('.description') ||
          document.querySelector('section[id*="description"]');
        const description = (descEl?.textContent || '').trim();
        const title =
          text('h1') ||
          text('[data-testid="ad-title"]');
        const price = (() => {
          const t = text('[data-testid="price-label"]') || text('[class*="price"]');
          const m = t.replace(/\./g, '').match(/(\d+)\s*€/);
          return m ? Number(m[1]) : null;
        })();
        const location = text('[data-testid="seller-address"]') || text('[class*="seller"][class*="address"]');
        return {
          title,
          price,
          description,
          location,
          km: get('Kilometerstand') || get('km-Stand'),
          year: get('Erstzulassung'),
          fuel: get('Kraftstoff'),
          gearbox: get('Getriebe'),
          power: get('Leistung'),
        };
      });

      if (!data.title) return null;

      const fuelLower = (data.fuel || '').toLowerCase();
      let fuel: Fuel | null = null;
      for (const [k, v] of Object.entries(FUEL_MAP_DE)) if (fuelLower.includes(k)) fuel = v;
      const gearbox: Gearbox | null = data.gearbox
        ? data.gearbox.toLowerCase().includes('auto')
          ? 'automatic'
          : 'manual'
        : null;
      const yearMatch = (data.year || '').match(/(\d{2})\/(\d{4})/) || (data.year || '').match(/(\d{4})/);
      const year = yearMatch ? Number(yearMatch[yearMatch.length - 1]) : null;
      const km = data.km ? parseGerNumber(data.km) : null;
      const power_kw = data.power
        ? (() => {
            const m = data.power.match(/(\d+)\s*kW/);
            return m ? Number(m[1]) : null;
          })()
        : null;

      return {
        id: `mobile:${card.platformId}`,
        source: 'mobile',
        platformId: card.platformId,
        url: card.url,
        title: data.title,
        price: data.price ?? card.price,
        km,
        year,
        fuel,
        gearbox,
        bodyType: null,
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

export async function scrapeMobileDe(
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

  // De-dupe
  const seen = new Set<string>();
  const unique = allCards.filter((c) => (seen.has(c.platformId) ? false : (seen.add(c.platformId), true)));

  const results = await runConcurrent(unique, 2, async (card) => {
    const cached = getCachedListing('mobile', card.platformId);
    if (cached) return cached;
    const detail = await scrapeDetail(card);
    if (detail) upsertListing(detail);
    await jitter(900, 2200);
    return detail;
  }, (done) => opts.onProgress?.(done, unique.length));

  return results.filter((r): r is NormalizedListing => r != null);
}
