import type { ClothingCategory, ClothingFit, ClothingSize } from './scrapers/types';

export const CLOTHING_CATEGORIES: { value: ClothingCategory; label: string; plural: string }[] = [
  { value: 'sweater', label: 'Pullover', plural: 'Pullover' },
  { value: 'jacket', label: 'Jacke', plural: 'Jacken' },
  { value: 'pants', label: 'Hose', plural: 'Hosen' },
];

// Schnitt nur für Hosen relevant (breit/eng).
export const CLOTHING_FITS: { value: ClothingFit; label: string }[] = [
  { value: 'any', label: 'Egal' },
  { value: 'slim', label: 'Eng' },
  { value: 'wide', label: 'Breit' },
];

// Konfektionsgröße für Pullover und Jacken.
export const CLOTHING_SIZES: { value: ClothingSize; label: string }[] = [
  { value: 'any', label: 'Egal' },
  { value: 'XS', label: 'XS' },
  { value: 'S', label: 'S' },
  { value: 'M', label: 'M' },
  { value: 'L', label: 'L' },
  { value: 'XL', label: 'XL' },
  { value: 'XXL', label: 'XXL' },
];

export const CLOTHING_BRANDS = [
  'Nike', 'Adidas', 'Puma', 'Zara', 'H&M', 'Levi\'s', 'Tommy Hilfiger', 'Hugo Boss',
  'Ralph Lauren', 'The North Face', 'Carhartt', 'Jack & Jones', 'Only', 'Vero Moda',
  'Esprit', 'Lacoste', 'Diesel', 'G-Star', 'Bershka', 'Pull&Bear', 'Uniqlo', 'Vans',
];

export function clothingCategoryLabel(category: ClothingCategory | undefined): string {
  return CLOTHING_CATEGORIES.find((item) => item.value === category)?.label ?? 'Kleidung';
}

export function clothingCategoryPlural(category: ClothingCategory | undefined): string {
  return CLOTHING_CATEGORIES.find((item) => item.value === category)?.plural ?? 'Kleidung';
}

export function clothingFitLabel(fit: ClothingFit | null | undefined): string | null {
  if (!fit || fit === 'any') return null;
  return CLOTHING_FITS.find((item) => item.value === fit)?.label ?? null;
}

export function clothingSizeLabel(size: ClothingSize | null | undefined): string | null {
  if (!size || size === 'any') return null;
  return CLOTHING_SIZES.find((item) => item.value === size)?.label ?? size;
}

// Der Schnitt (breit/eng) gilt nur für Hosen, die Größe (XS–XXL) nur für
// Pullover und Jacken. Hilfsfunktionen, damit UI und Scraper konsistent bleiben.
export function clothingUsesFit(category: ClothingCategory | undefined): boolean {
  return category === 'pants';
}

export function clothingUsesSize(category: ClothingCategory | undefined): boolean {
  return category === 'sweater' || category === 'jacket';
}
