import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';

chromium.use(StealthPlugin());

// Robuste Browser-Pfad-Auflösung.
// Next.js/Webpack-Bundling kann Playwrights eingebaute Auto-Erkennung des
// installierten Browsers brechen ("Executable doesn't exist at ...chrome-headless-shell.exe").
// Wir suchen die ausführbare Datei deshalb selbst im ms-playwright-Ordner und geben
// sie per executablePath explizit vor.
//
// WICHTIG: chrome-headless-shell ZUERST. Auf manchen Windows-Systemen scheitert die
// volle chrome.exe beim Start mit "spawn UNKNOWN" (Antivirus/Berechtigungen/Sonderzeichen
// im Pfad), während die schlanke headless-shell zuverlässig läuft. Da wir ohnehin
// headless arbeiten, ist die shell die beste Wahl; chrome.exe nur als Fallback.
let _execPathCache: string | null | undefined;

function findBrowserExecutable(): string | null {
  if (_execPathCache !== undefined) return _execPathCache;

  const candidates: string[] = [];
  const local = process.env.LOCALAPPDATA;
  const home = process.env.USERPROFILE || process.env.HOME;
  const roots = [
    // Projekt-lokaler Browser-Ordner ZUERST (reiner ASCII-Pfad, kein "ö" o.ä.).
    // Umgeht den Windows-Bug, dass Playwright Browser unter Pfaden mit Sonderzeichen
    // im Benutzernamen (z.B. C:\Users\Berat Bogazköy\...) nicht startet.
    path.join(process.cwd(), 'browsers'),
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    local ? path.join(local, 'ms-playwright') : null,
    home ? path.join(home, 'AppData', 'Local', 'ms-playwright') : null,
    home ? path.join(home, '.cache', 'ms-playwright') : null,
  ].filter((x): x is string => !!x);

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    let dirs: string[] = [];
    try {
      dirs = fs.readdirSync(root);
    } catch {
      continue;
    }
    const shellDirs = dirs.filter((d) => /^chromium_headless_shell-\d+$/.test(d)).sort().reverse();
    const fullDirs = dirs.filter((d) => /^chromium-\d+$/.test(d)).sort().reverse();
    // headless-shell zuerst (zuverlässiger), volle chrome.exe als Fallback.
    for (const d of shellDirs) {
      candidates.push(path.join(root, d, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'));
      candidates.push(path.join(root, d, 'chrome-headless-shell-linux', 'chrome-headless-shell'));
    }
    for (const d of fullDirs) {
      candidates.push(path.join(root, d, 'chrome-win64', 'chrome.exe'));
      candidates.push(path.join(root, d, 'chrome-linux', 'chrome'));
      candidates.push(path.join(root, d, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'));
    }
  }

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      _execPathCache = c;
      return c;
    }
  }
  _execPathCache = null;
  return null;
}

const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
];

let _browser: Browser | null = null;
let _context: BrowserContext | null = null;
let _refCount = 0;

async function ensureBrowser(): Promise<{ browser: Browser; context: BrowserContext }> {
  if (_browser && _context) return { browser: _browser, context: _context };
  const executablePath = findBrowserExecutable() ?? undefined;
  _browser = (await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  })) as unknown as Browser;
  _context = await _browser.newContext({
    userAgent: UA_POOL[Math.floor(Math.random() * UA_POOL.length)],
    viewport: { width: 1366, height: 900 },
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    extraHTTPHeaders: {
      'accept-language': 'de-DE,de;q=0.9,en;q=0.5',
    },
  });
  return { browser: _browser, context: _context };
}

export async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  _refCount++;
  const { context } = await ensureBrowser();
  const page = await context.newPage();
  try {
    return await fn(page);
  } finally {
    await page.close().catch(() => {});
    _refCount--;
    if (_refCount === 0) {
      // Keep browser warm for a few seconds in case more work arrives
      setTimeout(() => {
        if (_refCount === 0) closeBrowser().catch(() => {});
      }, 5000);
    }
  }
}

export async function closeBrowser(): Promise<void> {
  if (_context) {
    await _context.close().catch(() => {});
    _context = null;
  }
  if (_browser) {
    await _browser.close().catch(() => {});
    _browser = null;
  }
}

export function jitter(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise((r) => setTimeout(r, ms));
}

export async function runConcurrent<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, idx: number) => Promise<R>,
  onProgress?: (done: number) => void,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  let done = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      try {
        results[idx] = await worker(items[idx], idx);
      } catch (e) {
        // record undefined; caller filters
        results[idx] = undefined as any;
      }
      done++;
      onProgress?.(done);
    }
  });
  await Promise.all(runners);
  return results;
}

export function detectBlock(html: string): string | null {
  const lower = html.toLowerCase();
  if (lower.includes('cf-challenge') || lower.includes('cf_chl_opt')) return 'cloudflare-challenge';
  if (lower.includes('captcha') && lower.includes('hcaptcha')) return 'hcaptcha';
  if (lower.includes('access denied') && lower.includes('cloudflare')) return 'cloudflare-block';
  return null;
}
