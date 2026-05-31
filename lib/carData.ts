// Marken + Modelle für die Autovervollständigung im Filterformular.
// Die Schlüssel sind die Such-/Anzeigenamen (so wie man sie auf Kleinanzeigen
// als Stichwort eingibt). Bewusst kompakt gehalten auf den deutschen Markt.

export const CAR_DATA: Record<string, string[]> = {
  VW: [
    'Golf', 'Polo', 'Passat', 'Tiguan', 'Touran', 'T-Roc', 'T-Cross', 'Arteon',
    'up!', 'Caddy', 'Touareg', 'Sharan', 'Scirocco', 'Beetle', 'ID.3', 'ID.4', 'ID.5', 'Multivan',
  ],
  BMW: [
    '1er', '2er', '3er', '4er', '5er', '6er', '7er', '8er', 'X1', 'X2', 'X3', 'X4',
    'X5', 'X6', 'X7', 'Z4', 'i3', 'i4', 'iX', 'M2', 'M3', 'M4', 'M5',
  ],
  Audi: [
    'A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q2', 'Q3', 'Q4', 'Q5', 'Q7', 'Q8',
    'TT', 'e-tron', 'S3', 'S4', 'RS3', 'RS6',
  ],
  Mercedes: [
    'A-Klasse', 'B-Klasse', 'C-Klasse', 'E-Klasse', 'S-Klasse', 'CLA', 'CLS',
    'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'SLK', 'SL', 'Vito', 'Viano', 'Sprinter', 'V-Klasse',
  ],
  Opel: [
    'Corsa', 'Astra', 'Insignia', 'Mokka', 'Crossland', 'Grandland', 'Zafira',
    'Adam', 'Meriva', 'Vivaro', 'Combo',
  ],
  Ford: [
    'Fiesta', 'Focus', 'Mondeo', 'Kuga', 'Puma', 'Mustang', 'Galaxy', 'S-Max',
    'EcoSport', 'C-Max', 'Ka', 'Transit', 'Ranger',
  ],
  Renault: [
    'Clio', 'Captur', 'Megane', 'Scenic', 'Kadjar', 'Twingo', 'Zoe', 'Kangoo', 'Talisman', 'Espace',
  ],
  Toyota: [
    'Yaris', 'Corolla', 'Auris', 'Avensis', 'C-HR', 'RAV4', 'Aygo', 'Prius', 'Camry', 'Land Cruiser', 'Hilux',
  ],
  Skoda: [
    'Fabia', 'Octavia', 'Superb', 'Kodiaq', 'Karoq', 'Kamiq', 'Scala', 'Rapid', 'Citigo', 'Enyaq', 'Yeti',
  ],
  SEAT: [
    'Ibiza', 'Leon', 'Arona', 'Ateca', 'Tarraco', 'Alhambra', 'Mii', 'Toledo',
  ],
  Peugeot: [
    '108', '208', '308', '508', '2008', '3008', '5008', 'Partner', 'Rifter',
  ],
  Citroen: [
    'C1', 'C3', 'C4', 'C5', 'Berlingo', 'C3 Aircross', 'C4 Cactus', 'C5 Aircross',
  ],
  Fiat: [
    '500', 'Panda', 'Punto', 'Tipo', 'Doblo', '500X', '500L', 'Ducato',
  ],
  Hyundai: [
    'i10', 'i20', 'i30', 'i40', 'Tucson', 'Kona', 'Santa Fe', 'Ioniq', 'ix35', 'Bayon',
  ],
  Kia: [
    'Picanto', 'Rio', 'Ceed', 'Sportage', 'Sorento', 'Stonic', 'Niro', 'Soul', 'XCeed', 'EV6',
  ],
  Mazda: [
    '2', '3', '6', 'CX-3', 'CX-30', 'CX-5', 'MX-5',
  ],
  Nissan: [
    'Micra', 'Note', 'Juke', 'Qashqai', 'X-Trail', 'Leaf', 'Pulsar',
  ],
  Volvo: [
    'V40', 'V60', 'V90', 'S60', 'S90', 'XC40', 'XC60', 'XC90',
  ],
  Dacia: [
    'Sandero', 'Duster', 'Logan', 'Lodgy', 'Dokker', 'Spring', 'Jogger',
  ],
  Porsche: [
    '911', 'Cayenne', 'Macan', 'Panamera', 'Boxster', 'Cayman', 'Taycan',
  ],
  'Mini': [
    'Cooper', 'One', 'Clubman', 'Countryman', 'Cabrio',
  ],
  Suzuki: [
    'Swift', 'Vitara', 'SX4', 'Ignis', 'Jimny', 'Celerio',
  ],
  Tesla: [
    'Model 3', 'Model S', 'Model X', 'Model Y',
  ],
};

// Alphabetisch sortierte Markenliste für das Marken-Datalist.
export const BRANDS: string[] = Object.keys(CAR_DATA).sort((a, b) =>
  a.localeCompare(b, 'de'),
);

// Aliase, damit auch alternative Schreibweisen die Modelle laden.
const ALIASES: Record<string, string> = {
  volkswagen: 'VW',
  'mercedes-benz': 'Mercedes',
  'mercedes benz': 'Mercedes',
  benz: 'Mercedes',
  mini: 'Mini',
  vauxhall: 'Opel',
};

// Liefert die Modelle zu einer eingegebenen Marke (case-insensitive, mit Aliassen).
export function modelsForBrand(brand: string): string[] {
  const norm = brand.trim().toLowerCase();
  if (!norm) return [];
  const directKey = Object.keys(CAR_DATA).find((k) => k.toLowerCase() === norm);
  if (directKey) return CAR_DATA[directKey];
  const aliasKey = ALIASES[norm];
  if (aliasKey && CAR_DATA[aliasKey]) return CAR_DATA[aliasKey];
  return [];
}
