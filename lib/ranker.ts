import crypto from 'crypto';
import type { ListingScore, NormalizedListing } from './scrapers/types';
import { getScore, saveScore } from './db';

// Kostenloser Google-Gemini-Tarif (Google AI Studio).
// Modell per Env überschreibbar; Default ist ein Gratis-Flash-Modell.
// flash-lite hat ein höheres kostenloses Minutenlimit (~15 RPM) und ist schnell —
// für das Lesen/Bewerten von Anzeigentexten völlig ausreichend.
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

const RUBRIC = `Du bist ein erfahrener KFZ-Experte und Autohändler. Du bewertest Gebrauchtwagen-Inserate und gibst eine ehrliche Einschätzung für einen Privatkäufer.

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

interface GeminiScore {
  score: number;
  summary: string;
  pros: string[];
  cons: string[];
  red_flags: string[];
}

function hashWish(wish: string | undefined): string {
  return crypto.createHash('sha1').update((wish || '').trim()).digest('hex').slice(0, 12);
}

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY ist nicht gesetzt — bitte in .env.local eintragen');
  return key;
}

function buildUserContent(l: NormalizedListing, wish: string | undefined): string {
  return JSON.stringify(
    {
      titel: l.title,
      preis_eur: l.price,
      km_stand: l.km,
      baujahr: l.year,
      kraftstoff: l.fuel,
      getriebe: l.gearbox,
      leistung_kw: l.power_kw,
      ort: l.location,
      quelle: l.source,
      beschreibung: l.description.slice(0, 4000),
      wunsch_des_kaeufers: wish || '(kein Freitext)',
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

async function callGemini(userContent: string): Promise<GeminiScore | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey()}`;
  const body = {
    systemInstruction: { parts: [{ text: RUBRIC }] },
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
  wish: string | undefined,
): Promise<ListingScore> {
  const wishHash = hashWish(wish);
  const cached = getScore(l.id, wishHash);
  if (cached) return cached;

  const parsed = await callGemini(buildUserContent(l, wish));

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
  return hashWish(wish);
}
