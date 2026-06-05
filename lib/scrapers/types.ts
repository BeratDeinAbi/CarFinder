export type Source = 'mobile' | 'kleinanzeigen';
export type SearchDomain = 'cars' | 'electronics' | 'clothing';

export type Fuel = 'petrol' | 'diesel' | 'hybrid' | 'electric' | 'other';
export type Gearbox = 'manual' | 'automatic' | 'other';
export type BodyType = 'estate' | 'sedan' | 'convertible' | 'suv' | 'small' | 'coupe' | 'van' | 'other';
export type ElectronicsCategory = 'phone' | 'monitor' | 'laptop' | 'pc';
export type ElectronicsCondition = 'any' | 'new' | 'like_new' | 'good' | 'used' | 'defective';

// Klamotten: Pullover, Jacke oder Hose. Bei Hosen filtert man nach Schnitt
// (breit/eng), bei Pullover/Jacke nach Größe.
export type ClothingCategory = 'sweater' | 'jacket' | 'pants';
export type ClothingFit = 'any' | 'wide' | 'slim';
export type ClothingSize = 'any' | 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';

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
  clothingCategory?: ClothingCategory;
  clothingFit?: ClothingFit | 'any';
  clothingSize?: ClothingSize | 'any';
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
  clothingCategory: ClothingCategory | null;
  clothingFit: ClothingFit | null;
  clothingSize: ClothingSize | null;
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
