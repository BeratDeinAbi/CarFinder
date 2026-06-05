import crypto from 'crypto';
import { electronicsCategoryLabel } from './electronicsData';
import { clothingCategoryLabel, clothingFitLabel, clothingSizeLabel } from './clothingData';
import type { ListingScore, NormalizedListing, SearchDomain, SearchFilters } from './scrapers/types';
import { getScore, saveScore } from './db';

// Kostenloser Google-Gemini-Tarif (Google AI Studio).
// Modell per Env überschreibbar; Default ist ein Gratis-Flash-Modell.
// flash-lite hat ein höheres kostenloses Minutenlimit (~15 RPM) und ist schnell —
// für das Lesen/Bewerten von Anzeigentexten völlig ausreichend.
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

const CAR_RUBRIC = `Du bist ein erfahrener KFZ-Experte und Autohändler. Du bewertest Gebrauchtwagen-Inserate und gibst eine ehrliche Einschätzung für einen Privatkäufer.

# Bewertungskriterien (Score 0-100)

**Plausibilität (bis 25 Pkt):** Passen Preis, km-Stand, Baujahr und Leistung zusammen? Ein zu niedriger Preis ist verdächtig. Hohe Laufleistung pro Jahr (>20.000 km) bei Diesel ist okay, bei Benziner eher kritisch.

**Zustand laut Beschreibung (bis 25 Pkt):** Wird konkret beschrieben? Werden Schäden, Mängel, Reparaturen erwähnt? Service-Historie? "Scheckheftgepflegt", "1. Hand", "Nichtraucher" sind positiv. "Bastlerfahrzeug", "Motorschaden", "läuft nicht", "ohne TÜV" sind klare Minuspunkte.

**Ausstattung (bis 20 Pkt):** Werden Komfort/Sicherheits-Features genannt (Klima, Navi, Tempomat, AHK, Spurhalte, etc.)? Mehr Ausstattung = höher.

**Verkäufer-Signale (bis 15 Pkt):** Privat oder Händler? Garantie? Probefahrt möglich? Bilder-Anzahl? Sehr kurze, generische Beschreibung ist verdächtig.

**Passung zum Wunsch des Käufers (bis 15 Pkt):** Wie gut passt das Inserat zum Freitext-Wunsch des Käufers? Wenn er "Familienauto mit viel Platz" sucht, ist ein Kombi/SUV besser als ein Coupé.

# Red Flags (immer auflisten, falls gefunden)

- "Bastler", "zum Schlachten", "Motorschaden", "Getriebeschaden"
- "Export", "nur Export", auffälliges Drängen
- "Privatverkauf, keine Garantie, keine Rücknahme" als alleinige Info
- Unfallwagen, nicht repariert
- Sehr kurze Beschreibung (<100 Zeichen) bei höherwertigem Auto
- Preis deutlich unter Marktniveau ohne Erklärung
- Keine TÜV/HU mehr
- "Ohne Papiere"

Antworte auf Deutsch. Maximal 4 Einträge pro Liste (pros, cons, red_flags); die Listen dürfen leer sein.`;

const ELECTRONICS_RUBRIC = `Du bist ein erfahrener Gebraucht-Elektronik-Experte. Du bewertest Inserate für Handys, Monitore, Laptops und PCs und gibst eine ehrliche Einschätzung für einen Privatkäufer.

# Bewertungskriterien (Score 0-100)

**Preis-Leistung (bis 25 Pkt):** Passt der Preis zu Alter, Marke, Modell, Ausstattung und Zustand? Ein deutlich zu niedriger Preis ist verdächtig, ein sehr hoher Preis muss durch Garantie, Zubehör oder Top-Zustand erklärbar sein.

**Zustand & Funktionsfähigkeit (bis 25 Pkt):** Werden Zustand, Mängel, Akkuzustand, Display, Anschlüsse, Tastatur, Lüfter, Pixelfehler, Gehäuse und Tests konkret beschrieben? "voll funktionsfähig", "Rechnung", "OVP" und "kann getestet werden" sind positiv.

**Technische Daten (bis 20 Pkt):** Sind bei Laptops/PCs CPU, RAM, SSD, GPU, Displaygröße und Betriebssystem klar genannt? Bei Handys Speicher, Akkuzustand, Display/Face ID/Kamera. Bei Monitoren Auflösung, Zoll, Hz, Panel, Anschlüsse und Pixelfehler.

**Verkäufer-Signale (bis 15 Pkt):** Seriöse Beschreibung, echte Fotos, Abholung/Test möglich, Garantie/Rechnung, klare Kommunikation. Kurze generische Texte, Versanddruck oder ausweichende Angaben sind kritisch.

**Passung zum Wunsch des Käufers (bis 15 Pkt):** Wie gut passt das Inserat zum Freitext-Wunsch? Gaming, Office, Uni, Bildbearbeitung, Homeoffice oder günstiger Alltag haben unterschiedliche Prioritäten.

# Red Flags (immer auflisten, falls gefunden)

- "defekt", "für Bastler", "Ersatzteile", "Displaybruch", "Wasserschaden"
- iCloud-/Google-/BIOS-Sperre, "Passwort vergessen", keine Entsperrung möglich
- Akku stark verschlissen, aufgebläht oder nicht genannt bei teuren Geräten
- Keine technischen Daten bei Laptop/PC/Monitor
- Preis deutlich unter Marktniveau ohne Erklärung
- Nur Versand, kein Test, ungewöhnlicher Zahlungsdruck
- Keine Rechnung/Seriennummer bei sehr teurer oder neuer Ware

Antworte auf Deutsch. Maximal 4 Einträge pro Liste (pros, cons, red_flags); die Listen dürfen leer sein.`;

const CLOTHING_RUBRIC = `Du bist ein erfahrener Second-Hand-Mode-Experte. Du bewertest Inserate für Kleidung (Pullover, Jacken, Hosen) und gibst eine ehrliche Einschätzung für einen Privatkäufer.

# Bewertungskriterien (Score 0-100)

**Preis-Leistung (bis 25 Pkt):** Passt der Preis zu Marke, Modell, Material und Zustand? Markenkleidung in gutem Zustand zu fairem Preis ist top. Ein sehr niedriger Preis bei teurer Marke kann auf Fälschung oder Mängel hindeuten.

**Zustand (bis 25 Pkt):** Werden Tragezustand, Flecken, Löcher, Pilling, defekte Reißverschlüsse/Knöpfe, Abnutzung oder Waschverhalten konkret beschrieben? "neuwertig", "nur einmal getragen", "ungetragen mit Etikett", "OVP" sind positiv. "stark getragen", "Loch", "Fleck", "Defekt" sind Minuspunkte.

**Angaben zu Größe & Passform (bis 20 Pkt):** Sind Größe (z.B. M, L, XL bzw. Bundweite/Länge bei Hosen) und Schnitt (eng/slim oder weit/oversize) klar genannt? Maße in cm sind ein Plus. Fehlende Größenangaben sind kritisch.

**Verkäufer-Signale (bis 15 Pkt):** Echte Fotos vom tatsächlichen Stück, klare Beschreibung, Material-/Pflegehinweise, Versand oder Abholung möglich. Generische Stockfotos oder sehr kurze Texte sind kritisch.

**Passung zum Wunsch des Käufers (bis 15 Pkt):** Wie gut passt das Inserat zum Freitext-Wunsch (Stil, Marke, Größe, Schnitt, Anlass)?

# Red Flags (immer auflisten, falls gefunden)

- "Loch", "Fleck", "defekt", "kaputt", "Reißverschluss defekt"
- Verdacht auf Fälschung / "Replika" / Markenware deutlich zu billig
- Keine Größenangabe bei Kleidung
- Nur Stockfotos statt echter Bilder
- Starke Abnutzung, "Pilling", verwaschen, ausgeleiert
- Nur Versand, kein Rückgaberecht bei teurer Ware

Antworte auf Deutsch. Maximal 4 Einträge pro Liste (pros, cons, red_flags); die Listen dürfen leer sein.`;

interface GeminiScore {
  score: number;
  summary: string;
  pros: string[];
  cons: string[];
  red_flags: string[];
}

function hashWish(wish: string | undefined, domain: SearchDomain | undefined): string {
  return crypto.createHash('sha1').update(`${domain ?? 'cars'}:${(wish || '').trim()}`).digest('hex').slice(0, 12);
}

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY ist nicht gesetzt — bitte in .env.local eintragen');
  return key;
}

function buildUserContent(l: NormalizedListing, filters: SearchFilters): string {
  const base = {
    titel: l.title,
    preis_eur: l.price,
    ort: l.location,
    quelle: l.source,
    beschreibung: l.description.slice(0, 4000),
    wunsch_des_kaeufers: filters.wish || '(kein Freitext)',
  };

  if (l.domain === 'electronics') {
    return JSON.stringify(
      {
        ...base,
        produktbereich: electronicsCategoryLabel(l.category ?? filters.category),
        gesuchte_marke: filters.make,
        gesuchtes_modell_oder_keyword: filters.keyword || filters.model,
        zustand: l.condition || filters.condition,
      },
      null,
      2,
    );
  }

  if (l.domain === 'clothing') {
    return JSON.stringify(
      {
        ...base,
        kleidungsstueck: clothingCategoryLabel(l.clothingCategory ?? filters.clothingCategory),
        gesuchte_marke: filters.make,
        gesuchter_begriff: filters.keyword || filters.model,
        gesuchter_schnitt: clothingFitLabel(filters.clothingFit) ?? '(egal)',
        gesuchte_groesse: clothingSizeLabel(filters.clothingSize) ?? '(egal)',
        erkannter_schnitt: clothingFitLabel(l.clothingFit),
        erkannte_groesse: clothingSizeLabel(l.clothingSize),
      },
      null,
      2,
    );
  }

  return JSON.stringify(
    {
      ...base,
      km_stand: l.km,
      baujahr: l.year,
      kraftstoff: l.fuel,
      getriebe: l.gearbox,
      karosserie: l.bodyType,
      leistung_kw: l.power_kw,
    },
    null,
    2,
  );
}

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    score: { type: 'INTEGER' },
    summary: { type: 'STRING' },
    pros: { type: 'ARRAY', items: { type: 'STRING' } },
    cons: { type: 'ARRAY', items: { type: 'STRING' } },
    red_flags: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['score', 'summary', 'pros', 'cons', 'red_flags'],
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callGemini(userContent: string, rubric: string): Promise<GeminiScore | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey()}`;
  const body = {
    systemInstruction: { parts: [{ text: rubric }] },
    contents: [{ role: 'user', parts: [{ text: userContent }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1200,
      // 2.5-Flash ist ein "Thinking"-Modell; Thinking aus, damit das Token-Budget
      // komplett für die JSON-Antwort bleibt (sonst wird die Antwort abgeschnitten).
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  };

  // Gratis-Tarif hat ein Minutenlimit. Bei 429/503 wartet wir die von Google
  // angegebene Zeit (retryDelay) und versuchen es erneut. Nach Erschöpfung geben wir
  // null zurück (-> neutraler Score), damit die Anzeige trotzdem erscheint und der
  // ganze Job nicht hängen bleibt.
  const maxAttempts = 6;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.status === 429 || res.status === 503) {
      const txt = await res.text().catch(() => '');
      // Tageslimit (PerDay) erschöpft → Warten bringt nichts (Reset erst am nächsten Tag).
      // Sofort aufgeben, damit der Job nicht minutenlang hängt; Anzeige bekommt neutralen Score.
      if (/PerDay|generate_requests_per_day|FreeTier/i.test(txt) && /PerDay/i.test(txt)) {
        return null;
      }
      if (attempt === maxAttempts) return null;
      // "retryDelay":"42s"  oder  "Please retry in 42.9s."
      const m = txt.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/) || txt.match(/retry in (\d+(?:\.\d+)?)s/i);
      const serverWait = m ? Math.ceil(Number(m[1]) * 1000) : 0;
      const backoff = Math.min(Math.max(serverWait, attempt * 4000), 65000) + Math.random() * 1000;
      await sleep(backoff);
      continue;
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Gemini HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }

    const json: any = await res.json();
    const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    try {
      const obj = JSON.parse(text);
      return {
        score: Math.max(0, Math.min(100, Number(obj.score) || 0)),
        summary: String(obj.summary || ''),
        pros: Array.isArray(obj.pros) ? obj.pros.map(String).slice(0, 4) : [],
        cons: Array.isArray(obj.cons) ? obj.cons.map(String).slice(0, 4) : [],
        red_flags: Array.isArray(obj.red_flags) ? obj.red_flags.map(String).slice(0, 4) : [],
      };
    } catch {
      return null;
    }
  }
  return null;
}

export async function rankListing(
  l: NormalizedListing,
  filters: SearchFilters,
): Promise<ListingScore> {
  const wishHash = hashWish(filters.wish, l.domain);
  const cached = getScore(l.id, wishHash);
  if (cached) return cached;

  const rubric =
    l.domain === 'electronics' ? ELECTRONICS_RUBRIC : l.domain === 'clothing' ? CLOTHING_RUBRIC : CAR_RUBRIC;
  const parsed = await callGemini(buildUserContent(l, filters), rubric);

  const score: ListingScore = parsed
    ? {
        listingId: l.id,
        score: parsed.score,
        summary: parsed.summary,
        pros: parsed.pros,
        cons: parsed.cons,
        redFlags: parsed.red_flags,
      }
    : {
        listingId: l.id,
        score: 50,
        summary: 'Bewertung fehlgeschlagen — neutraler Score gesetzt.',
        pros: [],
        cons: [],
        redFlags: [],
      };

  saveScore(score, wishHash);
  return score;
}

export function getWishHash(wish: string | undefined): string {
  return hashWish(wish, 'cars');
}

export function getFiltersHash(filters: SearchFilters): string {
  return hashWish(filters.wish, filters.domain);
}
