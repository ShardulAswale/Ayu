export interface IngredientObject {
  name?: string;
  quantity?: number | string;
  unit?: string;
}
export function formatRecipeIngredients(value: unknown): string;
export function displayText(value: unknown): string;
