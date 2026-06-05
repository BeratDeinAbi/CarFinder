import type { Page } from 'playwright';
import { withPage, jitter, runConcurrent, detectBlock } from './browser';
import { getCachedListing, upsertListing } from '../db';
import type { BodyType, ClothingCategory, ClothingFit, ClothingSize, ElectronicsCategory, ElectronicsCondition, Fuel, Gearbox, NormalizedListing, SearchFilters } from './types';

const BASE = 'https://www.kleinanzeigen.de';
const ELECTRONICS_CATEGORY_CONFIG: Record<ElectronicsCategory, { path: string; code: string; fallbackKeyword: string }> = {
  phone: { path: 's-handy-telefon', code: 'c173', fallbackKeyword: 'handy' },
  monitor: { path: 's-pc-zubehoer-software', code: 'c225', fallbackKeyword: 'monitor' },
  laptop: { path: 's-notebooks', code: 'c278', fallbackKeyword: 'laptop' },
  pc: { path: 's-pcs', code: 'c228', fallbackKeyword: 'pc' },
};

// Klamotten: Kleinanzeigen führt Mode unter "Bekleidung" (c153). Die Kategorie
// (Pullover/Jacke/Hose) wird als Keyword in den Slug gepackt; Schnitt/Größe
// filtern wir nach dem Scrapen aus Titel/Beschreibung.
const CLOTHING_CONFIG = { path: 's-bekleidung', code: 'c153' };
const CLOTHING_CATEGORY_KEYWORD: Record<ClothingCategory, string> = {
  sweater: 'pullover',
  jacket: 'jacke',
  pants: 'hose',
};

function slugify(parts: Array<string | undefined>): string {
  return parts
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Kleinanzeigen filtert den Umkreis NICHT über die PLZ im Pfad (l<plz>r<km> wird
// ignoriert), sondern über ?locationId=<interne-ID>&radius=<km>. Die interne ID
// liefert die Orts-Autocomplete-API. Wir lösen die PLZ einmal auf und cachen sie.
const _locIdCache = new Map<string, string | null>();

async function resolveLocationId(zip: string): Promise<string | null> {
  const key = zip.trim();
  if (!key) return null;
  if (_locIdCache.has(key)) return _locIdCache.get(key)!;

  const id = await withPage(async (page) => {
    try {
      const resp = await page.goto(
        `${BASE}/s-ort-empfehlungen.json?query=${encodeURIComponent(key)}`,
        { waitUntil: 'domcontentloaded', timeout: 15000 },
      );
      if (!resp || !resp.ok()) return null;
      const json = (await resp.json()) as Record<string, string>;
      // Antwort z.B. {"_0":"Deutschland","_9668":"10115 Mitte","_3504":"10115 Wedding"}
      // Wir nehmen den ersten Eintrag, dessen Schlüssel-ID != 0 ist (echter Ort).
      for (const rawKey of Object.keys(json)) {
        const idPart = rawKey.replace(/^_/, '');
        if (idPart && idPart !== '0') return idPart;
      }
      return null;
    } catch {
      return null;
    }
  });

  _locIdCache.set(key, id);
  return id;
}

// Kleinanzeigen erwartet Filter als PFAD-Segmente, nicht als Query-Parameter.
// Nur der Preis ist als Pfad-Segment zuverlässig: /s-autos/preis:MIN:MAX/<keyword>/k0c216
// Baujahr/km/Kraftstoff werden NICHT in die URL gepackt (die +autos.*-Segmente sind
// unzuverlässig und können die Suche auf 0 Treffer brechen) — das erledigt der
// Code-Filter matchesFilters() nach dem Scrapen.
// Hängt den Umkreis-Filter als Query-Parameter an (?locationId=..&radius=..).
// Nur so filtert Kleinanzeigen wirklich nach Standort (das l<plz>r<km> im Pfad
// wird ignoriert). locationId wird vorab via resolveLocationId() aufgelöst.
function withLocationQuery(url: string, locationId: string | null, radiusKm?: number): string {
  if (!locationId) return url;
  const params = new URLSearchParams();
  params.set('locationId', locationId);
  if (radiusKm) params.set('radius', String(radiusKm));
  return `${url}?${params.toString()}`;
}

function buildCarSearchUrl(f: SearchFilters, page: number, locationId: string | null): string {
  const slug = slugify([f.make, f.model]);
  const priceSeg = f.priceMin || f.priceMax ? `/preis:${f.priceMin ?? ''}:${f.priceMax ?? ''}` : '';
  const pageSeg = page > 1 ? `/seite:${page}` : '';

  const base = slug
    ? `${BASE}/s-autos${priceSeg}/${slug}${pageSeg}/k0c216`
    : `${BASE}/s-autos${priceSeg}${pageSeg}/c216`;
  return withLocationQuery(base, locationId, f.radiusKm);
}

function buildElectronicsSearchUrl(f: SearchFilters, page: number, locationId: string | null): string {
  const category = f.category ?? 'phone';
  const config = ELECTRONICS_CATEGORY_CONFIG[category];
  const slug = slugify([f.make, f.keyword || f.model || config.fallbackKeyword]);
  const priceSeg = f.priceMin || f.priceMax ? `/preis:${f.priceMin ?? ''}:${f.priceMax ?? ''}` : '';
  const pageSeg = page > 1 ? `/seite:${page}` : '';

  const base = slug
    ? `${BASE}/${config.path}${priceSeg}/${slug}${pageSeg}/k0${config.code}`
    : `${BASE}/${config.path}${priceSeg}${pageSeg}/${config.code}`;
  return withLocationQuery(base, locationId, f.radiusKm);
}

function buildClothingSearchUrl(f: SearchFilters, page: number, locationId: string | null): string {
  const category = f.clothingCategory ?? 'sweater';
  const categoryWord = CLOTHING_CATEGORY_KEYWORD[category];
  // Schnitt (nur Hose) und Größe (nur Pullover/Jacke) als zusätzliche Suchbegriffe,
  // damit Kleinanzeigen schon vorfiltert. Das harte Filtern macht matchesFilters().
  const fitWord = f.clothingFit && f.clothingFit !== 'any' ? (f.clothingFit === 'slim' ? 'eng' : 'weit') : undefined;
  const sizeWord = f.clothingSize && f.clothingSize !== 'any' ? f.clothingSize : undefined;
  const slug = slugify([f.make, categoryWord, f.keyword || f.model, fitWord, sizeWord]);
  const priceSeg = f.priceMin || f.priceMax ? `/preis:${f.priceMin ?? ''}:${f.priceMax ?? ''}` : '';
  const pageSeg = page > 1 ? `/seite:${page}` : '';

  const base = slug
    ? `${BASE}/${CLOTHING_CONFIG.path}${priceSeg}/${slug}${pageSeg}/k0${CLOTHING_CONFIG.code}`
    : `${BASE}/${CLOTHING_CONFIG.path}${priceSeg}${pageSeg}/${CLOTHING_CONFIG.code}`;
  return withLocationQuery(base, locationId, f.radiusKm);
}

function buildSearchUrl(f: SearchFilters, page: number, locationId: string | null): string {
  if (f.domain === 'electronics') return buildElectronicsSearchUrl(f, page, locationId);
  if (f.domain === 'clothing') return buildClothingSearchUrl(f, page, locationId);
  return buildCarSearchUrl(f, page, locationId);
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

function mapCondition(raw: string | null): ElectronicsCondition | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes('defekt') || s.includes('ersatzteil')) return 'defective';
  if (s.includes('wie neu') || s.includes('sehr gut')) return 'like_new';
  if (s.includes('neu')) return 'new';
  if (s.includes('gut')) return 'good';
  if (s.includes('gebraucht') || s.includes('in ordnung')) return 'used';
  return null;
}

// Schnitt (breit/eng) aus dem Anzeigentext ableiten. Nur relevant für Hosen.
function mapClothingFit(text: string): ClothingFit | null {
  const s = text.toLowerCase();
  if (/\b(slim|skinny|eng|tight|röhre|roehre|figurbetont|schmal)\b/.test(s)) return 'slim';
  if (/\b(weit|breit|wide|baggy|loose|relaxed|bootcut|oversize|oversized|straight|locker)\b/.test(s)) return 'wide';
  return null;
}

// Konfektionsgröße (XS–XXL) aus dem Anzeigentext ableiten. Für Pullover/Jacken.
function mapClothingSize(text: string): ClothingSize | null {
  const s = text.toUpperCase();
  // Längste Schreibweisen zuerst prüfen, damit "XXL" nicht als "XL"/"L" greift.
  if (/\b(XXL|2XL)\b/.test(s) || /GR(?:ÖSSE|OESSE|\.)?\s*XXL/.test(s)) return 'XXL';
  if (/\bXL\b/.test(s) || /GR(?:ÖSSE|OESSE|\.)?\s*XL/.test(s)) return 'XL';
  if (/\bXS\b/.test(s) || /GR(?:ÖSSE|OESSE|\.)?\s*XS/.test(s)) return 'XS';
  if (/\bL\b/.test(s) || /GR(?:ÖSSE|OESSE|\.)?\s*L\b/.test(s)) return 'L';
  if (/\bM\b/.test(s) || /GR(?:ÖSSE|OESSE|\.)?\s*M\b/.test(s)) return 'M';
  if (/\bS\b/.test(s) || /GR(?:ÖSSE|OESSE|\.)?\s*S\b/.test(s)) return 'S';
  return null;
}

// Sicherheitsnetz: nur Anzeigen behalten, die wirklich zu den Filtern passen.
function matchesFilters(l: NormalizedListing, f: SearchFilters): boolean {
  if (f.priceMin != null && l.price != null && l.price < f.priceMin) return false;
  if (f.priceMax != null && l.price != null && l.price > f.priceMax) return false;
  if (f.domain === 'electronics') {
    if (f.condition && f.condition !== 'any' && l.condition && l.condition !== f.condition) return false;
    return true;
  }
  if (f.domain === 'clothing') {
    // Nur filtern, wenn das Inserat einen Wert hergibt (sonst durchlassen — wie bei Karosserie).
    if (f.clothingFit && f.clothingFit !== 'any' && l.clothingFit && l.clothingFit !== f.clothingFit) return false;
    if (f.clothingSize && f.clothingSize !== 'any' && l.clothingSize && l.clothingSize !== f.clothingSize) return false;
    return true;
  }
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

async function scrapeDetail(card: ListCard, filters: SearchFilters): Promise<NormalizedListing | null> {
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
          condition: getDetail('Zustand'),
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
      const domain = filters.domain ?? 'cars';
      const clothingText = domain === 'clothing' ? `${title} ${data.description || ''}` : '';

      return {
        id: `kleinanzeigen:${card.platformId}`,
        source: 'kleinanzeigen',
        domain,
        platformId: card.platformId,
        url: card.url,
        title,
        price: data.price ?? card.price,
        km,
        year,
        fuel,
        gearbox,
        bodyType: domain === 'cars' ? mapBodyType(data.bodyType) : null,
        power_kw: domain === 'cars' ? power_kw : null,
        category: domain === 'electronics' ? filters.category ?? 'phone' : null,
        condition: domain === 'electronics' ? mapCondition(data.condition) : null,
        clothingCategory: domain === 'clothing' ? filters.clothingCategory ?? 'sweater' : null,
        clothingFit: domain === 'clothing' ? mapClothingFit(clothingText) : null,
        clothingSize: domain === 'clothing' ? mapClothingSize(clothingText) : null,
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
  // PLZ einmal in die interne location-ID auflösen (für den Umkreisfilter).
  const locationId = filters.zip ? await resolveLocationId(filters.zip) : null;
  const allCards: ListCard[] = [];
  for (let p = 1; p <= maxPages; p++) {
    const url = buildSearchUrl(filters, p, locationId);
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
    if (cached && (filters.domain ?? 'cars') === cached.domain) return cached;
    const normalized = await scrapeDetail(card, filters);
    if (normalized) upsertListing(normalized);
    await jitter(900, 2200);
    return normalized;
  }, (done) => opts.onProgress?.(done, unique.length));

  // Endgültiges Sicherheitsnetz: Baujahr/km/Kraftstoff/Preis gegen die Filter prüfen.
  return results.filter((r): r is NormalizedListing => r != null && matchesFilters(r, filters));
}
