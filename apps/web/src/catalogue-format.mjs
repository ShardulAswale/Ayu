/** Never display missing nutrition data as zero. */
export function nutritionLabel(value, unit) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString(undefined,{maximumFractionDigits:1}) + ' ' + unit;
}
