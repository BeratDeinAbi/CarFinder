'use client';

import { useMemo, useState } from 'react';
import type { Fuel, SearchFilters } from '@/lib/scrapers/types';
import { BRANDS, modelsForBrand } from '@/lib/carData';

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
  const [make, setMake] = useState('VW');
  const [model, setModel] = useState('Golf');
  const [priceMin, setPriceMin] = useState('5000');
  const [priceMax, setPriceMax] = useState('15000');
  const [yearMin, setYearMin] = useState('2015');
  const [yearMax, setYearMax] = useState('');
  const [kmMax, setKmMax] = useState('150000');
  const [fuels, setFuels] = useState<Fuel[]>([]);
  const [gearbox, setGearbox] = useState<'manual' | 'automatic' | 'any'>('any');
  const [zip, setZip] = useState('10115');
  const [radiusKm, setRadiusKm] = useState('100');
  const [wish, setWish] = useState('alltagstauglich, zuverlässig, wenig Reparaturen');

  // Modelle passend zur eingegebenen Marke (für das Modell-Datalist).
  const models = useMemo(() => modelsForBrand(make), [make]);

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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const filters: SearchFilters = {
      make: make.trim() || undefined,
      model: model.trim() || undefined,
      priceMin: priceMin ? Number(priceMin) : undefined,
      priceMax: priceMax ? Number(priceMax) : undefined,
      yearMin: yearMin ? Number(yearMin) : undefined,
      yearMax: yearMax ? Number(yearMax) : undefined,
      kmMax: kmMax ? Number(kmMax) : undefined,
      fuels: fuels.length ? fuels : undefined,
      gearbox,
      zip: zip.trim() || undefined,
      radiusKm: radiusKm ? Number(radiusKm) : undefined,
      wish: wish.trim() || undefined,
    };
    onSubmit(filters);
  };

  return (
    <form className="panel" onSubmit={submit}>
      <h2>Filter</h2>

      <div className="field">
        <label>Marke</label>
        <input
          list="brand-list"
          value={make}
          onChange={(e) => handleMakeChange(e.target.value)}
          placeholder="Marke tippen oder auswählen…"
          autoComplete="off"
        />
        <datalist id="brand-list">
          {BRANDS.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
      </div>

      <div className="field">
        <label>Modell</label>
        <input
          list="model-list"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={models.length ? 'Klicken für Modelle…' : 'z.B. Golf'}
          autoComplete="off"
        />
        <datalist id="model-list">
          {models.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </div>

      <div className="field">
        <label>Preis (€)</label>
        <div className="row-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={100}
            placeholder="beliebig"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
          />
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={100}
            placeholder="beliebig"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label>Baujahr</label>
        <div className="row-2">
          <input type="number" placeholder="von" value={yearMin} onChange={(e) => setYearMin(e.target.value)} />
          <input type="number" placeholder="bis" value={yearMax} onChange={(e) => setYearMax(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label>Max. km</label>
        <input type="number" value={kmMax} onChange={(e) => setKmMax(e.target.value)} />
      </div>

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

      <button type="submit" className="btn" disabled={disabled}>
        {disabled ? 'Suche läuft…' : 'Autos finden'}
      </button>
    </form>
  );
}
