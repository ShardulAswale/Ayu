/**
 * Legacy/imported MongoDB recipes may have structured ingredient objects.
 * React cannot render objects as children, so convert only for display.
 * Never mutate or stringify a recipe before the user chooses to edit it.
 */
function ingredientText(value) {
  if (typeof value === 'string') return value.trim();
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object' || Array.isArray(value)) return '';
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const amount = typeof value.quantity === 'number' || typeof value.quantity === 'string'
    ? String(value.quantity).trim() : '';
  const unit = typeof value.unit === 'string' ? value.unit.trim() : '';
  if (!name) return 'Ingredient details unavailable';
  return amount || unit ? name + ' (' + [amount, unit].filter(Boolean).join(' ') + ')' : name;
}

export function formatRecipeIngredients(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const text = value.map(item => typeof item === 'string' ? item : ingredientText(item))
      .filter(Boolean).join(', ');
    return text || 'Ingredients not specified';
  }
  if (value && typeof value === 'object') return ingredientText(value);
  return 'Ingredients not specified';
}

export function displayText(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(item => typeof item === 'string'
    ? item : ingredientText(item)).filter(Boolean).join(', ');
  if (value && typeof value === 'object') return ingredientText(value);
  return '';
}
