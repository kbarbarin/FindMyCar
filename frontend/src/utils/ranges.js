// Helpers pour comparer des plages [min, max] avec des bornes optionnelles.

export function inRange(value, min, max) {
  if (value == null) return false;
  if (min != null && value < min) return false;
  if (max != null && value > max) return false;
  return true;
}

export function isNonEmpty(arr) {
  return Array.isArray(arr) && arr.length > 0;
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
