'use client';

import { useMemo, useState } from 'react';
import type { BodyType, ElectronicsCategory, ElectronicsCondition, Fuel, SearchDomain, SearchFilters } from '@/lib/scrapers/types';
import { BRANDS, modelsForBrand } from '@/lib/carData';
import {
  ELECTRONICS_CATEGORIES,
  ELECTRONICS_CONDITIONS,
  electronicsBrandsForCategory,
  electronicsCategoryPlural,
  electronicsModelsFor,
} from '@/lib/electronicsData';
import Combobox from './Combobox';

const BODY_TYPES: { value: BodyType | 'any'; label: string }[] = [
  { value: 'any', label: 'Egal' },
  { value: 'estate', label: 'Kombi' },
  { value: 'sedan', label: 'Limousine' },
  { value: 'convertible', label: 'Cabrio' },
  { value: 'suv', label: 'SUV / Geländewagen' },
  { value: 'coupe', label: 'Coupé / Sportwagen' },
  { value: 'small', label: 'Kleinwagen' },
  { value: 'van', label: 'Van / Bus' },
];

interface Props {
  onSubmit: (filters: SearchFilters) => void;
  disabled?: boolean;
}

const FUELS: { value: Fuel; label: string }[] = [
  { value: 'petrol', label: 'Benzin' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'electric', label: 'Elektro' },
];

export default function FilterForm({ onSubmit, disabled }: Props) {
  const [domain, setDomain] = useState<SearchDomain>('cars');
  const [make, setMake] = useState('VW');
  const [model, setModel] = useState('Golf');
  const [electronicsCategory, setElectronicsCategory] = useState<ElectronicsCategory>('phone');
  const [electronicsBrand, setElectronicsBrand] = useState('Apple');
  const [electronicsQuery, setElectronicsQuery] = useState('iPhone');
  const [condition, setCondition] = useState<ElectronicsCondition>('any');
  const [priceMin, setPriceMin] = useState('5000');
  const [priceMax, setPriceMax] = useState('15000');
  const [yearMin, setYearMin] = useState('');
  const [yearMax, setYearMax] = useState('');
  const [kmMax, setKmMax] = useState('150000');
  const [fuels, setFuels] = useState<Fuel[]>([]);
  const [gearbox, setGearbox] = useState<'manual' | 'automatic' | 'any'>('any');
  const [bodyType, setBodyType] = useState<BodyType | 'any'>('any');
  const [zip, setZip] = useState('10115');
  const [radiusKm, setRadiusKm] = useState('100');
  const [wish, setWish] = useState('alltagstauglich, zuverlässig, wenig Reparaturen');

  // Modelle passend zur eingegebenen Marke (für das Modell-Datalist).
  const models = useMemo(() => modelsForBrand(make), [make]);
  const electronicsBrands = useMemo(() => electronicsBrandsForCategory(electronicsCategory), [electronicsCategory]);
  const electronicsModels = useMemo(
    () => electronicsModelsFor(electronicsCategory, electronicsBrand),
    [electronicsCategory, electronicsBrand],
  );

  const toggleFuel = (f: Fuel) => {
    setFuels((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));
  };

  // Beim Markenwechsel das Modell zurücksetzen, falls es nicht zur neuen Marke passt.
  const handleMakeChange = (val: string) => {
    setMake(val);
    const newModels = modelsForBrand(val);
    if (model && newModels.length && !newModels.some((m) => m.toLowerCase() === model.toLowerCase())) {
      setModel('');
    }
  };

  const handleDomainChange = (nextDomain: SearchDomain) => {
    setDomain(nextDomain);
    if (nextDomain === 'cars') {
      setPriceMin('5000');
      setPriceMax('15000');
      setWish('alltagstauglich, zuverlässig, wenig Reparaturen');
    } else {
      setPriceMin('');
      setPriceMax('800');
      setWish('guter Zustand, fairer Preis, kein versteckter Defekt');
    }
  };

  const handleElectronicsCategoryChange = (val: ElectronicsCategory) => {
    setElectronicsCategory(val);
    const brands = electronicsBrandsForCategory(val);
    if (!brands.some((brand) => brand.toLowerCase() === electronicsBrand.toLowerCase())) {
      setElectronicsBrand(brands[0] || '');
    }
    setElectronicsQuery('');
  };

  // Beim Wechsel der Elektronik-Marke das Modell leeren, wenn es nicht mehr passt.
  const handleElectronicsBrandChange = (val: string) => {
    setElectronicsBrand(val);
    const newModels = electronicsModelsFor(electronicsCategory, val);
    if (electronicsQuery && newModels.length && !newModels.some((m) => m.toLowerCase() === electronicsQuery.toLowerCase())) {
      setElectronicsQuery('');
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const shared = {
      make: make.trim() || undefined,
      model: model.trim() || undefined,
      priceMin: priceMin ? Number(priceMin) : undefined,
      priceMax: priceMax ? Number(priceMax) : undefined,
      zip: zip.trim() || undefined,
      radiusKm: radiusKm ? Number(radiusKm) : undefined,
      wish: wish.trim() || undefined,
    };

    const filters: SearchFilters = domain === 'cars' ? {
      ...shared,
      domain: 'cars',
      yearMin: yearMin ? Number(yearMin) : undefined,
      yearMax: yearMax ? Number(yearMax) : undefined,
      kmMax: kmMax ? Number(kmMax) : undefined,
      fuels: fuels.length ? fuels : undefined,
      gearbox,
      bodyType,
    } : {
      domain: 'electronics',
      category: electronicsCategory,
      make: electronicsBrand.trim() || undefined,
      model: electronicsQuery.trim() || undefined,
      keyword: electronicsQuery.trim() || undefined,
      condition,
      priceMin: shared.priceMin,
      priceMax: shared.priceMax,
      zip: shared.zip,
      radiusKm: shared.radiusKm,
      wish: shared.wish,
    };
    onSubmit(filters);
  };

  return (
    <form className="panel" onSubmit={submit}>
      <h2>Filter</h2>

      <div className="domain-switch" role="group" aria-label="Suchbereich">
        <button
          type="button"
          className={domain === 'cars' ? 'active' : ''}
          onClick={() => handleDomainChange('cars')}
          disabled={disabled}
        >
          <span className="ds-icon" aria-hidden>🚗</span>
          Autos
        </button>
        <button
          type="button"
          className={domain === 'electronics' ? 'active' : ''}
          onClick={() => handleDomainChange('electronics')}
          disabled={disabled}
        >
          <span className="ds-icon" aria-hidden>📱</span>
          Elektrogeräte
        </button>
      </div>

      {domain === 'cars' ? (
        <>
          <div className="filter-section">
            <div className="filter-section-title"><span className="fs-icon" aria-hidden>🚙</span>Fahrzeug</div>
            <div className="field">
              <label>Marke</label>
              <Combobox
                value={make}
                onChange={handleMakeChange}
                options={BRANDS}
                placeholder="Beliebig — tippen oder wählen…"
                anyLabel="Beliebig (alle Marken)"
              />
            </div>
            <div className="field">
              <label>Modell</label>
              <Combobox
                value={model}
                onChange={setModel}
                options={models}
                placeholder={make ? 'Beliebig — Modell wählen…' : 'Erst Marke wählen'}
                anyLabel="Beliebig (alle Modelle)"
              />
            </div>
          </div>

          <div className="filter-section">
            <div className="filter-section-title"><span className="fs-icon" aria-hidden>💶</span>Preis &amp; Eckdaten</div>
            <div className="field">
              <label>Preis (€)</label>
              <div className="row-2">
                <input type="number" inputMode="numeric" min={0} step={100} placeholder="beliebig" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />
                <input type="number" inputMode="numeric" min={0} step={100} placeholder="beliebig" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Baujahr</label>
              <div className="row-2">
                <input type="number" inputMode="numeric" placeholder="beliebig" value={yearMin} onChange={(e) => setYearMin(e.target.value)} />
                <input type="number" inputMode="numeric" placeholder="beliebig" value={yearMax} onChange={(e) => setYearMax(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Max. km</label>
              <input type="number" inputMode="numeric" step={5000} placeholder="beliebig" value={kmMax} onChange={(e) => setKmMax(e.target.value)} />
            </div>
          </div>

          <div className="filter-section">
            <div className="filter-section-title"><span className="fs-icon" aria-hidden>⚙️</span>Ausstattung</div>
            <div className="field">
              <label>Kraftstoff</label>
              <div className="checkbox-group">
                {FUELS.map((f) => (
                  <label key={f.value}>
                    <input type="checkbox" checked={fuels.includes(f.value)} onChange={() => toggleFuel(f.value)} />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Getriebe</label>
              <select value={gearbox} onChange={(e) => setGearbox(e.target.value as any)}>
                <option value="any">Egal</option>
                <option value="manual">Schalter</option>
                <option value="automatic">Automatik</option>
              </select>
            </div>
            <div className="field">
              <label>Karosserieform</label>
              <select value={bodyType} onChange={(e) => setBodyType(e.target.value as BodyType | 'any')}>
                {BODY_TYPES.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="filter-section">
            <div className="filter-section-title"><span className="fs-icon" aria-hidden>📦</span>Gerät</div>
            <div className="field">
              <label>Kategorie</label>
              <select value={electronicsCategory} onChange={(e) => handleElectronicsCategoryChange(e.target.value as ElectronicsCategory)}>
                {ELECTRONICS_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Marke</label>
              <Combobox
                value={electronicsBrand}
                onChange={handleElectronicsBrandChange}
                options={electronicsBrands}
                placeholder="Beliebig — tippen oder wählen…"
                anyLabel="Beliebig (alle Marken)"
              />
            </div>
            <div className="field">
              <label>Modell oder Suchbegriff</label>
              <Combobox
                value={electronicsQuery}
                onChange={setElectronicsQuery}
                options={electronicsModels}
                placeholder={
                  electronicsModels.length
                    ? 'Modell wählen oder frei tippen…'
                    : `${electronicsCategoryPlural(electronicsCategory)} suchen…`
                }
                anyLabel="Beliebig (alle Modelle)"
              />
            </div>
          </div>

          <div className="filter-section">
            <div className="filter-section-title"><span className="fs-icon" aria-hidden>💶</span>Preis &amp; Zustand</div>
            <div className="field">
              <label>Preis (€)</label>
              <div className="row-2">
                <input type="number" inputMode="numeric" min={0} step={100} placeholder="beliebig" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />
                <input type="number" inputMode="numeric" min={0} step={100} placeholder="beliebig" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Zustand</label>
              <select value={condition} onChange={(e) => setCondition(e.target.value as ElectronicsCondition)}>
                {ELECTRONICS_CONDITIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      )}

      <div className="filter-section">
        <div className="filter-section-title"><span className="fs-icon" aria-hidden>📍</span>Ort &amp; Wunsch</div>
        <div className="field">
          <label>PLZ + Umkreis (km)</label>
          <div className="row-2">
            <input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="PLZ" />
            <input type="number" value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} placeholder="km" />
          </div>
        </div>
        <div className="field">
          <label>Was wünschst du dir? (Freitext)</label>
          <textarea value={wish} onChange={(e) => setWish(e.target.value)} />
        </div>
      </div>

      <button type="submit" className="btn" disabled={disabled}>
        {disabled ? 'Suche läuft…' : domain === 'cars' ? 'Autos finden' : `${electronicsCategoryPlural(electronicsCategory)} finden`}
      </button>
    </form>
  );
}
