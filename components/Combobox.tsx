'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
  /** Label für die "alles zurücksetzen"-Option oben in der Liste. */
  anyLabel?: string;
  disabled?: boolean;
}

// Moderne Combobox: freies Tippen + gefilterte Vorschläge in einem schicken
// Dropdown (ersetzt das native <datalist>). Oben gibt es eine "Beliebig"-Option,
// die das Feld leert, sodass man z.B. ohne Marke nur nach Preis suchen kann.
export default function Combobox({
  value,
  onChange,
  options,
  placeholder,
  anyLabel = 'Beliebig',
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Klick außerhalb schließt das Dropdown.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const q = value.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => o.toLowerCase().includes(q))
    : options;

  const choose = (val: string) => {
    onChange(val);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlight]) choose(filtered[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="combo" ref={wrapRef}>
      <input
        className="combo-input"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      <span className="combo-caret" aria-hidden>▾</span>
      {open && (
        <ul className="combo-list" role="listbox">
          <li
            className={`combo-opt combo-any ${value === '' ? 'sel' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault();
              choose('');
            }}
          >
            {anyLabel}
          </li>
          {filtered.length === 0 && (
            <li className="combo-opt combo-empty">Tippen zum Suchen…</li>
          )}
          {filtered.map((o, i) => (
            <li
              key={o}
              className={`combo-opt ${i === highlight ? 'hl' : ''} ${o === value ? 'sel' : ''}`}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o);
              }}
            >
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
