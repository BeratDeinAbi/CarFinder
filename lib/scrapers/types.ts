export type Source = 'mobile' | 'kleinanzeigen';
export type SearchDomain = 'cars' | 'electronics';

export type Fuel = 'petrol' | 'diesel' | 'hybrid' | 'electric' | 'other';
export type Gearbox = 'manual' | 'automatic' | 'other';
export type BodyType = 'estate' | 'sedan' | 'convertible' | 'suv' | 'small' | 'coupe' | 'van' | 'other';
export type ElectronicsCategory = 'phone' | 'monitor' | 'laptop' | 'pc';
export type ElectronicsCondition = 'any' | 'new' | 'like_new' | 'good' | 'used' | 'defective';

export interface SearchFilters {
  domain?: SearchDomain;
  make?: string;
  model?: string;
  priceMin?: number;
  priceMax?: number;
  yearMin?: number;
  yearMax?: number;
  kmMax?: number;
  fuels?: Fuel[];
  gearbox?: Gearbox | 'any';
  bodyType?: BodyType | 'any';
  category?: ElectronicsCategory;
  condition?: ElectronicsCondition;
  keyword?: string;
  zip?: string;
  radiusKm?: number;
  wish?: string;
}

export interface NormalizedListing {
  id: string;
  source: Source;
  domain: SearchDomain;
  platformId: string;
  url: string;
  title: string;
  price: number | null;
  km: number | null;
  year: number | null;
  fuel: Fuel | null;
  gearbox: Gearbox | null;
  bodyType: BodyType | null;
  power_kw: number | null;
  category: ElectronicsCategory | null;
  condition: ElectronicsCondition | null;
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
