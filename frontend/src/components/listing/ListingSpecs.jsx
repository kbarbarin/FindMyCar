import { Calendar, Gauge, Fuel, Cog, Zap, Users, DoorOpen, Palette } from 'lucide-react';
import { formatMileage, formatYear, formatPowerHp } from '../../utils/formatters.js';
import { FUEL_LABEL } from '../../constants/fuels.js';
import { TRANSMISSION_LABEL } from '../../constants/transmissions.js';
import styles from './ListingSpecs.module.css';

export default function ListingSpecs({ listing }) {
  const items = [
    { icon: <Calendar size={16} />, label: 'Année', value: formatYear(listing.year) },
    { icon: <Gauge size={16} />, label: 'Kilométrage', value: formatMileage(listing.mileageKm) },
    { icon: <Fuel size={16} />, label: 'Carburant', value: listing.fuel ? FUEL_LABEL[listing.fuel] : '—' },
    { icon: <Cog size={16} />, label: 'Boîte', value: listing.transmission ? TRANSMISSION_LABEL[listing.transmission] : '—' },
    { icon: <Zap size={16} />, label: 'Puissance', value: formatPowerHp(listing.powerHp) },
    { icon: <Users size={16} />, label: 'Places', value: listing.seats ?? '—' },
    { icon: <DoorOpen size={16} />, label: 'Portes', value: listing.doors ?? '—' },
    { icon: <Palette size={16} />, label: 'Couleur', value: listing.color ?? '—' },
  ];

  return (
    <dl className={styles.grid}>
      {items.map((i) => (
        <div key={i.label} className={styles.item}>
          <dt className={styles.term}>
            <span className={styles.icon}>{i.icon}</span>
            {i.label}
          </dt>
          <dd className={`${styles.value} tabular`}>{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
