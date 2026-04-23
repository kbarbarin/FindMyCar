// Formateurs d'affichage. Toujours passer les nombres par ici pour un rendu cohérent.

const priceFormatters = new Map();

export function formatPrice(amount, currency = 'EUR', locale = 'fr-FR') {
  if (amount == null || Number.isNaN(amount)) return '—';
  const key = `${locale}:${currency}`;
  if (!priceFormatters.has(key)) {
    priceFormatters.set(
      key,
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }),
    );
  }
  return priceFormatters.get(key).format(amount);
}

export function formatMileage(km, locale = 'fr-FR') {
  if (km == null || Number.isNaN(km)) return '—';
  return `${new Intl.NumberFormat(locale).format(Math.round(km))} km`;
}

export function formatNumber(n, locale = 'fr-FR') {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat(locale).format(n);
}

export function formatYear(year) {
  if (!year) return '—';
  return String(year);
}

export function formatPowerHp(hp) {
  if (!hp) return '—';
  return `${Math.round(hp)} ch`;
}

export function pluralize(count, singular, plural) {
  return `${count} ${count > 1 ? plural : singular}`;
}
