export type Source = 'mobile' | 'kleinanzeigen';

export type Fuel = 'petrol' | 'diesel' | 'hybrid' | 'electric' | 'other';
export type Gearbox = 'manual' | 'automatic' | 'other';

export interface SearchFilters {
  make?: string;
  model?: string;
  priceMin?: number;
  priceMax?: number;
  yearMin?: number;
  yearMax?: number;
  kmMax?: number;
  fuels?: Fuel[];
  gearbox?: Gearbox | 'any';
  zip?: string;
  radiusKm?: number;
  wish?: string;
}

export interface NormalizedListing {
  id: string;
  source: Source;
  platformId: string;
  url: string;
  title: string;
  price: number | null;
  km: number | null;
  year: number | null;
  fuel: Fuel | null;
  gearbox: Gearbox | null;
  power_kw: number | null;
  location: string | null;
  description: string;
  thumbnail: string | null;
  fetchedAt: number;
}

export interface ListingScore {
  listingId: string;
  score: number;
  summary: string;
  pros: string[];
  cons: string[];
  redFlags: string[];
}

export interface ScoredListing extends NormalizedListing {
  score?: ListingScore;
}

export type JobStatus = 'queued' | 'scraping' | 'ranking' | 'done' | 'error';

export interface JobInfo {
  id: string;
  status: JobStatus;
  filters: SearchFilters;
  createdAt: number;
  updatedAt: number;
  totalFound: number;
  totalScored: number;
  errors: string[];
}
