import type { ElectronicsCategory, ElectronicsCondition } from './scrapers/types';

export const ELECTRONICS_CATEGORIES: { value: ElectronicsCategory; label: string; plural: string }[] = [
  { value: 'phone', label: 'Handy', plural: 'Handys' },
  { value: 'monitor', label: 'Monitor', plural: 'Monitore' },
  { value: 'laptop', label: 'Laptop', plural: 'Laptops' },
  { value: 'pc', label: 'PC', plural: 'PCs' },
];

export const ELECTRONICS_CONDITIONS: { value: ElectronicsCondition; label: string }[] = [
  { value: 'any', label: 'Egal' },
  { value: 'new', label: 'Neu' },
  { value: 'like_new', label: 'Wie neu' },
  { value: 'good', label: 'Gut' },
  { value: 'used', label: 'Gebraucht' },
  { value: 'defective', label: 'Defekt / Ersatzteile' },
];

export const ELECTRONICS_BRANDS_BY_CATEGORY: Record<ElectronicsCategory, string[]> = {
  phone: ['Apple', 'Samsung', 'Google', 'Xiaomi', 'OnePlus', 'Sony', 'Huawei', 'Motorola', 'Nothing'],
  monitor: ['LG', 'Samsung', 'Dell', 'AOC', 'BenQ', 'ASUS', 'Acer', 'HP', 'Eizo', 'Philips'],
  laptop: ['Apple', 'Lenovo', 'Dell', 'HP', 'ASUS', 'Acer', 'Microsoft', 'MSI', 'Razer', 'Samsung'],
  pc: ['Lenovo', 'Dell', 'HP', 'Acer', 'Medion', 'MSI', 'Corsair', 'Alienware', 'be quiet!', 'Custom'],
};

export function electronicsCategoryLabel(category: ElectronicsCategory | undefined): string {
  return ELECTRONICS_CATEGORIES.find((item) => item.value === category)?.label ?? 'Elektrogerät';
}

export function electronicsCategoryPlural(category: ElectronicsCategory | undefined): string {
  return ELECTRONICS_CATEGORIES.find((item) => item.value === category)?.plural ?? 'Elektrogeräte';
}

export function electronicsBrandsForCategory(category: ElectronicsCategory): string[] {
  return ELECTRONICS_BRANDS_BY_CATEGORY[category];
}
