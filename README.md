# CarFinder

Lokales Dashboard, das Gebrauchtwagen-Inserate auf **mobile.de** und **Kleinanzeigen.de** sowie Elektrogeräte auf **Kleinanzeigen.de** sucht und sie von einem **KI-Modell (Google Gemini, kostenloser Tarif)** lesen und bewerten lässt. Du wählst zuerst, ob du Autos oder Elektrogeräte finden möchtest, gibst passende Filter und einen Freitext-Wunsch ein („Familienauto, viel Platz, zuverlässig" oder „Laptop für Uni, guter Akku"), und die App zeigt dir die Treffer als Ranking mit Score, Zusammenfassung und Red Flags pro Anzeige.

## Setup

```bash
npm install
cp .env.example .env.local
# GEMINI_API_KEY in .env.local eintragen — kostenlos via https://aistudio.google.com/apikey
npm run dev
```

Dann <http://localhost:3000> öffnen.

`npm install` zieht beim ersten Mal über `postinstall` den Chromium-Browser für Playwright nach (~150 MB).

## Wie das funktioniert

1. Du wählst den Suchbereich und füllst Filter aus → POST an `/api/search` → ein Job wird in SQLite angelegt
2. Im Hintergrund:
   - **Playwright** (mit Stealth-Plugin, Delays, UA-Rotation) ruft die passende Kleinanzeigen-Suchseite auf, parst die Trefferkarten und holt die Detail-Pages
   - Ein Code-Filter wirft unpassende Treffer raus; bei Autos u. a. Preis/Baujahr/km/Kraftstoff, bei Elektrogeräten Preis und Zustand
   - Jede Anzeige wird normalisiert in SQLite gespeichert (Cache 24 h)
   - **Gemini** (Gratis-Tarif) liest jede Beschreibung mit einer passenden Auto- oder Elektrogeräte-Rubrik und gibt strukturiertes JSON zurück: `score 0-100`, `summary`, `pros`, `cons`, `red_flags`
3. Das Frontend pollt `/api/jobs/:id` alle 2 s und zeigt Live-Fortschritt + Ergebnisse sortiert nach Score

## Tech-Stack

- Next.js 14 App Router (TypeScript)
- Playwright + `playwright-extra` + Stealth-Plugin
- Google Gemini REST-API (kostenloser Tarif, kein SDK nötig)
- `node:sqlite` (in Node 22+/24 eingebaut) für Cache & Job-State

## Wichtig zum Scraping

Kleinanzeigen.de und mobile.de verbieten Scraping in ihren AGB und haben Bot-Schutz. Diese App ist für **persönliche, lokale Nutzung in kleinem Umfang** gedacht — sie wartet bewusst zwischen Requests und nutzt Caching, um sich defensiv zu verhalten.

**mobile.de ist standardmäßig deaktiviert:** dessen Cloudflare-Schutz blockt headless-Browser zuverlässig, das kostet nur Zeit und erzeugt Fehlermeldungen. Aktivierbar mit `ENABLE_MOBILE_DE=1` in `.env.local` (funktioniert dann praktisch nur mit einem Proxy zuverlässig). Standardquelle ist **Kleinanzeigen.de**, das sauber durchläuft.

## Projektstruktur

```
app/                Next.js App Router (page + API routes)
components/         React-UI (FilterForm, ResultCard, ScoreBadge)
lib/
  db.ts             SQLite-Layer (jobs, listings, scores)
  jobs.ts           Job-Orchestrierung (Scrape → Rank)
  ranker.ts         Claude-Aufruf mit Prompt-Caching
  scrapers/
    browser.ts      Playwright-Singleton + Helpers
    mobile.ts       mobile.de
    kleinanzeigen.ts
    types.ts        Geteilte Typen
data/               SQLite-Datei (wird automatisch angelegt)
```

## Kosten & Limits

Die Bewertung läuft über den **kostenlosen** Gemini-Tarif. Der hat ein Minutenlimit (Free Tier, je nach Modell ~15 Anfragen/Minute) und ein Tageslimit — die App rankt deshalb mit Concurrency 2 und wiederholt bei Rate-Limit (HTTP 429) automatisch mit Backoff. Für die Suchgrößen hier reicht das locker; bei sehr vielen Treffern dauert das Ranking entsprechend länger.

## Erweiterungen für später

- Benachrichtigung bei neuen Treffern (Watcher-Cron)
- Bilder vom Inserat per Vision-Modell prüfen
- Schwacke/DAT-Marktwert für Plausibilitäts-Check
