import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import type { JobInfo, JobStatus, ListingScore, NormalizedListing, SearchFilters } from './scrapers/types';

const DB_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

let _db: DatabaseSync | null = null;

function db(): DatabaseSync {
  if (_db) return _db;
  _db = new DatabaseSync(path.join(DB_DIR, 'carfinder.db'));
  _db.exec('PRAGMA journal_mode = WAL');
  _db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      filters_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      total_found INTEGER NOT NULL DEFAULT 0,
      total_scored INTEGER NOT NULL DEFAULT 0,
      errors_json TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      domain TEXT NOT NULL DEFAULT 'cars',
      platform_id TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      price INTEGER,
      km INTEGER,
      year INTEGER,
      fuel TEXT,
      gearbox TEXT,
      body_type TEXT,
      power_kw INTEGER,
      category TEXT,
      condition TEXT,
      clothing_category TEXT,
      clothing_fit TEXT,
      clothing_size TEXT,
      location TEXT,
      description TEXT NOT NULL,
      thumbnail TEXT,
      fetched_at INTEGER NOT NULL,
      UNIQUE(source, platform_id)
    );

    CREATE TABLE IF NOT EXISTS job_listings (
      job_id TEXT NOT NULL,
      listing_id TEXT NOT NULL,
      PRIMARY KEY (job_id, listing_id)
    );

    CREATE TABLE IF NOT EXISTS scores (
      listing_id TEXT NOT NULL,
      wish_hash TEXT NOT NULL,
      score INTEGER NOT NULL,
      summary TEXT NOT NULL,
      pros_json TEXT NOT NULL,
      cons_json TEXT NOT NULL,
      red_flags_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (listing_id, wish_hash)
    );
  `);

  // Migrations: neue Spalten für bereits existierende Datenbanken nachrüsten.
  const cols = _db.prepare(`PRAGMA table_info(listings)`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === 'body_type')) {
    _db.exec(`ALTER TABLE listings ADD COLUMN body_type TEXT`);
  }
  if (!cols.some((c) => c.name === 'domain')) {
    _db.exec(`ALTER TABLE listings ADD COLUMN domain TEXT NOT NULL DEFAULT 'cars'`);
  }
  if (!cols.some((c) => c.name === 'category')) {
    _db.exec(`ALTER TABLE listings ADD COLUMN category TEXT`);
  }
  if (!cols.some((c) => c.name === 'condition')) {
    _db.exec(`ALTER TABLE listings ADD COLUMN condition TEXT`);
  }
  if (!cols.some((c) => c.name === 'clothing_category')) {
    _db.exec(`ALTER TABLE listings ADD COLUMN clothing_category TEXT`);
  }
  if (!cols.some((c) => c.name === 'clothing_fit')) {
    _db.exec(`ALTER TABLE listings ADD COLUMN clothing_fit TEXT`);
  }
  if (!cols.some((c) => c.name === 'clothing_size')) {
    _db.exec(`ALTER TABLE listings ADD COLUMN clothing_size TEXT`);
  }

  return _db;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function createJob(id: string, filters: SearchFilters): void {
  const now = Date.now();
  db()
    .prepare(
      `INSERT INTO jobs (id, status, filters_json, created_at, updated_at) VALUES (?, 'queued', ?, ?, ?)`,
    )
    .run(id, JSON.stringify(filters), now, now);
}

export function updateJob(id: string, patch: Partial<Pick<JobInfo, 'status' | 'totalFound' | 'totalScored' | 'errors'>>): void {
  const cur = getJob(id);
  if (!cur) return;
  const next = {
    status: (patch.status ?? cur.status) as JobStatus,
    totalFound: patch.totalFound ?? cur.totalFound,
    totalScored: patch.totalScored ?? cur.totalScored,
    errors: patch.errors ?? cur.errors,
  };
  db()
    .prepare(
      `UPDATE jobs SET status=?, total_found=?, total_scored=?, errors_json=?, updated_at=? WHERE id=?`,
    )
    .run(next.status, next.totalFound, next.totalScored, JSON.stringify(next.errors), Date.now(), id);
}

export function appendJobError(id: string, msg: string): void {
  const cur = getJob(id);
  if (!cur) return;
  const errors = [...cur.errors, msg].slice(-20);
  updateJob(id, { errors });
}

export function getJob(id: string): JobInfo | null {
  const row = db().prepare(`SELECT * FROM jobs WHERE id=?`).get(id) as any;
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    filters: JSON.parse(row.filters_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    totalFound: row.total_found,
    totalScored: row.total_scored,
    errors: JSON.parse(row.errors_json),
  };
}

export function upsertListing(l: NormalizedListing): void {
  db()
    .prepare(
      `INSERT INTO listings (id, source, domain, platform_id, url, title, price, km, year, fuel, gearbox, body_type, power_kw, category, condition, clothing_category, clothing_fit, clothing_size, location, description, thumbnail, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(source, platform_id) DO UPDATE SET
         title=excluded.title, price=excluded.price, km=excluded.km, year=excluded.year,
         fuel=excluded.fuel, gearbox=excluded.gearbox, body_type=excluded.body_type, power_kw=excluded.power_kw,
         domain=excluded.domain, category=excluded.category, condition=excluded.condition,
         clothing_category=excluded.clothing_category, clothing_fit=excluded.clothing_fit, clothing_size=excluded.clothing_size,
         location=excluded.location, description=excluded.description,
         thumbnail=excluded.thumbnail, fetched_at=excluded.fetched_at`,
    )
    .run(
      l.id,
      l.source,
      l.domain,
      l.platformId,
      l.url,
      l.title,
      l.price,
      l.km,
      l.year,
      l.fuel,
      l.gearbox,
      l.bodyType,
      l.power_kw,
      l.category,
      l.condition,
      l.clothingCategory,
      l.clothingFit,
      l.clothingSize,
      l.location,
      l.description,
      l.thumbnail,
      l.fetchedAt,
    );
}

export function getCachedListing(source: string, platformId: string): NormalizedListing | null {
  const row = db()
    .prepare(`SELECT * FROM listings WHERE source=? AND platform_id=? AND fetched_at > ?`)
    .get(source, platformId, Date.now() - CACHE_TTL_MS) as any;
  if (!row) return null;
  return rowToListing(row);
}

export function getListing(id: string): NormalizedListing | null {
  const row = db().prepare(`SELECT * FROM listings WHERE id=?`).get(id) as any;
  if (!row) return null;
  return rowToListing(row);
}

function rowToListing(row: any): NormalizedListing {
  return {
    id: row.id,
    source: row.source,
    domain: row.domain ?? 'cars',
    platformId: row.platform_id,
    url: row.url,
    title: row.title,
    price: row.price,
    km: row.km,
    year: row.year,
    fuel: row.fuel,
    gearbox: row.gearbox,
    bodyType: row.body_type ?? null,
    power_kw: row.power_kw,
    category: row.category ?? null,
    condition: row.condition ?? null,
    clothingCategory: row.clothing_category ?? null,
    clothingFit: row.clothing_fit ?? null,
    clothingSize: row.clothing_size ?? null,
    location: row.location,
    description: row.description,
    thumbnail: row.thumbnail,
    fetchedAt: row.fetched_at,
  };
}

export function linkJobListing(jobId: string, listingId: string): void {
  db()
    .prepare(`INSERT OR IGNORE INTO job_listings (job_id, listing_id) VALUES (?, ?)`)
    .run(jobId, listingId);
}

export function getJobListings(jobId: string): NormalizedListing[] {
  const rows = db()
    .prepare(`SELECT l.* FROM listings l JOIN job_listings jl ON jl.listing_id = l.id WHERE jl.job_id = ?`)
    .all(jobId) as any[];
  return rows.map(rowToListing);
}

export function saveScore(score: ListingScore, wishHash: string): void {
  db()
    .prepare(
      `INSERT INTO scores (listing_id, wish_hash, score, summary, pros_json, cons_json, red_flags_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(listing_id, wish_hash) DO UPDATE SET
         score=excluded.score, summary=excluded.summary, pros_json=excluded.pros_json,
         cons_json=excluded.cons_json, red_flags_json=excluded.red_flags_json, created_at=excluded.created_at`,
    )
    .run(
      score.listingId,
      wishHash,
      score.score,
      score.summary,
      JSON.stringify(score.pros),
      JSON.stringify(score.cons),
      JSON.stringify(score.redFlags),
      Date.now(),
    );
}

export function getScore(listingId: string, wishHash: string): ListingScore | null {
  const row = db()
    .prepare(`SELECT * FROM scores WHERE listing_id=? AND wish_hash=?`)
    .get(listingId, wishHash) as any;
  if (!row) return null;
  return {
    listingId: row.listing_id,
    score: row.score,
    summary: row.summary,
    pros: JSON.parse(row.pros_json),
    cons: JSON.parse(row.cons_json),
    redFlags: JSON.parse(row.red_flags_json),
  };
}
