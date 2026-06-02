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

// Modellvorschläge je Kategorie + Marke (z.B. Apple-Laptop -> MacBook Air, MacBook Pro).
// Schlüssel: `${category}:${markeLowercase}`. Bewusst auf gängige, aktuelle Modelle
// beschränkt; bei unbekannter Kombination kommt eine leere Liste (freies Tippen bleibt möglich).
const ELECTRONICS_MODELS: Record<string, string[]> = {
  // ---- Handys ----
  'phone:apple': ['iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15', 'iPhone 14 Pro', 'iPhone 14', 'iPhone 13', 'iPhone 12', 'iPhone 11', 'iPhone SE', 'iPhone XR'],
  'phone:samsung': ['Galaxy S24 Ultra', 'Galaxy S24', 'Galaxy S23', 'Galaxy S22', 'Galaxy S21', 'Galaxy A54', 'Galaxy A53', 'Galaxy Z Flip', 'Galaxy Z Fold', 'Galaxy Note 20'],
  'phone:google': ['Pixel 8 Pro', 'Pixel 8', 'Pixel 7 Pro', 'Pixel 7', 'Pixel 7a', 'Pixel 6', 'Pixel 6a'],
  'phone:xiaomi': ['Redmi Note 13', 'Redmi Note 12', '13 Pro', '13', '12', 'Poco X6', 'Poco F5', 'Mi 11'],
  'phone:oneplus': ['12', '11', '10 Pro', 'Nord 3', 'Nord CE 3', '9 Pro', '9'],
  'phone:sony': ['Xperia 1 V', 'Xperia 5 V', 'Xperia 10 V', 'Xperia 1 IV', 'Xperia 5 IV'],
  'phone:huawei': ['P60 Pro', 'P50 Pro', 'P40 Pro', 'Mate 50 Pro', 'Nova 11'],
  'phone:motorola': ['Edge 40', 'Edge 30', 'Moto G84', 'Moto G54', 'Razr 40'],
  'phone:nothing': ['Phone (2)', 'Phone (2a)', 'Phone (1)'],

  // ---- Laptops ----
  'laptop:apple': ['MacBook Air M3', 'MacBook Air M2', 'MacBook Air M1', 'MacBook Pro 14"', 'MacBook Pro 16"', 'MacBook Pro M3', 'MacBook Pro M2', 'MacBook Pro M1'],
  'laptop:lenovo': ['ThinkPad X1 Carbon', 'ThinkPad T14', 'ThinkPad E15', 'IdeaPad 5', 'Yoga Slim 7', 'Legion 5', 'Legion Pro 7'],
  'laptop:dell': ['XPS 13', 'XPS 15', 'XPS 17', 'Latitude 7440', 'Inspiron 15', 'G15 Gaming', 'Alienware m16'],
  'laptop:hp': ['Spectre x360', 'Envy 13', 'Pavilion 15', 'EliteBook 840', 'Omen 16', 'Victus 15'],
  'laptop:asus': ['ZenBook 14', 'VivoBook 15', 'ROG Zephyrus G14', 'ROG Strix', 'TUF Gaming A15', 'ProArt Studiobook'],
  'laptop:acer': ['Swift 3', 'Swift Go', 'Aspire 5', 'Predator Helios', 'Nitro 5', 'Chromebook 314'],
  'laptop:microsoft': ['Surface Laptop 5', 'Surface Laptop 4', 'Surface Pro 9', 'Surface Pro 8', 'Surface Laptop Studio'],
  'laptop:msi': ['Prestige 14', 'Modern 15', 'Stealth 15', 'Katana 15', 'Raider GE78', 'Cyborg 15'],
  'laptop:razer': ['Blade 14', 'Blade 15', 'Blade 16', 'Blade 17'],
  'laptop:samsung': ['Galaxy Book4 Pro', 'Galaxy Book3', 'Galaxy Book2', 'Galaxy Book Go'],

  // ---- Monitore ----
  'monitor:lg': ['UltraGear 27"', 'UltraGear 34"', 'UltraWide 34"', 'UltraFine 27"', '27GP850', '34WP65C'],
  'monitor:samsung': ['Odyssey G9', 'Odyssey G7', 'Odyssey G5', 'ViewFinity S9', 'Smart Monitor M8', 'M7'],
  'monitor:dell': ['UltraSharp U2723', 'UltraSharp U2720', 'S2722DGM', 'G2724D', 'P2419H'],
  'monitor:aoc': ['24G2', 'CU34G2X', 'Q27G2S', '27G2'],
  'monitor:benq': ['MOBIUZ EX2710', 'PD2705Q', 'GW2790', 'Zowie XL2546'],
  'monitor:asus': ['ROG Swift PG279', 'TUF Gaming VG27', 'ProArt PA278', 'VG249Q'],
  'monitor:acer': ['Nitro XV272', 'Predator XB273', 'Nitro VG270'],
  'monitor:hp': ['E24', 'M27fe', 'Omen 27', 'Z27'],
  'monitor:eizo': ['ColorEdge CG2700', 'FlexScan EV2760', 'FlexScan EV2495'],
  'monitor:philips': ['27E1N', '345E2', 'Brilliance 499P'],

  // ---- PCs ----
  'pc:lenovo': ['Legion Tower 5', 'Legion Tower 7', 'IdeaCentre', 'ThinkCentre M70', 'LOQ Tower'],
  'pc:dell': ['XPS Desktop', 'OptiPlex 7010', 'Alienware Aurora', 'Inspiron Desktop'],
  'pc:hp': ['Omen 45L', 'Omen 25L', 'Pavilion Desktop', 'EliteDesk 800', 'Victus 15L'],
  'pc:acer': ['Predator Orion 3000', 'Aspire TC', 'Nitro 50'],
  'pc:medion': ['Erazer Engineer', 'Akoya Desktop'],
  'pc:msi': ['MEG Aegis Ti5', 'MAG Infinite', 'Codex'],
  'pc:corsair': ['Vengeance i7400', 'One i300'],
  'pc:alienware': ['Aurora R16', 'Aurora R15'],
};

export function electronicsModelsFor(category: ElectronicsCategory, brand: string): string[] {
  const key = `${category}:${brand.trim().toLowerCase()}`;
  return ELECTRONICS_MODELS[key] ?? [];
}
