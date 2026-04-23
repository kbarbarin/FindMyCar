import { useState, useMemo } from 'react';
import styles from './CarImage.module.css';

// Image d'annonce avec fallback local : si le src est absent ou 404,
// on affiche une vignette SVG stylée avec la marque + modèle.
// Objectif : aucune dépendance réseau pour que le site reste utilisable offline.
export default function CarImage({ src, alt, make, model, className = '' }) {
  const [failed, setFailed] = useState(false);
  const label = [make, model].filter(Boolean).join(' ') || 'Véhicule';

  // Palette déterministe à partir d'un hash du label → chaque modèle a "sa" couleur.
  const hue = useMemo(() => {
    let h = 0;
    for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
    return h % 360;
  }, [label]);

  const showFallback = !src || failed;

  return (
    <div className={[styles.wrap, className].filter(Boolean).join(' ')}>
      <div
        className={styles.fallback}
        style={{
          background: `linear-gradient(135deg, hsl(${hue}, 60%, 86%), hsl(${(hue + 40) % 360}, 55%, 72%))`,
        }}
        aria-hidden={!showFallback}
      >
        <svg className={styles.carSvg} viewBox="0 0 120 60" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path
            fill="rgba(11,14,20,0.22)"
            d="M10 42c0-2 1-4 4-4h4l5-13c1-3 4-5 7-5h40c3 0 6 2 7 5l5 13h4c3 0 4 2 4 4v8c0 2-1 3-3 3h-4a7 7 0 0 1-14 0H31a7 7 0 0 1-14 0h-4c-2 0-3-1-3-3v-8Z"
          />
          <circle cx="24" cy="50" r="5" fill="rgba(11,14,20,0.35)" />
          <circle cx="96" cy="50" r="5" fill="rgba(11,14,20,0.35)" />
        </svg>
        <span className={styles.label}>{label}</span>
      </div>

      {src && !failed && (
        <img
          src={src}
          alt={alt || label}
          loading="lazy"
          className={styles.img}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
