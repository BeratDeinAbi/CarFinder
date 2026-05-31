'use client';

import { useState } from 'react';
import type { Fuel, SearchFilters } from '@/lib/scrapers/types';

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

  const toggleFuel = (f: Fuel) => {
    setFuels((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));
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
        <input value={make} onChange={(e) => setMake(e.target.value)} placeholder="z.B. VW" />
      </div>

      <div className="field">
        <label>Modell</label>
        <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="z.B. Golf" />
      </div>

      <div className="field">
        <label>Preis (€)</label>
        <div className="row-2">
          <input type="number" placeholder="von" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />
          <input type="number" placeholder="bis" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} />
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
