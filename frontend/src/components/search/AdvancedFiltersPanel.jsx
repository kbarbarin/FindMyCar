import { useMemo } from 'react';
import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import { FUELS } from '../../constants/fuels.js';
import { TRANSMISSIONS } from '../../constants/transmissions.js';
import { COUNTRIES } from '../../constants/countries.js';
import { SOURCES_META } from '../../constants/sources.js';
import styles from './AdvancedFiltersPanel.module.css';

// Panneau latéral de filtres. Contrôlé : onChange renvoie un patch de SearchCriteria.
export default function AdvancedFiltersPanel({ criteria, onChange, onReset }) {
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  function patch(key, value) { onChange({ [key]: value }); }

  function toggleArray(key, value) {
    const arr = new Set(criteria[key] || []);
    if (arr.has(value)) arr.delete(value); else arr.add(value);
    onChange({ [key]: [...arr] });
  }

  function toNumber(v) {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  return (
    <Card as="aside" padding="md" className={styles.panel}>
      <div className={styles.header}>
        <h3>Filtres</h3>
        <Button size="sm" variant="ghost" onClick={onReset}>Réinitialiser</Button>
      </div>

      <Section title="Véhicule">
        <div className={styles.row2}>
          <Input label="Marque" placeholder="Ex : Toyota" value={criteria.make ?? ''} onChange={(e) => patch('make', e.target.value || null)} />
          <Input label="Modèle" placeholder="Ex : Prius+" value={criteria.model ?? ''} onChange={(e) => patch('model', e.target.value || null)} />
        </div>
      </Section>

      <Section title="Année">
        <div className={styles.row2}>
          <Input label="Min" type="number" min="1990" max={currentYear} value={criteria.yearMin ?? ''} onChange={(e) => patch('yearMin', toNumber(e.target.value))} />
          <Input label="Max" type="number" min="1990" max={currentYear} value={criteria.yearMax ?? ''} onChange={(e) => patch('yearMax', toNumber(e.target.value))} />
        </div>
      </Section>

      <Section title="Kilométrage">
        <div className={styles.row2}>
          <Input label="Min (km)" type="number" min="0" step="1000" value={criteria.mileageMin ?? ''} onChange={(e) => patch('mileageMin', toNumber(e.target.value))} />
          <Input label="Max (km)" type="number" min="0" step="1000" value={criteria.mileageMax ?? ''} onChange={(e) => patch('mileageMax', toNumber(e.target.value))} />
        </div>
      </Section>

      <Section title="Prix (€)">
        <div className={styles.row2}>
          <Input label="Min" type="number" min="0" step="500" value={criteria.priceMin ?? ''} onChange={(e) => patch('priceMin', toNumber(e.target.value))} />
          <Input label="Max" type="number" min="0" step="500" value={criteria.priceMax ?? ''} onChange={(e) => patch('priceMax', toNumber(e.target.value))} />
        </div>
      </Section>

      <Section title="Carburant">
        <ChipGroup
          items={FUELS}
          selected={criteria.fuel || []}
          onToggle={(id) => toggleArray('fuel', id)}
        />
      </Section>

      <Section title="Boîte de vitesse">
        <ChipGroup
          items={TRANSMISSIONS}
          selected={criteria.transmission || []}
          onToggle={(id) => toggleArray('transmission', id)}
        />
      </Section>

      <Section title="Pays">
        <ChipGroup
          items={COUNTRIES.map((c) => ({ id: c.code, label: c.label }))}
          selected={criteria.countries || []}
          onToggle={(id) => toggleArray('countries', id)}
        />
      </Section>

      <Section title="Sources">
        <ChipGroup
          items={SOURCES_META.map((s) => ({ id: s.id, label: s.label }))}
          selected={criteria.sources || []}
          onToggle={(id) => toggleArray('sources', id)}
        />
      </Section>

      <Section title="Options">
        <label className={styles.checkRow}>
          <input type="checkbox" checked={!!criteria.firstHandOnly} onChange={(e) => patch('firstHandOnly', e.target.checked || null)} />
          Première main uniquement
        </label>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={!!criteria.importFriendly} onChange={(e) => patch('importFriendly', e.target.checked || null)} />
          Mode import (frais d'import estimés)
        </label>
      </Section>
    </Card>
  );
}

function Section({ title, children }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionTitle}>{title}</div>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

function ChipGroup({ items, selected, onToggle }) {
  return (
    <div className={styles.chips}>
      {items.map((item) => {
        const on = selected.includes(item.id);
        return (
          <button
            key={item.id}
            type="button"
            className={[styles.chip, on ? styles.chipOn : ''].join(' ')}
            onClick={() => onToggle(item.id)}
            aria-pressed={on}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
