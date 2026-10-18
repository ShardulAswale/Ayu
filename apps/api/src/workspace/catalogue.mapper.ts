/** Read-only adapter for existing Atlas Foods and Recipes. */
type Doc = Record<string, unknown>;
const object = (v: unknown): Doc => v && typeof v === 'object' && !Array.isArray(v) ? v as Doc : {};
const nonNegative = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v !== 'number' && typeof v !== 'string') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const first = (v: Doc, keys: string[]): number | null => {
  for (const key of keys) {
    const n = nonNegative(v[key]);
    if (n !== null) return n;
  }
  return null;
};
export const escapedSearch = (value: string) => value.replace(/[.*+?^$()|[\]{}\\]/g, '\\$&');
export function nutritionValues(v: unknown) {
  const x = object(v);
  return {
    calories: first(x,['caloriesKcal','energyKcal','calories','kcal','energy_kcal']),
    protein: first(x,['proteinG','protein','protein_g']),
    carbs: first(x,['carbsG','carbohydrateG','carbohydratesG','carbs','carbohydrates','carbohydrate','carbs_g']),
    fat: first(x,['fatG','totalFatG','fat','totalFat','fat_g']),
    fiber: first(x,['fiberG','fibreG','fiber','fibre','dietaryFiberG','fiber_g']),
  };
}
export function recipeForWorkspace(recipe: Doc): Doc {
  const nested = nutritionValues(recipe.nutritionPerServing);
  const legacy = nutritionValues(recipe);
  const nutrient = (key: keyof typeof nested) => nested[key] ?? legacy[key];
  return { ...recipe, id: String(recipe._id), calories: nutrient('calories'),
    protein: nutrient('protein'), carbs: nutrient('carbs'), fat: nutrient('fat'), fiber: nutrient('fiber') };
}
export function foodForWorkspace(food: Doc, tags: Map<string, Doc>): Doc {
  const categoryId = food.categoryId ? String(food.categoryId) : '';
  const category = tags.get(categoryId);
  const ids = Array.isArray(food.tagIds) ? food.tagIds : [];
  const source = object(food.source);
  return {
    id: String(food._id),
    name: typeof food.name === 'string' ? food.name : '',
    foodType: typeof food.foodType === 'string' ? food.foodType : null,
    category: category ? { id: categoryId, slug: category.slug ?? null, label: category.label ?? category.name ?? null } : null,
    tags: ids.map(id => {
      const tag = tags.get(String(id));
      return tag ? { id: String(id), slug: tag.slug ?? null, label: tag.label ?? tag.name ?? null } : null;
    }).filter(Boolean),
    nutritionPer100g: food.nutritionPer100g ?? null,
    nutrients: nutritionValues(food.nutritionPer100g),
    portions: Array.isArray(food.portions) ? food.portions.slice(0, 20) : [],
    source: { canonicalFdcId: source.canonicalFdcId ?? null, dataset: source.dataset ?? null },
  };
}
